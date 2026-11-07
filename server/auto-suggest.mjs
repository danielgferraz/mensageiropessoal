// Resposta automática do Antigravity: chega mensagem (webhook messages.upsert da Evolution) -> gera RASCUNHO.
// O rascunho vira sugestão para o humano aprovar. Ele só é ENVIADO sozinho quando TODAS as travas abaixo passam;
// qualquer dúvida, falha ou limite deixa a resposta como sugestão. Nunca envia mídia, áudio, figurinha nem para grupos.
//
// Travas do envio automático (sendText é opcional: sem ele nada é enviado):
//  1. COPILOT_ALLOW_AUTOMATIC ligado no servidor (allowAutomatic) e atendente automático, ligado e fora de pausa (config)
//  2. opt-in desta conversa (aiEnabled + autoReply) e ninguém assumiu (mode = suggestion)
//  3. mensagem de origem é texto puro e recente (maxAutoAgeMs); evento não repetido
//  4. rascunho com fonte aprovada (requireSources), aprovado pelo filtro de saída e ainda atual (sem mensagem mais nova)
//  5. janela mínima entre respostas da conversa, limite por conversa/hora e global/hora
//  6. o rascunho é "reservado" (pendente -> aceito) no banco antes de enviar: se foi descartado, não envia; sem reenvio em caso de falha
import { parseUpsert, phoneOf } from './whatsapp-utils.mjs';
import { needsFacts, openingKey, splitBubbles } from './copilot.mjs';

const MAX_SEEN = 1000;
const HOUR = 3600000;
/** Espera depois da ÚLTIMA mensagem do contato (cada mensagem nova reinicia a contagem). Vale para o envio e para a sugestão. */
export const DEFAULT_DEBOUNCE_MS = 6000;

export const AUTO_DEFAULTS = Object.freeze({
  maxAutoAgeMs: 2 * 60 * 1000,      // só responde sozinho a mensagens com até 2 min
  minIntervalMs: 60 * 1000,         // no máximo uma resposta automática por conversa a cada 60 s
  maxPerConvPerHour: 0,             // 0 = sem teto por conversa (decisão do usuário); a janela de 60 s e o global/hora continuam
  maxSendsPerHour: 10,              // global
});

export function createAutoSuggester({ store, getDb, fetchContext, suggest, sendText = null, sendPresence = null, hasSourceFor = null,
  allowAutomatic = false, requireSources = true, factNoSource = 'confirm', presence = {}, getStyleSamples = null, antiRepeat = true,
  bubbleDelayMs = (t) => Math.min(3500, 800 + String(t).length * 40),
  limits = {}, debounceMs = DEFAULT_DEBOUNCE_MS, maxPerHour = 20, maxMessageAgeMs = 10 * 60 * 1000, now = () => Date.now(), log = () => {} }) {
  const lim = { ...AUTO_DEFAULTS, ...limits };
  // "Digitando…": renovado enquanto espera/gera (a presença expira) e SEMPRE encerrado com "paused"; nunca fica preso
  const pres = { tickMs: 2000, renewMs: 8000, maxMs: 150000, ...presence };
  const typing = new Map();          // jid -> { instance, startedAt, lastSent, tick }
  const recentOpenings = [];         // duas primeiras palavras das últimas respostas (todas as conversas): não abrir sempre igual
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const seen = new Map();            // id da mensagem -> true (LRU simples)
  const convs = new Map();           // jid -> { seq, timer, ... }
  const ownSent = new Map();         // id das mensagens que ESTE servidor enviou (eco do webhook não é "humano respondeu")
  const sending = new Map();         // jid -> até quando um envio nosso está em andamento
  const lastSentAt = new Map();      // jid -> instante do último envio automático
  let queue = Promise.resolve();
  let running = 0;

  const audit = (entry) => { try { store.audit({ user: 'webhook-evolution', ...entry }); } catch (e) { log('audit', e.message); } };
  const remember = (map, key, value, max = 500) => { map.set(key, value); if (map.size > max) map.delete(map.keys().next().value); };

  async function optedInJid(db, jids) {
    for (const jid of jids) {
      const state = await db.getConversation(jid);
      if (state.aiEnabled && state.mode === 'suggestion') return { jid, state };
      if (state.aiEnabled && state.mode === 'human') return { jid, state, blocked: 'human_takeover' };
    }
    return null;
  }

  const autoSentSince = (since) => store.readAudit(2000).filter((e) => e.action === 'auto_sent' && Date.parse(e.ts) > since);

  /** Travas que valem ANTES de gerar (e que mantêm o "digitando" ligado). Retorna null se um envio ainda é possível. */
  function gateReason({ entry, state, jid }) {
    if (!sendText || !allowAutomatic) return 'automatic_off';
    const config = store.readConfig();
    if (!config.enabled || config.paused) return 'paused';
    if (config.mode !== 'automatic') return 'mode_suggestion';
    if (!state.autoReply || !state.aiEnabled || state.mode !== 'suggestion') return 'conversation_suggestion_only';
    if (!entry.autoEligible) return entry.allPlain ? 'old_message' : 'not_plain_text';
    if (requireSources && hasSourceFor && !hasSourceFor(entry.text)) return 'no_approved_source';
    // Sem exigir fonte: conversa social segue; pergunta de fato (preço, prazo...) sem trecho só vira "vou confirmar" (factNoSource='confirm') ou sugestão ('suggest')
    if (!requireSources && factNoSource === 'suggest' && hasSourceFor && !hasSourceFor(entry.text) && needsFacts(entry.text)) return 'fact_needs_source';
    const t = now();
    if (t - (lastSentAt.get(jid) || 0) < lim.minIntervalMs) return 'rate_window';
    const last = Date.parse(state.lastAiReplyAt || '') || 0;
    if (t - last < lim.minIntervalMs) return 'rate_window';
    const sent = autoSentSince(t - HOUR);
    if (lim.maxPerConvPerHour > 0 && sent.filter((e) => e.contactId === jid).length >= lim.maxPerConvPerHour) return 'rate_conv';
    if (sent.length >= lim.maxSendsPerHour) return 'rate_global_send';
    return null;
  }

  /** Destino do rascunho: pode enviar sozinho? Soma a trava que depende do resultado (fonte aprovada de fato usada). */
  function autoBlockReason({ entry, again, result, jid }) {
    const why = gateReason({ entry, state: again.state, jid });
    if (why) return why;
    if (requireSources && !(result.sources || []).length) return 'no_approved_source';
    if (!requireSources && factNoSource === 'suggest' && !(result.sources || []).length && needsFacts(entry.text)) return 'fact_needs_source';
    return null;
  }

  const presenceCall = async (jid, instance, state) => {
    if (!sendPresence) return;
    try { await sendPresence({ instance, jid, presence: state, delayMs: state === 'composing' ? pres.renewMs + 2000 : 0 }); }
    catch (e) { log('presence', e.message); }   // presença é cosmética: falhar nunca derruba o fluxo
  };
  function typingStart(jid, instance) {
    if (!sendPresence || typing.has(jid)) return;
    const st = { instance, startedAt: now(), lastSent: now(), tick: null };
    typing.set(jid, st);
    void presenceCall(jid, instance, 'composing');
    st.tick = setInterval(() => { void typingTick(jid, st); }, pres.tickMs);
    st.tick.unref?.();
  }
  async function typingStop(jid) {
    const st = typing.get(jid);
    if (!st) return;
    clearInterval(st.tick);
    typing.delete(jid);
    await presenceCall(jid, st.instance, 'paused');
  }
  async function typingTick(jid, st) {
    if (typing.get(jid) !== st) return;
    if (now() - st.startedAt > pres.maxMs) { await typingStop(jid); return; }
    // Humano assumiu, IA desligada, automático desligado ou atendente pausado durante a espera: aborta e para de "digitar"
    const entry = convs.get(jid);
    let still = false;
    try {
      const db = await getDb();
      const opt = db && entry ? await optedInJid(db, entry.jids) : null;
      still = !!opt && !opt.blocked && !gateReason({ entry, state: opt.state, jid: opt.jid });
    } catch (e) { log('tick', e.message); }
    if (typing.get(jid) !== st) return;
    if (!still) {
      if (entry?.timer) { clearTimeout(entry.timer); convs.delete(jid); }   // ainda esperando: cancela o rascunho também
      await typingStop(jid);
      return;
    }
    if (now() - st.lastSent >= pres.renewMs) { st.lastSent = now(); await presenceCall(jid, st.instance, 'composing'); }
  }

  async function trySend({ db, key, seq, entry, again, result, sug, base }) {
    const jid = again.jid;
    const why = autoBlockReason({ entry, again, result, jid });
    if (why) { audit({ ...base, action: 'auto_skip', code: why, reason: 'Ficou só como sugestão.' }); return; }
    if (convs.get(key)?.seq !== seq) { audit({ ...base, action: 'auto_stale', code: 'newer_message' }); return; }
    // Reserva atômica: se o rascunho foi descartado (mensagem nova, humano respondeu), não envia.
    const claimed = sug?.id ? await db.resolveSuggestion(sug.id, 'accepted') : null;
    if (!claimed) { audit({ ...base, action: 'auto_stale', code: 'draft_discarded' }); return; }
    sending.set(jid, now() + 30000);
    const parts = splitBubbles(String(result.draft)).slice(0, 2);
    const ids = [];
    try {
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) await sleep(bubbleDelayMs(parts[i]));       // pausa de digitação entre as duas bolhas (o "digitando" continua ligado)
        const sent = await sendText({ instance: entry.instance, jid, text: parts[i] });
        const messageId = sent?.id || null;
        ids.push(messageId);
        if (messageId) remember(ownSent, messageId, now());
        lastSentAt.set(jid, now());
        await db.recordSent(jid, messageId, 'ia').catch((e) => log('recordSent', e.message));
      }
      await typingStop(jid);   // a mensagem chegou: encerra o "digitando"
      audit({ ...base, action: 'auto_sent', code: 'ok', suggestionId: sug.id, messageId: ids[0] ?? null, messageIds: ids, bubbles: parts.length, length: String(result.draft).length, sources: (result.sources || []).map((s) => s.source) });
    } catch (e) {
      // Sem reenvio automático (evita duplicar). O que NÃO foi enviado volta como sugestão para o humano decidir.
      audit({ ...base, action: 'auto_send_failed', code: 'send_error', sentBubbles: ids.length, reason: 'Falha ao enviar; deixei o restante como sugestão.' });
      log('send', e.message);
      const rest = parts.slice(ids.length).join('\n\n');
      if (rest) await db.recordReplySuggestion(jid, rest.slice(0, 10000), { sourceMessageId: entry.id, auto: true }).catch(() => {});
    } finally { sending.set(jid, now() + 5000); }   // janela curta para o eco do webhook da própria mensagem
  }

  async function generate(key, seq) {
    const entry = convs.get(key);
    if (!entry || entry.seq !== seq) return;               // chegou mensagem mais nova: esta rodada é velha
    const db = await getDb();
    const { jid, instance, jids } = entry;
    const base = { contactId: jid, sourceMessageId: entry.id };
    try {
      const opt = await optedInJid(db, jids);
      if (!opt || opt.blocked) { audit({ ...base, action: 'auto_skip', code: opt?.blocked || 'conversation_off' }); return; }

      let messages = [];
      try { messages = await fetchContext({ instance, jids, limit: 20 }); } catch (e) { log('context', e.message); }
      messages = messages.slice(-20).map((m) => ({ fromMe: !!m.fromMe, text: m.text }));
      // Todas as mensagens da rajada entram, mesmo que a Evolution ainda não as tenha gravado
      for (const text of entry.texts || [entry.text]) if (!messages.some((m) => !m.fromMe && m.text === text)) messages.push({ fromMe: false, text });

      const hourAgo = now() - HOUR;
      if (store.recentDrafts(now()).filter((d) => d.at > hourAgo).length >= maxPerHour) {
        audit({ ...base, action: 'auto_skip', code: 'rate_global', reason: 'Limite de rascunhos automáticos por hora atingido.' });
        return;
      }

      const result = await suggest({
        contactId: opt.jid, isSaved: true, isGroup: false, optIn: true, noContactLimit: true, labelIds: [],
        contactPhone: phoneOf(jids.find((j) => phoneOf(j)) || opt.jid), messages, lastIncoming: entry.text,
        styleSamples: getStyleSamples ? getStyleSamples() : [], avoidOpenings: antiRepeat ? recentOpenings.slice(-10) : [],
      });
      if (!result?.draft) return;                           // bloqueado/encaminhado/falhou: suggestReply já auditou; nada é enviado
      const opening = openingKey(splitBubbles(result.draft)[0] || '');
      if (opening && antiRepeat) { recentOpenings.push(opening); if (recentOpenings.length > 20) recentOpenings.shift(); }

      if (convs.get(key)?.seq !== seq) { audit({ ...base, action: 'auto_stale', code: 'newer_message', reason: 'Rascunho descartado: chegou mensagem nova.' }); return; }
      const again = await optedInJid(db, jids);
      if (!again || again.blocked) { audit({ ...base, action: 'auto_stale', code: again?.blocked || 'conversation_off', reason: 'Rascunho descartado: controle da conversa mudou.' }); return; }
      const sug = await db.recordReplySuggestion(again.jid, String(result.draft).slice(0, 10000), { sourceMessageId: entry.id, auto: true });
      audit({ ...base, action: 'auto_suggestion', code: 'ok', suggestionId: sug?.id ?? null, length: String(result.draft).length });
      await trySend({ db, key, seq, entry, again, result, sug, base });
    } catch (e) {
      audit({ ...base, action: 'auto_error', code: 'error', reason: 'Falha ao gerar o rascunho automático.' });
      log('generate', e.message);
    } finally {
      // Terminou (enviou, caiu para sugestão, abortou ou falhou): para de "digitar", a menos que já haja uma rodada mais nova esperando
      if (convs.get(key)?.seq === seq) await typingStop(jid);
    }
  }

  function schedule(key, entry) {
    const prev = convs.get(key);
    if (prev?.timer) clearTimeout(prev.timer);
    const seq = (prev?.seq || 0) + 1;
    // Uma única resposta para a rajada: acumula os textos e só vale como "texto puro recente" se todos forem
    const next = { ...entry, seq, timer: null, texts: [...(prev?.texts || []), entry.text].slice(-10), allPlain: (prev ? prev.allPlain : true) && entry.plain };
    next.autoEligible = entry.autoEligible && next.allPlain;
    next.timer = setTimeout(() => {
      next.timer = null;
      running++;
      queue = queue.then(() => generate(key, seq)).catch(() => {}).finally(() => {
        running--;
        const cur = convs.get(key);
        if (cur && cur.seq === seq && !cur.timer) convs.delete(key);
      });
    }, debounceMs);
    convs.set(key, next);
  }

  async function onOutgoing(db, msg) {
    // Eco de uma mensagem que nós mesmos enviamos (ou envio em andamento): não é "humano respondeu".
    if (ownSent.has(msg.id) || msg.jids.some((j) => (sending.get(j) || 0) > now())) return;
    for (const jid of msg.jids) {
      await db.dismissPendingReplies(jid, 'human_replied', 'humano').catch((e) => log('dismiss', e.message));
      // Humano respondeu: a conversa volta sozinha para "só sugestão"
      const paused = await db.pauseAutoReply?.(jid, 'human_replied', 'humano').catch((e) => { log('pause', e.message); return false; });
      if (paused) audit({ contactId: jid, action: 'auto_paused', code: 'human_replied', reason: 'Humano respondeu: resposta automática pausada nesta conversa.' });
    }
  }

  async function handleMessage(msg) {
    if (msg.isGroup || msg.jids.some((j) => j.endsWith('@broadcast'))) return;
    const db = await getDb();
    if (!db) return;
    if (msg.fromMe) { await onOutgoing(db, msg); return; }
    if (!msg.text) return;                                  // áudio, figurinha, mídia sem legenda
    const age = msg.atMs ? now() - msg.atMs : 0;
    if (age > maxMessageAgeMs) return;                      // sincronização de histórico, não mensagem nova
    if (seen.has(msg.id)) return;
    remember(seen, msg.id, true, MAX_SEEN);

    const opt = await optedInJid(db, msg.jids);
    if (!opt) return;                                       // conversa sem sugestões ligadas: nada a fazer
    await db.dismissPendingReplies(opt.jid, 'new_message').catch((e) => log('dismiss', e.message));
    if (opt.blocked) return;                                // humano assumiu: não gera
    const entry = { id: msg.id, text: msg.text, instance: msg.instance, jids: msg.jids, jid: opt.jid,
      plain: !!msg.plain, autoEligible: !!msg.plain && age <= lim.maxAutoAgeMs };
    schedule(opt.jid, entry);
    // "Digitando…" começa junto com a contagem, só se uma resposta automática ainda é possível; senão garante que está apagado
    const next = convs.get(opt.jid);
    if (!gateReason({ entry: next, state: opt.state, jid: opt.jid })) typingStart(opt.jid, msg.instance);
    else await typingStop(opt.jid);
  }

  return {
    /** Processa o corpo de um webhook. Rápido: só agenda; o rascunho (e o envio, se permitido) vem depois do debounce. */
    async handleWebhook(payload) {
      const messages = parseUpsert(payload);
      for (const msg of messages) {
        try { await handleMessage(msg); } catch (e) { log('webhook', e.message); }
      }
      return { received: messages.length };
    },
    async whenIdle() {
      while (convs.size || running) await new Promise((r) => setTimeout(r, 5));
      await queue;
      while (typing.size) await new Promise((r) => setTimeout(r, 5));
    },
    pending: () => convs.size,
    typingNow: () => [...typing.keys()],
  };
}
