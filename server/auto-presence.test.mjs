// Espera com reinício + "digitando…" (presença) do envio automático. Evolution FALSA: nenhum WhatsApp real.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createAutoSuggester, DEFAULT_DEBOUNCE_MS } from './auto-suggest.mjs';
import { createStore, suggestReply, validateConfig, DEFAULT_CONFIG } from './copilot.mjs';
import { loadKnowledge } from './rag.mjs';

const PN = '5511999990001@s.whatsapp.net';
const GROUP = '120363000000000000@g.us';
const DRAFT = 'O prazo de entrega do serviço é de cinco dias úteis. Posso ajudar em mais algo?';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const kbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pres-kb-'));
fs.mkdirSync(path.join(kbDir, '02_Servicos'));
fs.writeFileSync(path.join(kbDir, '02_Servicos', 'A.md'), '# Serviço\nStatus: Aprovado\n\n## Prazo\nO prazo de entrega do serviço é de cinco dias úteis após a aprovação do cliente.');
const knowledge = loadKnowledge(kbDir, DEFAULT_CONFIG.ragFolders);

const upsert = (text = 'Qual o prazo de entrega do serviço?', key = {}, over = {}) => ({
  event: 'messages.upsert', instance: 'WA',
  data: { key: { id: `M${Math.random().toString(36).slice(2)}`, remoteJid: PN, fromMe: false, ...key }, pushName: 'Cliente',
    message: { conversation: text }, messageTimestamp: Math.floor(Date.now() / 1000), ...over },
});

function fakeDb(initial = {}) {
  const conv = new Map(Object.entries({ [PN]: { aiEnabled: true, mode: 'suggestion', autoReply: true }, ...initial }));
  const suggestions = [];
  return {
    suggestions, conv,
    async getConversation(jid) { return { jid, aiEnabled: false, mode: 'suggestion', autoReply: false, lastAiReplyAt: null, ...(conv.get(jid) || {}) }; },
    async recordReplySuggestion(jid, draft, meta = {}) { for (const s of suggestions) if (s.jid === jid && s.status === 'pending') s.status = 'dismissed'; const s = { id: String(suggestions.length + 1), jid, draft, status: 'pending', ...meta }; suggestions.push(s); return s; },
    async dismissPendingReplies(jid) { let n = 0; for (const s of suggestions) if (s.jid === jid && s.status === 'pending') { s.status = 'dismissed'; n++; } return n; },
    async resolveSuggestion(id, decision) { const s = suggestions.find((x) => x.id === String(id) && x.status === 'pending'); if (!s) return null; s.status = decision; return { suggestion: s }; },
    async recordSent() {}, async pauseAutoReply() { return false; },
    pending: (jid = PN) => suggestions.filter((s) => s.jid === jid && s.status === 'pending'),
  };
}

function setup({ db = fakeDb(), config = { mode: 'automatic' }, model, context, send, presenceFn, debounceMs = 60, presence = { tickMs: 10, renewMs: 40, maxMs: 5000 }, allowAutomatic = true, hasSourceFor } = {}) {
  const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'pres-')), { allowAutomatic: true });
  store.writeConfig(validateConfig({ enabled: true, paused: false, ...config }, DEFAULT_CONFIG, { allowAutomatic: true }));
  const events = []; // linha do tempo: presença e envios
  const t0 = Date.now();
  const stamp = (...a) => events.push([Date.now() - t0, ...a]);
  const modelCalls = [];
  const suggester = createAutoSuggester({
    store, getDb: async () => db, debounceMs, presence, allowAutomatic, hasSourceFor,
    sendText: send || (async (m) => { stamp('send', m.text); return { id: 'OUT1' }; }),
    sendPresence: presenceFn || (async (m) => { stamp('presence', m.presence, m.jid); }),
    limits: { minIntervalMs: 0 },
    fetchContext: context || (async () => []),
    suggest: (request) => suggestReply({ store, knowledge, runModel: async (p) => { modelCalls.push(p); return (model || (async () => DRAFT))(p); }, user: { email: 'webhook-evolution' }, request }),
  });
  const presences = () => events.filter((e) => e[1] === 'presence').map((e) => e[2]);
  const sends = () => events.filter((e) => e[1] === 'send');
  return { suggester, db, store, events, modelCalls, stamp, presences, sends, audits: () => store.readAudit(300) };
}

test('the wait is 6 s by default and applies to suggestions and replies alike', () => {
  assert.equal(DEFAULT_DEBOUNCE_MS, 6000);
  const server = fs.readFileSync(new URL('./server.mjs', import.meta.url), 'utf8');
  assert.match(server, /AUTO_SUGGEST_DEBOUNCE_MS \|\| '6000'/);
});

test('every new message restarts the wait: one single reply for the whole burst, only after the last message', async () => {
  const t = setup({ debounceMs: 500 });
  const start = Date.now(); let lastAt = 0;
  for (const text of ['oi', 'tudo bem?', 'Qual o prazo de entrega do serviço?']) {
    await t.suggester.handleWebhook(upsert(text)); lastAt = Date.now() - start; await sleep(100);   // cada intervalo < espera: reinicia
  }
  await t.suggester.whenIdle();
  assert.equal(t.modelCalls.length, 1, 'one generation for the burst');
  assert.equal(t.sends().length, 1, 'one reply, not one per message');
  for (const text of ['oi', 'tudo bem?', 'Qual o prazo de entrega']) assert.ok(t.modelCalls[0].includes(`CLIENTE: ${text}`), `burst message "${text}" is in the context`);
  assert.ok(t.sends()[0][0] >= lastAt + 500 - 15, `reply ${t.sends()[0][0]}ms after start vs last message at ${lastAt}ms + 500ms`);
});

test('"digitando…" starts with the wait, is renewed while generating, and ends with paused after the send', async () => {
  const t = setup({ debounceMs: 80, model: async () => { await sleep(250); return DRAFT; } });
  await t.suggester.handleWebhook(upsert());
  await sleep(20);
  assert.equal(t.presences()[0], 'composing', 'composing begins as soon as the wait begins, before any generation');
  assert.ok(t.presences().every((x) => x === 'composing'));
  assert.equal(t.sends().length, 0);
  await t.suggester.whenIdle();
  const seq = t.events.map((e) => e[1] === 'presence' ? e[2] : e[1]);
  assert.ok(seq.filter((x) => x === 'composing').length >= 3, `renewed during wait+generation: ${seq.join(',')}`);
  assert.equal(seq.at(-1), 'paused');
  assert.equal(seq.filter((x) => x === 'paused').length, 1);
  assert.ok(seq.indexOf('send') < seq.indexOf('paused'), 'paused only after the message was sent');
  assert.ok(t.events.every((e) => e[1] !== 'presence' || e[3] === PN));
  assert.deepEqual(t.suggester.typingNow(), []);
});

test('no "digitando…" where no automatic reply is possible: suggestion-only, group, AI off, paused, mode, no source', async () => {
  const cases = [
    ['suggestion-only conversation', { db: fakeDb({ [PN]: { aiEnabled: true, mode: 'suggestion', autoReply: false } }) }],
    ['AI off', { db: fakeDb({ [PN]: { aiEnabled: false, mode: 'suggestion', autoReply: true } }) }],
    ['human took over', { db: fakeDb({ [PN]: { aiEnabled: true, mode: 'human', autoReply: true } }) }],
    ['assistant paused', { config: { mode: 'automatic', paused: true } }],
    ['global mode suggestion', { config: { mode: 'suggestion' } }],
    ['server flag off', { allowAutomatic: false }],
    ['no approved source for this question', { hasSourceFor: () => false }],
  ];
  for (const [name, opts] of cases) {
    const t = setup(opts);
    await t.suggester.handleWebhook(upsert()); await t.suggester.whenIdle();
    assert.deepEqual(t.presences(), [], name);
    assert.equal(t.sends().length, 0, name);
  }
  const g = setup({ db: fakeDb({ [GROUP]: { aiEnabled: true, mode: 'suggestion', autoReply: true } }) });
  await g.suggester.handleWebhook(upsert('oi', { remoteJid: GROUP })); await g.suggester.whenIdle();
  assert.deepEqual(g.presences(), []); assert.equal(g.modelCalls.length, 0);
  const media = setup();
  await media.suggester.handleWebhook(upsert('', {}, { message: { audioMessage: {} } })); await media.suggester.whenIdle();
  assert.deepEqual(media.presences(), []);
});

test('a human takes over during the wait: aborts without generating or sending, and stops typing', async () => {
  const db = fakeDb();
  const t = setup({ db, debounceMs: 400 });
  await t.suggester.handleWebhook(upsert());
  await sleep(25);
  assert.equal(t.presences()[0], 'composing');
  db.conv.set(PN, { aiEnabled: true, mode: 'human', autoReply: false });   // assumiu durante a espera
  await t.suggester.whenIdle();
  assert.equal(t.modelCalls.length, 0, 'the draft is cancelled');
  assert.equal(t.sends().length, 0);
  assert.equal(t.presences().at(-1), 'paused');
  assert.deepEqual(t.suggester.typingNow(), []);
});

test('pausing the assistant or the kill switch during the wait also aborts and clears typing', async () => {
  const t = setup({ debounceMs: 400 });
  await t.suggester.handleWebhook(upsert());
  await sleep(40);
  t.store.writeConfig(validateConfig({ enabled: true, paused: true, mode: 'automatic' }, DEFAULT_CONFIG, { allowAutomatic: true }));
  await t.suggester.whenIdle();
  assert.equal(t.modelCalls.length, 0); assert.equal(t.sends().length, 0);
  assert.equal(t.presences().at(-1), 'paused');
});

test('a new message during generation keeps typing on and the stale draft is never sent; single final paused', async () => {
  let release; const gate = new Promise((r) => { release = r; }); let calls = 0;
  const t = setup({ debounceMs: 60, model: async () => { calls++; if (calls === 1) await gate; return calls === 1 ? 'Resposta antiga sobre o prazo de entrega do serviço.' : DRAFT; } });
  await t.suggester.handleWebhook(upsert('primeira pergunta sobre o prazo'));
  await sleep(120);                                   // gerando a primeira
  await t.suggester.handleWebhook(upsert('segunda pergunta sobre o prazo'));
  release(); await t.suggester.whenIdle();
  assert.equal(t.sends().length, 1);
  assert.equal(t.sends()[0][2], DRAFT);
  const seq = t.events.map((e) => e[1] === 'presence' ? e[2] : e[1]);
  assert.equal(seq.filter((x) => x === 'paused').length, 1, `typing was never dropped between rounds: ${seq.join(',')}`);
  assert.equal(seq.at(-1), 'paused');
  assert.ok(seq.indexOf('send') < seq.indexOf('paused'));
});

test('send failure, generation failure, handoff and unsafe output never leave typing stuck', async () => {
  const fail = setup({ send: async () => { throw new Error('Evolution fora'); } });
  await fail.suggester.handleWebhook(upsert()); await fail.suggester.whenIdle();
  assert.equal(fail.presences().at(-1), 'paused');
  assert.deepEqual(fail.suggester.typingNow(), []);
  assert.equal(fail.db.pending().length, 1, 'falls back to a suggestion');
  for (const model of [async () => { throw new Error('boom'); }, async () => '[ENCAMINHAR]', async () => 'Use o CPF 123.456.789-09 para continuar.']) {
    const t = setup({ model }); await t.suggester.handleWebhook(upsert()); await t.suggester.whenIdle();
    assert.equal(t.presences().at(-1), 'paused'); assert.deepEqual(t.suggester.typingNow(), []); assert.equal(t.sends().length, 0);
  }
});

test('presence is best effort: a failing presence call never blocks the reply; typing never outlives the safety limit', async () => {
  const t = setup({ presenceFn: async () => { throw new Error('presença fora'); } });
  await t.suggester.handleWebhook(upsert()); await t.suggester.whenIdle();
  assert.equal(t.sends().length, 1);

  const slow = setup({ debounceMs: 20, presence: { tickMs: 10, renewMs: 20, maxMs: 120 }, model: async () => { await sleep(500); return DRAFT; } });
  await slow.suggester.handleWebhook(upsert());
  await sleep(300);
  assert.equal(slow.presences().at(-1), 'paused', 'safety cap stopped typing while the model was still running');
  const composingAfterCap = slow.events.filter((e) => e[1] === 'presence' && e[2] === 'composing').length;
  await slow.suggester.whenIdle();
  assert.equal(slow.events.filter((e) => e[1] === 'presence' && e[2] === 'composing').length, composingAfterCap, 'no composing after the cap');
});

test('human reply from the phone (fromMe) does not start typing and a send echo does not either', async () => {
  const t = setup();
  await t.suggester.handleWebhook(upsert('oi', { fromMe: true, id: 'HUM1' })); await t.suggester.whenIdle();
  assert.deepEqual(t.presences(), []);
});
