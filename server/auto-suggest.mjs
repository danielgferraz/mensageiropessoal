// Sugestão AUTOMÁTICA de resposta: chega mensagem (webhook messages.upsert da Evolution) -> gera RASCUNHO.
// Regra central: este módulo nunca envia mensagem ao WhatsApp. Só grava uma sugestão pendente para o humano aprovar.
import { parseUpsert, phoneOf } from './whatsapp-utils.mjs';

const MAX_SEEN = 1000;

/**
 * deps:
 *  - store: createStore() do copilot (config + auditoria + recentDrafts)
 *  - getDb(): Promise<db|null> do banco isolado do Mensageiro
 *  - fetchContext({ instance, jids, limit }): últimas mensagens [{ fromMe, text }] (pode falhar; há fallback)
 *  - suggest(request): suggestReply já ligado ao modelo (retorna { draft, blocked, code, reason, sources })
 */
export function createAutoSuggester({ store, getDb, fetchContext, suggest, debounceMs = 4000, maxPerHour = 20,
  maxMessageAgeMs = 10 * 60 * 1000, now = () => Date.now(), log = () => {} }) {
  const seen = new Map();            // id da mensagem -> true (LRU simples, evita processar o mesmo evento duas vezes)
  const convs = new Map();           // chave da conversa -> { seq, timer, text, instance, jids, jid }
  let queue = Promise.resolve();     // gera um rascunho por vez (o modelo é lento e caro)
  let running = 0;

  const audit = (entry) => { try { store.audit({ user: 'webhook-evolution', ...entry }); } catch (e) { log('audit', e.message); } };

  async function optedInJid(db, jids) {
    for (const jid of jids) {
      const state = await db.getConversation(jid);
      if (state.aiEnabled && state.mode === 'suggestion') return { jid, state };
      if (state.aiEnabled && state.mode === 'human') return { jid, state, blocked: 'human_takeover' };
    }
    return null;
  }

  async function generate(key, seq) {
    const entry = convs.get(key);
    if (!entry || entry.seq !== seq) return;               // chegou mensagem mais nova: esta rodada é velha
    const db = await getDb();
    const { jid, instance, jids } = entry;
    const base = { contactId: jid, sourceMessageId: entry.id };
    try {
      // Reconfere o controle por conversa (pode ter sido desligado ou assumido durante o debounce)
      const opt = await optedInJid(db, jids);
      if (!opt || opt.blocked) { audit({ ...base, action: 'auto_skip', code: opt?.blocked || 'conversation_off' }); return; }

      let messages = [];
      try { messages = await fetchContext({ instance, jids, limit: 20 }); } catch (e) { log('context', e.message); }
      messages = messages.slice(-20).map((m) => ({ fromMe: !!m.fromMe, text: m.text }));
      // O texto que disparou o webhook sempre entra, mesmo que a Evolution ainda não o tenha gravado
      if (!messages.some((m) => !m.fromMe && m.text === entry.text)) messages.push({ fromMe: false, text: entry.text });
      const incomingText = entry.text;

      const hourAgo = now() - 3600000;
      if (store.recentDrafts(now()).filter((d) => d.at > hourAgo).length >= maxPerHour) {
        audit({ ...base, action: 'auto_skip', code: 'rate_global', reason: 'Limite de rascunhos automáticos por hora atingido.' });
        return;
      }

      const result = await suggest({
        contactId: opt.jid, isSaved: true, isGroup: false, optIn: true, labelIds: [],
        contactPhone: phoneOf(jids.find((j) => phoneOf(j)) || opt.jid), messages, lastIncoming: incomingText,
      });
      if (!result?.draft) return;                           // bloqueado/encaminhado: suggestReply já auditou o motivo

      if (convs.get(key)?.seq !== seq) { audit({ ...base, action: 'auto_stale', code: 'newer_message', reason: 'Rascunho descartado: chegou mensagem nova.' }); return; }
      const again = await optedInJid(db, jids);
      if (!again || again.blocked) { audit({ ...base, action: 'auto_stale', code: again?.blocked || 'conversation_off', reason: 'Rascunho descartado: controle da conversa mudou.' }); return; }
      const sug = await db.recordReplySuggestion(again.jid, String(result.draft).slice(0, 10000), { sourceMessageId: entry.id, auto: true });
      audit({ ...base, action: 'auto_suggestion', code: 'ok', suggestionId: sug?.id ?? null, length: String(result.draft).length });
    } catch (e) {
      audit({ ...base, action: 'auto_error', code: 'error', reason: 'Falha ao gerar o rascunho automático.' });
      log('generate', e.message);
    }
  }

  function schedule(key, entry) {
    const prev = convs.get(key);
    if (prev?.timer) clearTimeout(prev.timer);
    const seq = (prev?.seq || 0) + 1;
    const next = { ...entry, seq, timer: null };
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

  async function handleMessage(msg) {
    if (msg.isGroup || msg.jids.some((j) => j.endsWith('@broadcast'))) return;
    const db = await getDb();
    if (!db) return;
    if (msg.fromMe) {
      // Alguém (você, pelo celular ou pelo app) respondeu: o rascunho pendente ficou velho. Nunca gera nada aqui.
      for (const jid of msg.jids) await db.dismissPendingReplies(jid, 'human_replied', 'humano').catch((e) => log('dismiss', e.message));
      return;
    }
    if (!msg.text) return;                                  // áudio, figurinha, mídia sem legenda
    if (msg.atMs && now() - msg.atMs > maxMessageAgeMs) return; // sincronização de histórico, não mensagem nova
    if (seen.has(msg.id)) return;
    seen.set(msg.id, true);
    if (seen.size > MAX_SEEN) seen.delete(seen.keys().next().value);

    const opt = await optedInJid(db, msg.jids);
    if (!opt) return;                                       // conversa sem sugestões ligadas: nada a fazer
    // Mensagem nova torna velho qualquer rascunho pendente, mesmo antes de gerar o próximo
    await db.dismissPendingReplies(opt.jid, 'new_message').catch((e) => log('dismiss', e.message));
    if (opt.blocked) return;                                // humano assumiu: não gera
    schedule(opt.jid, { id: msg.id, text: msg.text, instance: msg.instance, jids: msg.jids, jid: opt.jid });
  }

  return {
    /** Processa o corpo de um webhook. Rápido: só agenda; o rascunho é gerado depois do debounce. */
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
    },
    pending: () => convs.size,
  };
}
