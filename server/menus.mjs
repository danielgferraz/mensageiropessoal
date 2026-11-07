// Menus/botões do Mensageiro: validação, renderização (nativo e texto numerado), escolha e roteador de sessões.
// O menu SÓ sai quando o administrador envia numa conversa; as respostas aos cliques são determinísticas (sem modelo).
// Modo nativo (botão/lista da Evolution) pode falhar em silêncio no Baileys: erro explícito cai para texto numerado, sem duplicar.

export const ACTION_TYPES = ['reply', 'ask', 'crm', 'note', 'handoff', 'goto'];
export const RENDER_MODES = ['native', 'text'];
export const FIELD_LABELS = { name: 'nome', email: 'e-mail', city: 'cidade', service: 'tipo de serviço' };
export const LIMITS = Object.freeze({ items: 10, label: 40, nativeLabel: 20, text: 1000, aliases: 5, alias: 30, actions: 6, name: 60,
  description: 600, footer: 60, prompt: 300, note: 500, stage: 64, gotoChain: 5, attempts: 2, sendsPerInput: 4, ttlMs: 30 * 60 * 1000 });

const norm = (t) => String(t ?? '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const CLOSERS = ['Me responde com o número ou o nome da opção.', 'Pode mandar o número ou o nome da opção.', 'É só mandar o número (ou o nome da opção).', 'Manda o número aí, ou o nome da opção.'];
const NATIVE_HINTS = ['Escolhe uma:', 'Toca numa opção:', 'Qual dessas?'];
// Jeito de URA corporativa: o editor só avisa (não bloqueia), para o menu ter tom de conversa
const CORPORATE = /\b(digite|tecle|pressione|aperte) \d|\bpara (atendimento|vendas|suporte|financeiro|reclamacoes)\b|prezad|como posso ajudar|em que posso ajudar|bem-vind|central de atendimento|menu principal|opcao invalida|sua ligacao/;

// ---------- validação ----------

function validateAction(a, i, errors) {
  const where = `ação ${i + 1}`;
  if (!a || typeof a !== 'object' || !ACTION_TYPES.includes(a.type)) { errors.push(`${where}: tipo inválido.`); return null; }
  const out = { type: a.type };
  if (a.type === 'reply') {
    out.text = str(a.text);
    if (!out.text || out.text.length > LIMITS.text) errors.push(`${where}: texto de 1 a ${LIMITS.text} caracteres.`);
  } else if (a.type === 'ask') {
    out.field = norm(a.field).replace(/[^a-z_]/g, '');
    if (!/^[a-z_]{1,30}$/.test(out.field)) errors.push(`${where}: campo inválido (use letras minúsculas e _).`);
    out.prompt = str(a.prompt);
    if (!out.prompt || out.prompt.length > LIMITS.prompt) errors.push(`${where}: pergunta de 1 a ${LIMITS.prompt} caracteres.`);
    out.validate = a.validate === 'email' || out.field === 'email' ? 'email' : 'text';
  } else if (a.type === 'crm') {
    out.stage = str(a.stage) || null;
    out.note = str(a.note) || null;
    if (!out.stage && !out.note) errors.push(`${where}: informe o estágio e/ou a nota.`);
    if (out.stage && out.stage.length > LIMITS.stage) errors.push(`${where}: estágio longo demais.`);
    if (out.note && out.note.length > LIMITS.note) errors.push(`${where}: nota longa demais.`);
  } else if (a.type === 'note') {
    out.text = str(a.text);
    if (!out.text || out.text.length > LIMITS.note) errors.push(`${where}: nota de 1 a ${LIMITS.note} caracteres.`);
  } else if (a.type === 'handoff') {
    out.message = str(a.message) || null;
    if (out.message && out.message.length > LIMITS.prompt) errors.push(`${where}: mensagem longa demais.`);
  } else if (a.type === 'goto') {
    out.menu_id = Number(a.menu_id);
    if (!Number.isInteger(out.menu_id) || out.menu_id <= 0) errors.push(`${where}: escolha o menu de destino.`);
  }
  return out;
}

/** Valida a lista completa e ordenada de botões. `position` é sempre reescrito (1..n). */
export function validateItems(input) {
  const errors = [];
  const warnings = [];
  const list = Array.isArray(input) ? input : [];
  if (!list.length) errors.push('Adicione ao menos um botão.');
  if (list.length > LIMITS.items) errors.push(`No máximo ${LIMITS.items} botões por menu.`);
  const seen = new Set();
  const items = list.slice(0, LIMITS.items).map((raw, index) => {
    const label = str(raw?.label);
    const prefix = `Botão ${index + 1}`;
    if (!label || label.length > LIMITS.label) errors.push(`${prefix}: rótulo de 1 a ${LIMITS.label} caracteres.`);
    if (seen.has(norm(label))) errors.push(`${prefix}: rótulo repetido.`);
    seen.add(norm(label));
    const aliases = [...new Set((Array.isArray(raw?.aliases) ? raw.aliases : []).map(str).filter(Boolean))].slice(0, LIMITS.aliases);
    if (aliases.some((a) => a.length > LIMITS.alias)) errors.push(`${prefix}: apelido longo demais.`);
    const actionsIn = Array.isArray(raw?.actions) ? raw.actions : [];
    if (!actionsIn.length || actionsIn.length > LIMITS.actions) errors.push(`${prefix}: de 1 a ${LIMITS.actions} ações.`);
    const actions = actionsIn.slice(0, LIMITS.actions).map((a, i) => validateAction(a, i, errors)).filter(Boolean);
    actions.forEach((a, i) => { if ((a.type === 'goto' || a.type === 'handoff') && i !== actions.length - 1) errors.push(`${prefix}: "${a.type === 'goto' ? 'ir para outro menu' : 'chamar humano'}" precisa ser a última ação.`); });
    if (label.length > LIMITS.nativeLabel) warnings.push(`${prefix}: rótulo com mais de ${LIMITS.nativeLabel} caracteres será cortado no botão nativo.`);
    if (CORPORATE.test(norm(label))) warnings.push(`${prefix}: rótulo com jeito de URA corporativa; prefira algo de conversa ("Ver os serviços").`);
    return { id: raw?.id ? Number(raw.id) || null : null, position: index + 1, label, aliases, actions, active: raw?.active !== false };
  });
  return { ok: errors.length === 0, errors, warnings, items };
}

export function validateMenu(input) {
  const errors = [];
  const warnings = [];
  const name = str(input?.name);
  const description = str(input?.description);
  const footer = str(input?.footer);
  const render_mode = input?.render_mode === undefined ? 'text' : input.render_mode;   // padrão de fábrica: texto numerado (o nativo é opção por menu)
  if (!name || name.length > LIMITS.name) errors.push(`Nome interno de 1 a ${LIMITS.name} caracteres.`);
  if (!description || description.length > LIMITS.description) errors.push(`Texto de abertura de 1 a ${LIMITS.description} caracteres.`);
  if (footer.length > LIMITS.footer) errors.push(`Rodapé de até ${LIMITS.footer} caracteres.`);
  if (!RENDER_MODES.includes(render_mode)) errors.push('Modo de envio inválido.');
  if (CORPORATE.test(norm(description))) warnings.push('O texto de abertura soa como URA corporativa; escreva como numa conversa ("Me conta o que você precisa:").');
  return { ok: errors.length === 0, errors, warnings, value: { name, description, footer: footer || null, render_mode, active: input?.active !== false } };
}

/** Procura ciclo e cadeia longa de "ir para outro menu". `graph`: Map(menuId -> [destinos]). Retorna texto do problema ou null. */
export function gotoProblem(graph) {
  const state = new Map();
  let longest = 0;
  const visit = (id, depth) => {
    if (state.get(id) === 'open') return true;
    longest = Math.max(longest, depth);
    if (state.get(id) === 'done') return false;
    state.set(id, 'open');
    for (const next of graph.get(id) || []) if (visit(next, depth + 1)) return true;
    state.set(id, 'done');
    return false;
  };
  for (const id of graph.keys()) if (visit(id, 1)) return 'Os menus se encadeiam em círculo (um leva ao outro).';
  return longest > LIMITS.gotoChain ? `Encadeamento longo demais (máximo de ${LIMITS.gotoChain} menus seguidos).` : null;
}
export const gotoTargets = (items) => items.flatMap((i) => (i.actions || []).filter((a) => a.type === 'goto').map((a) => Number(a.menu_id)));

// ---------- renderização ----------

export const activeItems = (items) => [...(items || [])].filter((i) => i.active !== false).sort((a, b) => a.position - b.position);

export const renderLines = (items) => activeItems(items).map((it, i) => `${i + 1} - ${it.label}`).join('\n');

/** Menu numerado em texto, com tom de conversa. É o que a prévia mostra e o que vai no modo texto. */
export function renderText(menu, items) {
  const closer = CLOSERS[Math.abs(Number(menu.id) || 0) % CLOSERS.length];
  return `${menu.description}\n\n${renderLines(items)}\n\n${closer}`;
}

/** O que seria enviado pela Evolution no modo nativo: até 3 opções = botões de resposta; mais que isso = lista. */
export function nativePlan(menu, items) {
  const list = activeItems(items);
  const idOf = (it) => `m:${menu.id}:${it.id}`;
  const first = menu.description.split('\n')[0].slice(0, 60);
  const hint = NATIVE_HINTS[Math.abs(Number(menu.id) || 0) % NATIVE_HINTS.length];
  if (list.length <= 3) {
    return { kind: 'buttons', body: { title: first, description: menu.description.length > first.length ? menu.description.slice(first.length).trim() || hint : hint,
      footer: menu.footer || undefined, buttons: list.map((it) => ({ type: 'reply', displayText: it.label.slice(0, LIMITS.nativeLabel), id: idOf(it) })) } };
  }
  return { kind: 'list', body: { title: first, description: menu.description.length > first.length ? menu.description.slice(first.length).trim() || hint : hint,
    buttonText: 'Ver opções', footerText: menu.footer || ' ',
    sections: [{ title: 'Opções', rows: list.map((it) => ({ title: it.label.slice(0, 24), description: ' ', rowId: idOf(it) })) }] } };
}

const FIELD_ALIASES = { nome: 'name', servico: 'service', cidade: 'city' };
export function renderTemplate(text, collected = {}) {
  const resumo = Object.entries(collected).map(([k, v]) => `${FIELD_LABELS[k] || k}: ${v}`).join(', ');
  return String(text ?? '').replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key) => {
    const k = key.toLowerCase();
    if (k === 'resumo') return resumo;
    return collected[FIELD_ALIASES[k] || k] ?? '';
  }).replace(/[ \t]+\n/g, '\n').trim();
}

// ---------- escolha ----------

export function parseButtonId(id, menuId) {
  const m = /^m:(\d+):(\d+)$/.exec(String(id || ''));
  return m && Number(m[1]) === Number(menuId) ? Number(m[2]) : null;
}

/** Número ("1", "1.", "opção 1", "1️⃣"), rótulo ou apelido. Só vale a mensagem INTEIRA; "2 dias" não é a opção 2. */
export function matchChoice(text, items) {
  const list = activeItems(items);
  const t = norm(String(text ?? '').replace(/[⃣️]/g, ''));
  if (!t) return null;
  const num = /^(?:opcao|opc|numero|n[o°º.]?)?\s*(\d{1,2})\s*[.)\-:]?$/.exec(t);
  if (num) return list[Number(num[1]) - 1] || null;
  return list.find((it) => norm(it.label) === t || (it.aliases || []).some((a) => norm(a) === t)) || null;
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
export function validateField(value, kind) {
  const v = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!v || v.length > 120) return null;
  if (kind === 'email') return EMAIL.test(v) ? v : null;
  return v;
}

// ---------- roteador ----------

/**
 * deps: store (menus), getDb() (banco de estado: CRM, notas, assumir), sendText({instance,jid,text}) -> {id},
 * sendNative({instance,jid,plan}) -> {id} (opcional), nativeEnabled, registry (ids enviados por nós), audit(entry), now().
 */
export function createMenuRouter({ store, getDb, sendText, sendNative = null, nativeEnabled = false, registry, audit = () => {}, now = () => Date.now(), ttlMs = LIMITS.ttlMs, log = () => {} }) {
  const locks = new Map();
  const withLock = (jid, fn) => {
    const prev = locks.get(jid) || Promise.resolve();
    const next = prev.catch(() => {}).then(fn);
    locks.set(jid, next);
    next.finally(() => { if (locks.get(jid) === next) locks.delete(jid); }).catch(() => {});
    return next;
  };

  async function send(ctx, text) {
    if (ctx.sends >= LIMITS.sendsPerInput) return null;
    ctx.sends++;
    const sent = await sendText({ instance: ctx.instance, jid: ctx.jid, text });
    if (sent?.id) registry?.add(sent.id);
    registry?.markSending?.(ctx.jid, now() + 5000);
    const db = await getDb();
    await db?.recordSent?.(ctx.jid, sent?.id || null, 'humano').catch((e) => log('recordSent', e.message));
    return sent;
  }

  async function sendMenu({ jid, instance, menuId, mode, by = null, depth = 0, ctx = { sends: 0 } }) {
    const menu = await store.getMenu(menuId);
    if (!menu || !menu.active) throw Object.assign(new Error('Menu inexistente ou desativado.'), { statusCode: 404 });
    const items = activeItems(menu.items);
    if (!items.length) throw Object.assign(new Error('O menu não tem botões ativos.'), { statusCode: 400 });
    const requested = mode || menu.render_mode;
    let modeUsed = 'text', fallback = false, errorKind = null, first = null;
    if (requested === 'native' && nativeEnabled && sendNative) {
      try {
        first = await sendNative({ instance, jid, plan: nativePlan(menu, items) });
        modeUsed = 'native';
        if (first?.id) registry?.add(first.id);
        registry?.markSending?.(jid, now() + 5000);
      } catch (e) {
        fallback = true; errorKind = 'native_error'; log('native', e.message);   // erro explícito: cai para texto, sem duplicar (nada foi entregue)
      }
    } else if (requested === 'native') { fallback = true; errorKind = nativeEnabled ? 'native_unavailable' : 'native_disabled'; }
    if (modeUsed === 'text') first = await send({ ...ctx, jid, instance }, renderText(menu, items));
    const db = await getDb();
    if (modeUsed === 'native') await db?.recordSent?.(jid, first?.id || null, 'humano').catch(() => {});
    const expiresAt = new Date(now() + ttlMs).toISOString();
    await store.saveSession({ jid, menu_id: menu.id, item_id: null, step: 0, awaiting: 'choice', field: null, attempts: 0, collected: {}, mode_used: modeUsed, started_by: by, expires_at: expiresAt });
    audit({ action: 'menu_sent', menuId: menu.id, modeRequested: requested, modeUsed, fallback, ...(errorKind ? { reason: errorKind } : {}), items: items.length, contactId: jid, by, depth });
    return { modeUsed, modeRequested: requested, fallback, reason: errorKind, expiresAt, nativeUnconfirmed: modeUsed === 'native' };
  }

  async function finish(session, reason) { await store.deleteSession(session.jid); audit({ action: reason, menuId: session.menu_id, contactId: session.jid }); }

  async function runActions(ctx, session, item, startAt) {
    const db = await getDb();
    const actions = item.actions || [];
    for (let i = startAt; i < actions.length; i++) {
      const a = actions[i];
      if (a.type === 'reply') await send(ctx, renderTemplate(a.text, session.collected));
      else if (a.type === 'ask') {
        await send(ctx, a.prompt);
        await store.saveSession({ ...session, item_id: item.id, step: i + 1, awaiting: 'field', field: a.field, attempts: 0, expires_at: new Date(now() + ttlMs).toISOString() });
        return;
      } else if (a.type === 'crm') {
        if (a.stage) await db.setCrmStage(session.jid, a.stage, 'humano');
        if (a.note) await db.addNote(session.jid, 'humano', renderTemplate(a.note, session.collected).slice(0, 8000));
        audit({ action: 'menu_crm', menuId: session.menu_id, contactId: session.jid, stage: a.stage || null, note: !!a.note });
      } else if (a.type === 'note') {
        await db.addNote(session.jid, 'humano', renderTemplate(a.text, session.collected).slice(0, 8000));
      } else if (a.type === 'handoff') {
        await db.updateConversation(session.jid, { mode: 'human' }, 'humano');
        await db.dismissPendingReplies?.(session.jid, 'menu_handoff', 'humano').catch(() => {});
        if (a.message) await send(ctx, renderTemplate(a.message, session.collected));
        audit({ action: 'menu_handoff', menuId: session.menu_id, contactId: session.jid });
      } else if (a.type === 'goto') {
        await store.deleteSession(session.jid);
        await sendMenu({ jid: session.jid, instance: ctx.instance, menuId: a.menu_id, by: session.started_by, ctx });
        return;
      }
    }
    await finish(session, 'menu_done');
  }

  async function handleIncomingLocked(msg, session) {
    const ctx = { sends: 0, jid: session.jid, instance: msg.instance };
    if (Date.parse(session.expires_at) <= now()) { await finish(session, 'menu_expired'); return { handled: false }; }
    const menu = await store.getMenu(session.menu_id);
    if (!menu) { await store.deleteSession(session.jid); return { handled: false }; }

    if (session.awaiting === 'field') {
      const item = menu.items.find((i) => i.id === session.item_id);
      const action = item?.actions?.[session.step - 1];
      if (!item || action?.type !== 'ask') { await store.deleteSession(session.jid); return { handled: false }; }
      const value = msg.plain ? validateField(msg.text, action.validate) : null;
      if (!value) {
        if (session.attempts + 1 >= LIMITS.attempts) { await finish(session, 'menu_abandoned'); return { handled: false }; }
        await store.saveSession({ ...session, attempts: session.attempts + 1 });
        await send(ctx, action.validate === 'email' ? 'Não consegui ler esse e-mail, pode mandar de novo?' : 'Não peguei direito, pode mandar de novo?');
        audit({ action: 'menu_invalid', menuId: session.menu_id, contactId: session.jid, field: action.field });
        return { handled: true };
      }
      const collected = { ...session.collected, [action.field]: value };
      await store.setContactData(session.jid, action.field, value);
      audit({ action: 'menu_field', menuId: session.menu_id, contactId: session.jid, field: action.field });
      await runActions(ctx, { ...session, collected }, item, session.step);
      return { handled: true };
    }

    // aguardando escolha
    const byId = parseButtonId(msg.replyId, session.menu_id);
    const item = (byId && menu.items.find((i) => i.id === byId && i.active !== false)) || (msg.text ? matchChoice(msg.text, menu.items) : null);
    if (!item) {
      if (session.attempts + 1 >= LIMITS.attempts) { await finish(session, 'menu_abandoned'); return { handled: false }; }
      await store.saveSession({ ...session, attempts: session.attempts + 1 });
      await send(ctx, `Não entendi, responde só com o número:\n\n${renderLines(menu.items)}`);
      audit({ action: 'menu_invalid', menuId: session.menu_id, contactId: session.jid });
      return { handled: true };
    }
    audit({ action: 'menu_choice', menuId: session.menu_id, itemId: item.id, contactId: session.jid, via: byId ? 'button' : 'text' });
    await runActions(ctx, { ...session, attempts: 0 }, item, 0);
    return { handled: true };
  }

  return {
    sendMenu,
    /** Chamado pelo webhook ANTES da IA. { handled: true } = a IA não deve responder a esta mensagem. */
    async handleIncoming(msg) {
      let session = null;
      for (const jid of msg.jids) { session = await store.getSession(jid); if (session) break; }
      if (!session) return { handled: false };
      return withLock(session.jid, async () => {
        const fresh = await store.getSession(session.jid);   // pode ter mudado enquanto esperava a vez
        return fresh ? handleIncomingLocked(msg, fresh) : { handled: false };
      }).catch((e) => { log('menu', e.message); return { handled: false }; });
    },
    /** Humano escreveu na conversa (fora os nossos envios): a sessão do menu é cancelada. */
    async onHumanMessage(msg) {
      for (const jid of msg.jids) {
        const session = await store.getSession(jid);
        if (session) { await store.deleteSession(session.jid); audit({ action: 'menu_cancelled', menuId: session.menu_id, contactId: session.jid, reason: 'human_replied' }); }
      }
    },
    async endSession(jid) { const s = await store.getSession(jid); if (s) await finish(s, 'menu_cancelled'); return !!s; },
  };
}
