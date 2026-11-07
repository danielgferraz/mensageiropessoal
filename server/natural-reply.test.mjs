// Atendente "como se fosse o Daniel": tom natural, conversa social sem fonte, fatos só com fonte, handoff e nada de bot.
// Evolution FALSA: nenhum WhatsApp real.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createAutoSuggester } from './auto-suggest.mjs';
import { createStore, suggestReply, validateConfig, buildPrompt, filterOutput, evaluateRequest, isIdentityQuestion, needsFacts, DEFAULT_CONFIG } from './copilot.mjs';
import { loadKnowledge } from './rag.mjs';
import { buildAntigravityPrompt } from './antigravity.mjs';

const PN = '5511999990001@s.whatsapp.net';
const kbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nat-kb-'));
fs.mkdirSync(path.join(kbDir, '02_Servicos'));
fs.writeFileSync(path.join(kbDir, '02_Servicos', 'A.md'), '# Serviço\nStatus: Aprovado\n\n## Prazo\nO prazo de entrega do serviço é de 5 dias úteis após a aprovação do cliente.');
const withKb = loadKnowledge(kbDir, DEFAULT_CONFIG.ragFolders);
const emptyKb = loadKnowledge(fs.mkdtempSync(path.join(os.tmpdir(), 'nat-empty-')), DEFAULT_CONFIG.ragFolders);

const upsert = (text) => ({
  event: 'messages.upsert', instance: 'WA',
  data: { key: { id: `M${Math.random().toString(36).slice(2)}`, remoteJid: PN, fromMe: false }, pushName: 'Cliente',
    message: { conversation: text }, messageTimestamp: Math.floor(Date.now() / 1000) },
});
function fakeDb() {
  const conv = { aiEnabled: true, mode: 'suggestion', autoReply: true, lastAiReplyAt: null };
  const suggestions = [];
  return {
    suggestions,
    async getConversation(jid) { return { jid, ...conv }; },
    async recordReplySuggestion(jid, draft, meta = {}) { for (const s of suggestions) if (s.status === 'pending') s.status = 'dismissed'; const s = { id: String(suggestions.length + 1), jid, draft, status: 'pending', ...meta }; suggestions.push(s); return s; },
    async dismissPendingReplies() { return 0; },
    async resolveSuggestion(id, d) { const s = suggestions.find((x) => x.id === String(id) && x.status === 'pending'); if (!s) return null; s.status = d; return { suggestion: s }; },
    async recordSent() {}, async pauseAutoReply() { return false; },
    pending: () => suggestions.filter((s) => s.status === 'pending'),
  };
}
function setup({ model, kb = emptyKb, requireSources = false, factNoSource, antiRepeat = false, styleSamples = [], contactMessages = [] } = {}) {
  const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'nat-')), { allowAutomatic: true });
  store.writeConfig(validateConfig({ enabled: true, paused: false, mode: 'automatic' }, DEFAULT_CONFIG, { allowAutomatic: true }));
  const db = fakeDb(); const sent = []; const prompts = [];
  const suggester = createAutoSuggester({
    store, getDb: async () => db, debounceMs: 10, allowAutomatic: true, requireSources, factNoSource, antiRepeat, getStyleSamples: () => styleSamples, bubbleDelayMs: () => 5,
    sendText: async (m) => { sent.push(m.text); return { id: `OUT${sent.length}` }; },
    hasSourceFor: (t) => kb.documents?.length ? true : false,
    limits: { minIntervalMs: 0, maxSendsPerHour: 100 },
    fetchContext: async () => contactMessages,
    suggest: (request) => suggestReply({ store, knowledge: kb, runModel: async (p) => { prompts.push(p); return model(p, prompts.length); }, user: { email: 'webhook-evolution' }, request }),
  });
  const run = async (text) => { await suggester.handleWebhook(upsert(text)); await suggester.whenIdle(); };
  return { run, sent, db, prompts, audits: () => store.readAudit(300) };
}

test('prompt v3: first person as Daniel, conversation tone, short, mirrors the contact, no crutches, no bot talk, facts only from approved context', () => {
  const prompt = buildPrompt({ messages: [{ fromMe: false, text: 'oi' }], snippets: [] });
  assert.match(prompt, /Você é o Daniel/);
  assert.match(prompt, /primeira pessoa/);
  assert.match(prompt, /tom de conversa de verdade \(não de atendimento\)/);
  assert.match(prompt, /1 frase na maioria das vezes, 2 só quando precisar/);
  assert.match(prompt, /quebre em 2 mensagens curtas separadas por uma linha em branco/);
  assert.match(prompt, /Espelhe o registro do contato/);
  assert.match(prompt, /No máximo 1 emoji, e só se o contato usou emoji/);
  assert.match(prompt, /Varie a abertura sempre/);
  assert.match(prompt, /Não repita "Oi, tudo bem\?"/);
  for (const crutch of ['fico à disposição', 'qualquer dúvida', 'estou aqui para ajudar', 'claro!', 'com certeza!', 'Prezado', 'Como posso ajudar?']) assert.ok(prompt.includes(`"${crutch}"`), crutch);
  assert.match(prompt, /Nunca diga nem sugira que você é robô, bot, IA/);
  assert.match(prompt, /Fatos do negócio[^\n]*só podem vir do CONTEXTO APROVADO/);
  assert.match(prompt, /Nunca invente/);
  assert.match(prompt, /\[ENCAMINHAR\]/);
  assert.ok(!prompt.includes('EXEMPLOS_DO_JEITO_DO_DANIEL>'), 'no samples block without approved samples');
});

test('"oi" and "tudo bem?" get a natural reply sent without any approved source', async () => {
  const replies = { oi: 'Opa, e aí! Tudo certo?', 'tudo bem?': 'Tudo ótimo por aqui, e contigo?' };
  const t = setup({ model: async (p) => (p.includes('CLIENTE: tudo bem?') ? replies['tudo bem?'] : replies.oi) });
  await t.run('oi');
  await t.run('tudo bem?');
  assert.deepEqual(t.sent, [replies.oi, replies['tudo bem?']]);
  assert.ok(t.audits().filter((a) => a.action === 'auto_sent').length === 2);
  assert.ok(!t.sent.join(' ').match(/\b(bot|rob[oô]|IA|assistente)\b/i));
});

test('with the default server option (sources required) social chat still only becomes a suggestion', async () => {
  const t = setup({ requireSources: true, model: async () => 'Opa, e aí! Tudo certo?' });
  await t.run('oi');
  assert.deepEqual(t.sent, []);
  assert.ok(t.audits().some((a) => a.code === 'no_approved_source'));
});

test('"quanto custa" without a source never invents a number: holding reply is ok, numbers/values are blocked', async () => {
  const invented = setup({ model: async () => 'Fica R$ 200, em 3 dias já entrego.' });
  await invented.run('quanto custa o serviço?');
  assert.deepEqual(invented.sent, [], 'invented value is never sent');
  assert.equal(invented.db.pending().length, 0, 'and it does not even become a draft');
  assert.ok(invented.audits().some((a) => a.code === 'output_filter' && /dado sem fonte aprovada/.test(a.reason)));

  const words = setup({ model: async () => 'Sai por duzentos reais, uns cinco dias úteis.' });
  await words.run('quanto custa o serviço?');
  assert.deepEqual(words.sent, [], 'numbers spelled out with a unit are blocked too');

  const confirm = setup({ model: async () => 'Deixa eu confirmar aqui e já te falo.' });
  await confirm.run('quanto custa o serviço?');
  assert.deepEqual(confirm.sent, ['Deixa eu confirmar aqui e já te falo.']);

  const suggestOnly = setup({ factNoSource: 'suggest', model: async () => 'Deixa eu confirmar aqui e já te falo.' });
  await suggestOnly.run('quanto custa o serviço?');
  assert.deepEqual(suggestOnly.sent, [], 'AUTO_REPLY_FACT_NO_SOURCE=suggest keeps factual questions as suggestions');
  assert.ok(suggestOnly.audits().some((a) => a.code === 'fact_needs_source'));
  await suggestOnly.run('oi');   // conversa social segue normal nesse modo
  assert.equal(suggestOnly.sent.length, 1);
});

test('with an approved source the answer may use the passage (numbers allowed because they are grounded)', async () => {
  const t = setup({ kb: withKb, model: async (p) => { assert.match(p, /5 dias úteis/); return 'Fica em 5 dias úteis depois de aprovado.'; } });
  await t.run('qual o prazo de entrega do serviço?');
  assert.deepEqual(t.sent, ['Fica em 5 dias úteis depois de aprovado.']);
  assert.ok(t.audits().find((a) => a.action === 'auto_sent').sources.length > 0);
});

test('complaints, negotiation, identity questions and [ENCAMINHAR] become a handoff: nothing is sent to the contact', async () => {
  for (const text of ['quero reclamar do atendimento', 'dá pra fazer um desconto?', 'quero cancelar tudo']) {
    const t = setup({ model: async () => 'Claro, sem problema!' });
    await t.run(text);
    assert.deepEqual(t.sent, [], text); assert.equal(t.prompts.length, 0, `${text}: model is not even called`);
  }
  const identity = setup({ model: async () => 'Sou eu mesmo!' });
  for (const text of ['você é um robô?', 'isso é bot?', 'estou falando com uma pessoa de verdade?', 'é humano ou inteligência artificial?']) await identity.run(text);
  assert.deepEqual(identity.sent, [], 'never confirms or denies being a bot: a human answers');
  assert.equal(identity.prompts.length, 0);
  assert.ok(identity.audits().some((a) => a.code === 'identity_question'));

  const handoff = setup({ model: async () => '[ENCAMINHAR]' });
  await handoff.run('me explica melhor como funciona?');
  assert.deepEqual(handoff.sent, []);
  assert.ok(!JSON.stringify(handoff.sent).includes('ENCAMINHAR'), 'the marker never reaches the contact');
});

test('replies that sound like a bot are rewritten once; if still robotic they are not sent', async () => {
  const t = setup({ model: async (p, n) => (n === 1 ? 'Olá! Sou um assistente virtual. Como posso ajudar você hoje?' : 'Opa, tudo certo! Me conta aí.') });
  await t.run('oi');
  assert.equal(t.prompts.length, 2, 'one rewrite pass');
  assert.match(t.prompts[1], /soou robótica ou citou IA\/bot/);
  assert.deepEqual(t.sent, ['Opa, tudo certo! Me conta aí.']);

  const stubborn = setup({ model: async () => 'Prezado cliente, como posso ajudar? Sou uma IA.' });
  await stubborn.run('oi');
  assert.deepEqual(stubborn.sent, []);
  assert.ok(stubborn.audits().some((a) => a.code === 'output_filter' && /menção a IA ou bot|texto robotizado/.test(a.reason)));
});

test('output filter: bot talk, robotic openers, lists and (when ungrounded) invented numbers', () => {
  const cfg = { ...DEFAULT_CONFIG, allowedLinkHosts: [] };
  const bad = [
    ['Sou um bot, mas posso ajudar.', 'menção a IA ou bot'],
    ['Como assistente virtual, te explico.', 'menção a IA ou bot'],
    ['Em que posso ajudar você hoje?', 'texto robotizado'],
    ['Prezado Fulano, tudo bem?', 'texto robotizado'],
    ['Peço desculpas pelo transtorno.', 'texto robotizado'],
    ['Opções:\n- plano A\n- plano B', 'texto robotizado'],
  ];
  for (const [text, problem] of bad) assert.ok(filterOutput(text, cfg).problems.includes(problem), text);
  for (const text of ['Opa, tudo certo? Já te respondo.', 'Fala! Bora resolver isso, me manda os detalhes.', 'Deixa eu ver aqui e já te falo.']) assert.equal(filterOutput(text, cfg, { strict: true }).ok, true, text);
  assert.ok(filterOutput('Custa 200 reais', cfg, { strict: true }).problems.includes('dado sem fonte aprovada'));
  assert.equal(filterOutput('Custa 200 reais', cfg).ok, true, 'a human-reviewed draft may carry numbers');
});

test('identity and fact detectors', () => {
  assert.equal(isIdentityQuestion('Você é um ROBÔ?'), true);
  assert.equal(isIdentityQuestion('isso é um chatbot?'), true);
  assert.equal(isIdentityQuestion('bom dia, tudo bem?'), false);
  assert.equal(needsFacts('Quanto custa?'), true);
  assert.equal(needsFacts('qual o prazo'), true);
  assert.equal(needsFacts('oi tudo bem'), false);
  const cfg = { ...DEFAULT_CONFIG, enabled: true, paused: false };
  assert.equal(evaluateRequest(cfg, { contactId: PN, isSaved: true, optIn: true, lastIncoming: 'você é uma pessoa de verdade?' }, [], new Date()).code, 'identity_question');
});

test('Antigravity panel prompt: same natural tone, no talk of project/server/bot', () => {
  const prompt = buildAntigravityPrompt({ action: 'chat', message: 'me ajuda com essa conversa' });
  const system = prompt.split('Pedido do Daniel')[0];
  assert.match(system, /Fale como gente/);
  assert.match(system, /como o próprio Daniel, em primeira pessoa/);
  assert.match(system, /Nunca diga que é robô, bot ou IA/);
  assert.ok(!/(servidor|projeto|variáveis de ambiente)/i.test(system), 'the prompt itself never mentions server/project');
});
