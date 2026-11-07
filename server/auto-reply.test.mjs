// Envio automático: sempre com Evolution FALSA (função sendText registrada em memória). Nenhuma mensagem real.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createAutoSuggester } from './auto-suggest.mjs';
import { createStore, suggestReply, validateConfig, DEFAULT_CONFIG } from './copilot.mjs';
import { loadKnowledge } from './rag.mjs';

const PN = '5511999990001@s.whatsapp.net';
const GROUP = '120363000000000000@g.us';
const DRAFT = 'O prazo de entrega do serviço é de cinco dias úteis. Posso ajudar em mais algo?';

const kbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-kb-'));
fs.mkdirSync(path.join(kbDir, '02_Servicos'));
fs.writeFileSync(path.join(kbDir, '02_Servicos', 'A.md'), '# Serviço\nStatus: Aprovado\n\n## Prazo\nO prazo de entrega do serviço é de cinco dias úteis após a aprovação do cliente.');
const knowledge = loadKnowledge(kbDir, DEFAULT_CONFIG.ragFolders);
const emptyKb = loadKnowledge(fs.mkdtempSync(path.join(os.tmpdir(), 'auto-empty-')), DEFAULT_CONFIG.ragFolders);

const upsert = (over = {}, key = {}) => ({
  event: 'messages.upsert', instance: 'WA',
  data: { key: { id: `M${Math.random().toString(36).slice(2)}`, remoteJid: PN, fromMe: false, ...key }, pushName: 'Cliente',
    message: { conversation: 'Qual o prazo de entrega do serviço?' }, messageTimestamp: Math.floor(Date.now() / 1000), ...over },
});

function fakeDb(initial = {}) {
  const conv = new Map(Object.entries({ [PN]: { aiEnabled: true, mode: 'suggestion', autoReply: true }, ...initial }));
  const suggestions = []; const sentRows = []; const events = [];
  return {
    suggestions, sentRows, events, conv,
    async getConversation(jid) { return { jid, aiEnabled: false, mode: 'suggestion', autoReply: false, lastAiReplyAt: null, ...(conv.get(jid) || {}) }; },
    async recordReplySuggestion(jid, draft, meta = {}) {
      for (const s of suggestions) if (s.jid === jid && s.status === 'pending') s.status = 'dismissed';
      const s = { id: String(suggestions.length + 1), jid, draft, status: 'pending', ...meta }; suggestions.push(s); return s;
    },
    async dismissPendingReplies(jid, reason) { let n = 0; for (const s of suggestions) if (s.jid === jid && s.status === 'pending') { s.status = 'dismissed'; n++; } events.push(['dismiss', jid, reason]); return n; },
    async resolveSuggestion(id, decision) { const s = suggestions.find((x) => x.id === String(id) && x.status === 'pending'); if (!s) return null; s.status = decision; return { suggestion: s }; },
    async recordSent(jid, messageId, author) { sentRows.push({ jid, messageId, author }); const c = conv.get(jid); if (c && author === 'ia') c.lastAiReplyAt = new Date().toISOString(); },
    async pauseAutoReply(jid, reason) { const c = conv.get(jid); if (!c?.autoReply) return false; c.autoReply = false; events.push(['pause', jid, reason]); return true; },
    pending: (jid = PN) => suggestions.filter((s) => s.jid === jid && s.status === 'pending'),
  };
}

function setup({ config = { mode: 'automatic' }, db = fakeDb(), model, allowAutomatic = true, kb = knowledge, send, limits, requireSources, debounceMs = 15 } = {}) {
  const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'auto-reply-')), { allowAutomatic });
  store.writeConfig(validateConfig({ enabled: true, paused: false, ...config }, DEFAULT_CONFIG, { allowAutomatic: true }));
  const evolution = []; // tudo que "iria" para o WhatsApp
  const sendText = send || (async (m) => { evolution.push(m); return { id: `OUT${evolution.length}` }; });
  const modelCalls = [];
  const suggester = createAutoSuggester({
    store, getDb: async () => db, debounceMs, allowAutomatic, sendText, antiRepeat: false, ...(requireSources === undefined ? {} : { requireSources }),
    limits: { minIntervalMs: 0, ...limits },
    fetchContext: async () => [{ fromMe: false, text: 'Oi' }, { fromMe: true, text: 'Olá! Como posso ajudar?' }],
    suggest: (request) => suggestReply({ store, knowledge: kb, runModel: (p) => { modelCalls.push(p); return (model || (async () => DRAFT))(p); }, user: { email: 'webhook-evolution' }, request }),
  });
  return { suggester, db, store, evolution, modelCalls, audits: () => store.readAudit(300) };
}
const run = async (t, payload) => { await t.suggester.handleWebhook(payload); await t.suggester.whenIdle(); };
const codes = (t) => t.audits().filter((a) => a.action === 'auto_skip').map((a) => a.code);

test('sends automatically only when every gate passes, and records authorship, id and audit', async () => {
  const t = setup();
  const payload = upsert();
  await run(t, payload);
  assert.equal(t.evolution.length, 1);
  assert.deepEqual(t.evolution[0], { instance: 'WA', jid: PN, text: DRAFT });
  assert.deepEqual(t.db.sentRows, [{ jid: PN, messageId: 'OUT1', author: 'ia' }]);
  assert.equal(t.db.suggestions[0].status, 'accepted', 'the draft is reserved before sending');
  const sent = t.audits().find((a) => a.action === 'auto_sent');
  assert.equal(sent.contactId, PN);
  assert.equal(sent.sourceMessageId, payload.data.key.id);
  assert.equal(sent.messageId, 'OUT1');
  assert.ok(sent.sources.length > 0);
  assert.ok(!JSON.stringify(t.audits()).includes('cinco dias') && !JSON.stringify(t.audits()).includes('Qual o prazo'), 'audit keeps ids and sizes, not message text');
});

test('kill switches: server flag off, assistant paused/disabled, global mode on suggestion => only a suggestion', async () => {
  const cases = [
    [{ allowAutomatic: false }, 'automatic_off'],
    [{ config: { mode: 'automatic', paused: true } }, null],
    [{ config: { mode: 'automatic', enabled: false } }, null],
    [{ config: { mode: 'suggestion' } }, 'mode_suggestion'],
  ];
  for (const [opts, code] of cases) {
    const t = setup(opts);
    await run(t, upsert());
    assert.equal(t.evolution.length, 0, JSON.stringify(opts));
    if (code) { assert.ok(codes(t).includes(code), `${code} in ${codes(t)}`); assert.equal(t.db.pending().length, 1, 'stays as a suggestion'); }
  }
  const noSender = createAutoSuggester({ store: setup().store, getDb: async () => fakeDb(), fetchContext: async () => [], suggest: async () => ({ draft: DRAFT, sources: [{ source: 'x' }] }), debounceMs: 5 });
  await noSender.handleWebhook(upsert()); await noSender.whenIdle();
});

test('opt-in is per conversation: suggestions-only, AI off or human takeover never send', async () => {
  for (const state of [{ aiEnabled: true, mode: 'suggestion', autoReply: false }, { aiEnabled: false, mode: 'suggestion', autoReply: true }, { aiEnabled: true, mode: 'human', autoReply: true }]) {
    const t = setup({ db: fakeDb({ [PN]: state }) });
    await run(t, upsert());
    assert.equal(t.evolution.length, 0, JSON.stringify(state));
  }
  const other = setup({ db: fakeDb({ [PN]: { aiEnabled: false, mode: 'suggestion', autoReply: false }, '5511888880002@s.whatsapp.net': { aiEnabled: true, mode: 'suggestion', autoReply: true } }) });
  await run(other, upsert());
  assert.equal(other.evolution.length, 0, 'another conversation opted in does not open this one');
});

test('groups, media, captions, old messages and unapproved sources are never auto-sent', async () => {
  const g = setup({ db: fakeDb({ [GROUP]: { aiEnabled: true, mode: 'suggestion', autoReply: true } }) });
  await run(g, upsert({}, { remoteJid: GROUP }));
  assert.equal(g.evolution.length, 0); assert.equal(g.modelCalls.length, 0);

  const media = setup();
  await run(media, upsert({ message: { audioMessage: {} } })); await run(media, upsert({ message: { stickerMessage: {} } }));
  assert.equal(media.evolution.length, 0); assert.equal(media.modelCalls.length, 0);

  const caption = setup();
  await run(caption, upsert({ message: { imageMessage: { caption: 'Qual o prazo de entrega do serviço?' } } }));
  assert.equal(caption.evolution.length, 0, 'caption of a photo is not plain text');
  assert.ok(codes(caption).includes('not_plain_text'));

  const old = setup();
  await run(old, upsert({ messageTimestamp: Math.floor(Date.now() / 1000) - 5 * 60 }));
  assert.equal(old.evolution.length, 0);
  assert.ok(codes(old).includes('old_message'));
  assert.equal(old.db.pending().length, 1, 'still a suggestion');

  const noSource = setup({ kb: emptyKb, model: async () => 'Deixa eu confirmar aqui e já te falo.' });
  await run(noSource, upsert());
  assert.equal(noSource.evolution.length, 0);
  assert.ok(codes(noSource).includes('no_approved_source'));
  assert.equal(noSource.db.pending().length, 1);

  const optional = setup({ kb: emptyKb, requireSources: false, model: async () => 'Deixa eu confirmar aqui e já te falo.' });
  await run(optional, upsert());
  assert.equal(optional.evolution.length, 1, 'only with the explicit server option');
});

test('no loop or duplicates: echoes of our own message and repeated events send nothing more', async () => {
  const t = setup();
  const payload = upsert();
  await t.suggester.handleWebhook(payload); await t.suggester.handleWebhook(payload); await t.suggester.whenIdle();
  assert.equal(t.evolution.length, 1, 'duplicate event');
  await run(t, upsert({ message: { conversation: DRAFT } }, { id: 'OUT1', fromMe: true }));   // eco do webhook da nossa própria mensagem
  assert.equal(t.evolution.length, 1);
  assert.equal(t.modelCalls.length, 1, 'fromMe never generates');
  assert.equal(t.db.conv.get(PN).autoReply, true, 'our own echo does not pause the conversation');
});

test('a human reply pauses automatic mode for the conversation and discards the pending draft', async () => {
  const t = setup({ config: { mode: 'automatic' } });
  await run(t, upsert({}, { id: 'HUMANO1', fromMe: true }));
  assert.equal(t.db.conv.get(PN).autoReply, false);
  assert.ok(t.db.events.some((e) => e[0] === 'pause' && e[2] === 'human_replied'));
  assert.ok(t.audits().some((a) => a.action === 'auto_paused'));
  await run(t, upsert({ message: { conversation: 'Mais uma pergunta sobre o prazo de entrega?' } }));
  assert.equal(t.evolution.length, 0, 'after pausing, only suggestions');
  assert.equal(t.db.pending().length, 1);
});

test('rate limits: window per conversation, per conversation per hour and global per hour', async () => {
  const win = setup({ limits: { minIntervalMs: 60000 } });
  await run(win, upsert()); await run(win, upsert());
  assert.equal(win.evolution.length, 1);
  assert.ok(codes(win).includes('rate_window'));
  assert.equal(win.db.pending().length, 1, 'the second answer stays as a suggestion');

  const conv = setup({ limits: { maxPerConvPerHour: 2 } });
  for (let i = 0; i < 4; i++) await run(conv, upsert());
  assert.equal(conv.evolution.length, 2);
  assert.ok(codes(conv).includes('rate_conv'));

  const global = setup({ limits: { maxSendsPerHour: 1 }, config: { mode: 'automatic', maxPerHourPerContact: 30 } });
  await run(global, upsert()); await run(global, upsert());
  assert.equal(global.evolution.length, 1);
  assert.ok(codes(global).includes('rate_global_send'));
});

test('no per-conversation cap by default: many replies to one contact are only limited by the 60 s window and the global hourly limit', async () => {
  const t = setup({ limits: { maxSendsPerHour: 100 }, config: { mode: 'automatic', maxPerHourPerContact: 1, maxPerDay: 100 } });
  for (let i = 0; i < 8; i++) await run(t, upsert());
  assert.equal(t.evolution.length, 8, 'eight replies to the same conversation within the hour');
  assert.ok(!codes(t).includes('rate_conv'));
  // a janela entre respostas e o teto global continuam valendo
  const win = setup({ limits: { minIntervalMs: 60000 } });
  await run(win, upsert()); await run(win, upsert());
  assert.equal(win.evolution.length, 1);
  const glob = setup({ limits: { maxSendsPerHour: 2 } });
  for (let i = 0; i < 4; i++) await run(glob, upsert());
  assert.equal(glob.evolution.length, 2);
  assert.ok(codes(glob).includes('rate_global_send'));
});

test('a newer message while generating, or a draft discarded before sending, cancels the send', async () => {
  let release; const gate = new Promise((r) => { release = r; }); let calls = 0;
  const t = setup({ model: async () => { calls++; if (calls === 1) await gate; return calls === 1 ? 'Resposta antiga sobre o prazo de entrega do serviço.' : DRAFT; } });
  await t.suggester.handleWebhook(upsert({ message: { conversation: 'primeira pergunta sobre o prazo' } }));
  await new Promise((r) => setTimeout(r, 60));
  await t.suggester.handleWebhook(upsert({ message: { conversation: 'segunda pergunta sobre o prazo' } }));
  release(); await t.suggester.whenIdle();
  assert.ok(!t.evolution.some((m) => m.text.includes('antiga')), 'stale draft is never sent');
  assert.equal(t.evolution.length, 1); assert.equal(t.evolution[0].text, DRAFT);

  // rascunho descartado entre gerar e enviar (humano respondeu / nova mensagem): a reserva falha e nada sai
  const db = fakeDb(); const orig = db.recordReplySuggestion.bind(db);
  db.recordReplySuggestion = async (...a) => { const s = await orig(...a); s.status = 'dismissed'; return s; };
  const d = setup({ db }); await run(d, upsert());
  assert.equal(d.evolution.length, 0);
  assert.ok(d.audits().some((a) => a.code === 'draft_discarded'));
});

test('generation failure, handoff and unsafe output never send; a send failure falls back to a suggestion without retry', async () => {
  for (const model of [async () => { throw new Error('boom'); }, async () => '[ENCAMINHAR]', async () => 'Use o CPF 123.456.789-09 para continuar.']) {
    const t = setup({ model }); await run(t, upsert());
    assert.equal(t.evolution.length, 0);
    assert.equal(t.db.suggestions.length, 0);
  }
  let attempts = 0;
  const t = setup({ send: async () => { attempts++; throw new Error('Evolution fora'); } });
  await run(t, upsert());
  assert.equal(attempts, 1, 'no automatic retry (would risk duplicates)');
  assert.ok(t.audits().some((a) => a.action === 'auto_send_failed'));
  assert.equal(t.db.pending().length, 1, 'the text is back as a suggestion for the human');
  assert.equal(t.db.sentRows.length, 0);
});

test('guardrails keep applying to automatic mode: blocked topics, handoff words, hours', async () => {
  for (const text of ['Pode mandar o pix?', 'quero falar com humano']) {
    const t = setup(); await run(t, upsert({ message: { conversation: text } }));
    assert.equal(t.evolution.length, 0, text); assert.equal(t.modelCalls.length, 0);
  }
});
