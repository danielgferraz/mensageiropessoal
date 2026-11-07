// Prompt v3: tom de conversa, respostas curtas, sem muletas, abertura sempre diferente, jeito de escrever do Daniel, 2 bolhas.
// Evolution FALSA: nenhum WhatsApp real. As conversas abaixo são sintéticas (anonimizadas).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createAutoSuggester } from './auto-suggest.mjs';
import { createStore, suggestReply, validateConfig, buildPrompt, filterOutput, cleanStyleSample, openingKey, splitBubbles, DEFAULT_CONFIG } from './copilot.mjs';
import { loadKnowledge } from './rag.mjs';

const PN = '5511999990001@s.whatsapp.net';
const emptyKb = loadKnowledge(fs.mkdtempSync(path.join(os.tmpdir(), 'v3-empty-')), DEFAULT_CONFIG.ragFolders);
const upsert = (text) => ({
  event: 'messages.upsert', instance: 'WA',
  data: { key: { id: `M${Math.random().toString(36).slice(2)}`, remoteJid: PN, fromMe: false }, pushName: 'Cliente',
    message: { conversation: text }, messageTimestamp: Math.floor(Date.now() / 1000) },
});
function fakeDb() {
  const conv = { aiEnabled: true, mode: 'suggestion', autoReply: true, lastAiReplyAt: null };
  const suggestions = []; const sentRows = [];
  return { suggestions, sentRows,
    async getConversation(jid) { return { jid, ...conv }; },
    async recordReplySuggestion(jid, draft, meta = {}) { for (const s of suggestions) if (s.status === 'pending') s.status = 'dismissed'; const s = { id: String(suggestions.length + 1), jid, draft, status: 'pending', ...meta }; suggestions.push(s); return s; },
    async dismissPendingReplies() { return 0; },
    async resolveSuggestion(id, d) { const s = suggestions.find((x) => x.id === String(id) && x.status === 'pending'); if (!s) return null; s.status = d; return { suggestion: s }; },
    async recordSent(jid, messageId, author) { sentRows.push({ jid, messageId, author }); }, async pauseAutoReply() { return false; },
    pending: () => suggestions.filter((s) => s.status === 'pending'),
  };
}
function setup({ model, antiRepeat = true, styleSamples = [], context = [], send, bubbleDelayMs = () => 5 } = {}) {
  const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'v3-')), { allowAutomatic: true });
  store.writeConfig(validateConfig({ enabled: true, paused: false, mode: 'automatic' }, DEFAULT_CONFIG, { allowAutomatic: true }));
  const db = fakeDb(); const events = []; const prompts = [];
  const suggester = createAutoSuggester({
    store, getDb: async () => db, debounceMs: 8, allowAutomatic: true, requireSources: false, antiRepeat, bubbleDelayMs,
    getStyleSamples: () => styleSamples, limits: { minIntervalMs: 0, maxSendsPerHour: 1000 }, presence: { tickMs: 5, renewMs: 40 },
    sendText: send || (async (m) => { events.push(['send', m.text]); return { id: `OUT${events.filter((e) => e[0] === 'send').length}` }; }),
    sendPresence: async (m) => { events.push(['presence', m.presence]); },
    fetchContext: async () => context,
    suggest: (request) => suggestReply({ store, knowledge: emptyKb, runModel: async (p) => { prompts.push(p); return model(p, prompts.length); }, user: { email: 'webhook-evolution' }, request }),
  });
  return { suggester, db, events, prompts, sends: () => events.filter((e) => e[0] === 'send').map((e) => e[1]), audits: () => store.readAudit(500), store,
    run: async (text) => { await suggester.handleWebhook(upsert(text)); await suggester.whenIdle(); } };
}

test('output filter in conversation mode: crutches, length, bubbles, emoji and repeated opening', () => {
  const cfg = { ...DEFAULT_CONFIG };
  const natural = { naturalChecks: true, contactUsesEmoji: false };
  const codes = (text, opts = {}) => filterOutput(text, cfg, { ...natural, ...opts }).problems;
  for (const text of ['Claro! Posso sim.', 'Com certeza, te passo.', 'Fico à disposição pra qualquer coisa.', 'Qualquer dúvida é só chamar.', 'Estou aqui para ajudar no que precisar.', 'Perfeito! Já vejo.', 'Disponha!']) {
    assert.ok(codes(text).includes('texto robotizado'), text);
  }
  assert.ok(codes('Opa. Beleza. Tá certo. Vou ver.').includes('longo demais para conversa'), 'three short sentences without source is too much');
  assert.ok(codes('a'.repeat(190)).includes('longo demais para conversa'));
  assert.equal(codes('Opa, beleza! Já te falo.').length, 0, 'two short sentences are fine');
  assert.ok(codes('Opa!\n\nJá vejo isso.\n\nTe falo daqui a pouco.').includes('longo demais para conversa'), 'at most two bubbles');
  assert.equal(codes('Opa!\n\nJá vejo isso.').length, 0, 'two bubbles are fine');
  assert.ok(codes('Fechou 👍').includes('emoji demais ou sem o contato usar'), 'emoji when the contact did not use one');
  assert.equal(codes('Fechou 👍', { contactUsesEmoji: true }).length, 0, 'one emoji mirrors the contact');
  assert.ok(codes('Fechou 👍👏', { contactUsesEmoji: true }).includes('emoji demais ou sem o contato usar'), 'never more than one');
  assert.ok(codes('Opa, tudo certo?', { avoidOpenings: [openingKey('Opa, tudo bem?')] }).includes('abertura repetida'));
  assert.equal(codes('Fala, tudo certo?', { avoidOpenings: [openingKey('Opa, tudo bem?')] }).length, 0);
  // manual drafts (human reviewed) are not subject to the conversation-mode checks
  assert.equal(filterOutput('Claro! Com certeza, te passo já.', cfg).ok, true);
  assert.deepEqual(splitBubbles('um\n\n  \n\ndois'), ['um', 'dois']);
});

test('style samples: only short, number-free, link-free, name-free, non-robotic lines of the owner are accepted', () => {
  assert.equal(cleanStyleSample('opa blz, te falo já'), 'opa blz, te falo já');
  assert.equal(cleanStyleSample('Fechou! Me manda aí.'), 'Fechou! Me manda aí.');
  for (const bad of ['me liga no 11 99999-0001', 'veja https://site.com', 'manda pro joao@mail.com', 'fica R$ 200', 'fala com a Maria que ela resolve', 'como posso ajudar?', 'qualquer dúvida me chama', 'x', 'a'.repeat(141), 'sou um bot']) {
    assert.equal(cleanStyleSample(bad), null, bad);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v3-style-'));
  const store = createStore(dir);
  assert.deepEqual(store.readStyleSamples(), []);
  const saved = store.writeStyleSamples(['opa blz', 'OPA BLZ', 'fala com o Carlos', 'tmj', ...Array.from({ length: 20 }, (_, i) => `mensagem curta ${'x'.repeat(i + 1)}`.replace(/\d/g, ''))]);
  assert.equal(saved.length, 10, 'capped at 10');
  assert.ok(saved.includes('opa blz') && !saved.some((t) => /Carlos/.test(t)), 'deduplicated (case-insensitive) and names dropped');
  assert.deepEqual(createStore(dir).readStyleSamples(), saved, 'persisted');
  // arquivo editado à mão com lixo: filtrado na leitura
  fs.writeFileSync(path.join(dir, 'style-samples.json'), JSON.stringify({ samples: ['opa', 'ligue 11 99999-0001', 42, null] }));
  assert.deepEqual(createStore(dir).readStyleSamples(), ['opa'].filter((t) => cleanStyleSample(t)));
});

test('real conversation sample (synthetic): the prompt carries the owner style examples, the contact register and the avoid-list', async () => {
  const samples = ['opa blz', 'fechou, te mando já', 'tá certo, valeu', 'show kkk', 'boa, te falo mais tarde'];
  const context = [
    { fromMe: false, text: 'e aí blz? tá por aí?' },
    { fromMe: true, text: 'opa blz, tô sim' },
    { fromMe: false, text: 'mano só uma dúvida rapidinha' },
  ];
  const t = setup({ styleSamples: samples, context, model: async () => 'Fala aí, pode mandar.' });
  await t.run('mano só uma dúvida rapidinha');
  assert.deepEqual(t.sends(), ['Fala aí, pode mandar.']);
  const p = t.prompts[0];
  assert.match(p, /<EXEMPLOS_DO_JEITO_DO_DANIEL>[\s\S]*- opa blz[\s\S]*- show kkk[\s\S]*<\/EXEMPLOS_DO_JEITO_DO_DANIEL>/);
  assert.match(p, /CLIENTE: e aí blz\? tá por aí\?\nATENDENTE: opa blz, tô sim\nCLIENTE: mano só uma dúvida rapidinha/);
  assert.ok(!p.includes('EVITE_COMECAR_COM>\n-'), 'no avoid-list on the very first reply');
  await t.run('valeu, e outra coisa');
  assert.match(t.prompts.at(-1), /<EVITE_COMECAR_COM>\n- fala ai/, 'next prompt asks not to open like the previous reply');
});

test('10 replies to "oi" never repeat the opening; a model that insists on the same opening is rewritten once and then not sent', async () => {
  const pool = ['opa', 'fala', 'e aí', 'salve', 'bom dia', 'boa', 'hey', 'olá', 'eita', 'oxe', 'iaí', 'beleza'];
  const taken = (prompt) => [...prompt.matchAll(/<EVITE_COMECAR_COM>\n([\s\S]*?)<\/EVITE_COMECAR_COM>/g)].flatMap((m) => m[1].split('\n').map((l) => l.replace(/^- /, '').trim())).filter(Boolean);
  const varied = setup({ model: async (p) => { const avoid = taken(p); const word = pool.find((w) => !avoid.some((a) => a === openingKey(`${w} tudo`) || a === w || a.startsWith(`${w} `))) || 'valeu'; return `${word[0].toUpperCase()}${word.slice(1)}, tudo certo por aqui?`; } });
  for (let i = 0; i < 10; i++) await varied.run('oi');
  const openings = varied.sends().map(openingKey);
  assert.equal(varied.sends().length, 10);
  assert.equal(new Set(openings).size, 10, `10 different openings: ${openings.join(' | ')}`);

  const stubborn = setup({ model: async () => 'Opa, tudo certo?' });
  for (let i = 0; i < 4; i++) await stubborn.run('oi');
  assert.deepEqual(stubborn.sends(), ['Opa, tudo certo?'], 'the same opening is never sent twice');
  assert.ok(stubborn.audits().some((a) => a.code === 'output_filter' && /abertura repetida/.test(a.reason)));
  assert.ok(stubborn.prompts.some((p) => /Sua resposta anterior soou robótica/.test(p)), 'one rewrite was attempted');
});

test('a generic-attendant reply is rewritten once; if it persists nothing is sent', async () => {
  const t = setup({ model: async (p, n) => (n === 1 ? 'Claro! Fico à disposição para qualquer dúvida.' : 'Fala, pode mandar.') });
  await t.run('preciso de uma ajuda');
  assert.deepEqual(t.sends(), ['Fala, pode mandar.']);
  const stuck = setup({ model: async () => 'Com certeza! Estou aqui para ajudar.' });
  await stuck.run('preciso de uma ajuda');
  assert.deepEqual(stuck.sends(), []);
});

test('two short bubbles are sent in order, typing stays on between them and ends once with paused', async () => {
  const t = setup({ model: async () => 'Opa, beleza?\n\nJá te falo isso.' });
  await t.run('e aí');
  assert.deepEqual(t.sends(), ['Opa, beleza?', 'Já te falo isso.']);
  assert.deepEqual(t.db.sentRows.map((r) => [r.messageId, r.author]), [['OUT1', 'ia'], ['OUT2', 'ia']]);
  const seq = t.events.map((e) => (e[0] === 'presence' ? e[1] : 'send'));
  assert.equal(seq.filter((x) => x === 'paused').length, 1);
  assert.equal(seq.at(-1), 'paused');
  assert.ok(seq.lastIndexOf('send') < seq.indexOf('paused'), 'paused only after the last bubble');
  const sent = t.audits().find((a) => a.action === 'auto_sent');
  assert.equal(sent.bubbles, 2); assert.deepEqual(sent.messageIds, ['OUT1', 'OUT2']);
  assert.equal(t.db.suggestions[0].status, 'accepted');
  assert.ok(t.sends().length <= 2, 'never more than two bubbles');
});

test('bubble failures: if the second bubble fails only the unsent part goes back as a suggestion (no duplicate); if the first fails the whole text does', async () => {
  let n = 0;
  const second = setup({ model: async () => 'Opa, beleza?\n\nJá te falo isso.', send: async (m) => { if (++n === 2) throw new Error('Evolution fora'); return { id: 'OUT1' }; } });
  await second.run('e aí');
  assert.equal(n, 2, 'no retry');
  assert.equal(second.db.pending().length, 1);
  assert.equal(second.db.pending()[0].draft, 'Já te falo isso.');
  assert.equal(second.events.filter((e) => e[0] === 'presence').at(-1)[1], 'paused');

  const first = setup({ model: async () => 'Opa, beleza?\n\nJá te falo isso.', send: async () => { throw new Error('Evolution fora'); } });
  await first.run('e aí');
  assert.equal(first.db.pending()[0].draft, 'Opa, beleza?\n\nJá te falo isso.');
  assert.equal(first.db.sentRows.length, 0);
});
