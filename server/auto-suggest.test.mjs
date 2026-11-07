import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createAutoSuggester } from './auto-suggest.mjs';
import { createStore, suggestReply, validateConfig, DEFAULT_CONFIG } from './copilot.mjs';
import { parseUpsert, candidateJids, toContextMessages } from './whatsapp-utils.mjs';

const PN = '5511999990001@s.whatsapp.net';
const LID = '100000000000001@lid';
const GROUP = '120363000000000000@g.us';

const upsert = (over = {}, key = {}) => ({
  event: 'messages.upsert', instance: 'WA',
  data: { key: { id: `M${Math.random().toString(36).slice(2)}`, remoteJid: PN, fromMe: false, ...key }, pushName: 'Cliente',
    message: { conversation: 'Qual o prazo de entrega do serviço?' }, messageTimestamp: Math.floor(Date.now() / 1000), ...over },
});

function fakeDb(initial = {}) {
  const conv = new Map(Object.entries({ [PN]: { aiEnabled: true, mode: 'suggestion' }, ...initial }));
  const suggestions = [];
  return {
    suggestions, conv,
    async getConversation(jid) { return { jid, aiEnabled: false, mode: 'suggestion', ...(conv.get(jid) || {}) }; },
    async recordReplySuggestion(jid, draft, meta = {}) {
      for (const s of suggestions) if (s.jid === jid && s.status === 'pending') s.status = 'dismissed';
      const s = { id: String(suggestions.length + 1), jid, draft, status: 'pending', ...meta };
      suggestions.push(s); return s;
    },
    async dismissPendingReplies(jid, reason) {
      let n = 0; for (const s of suggestions) if (s.jid === jid && s.status === 'pending') { s.status = 'dismissed'; s.reason = reason; n++; }
      return n;
    },
    pending: (jid = PN) => suggestions.filter((s) => s.jid === jid && s.status === 'pending'),
  };
}

function setup({ config = {}, db = fakeDb(), model, context, suggesterOpts = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-sug-'));
  const store = createStore(dir);
  store.writeConfig(validateConfig({ enabled: true, paused: false, ...config }, DEFAULT_CONFIG));
  const modelCalls = [];
  const runModel = model || (async () => 'Opa, tudo certo por aqui! Já te respondo isso.');
  // Não existe dependência de envio: o módulo só recebe leitura de contexto, modelo e banco de sugestões.
  const suggester = createAutoSuggester({
    store, getDb: async () => db, debounceMs: 15, maxMessageAgeMs: 10 * 60 * 1000, antiRepeat: false,
    fetchContext: context || (async () => [{ fromMe: false, text: 'Oi' }, { fromMe: true, text: 'Olá! Como posso ajudar?' }]),
    suggest: (request) => suggestReply({ store, knowledge: null, runModel: (p) => { modelCalls.push(p); return runModel(p); }, user: { email: 'webhook-evolution' }, request }),
    ...suggesterOpts,
  });
  return { suggester, db, store, modelCalls, audits: () => store.readAudit(200) };
}

test('webhook payloads: only messages.upsert, phone is canonical for a @lid chat', () => {
  assert.deepEqual(parseUpsert({ event: 'connection.update', data: {} }), []);
  assert.equal(parseUpsert({ event: 'MESSAGES_UPSERT', instance: 'WA', data: upsert().data }).length, 1);
  const [lid] = parseUpsert(upsert({}, { remoteJid: LID, remoteJidAlt: PN }));
  assert.deepEqual(lid.jids, [PN, LID]);
  assert.deepEqual(candidateJids({ remoteJid: LID }), [LID]);
  const [own] = parseUpsert(upsert({}, { fromMe: true }));
  assert.equal(own.fromMe, true);
  assert.equal(parseUpsert(upsert({ message: { audioMessage: {} } }))[0].text, '');
  const merged = toContextMessages([
    [{ key: { id: 'a', fromMe: false }, message: { conversation: 'um' }, messageTimestamp: 2 }],
    [{ key: { id: 'a' }, message: { conversation: 'um' } }, { key: { id: 'b', fromMe: true }, message: { conversation: 'dois' }, messageTimestamp: 3 }],
  ]);
  assert.deepEqual(merged.map((m) => m.id), ['a', 'b']);
});

test('conversation with suggestions ON generates one pending draft linked to the source message', async () => {
  const t = setup();
  const payload = upsert();
  await t.suggester.handleWebhook(payload);
  await t.suggester.whenIdle();
  assert.equal(t.modelCalls.length, 1);
  assert.match(t.modelCalls[0], /CLIENTE: Qual o prazo de entrega/);
  const [s] = t.db.pending();
  assert.ok(s.draft.includes('tudo certo'));
  assert.equal(s.auto, true);
  assert.equal(s.sourceMessageId, payload.data.key.id);
  assert.ok(t.audits().some((a) => a.action === 'auto_suggestion' && a.contactId === PN));
});

test('a @lid event with remoteJidAlt uses the state saved under the phone jid', async () => {
  const t = setup();
  await t.suggester.handleWebhook(upsert({}, { remoteJid: LID, remoteJidAlt: PN }));
  await t.suggester.whenIdle();
  assert.equal(t.db.pending(PN).length, 1);
});

test('conversation OFF or taken over by a human generates nothing', async () => {
  for (const state of [{ aiEnabled: false, mode: 'suggestion' }, { aiEnabled: true, mode: 'human' }]) {
    const t = setup({ db: fakeDb({ [PN]: state }) });
    await t.suggester.handleWebhook(upsert());
    await t.suggester.whenIdle();
    assert.equal(t.modelCalls.length, 0, JSON.stringify(state));
    assert.equal(t.db.suggestions.length, 0);
  }
});

test('ignores own messages, groups, non-text, old history sync and duplicated events (no loop)', async () => {
  const t = setup({ db: fakeDb({ [GROUP]: { aiEnabled: true, mode: 'suggestion' } }) });
  await t.suggester.handleWebhook(upsert({}, { fromMe: true }));
  await t.suggester.handleWebhook(upsert({}, { remoteJid: GROUP }));
  await t.suggester.handleWebhook(upsert({ message: { imageMessage: {} } }));
  await t.suggester.handleWebhook(upsert({ messageTimestamp: Math.floor(Date.now() / 1000) - 3600 }));
  await t.suggester.whenIdle();
  assert.equal(t.modelCalls.length, 0);
  const dup = upsert();
  await t.suggester.handleWebhook(dup); await t.suggester.handleWebhook(dup);
  await t.suggester.whenIdle();
  assert.equal(t.modelCalls.length, 1);
  assert.equal(t.db.suggestions.length, 1);
});

test('a human reply (fromMe) discards the pending draft but never generates a new one', async () => {
  const t = setup();
  await t.suggester.handleWebhook(upsert()); await t.suggester.whenIdle();
  assert.equal(t.db.pending().length, 1);
  await t.suggester.handleWebhook(upsert({}, { fromMe: true })); await t.suggester.whenIdle();
  assert.equal(t.db.pending().length, 0);
  assert.equal(t.modelCalls.length, 1);
});

test('debounce: a burst of messages produces a single draft using the latest message', async () => {
  const t = setup();
  for (const text of ['oi', 'tudo bem?', 'Qual o prazo de entrega do serviço?']) {
    await t.suggester.handleWebhook(upsert({ message: { conversation: text } }));
  }
  await t.suggester.whenIdle();
  assert.equal(t.modelCalls.length, 1);
  assert.equal(t.db.suggestions.length, 1);
  assert.match(t.modelCalls[0], /CLIENTE: Qual o prazo/);
});

test('a new message discards the old pending draft and keeps one pending suggestion', async () => {
  const t = setup();
  await t.suggester.handleWebhook(upsert()); await t.suggester.whenIdle();
  const first = t.db.pending()[0];
  await t.suggester.handleWebhook(upsert({ message: { conversation: 'E o prazo para o segundo serviço?' } }));
  assert.equal(t.db.pending().length, 0, 'old draft discarded as soon as a new message arrives');
  await t.suggester.whenIdle();
  assert.equal(t.db.pending().length, 1);
  assert.notEqual(t.db.pending()[0].id, first.id);
});

test('a draft finished after a newer message arrived is dropped as stale', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  let calls = 0;
  const t = setup({ model: async () => { calls++; if (calls === 1) await gate; return calls === 1 ? 'Resposta antiga sobre o prazo de entrega.' : 'Resposta nova sobre o prazo de entrega.'; } });
  await t.suggester.handleWebhook(upsert({ message: { conversation: 'primeira' } }));
  await new Promise((r) => setTimeout(r, 60)); // primeira geração em andamento
  await t.suggester.handleWebhook(upsert({ message: { conversation: 'segunda' } }));
  release();
  await t.suggester.whenIdle();
  assert.ok(!t.db.suggestions.some((s) => s.draft.includes('antiga')), 'stale draft must not be stored');
  assert.ok(t.audits().some((a) => a.action === 'auto_stale'));
  assert.equal(t.db.pending().length, 1, 'the draft for the newer message is the single pending one');
  assert.ok(t.db.pending()[0].draft.includes('nova'));
});

test('guardrails still apply: master switch, paused, blocked topics, handoff, limits', async () => {
  for (const config of [{ enabled: false }, { paused: true }]) {
    const t = setup({ config }); await t.suggester.handleWebhook(upsert()); await t.suggester.whenIdle();
    assert.equal(t.db.suggestions.length, 0); assert.equal(t.modelCalls.length, 0);
  }
  for (const text of ['Pode mandar o pix?', 'quero falar com humano']) {
    const t = setup(); await t.suggester.handleWebhook(upsert({ message: { conversation: text } })); await t.suggester.whenIdle();
    assert.equal(t.db.suggestions.length, 0, text); assert.equal(t.modelCalls.length, 0);
  }
  // Decisão do usuário: o fluxo automático não tem teto por conversa (o limite por contato continua valendo no pedido manual)
  const t = setup({ config: { maxPerHourPerContact: 1 } });
  await t.suggester.handleWebhook(upsert()); await t.suggester.whenIdle();
  await t.suggester.handleWebhook(upsert()); await t.suggester.whenIdle();
  assert.equal(t.modelCalls.length, 2, 'no per-conversation cap in the automatic flow');
  const g = setup({ suggesterOpts: { maxPerHour: 1 } });
  await g.suggester.handleWebhook(upsert()); await g.suggester.whenIdle();
  await g.suggester.handleWebhook(upsert()); await g.suggester.whenIdle();
  assert.equal(g.modelCalls.length, 1);
  assert.ok(g.audits().some((a) => a.code === 'rate_global'));
});

test('model failure and unsafe output leave no draft; context failure falls back to the incoming text', async () => {
  const bad = setup({ model: async () => { throw new Error('boom'); } });
  await bad.suggester.handleWebhook(upsert()); await bad.suggester.whenIdle();
  assert.equal(bad.db.suggestions.length, 0);
  const leak = setup({ model: async () => 'Use o CPF 123.456.789-09 para continuar.' });
  await leak.suggester.handleWebhook(upsert()); await leak.suggester.whenIdle();
  assert.equal(leak.db.suggestions.length, 0);
  const noCtx = setup({ context: async () => { throw new Error('evolution fora'); } });
  await noCtx.suggester.handleWebhook(upsert()); await noCtx.suggester.whenIdle();
  assert.equal(noCtx.db.suggestions.length, 1);
  assert.match(noCtx.modelCalls[0], /CLIENTE: Qual o prazo/);
});

test('audit never stores message text', async () => {
  const t = setup();
  await t.suggester.handleWebhook(upsert()); await t.suggester.whenIdle();
  assert.ok(!JSON.stringify(t.audits()).includes('Qual o prazo'));
});
