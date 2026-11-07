// Menus/botões: validação, renderização (nativo e texto), escolha e roteador. Evolution FALSA: nenhum WhatsApp real.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { activeItems, createMenuRouter, gotoProblem, gotoTargets, matchChoice, nativePlan, parseButtonId, renderLines, renderTemplate, renderText, validateField, validateItems, validateMenu } from './menus.mjs';
import { createMemoryMenuStore } from './menus-store.mjs';
import { createAutoSuggester, createSentRegistry } from './auto-suggest.mjs';
import { createStore, suggestReply, validateConfig, DEFAULT_CONFIG } from './copilot.mjs';
import { parseUpsert, selectedReplyId } from './whatsapp-utils.mjs';

const JID = '5511999990001@s.whatsapp.net';
const GROUP = '120363000000000000@g.us';
const item = (label, actions, extra = {}) => ({ label, actions, ...extra });
const reply = (text) => ({ type: 'reply', text });
const MENU = { name: 'Atendimento', description: 'Me conta o que você precisa:', render_mode: 'native' };

async function setup({ nativeEnabled = true, native } = {}) {
  const store = createMemoryMenuStore();
  const menu = await store.createMenu(validateMenu(MENU).value);
  const items = validateItems([
    item('Ver os serviços', [reply('Trabalho com edição de vídeo e roteiros, {{nome}}.')], { aliases: ['servicos', 'serviços'] }),
    item('Pedir orçamento', [{ type: 'ask', field: 'name', prompt: 'Qual o seu nome?' }, { type: 'ask', field: 'email', prompt: 'E o seu e-mail?' },
      { type: 'crm', stage: 'Em contato', note: 'Orçamento pedido pelo menu: {{resumo}}' }, reply('Anotado, {{nome}}! Já te retorno.')]),
    item('Falar comigo', [{ type: 'handoff', message: 'Opa, já te respondo aqui mesmo.' }]),
  ]);
  assert.ok(items.ok, items.errors.join('|'));
  await store.replaceItems(menu.id, items.items);
  const sent = []; const calls = []; const audits = [];
  const clock = { v: 0 };   // relógio do registro: permite avançar o tempo além da janela de eco
  const registry = createSentRegistry({ now: () => Date.now() + clock.v });
  const db = {
    async recordSent(jid, id, author) { calls.push(['recordSent', jid, id, author]); },
    async setCrmStage(jid, stage, actor) { calls.push(['crm', jid, stage, actor]); },
    async addNote(jid, author, text) { calls.push(['note', jid, author, text]); },
    async updateConversation(jid, patch, actor) { calls.push(['conv', jid, patch, actor]); },
    async dismissPendingReplies() { return 0; },
  };
  const router = createMenuRouter({
    store, getDb: async () => db, registry, nativeEnabled,
    sendText: async (m) => { sent.push(['text', m.text]); return { id: `T${sent.length}` }; },
    sendNative: native || (async (m) => { sent.push(['native', m.plan]); return { id: `N${sent.length}` }; }),
    audit: (e) => audits.push(e),
  });
  const incoming = (text, over = {}) => ({ instance: 'WA', jids: [JID], text, plain: true, replyId: null, ...over });
  return { store, menu, router, sent, calls, audits, registry, clock, incoming, texts: () => sent.filter((s) => s[0] === 'text').map((s) => s[1]) };
}

test('menu and button validation: required fields, limits, order, last-action rules and tone warnings', () => {
  assert.equal(validateMenu({ name: '', description: '' }).ok, false);
  assert.equal(validateMenu({ ...MENU, render_mode: 'xyz' }).ok, false);
  assert.equal(validateMenu(MENU).value.render_mode, 'native');
  assert.equal(validateMenu({ name: 'x', description: 'y' }).value.render_mode, 'text', 'factory default is numbered text; native is an opt-in per menu');
  assert.match(validateMenu({ ...MENU, description: 'Bem-vindo à nossa central de atendimento. Digite 1 para vendas' }).warnings.join(' '), /URA corporativa/);
  assert.equal(validateItems([]).ok, false);
  assert.equal(validateItems(Array.from({ length: 11 }, (_, i) => item(`b${i}`, [reply('x')]))).ok, false);
  assert.match(validateItems([item('A', [reply('x')]), item('a', [reply('y')])]).errors.join(' '), /repetido/);
  assert.match(validateItems([item('A', [{ type: 'foo' }])]).errors.join(' '), /tipo inválido/);
  assert.match(validateItems([item('A', [{ type: 'handoff' }, reply('depois')])]).errors.join(' '), /última ação/);
  assert.match(validateItems([item('A', [{ type: 'goto', menu_id: 2 }, reply('depois')])]).errors.join(' '), /última ação/);
  assert.equal(validateItems([item('A', [{ type: 'crm' }])]).ok, false, 'crm needs a stage and/or a note');
  assert.equal(validateItems([item('A', [{ type: 'ask', field: 'email', prompt: 'e-mail?' }])]).items[0].actions[0].validate, 'email');
  const long = validateItems([item('Um rótulo bem grande para o botão', [reply('x')])]);
  assert.ok(long.ok && /será cortado no botão nativo/.test(long.warnings.join(' ')));
  assert.match(validateItems([item('Digite 1 para vendas', [reply('x')])]).warnings.join(' '), /URA/);
  const ordered = validateItems([item('B', [reply('x')], { id: 7 }), item('A', [reply('y')], { id: 3 })]).items;
  assert.deepEqual(ordered.map((i) => [i.id, i.position, i.label]), [[7, 1, 'B'], [3, 2, 'A']], 'order is the list order, ids are kept');
});

test('text preview and native plan show what the contact sees; numbering follows the active buttons in order', () => {
  const menu = { id: 5, ...validateMenu(MENU).value };
  const items = validateItems([item('Ver os serviços', [reply('a')]), item('Escondido', [reply('b')], { active: false }), item('Pedir orçamento', [reply('c')]), item('Falar comigo', [reply('d')])]).items.map((i, n) => ({ ...i, id: n + 10 }));
  const text = renderText(menu, items);
  assert.match(text, /^Me conta o que você precisa:\n\n1 - Ver os serviços\n2 - Pedir orçamento\n3 - Falar comigo\n\n/);
  assert.ok(!/Escondido|digite|prezado/i.test(text));
  assert.equal(renderLines(items), '1 - Ver os serviços\n2 - Pedir orçamento\n3 - Falar comigo');
  const closers = new Set([0, 1, 2, 3].map((id) => renderText({ ...menu, id }, items).split('\n\n').at(-1)));
  assert.equal(closers.size, 4, 'the closing line varies with the menu, not a fixed IVR phrase');
  const plan = nativePlan(menu, items);
  assert.equal(plan.kind, 'buttons');
  assert.deepEqual(plan.body.buttons.map((b) => [b.type, b.displayText, b.id]), [['reply', 'Ver os serviços', 'm:5:10'], ['reply', 'Pedir orçamento', 'm:5:12'], ['reply', 'Falar comigo', 'm:5:13']]);
  const many = Array.from({ length: 5 }, (_, n) => ({ id: n + 1, position: n + 1, label: `Opção número ${n + 1} com nome comprido`, aliases: [], actions: [], active: true }));
  const list = nativePlan(menu, many);
  assert.equal(list.kind, 'list');
  assert.equal(list.body.sections[0].rows.length, 5);
  assert.ok(list.body.sections[0].rows.every((r) => r.title.length <= 24 && /^m:5:\d+$/.test(r.rowId)));
  assert.equal(nativePlan(menu, [{ id: 1, position: 1, label: 'Um rótulo bem grande para botão', actions: [], active: true }]).body.buttons[0].displayText.length, 20);
});

test('choice matching: number, label and alias for the WHOLE message only; native ids; templates and fields', () => {
  const items = validateItems([item('Ver os serviços', [reply('a')], { aliases: ['servicos'] }), item('Pedir orçamento', [reply('b')]), item('Falar comigo', [reply('c')])]).items;
  for (const text of ['1', ' 1 ', '1.', '1)', 'opção 1', 'Opcao 1', '1️⃣', 'ver os servicos', 'SERVICOS']) assert.equal(matchChoice(text, items)?.label, 'Ver os serviços', text);
  assert.equal(matchChoice('3', items).label, 'Falar comigo');
  for (const text of ['2 dias', 'quero a 2', '4', '0', 'oi', '', 'orçamento por favor']) assert.equal(matchChoice(text, items), null, text);
  assert.equal(parseButtonId('m:5:10', 5), 10);
  assert.equal(parseButtonId('m:6:10', 5), null, 'button of another menu');
  assert.equal(parseButtonId('abc', 5), null);
  assert.equal(renderTemplate('Oi {{nome}}, {{ email }} / {{cidade}} / {{resumo}}', { name: 'Ana', email: 'a@b.co' }), 'Oi Ana, a@b.co /  / nome: Ana, e-mail: a@b.co');
  assert.equal(validateField('  ana@b.co ', 'email'), 'ana@b.co');
  assert.equal(validateField('ana arroba', 'email'), null);
  assert.equal(validateField('x'.repeat(121), 'text'), null);
});

test('goto: cycles and long chains are rejected', () => {
  assert.equal(gotoProblem(new Map([[1, [2]], [2, [3]], [3, []]])), null);
  assert.match(gotoProblem(new Map([[1, [2]], [2, [1]]])), /círculo/);
  assert.match(gotoProblem(new Map([[1, [1]]])), /círculo/);
  assert.match(gotoProblem(new Map([[1, [2]], [2, [3]], [3, [4]], [4, [5]], [5, [6]], [6, []]])), /longo demais/);
  assert.deepEqual(gotoTargets([{ actions: [{ type: 'goto', menu_id: 3 }] }, { actions: [reply('x')] }]), [3]);
});

test('sending a menu: native first; explicit native error falls back to numbered text exactly once; mode is audited', async () => {
  const ok = await setup();
  const r = await ok.router.sendMenu({ jid: JID, instance: 'WA', menuId: ok.menu.id, by: 'admin@x' });
  assert.equal(r.modeUsed, 'native'); assert.equal(r.fallback, false); assert.equal(r.nativeUnconfirmed, true);
  assert.equal(ok.sent.length, 1); assert.equal(ok.sent[0][0], 'native');
  assert.deepEqual(ok.audits.find((a) => a.action === 'menu_sent'), { action: 'menu_sent', menuId: ok.menu.id, modeRequested: 'native', modeUsed: 'native', fallback: false, items: 3, contactId: JID, by: 'admin@x', depth: 0 });
  assert.equal((await ok.store.getSession(JID)).awaiting, 'choice');

  const broken = await setup({ native: async () => { throw new Error('sendButtons 400'); } });
  const f = await broken.router.sendMenu({ jid: JID, instance: 'WA', menuId: broken.menu.id });
  assert.equal(f.modeUsed, 'text'); assert.equal(f.fallback, true); assert.equal(f.reason, 'native_error'); assert.equal(f.nativeUnconfirmed, false);
  assert.equal(broken.sent.length, 1, 'only the text went out: no duplicate');
  assert.match(broken.texts()[0], /1 - Ver os serviços\n2 - Pedir orçamento\n3 - Falar comigo/);
  const a = broken.audits.find((x) => x.action === 'menu_sent');
  assert.deepEqual([a.modeRequested, a.modeUsed, a.fallback, a.reason], ['native', 'text', true, 'native_error']);

  const off = await setup({ nativeEnabled: false });
  const o = await off.router.sendMenu({ jid: JID, instance: 'WA', menuId: off.menu.id });
  assert.deepEqual([o.modeUsed, o.fallback, o.reason], ['text', true, 'native_disabled']);

  const textMenu = await setup();
  const forced = await textMenu.router.sendMenu({ jid: JID, instance: 'WA', menuId: textMenu.menu.id, mode: 'text' });
  assert.deepEqual([forced.modeUsed, forced.fallback], ['text', false]);
  assert.equal(textMenu.sent.filter((s) => s[0] === 'native').length, 0, '"resend as text" never tries the native route again');
  await textMenu.store.updateMenu(textMenu.menu.id, { ...validateMenu(MENU).value, active: false });
  await assert.rejects(textMenu.router.sendMenu({ jid: JID, instance: 'WA', menuId: textMenu.menu.id }), /desativado/);
  assert.ok(textMenu.registry.has('T1'), 'our own ids are registered so the webhook echo is not taken as a human');
  assert.ok(textMenu.calls.some((c) => c[0] === 'recordSent' && c[3] === 'humano'));
});

test('contact replies: text number, alias and native button id run the actions; no session means the AI keeps the message', async () => {
  const t = await setup();
  assert.deepEqual(await t.router.handleIncoming(t.incoming('oi')), { handled: false }, 'no session: not handled');
  await t.router.sendMenu({ jid: JID, instance: 'WA', menuId: t.menu.id });
  const first = (await t.store.getMenu(t.menu.id)).items[0];
  assert.deepEqual(await t.router.handleIncoming(t.incoming('1')), { handled: true });
  assert.match(t.texts().at(-1), /^Trabalho com edição de vídeo e roteiros, \.$/, 'unknown field renders empty');
  assert.equal(await t.store.getSession(JID), null, 'session ends after the last action');
  await t.router.sendMenu({ jid: JID, instance: 'WA', menuId: t.menu.id });
  await t.router.handleIncoming(t.incoming('', { replyId: `m:${t.menu.id}:${first.id}`, plain: false }));
  assert.equal(t.texts().length, 2, 'native button id routes like the number');
  assert.ok(t.audits.some((a) => a.action === 'menu_choice' && a.via === 'button'));
  await t.router.sendMenu({ jid: JID, instance: 'WA', menuId: t.menu.id });
  await t.router.handleIncoming(t.incoming('serviços'));
  assert.equal(t.texts().length, 3, 'alias works');
  assert.ok(t.audits.some((a) => a.action === 'menu_done'));
});

test('ask -> validate -> CRM + note + reply: data is collected, stored and the human decision is recorded', async () => {
  const t = await setup();
  await t.router.sendMenu({ jid: JID, instance: 'WA', menuId: t.menu.id });
  await t.router.handleIncoming(t.incoming('2'));
  assert.equal(t.texts().at(-1), 'Qual o seu nome?');
  assert.equal((await t.store.getSession(JID)).awaiting, 'field');
  await t.router.handleIncoming(t.incoming('Ana Souza'));
  assert.equal(t.texts().at(-1), 'E o seu e-mail?');
  await t.router.handleIncoming(t.incoming('isso não é e-mail'));
  assert.match(t.texts().at(-1), /Não consegui ler esse e-mail/);
  assert.equal((await t.store.getSession(JID)).attempts, 1);
  await t.router.handleIncoming(t.incoming('ana@exemplo.com'));
  assert.deepEqual(await t.store.getContactData(JID), { name: 'Ana Souza', email: 'ana@exemplo.com' });
  assert.deepEqual(t.calls.find((c) => c[0] === 'crm'), ['crm', JID, 'Em contato', 'humano']);
  assert.deepEqual(t.calls.find((c) => c[0] === 'note'), ['note', JID, 'humano', 'Orçamento pedido pelo menu: nome: Ana Souza, e-mail: ana@exemplo.com']);
  assert.equal(t.texts().at(-1), 'Anotado, Ana Souza! Já te retorno.');
  assert.equal(await t.store.getSession(JID), null);
  assert.ok(!JSON.stringify(t.audits).includes('ana@exemplo.com'), 'audit never stores what the contact typed');
});

test('handoff takes the conversation (and stops the AI/auto mode); goto chains another menu', async () => {
  const t = await setup();
  await t.router.sendMenu({ jid: JID, instance: 'WA', menuId: t.menu.id });
  await t.router.handleIncoming(t.incoming('3'));
  assert.deepEqual(t.calls.find((c) => c[0] === 'conv'), ['conv', JID, { mode: 'human' }, 'humano']);
  assert.equal(t.texts().at(-1), 'Opa, já te respondo aqui mesmo.');
  assert.equal(await t.store.getSession(JID), null);

  const second = await t.store.createMenu(validateMenu({ name: 'Orçamento', description: 'Que tipo de serviço?', render_mode: 'text' }).value);
  await t.store.replaceItems(second.id, validateItems([item('Vídeo', [reply('Boa!')]), item('Roteiro', [reply('Fechou!')])]).items);
  const main = await t.store.getMenu(t.menu.id);
  await t.store.replaceItems(t.menu.id, validateItems([item('Ver mais', [{ type: 'goto', menu_id: second.id }]), ...main.items.map((i) => ({ ...i }))]).items);
  await t.router.sendMenu({ jid: JID, instance: 'WA', menuId: t.menu.id, mode: 'text' });
  await t.router.handleIncoming(t.incoming('1'));
  assert.match(t.texts().at(-1), /Que tipo de serviço\?\n\n1 - Vídeo\n2 - Roteiro/);
  assert.equal((await t.store.getSession(JID)).menu_id, second.id, 'the session moved to the next menu');
  await t.router.handleIncoming(t.incoming('2'));
  assert.equal(t.texts().at(-1), 'Fechou!');
});

test('invalid answers: one resend, then the conversation goes back to the AI/human; expiry and human messages end the session', async () => {
  const t = await setup();
  await t.router.sendMenu({ jid: JID, instance: 'WA', menuId: t.menu.id, mode: 'text' });
  assert.deepEqual(await t.router.handleIncoming(t.incoming('quero saber o preço, 2 dias')), { handled: true });
  assert.match(t.texts().at(-1), /^Não entendi, responde só com o número:\n\n1 - Ver os serviços/);
  assert.deepEqual(await t.router.handleIncoming(t.incoming('blá')), { handled: false });
  assert.equal(await t.store.getSession(JID), null);
  assert.ok(t.audits.some((a) => a.action === 'menu_abandoned'));

  await t.router.sendMenu({ jid: JID, instance: 'WA', menuId: t.menu.id, mode: 'text' });
  const s = await t.store.getSession(JID);
  await t.store.saveSession({ ...s, expires_at: new Date(Date.now() - 1000).toISOString() });
  assert.deepEqual(await t.router.handleIncoming(t.incoming('1')), { handled: false });
  assert.ok(t.audits.some((a) => a.action === 'menu_expired'));

  await t.router.sendMenu({ jid: JID, instance: 'WA', menuId: t.menu.id, mode: 'text' });
  await t.router.onHumanMessage({ jids: [JID] });
  assert.equal(await t.store.getSession(JID), null);
  assert.ok(t.audits.some((a) => a.action === 'menu_cancelled' && a.reason === 'human_replied'));
});

test('webhook integration: during a menu the AI stays quiet; a human message cancels, our own echo does not; groups never', async () => {
  const t = await setup();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'menu-ai-'));
  const store = createStore(dir, { allowAutomatic: true });
  store.writeConfig(validateConfig({ enabled: true, paused: false, mode: 'suggestion' }, DEFAULT_CONFIG, { allowAutomatic: true }));
  const conv = { aiEnabled: true, mode: 'suggestion', autoReply: false, lastAiReplyAt: null };
  const suggestions = []; let modelCalls = 0;
  const db = { async getConversation(jid) { return { jid, ...conv }; }, async recordReplySuggestion(jid, draft) { suggestions.push(draft); return { id: String(suggestions.length) }; },
    async dismissPendingReplies() { return 0; }, async resolveSuggestion() { return null; }, async recordSent() {}, async pauseAutoReply() { return false; } };
  const suggester = createAutoSuggester({ store, getDb: async () => db, debounceMs: 10, registry: t.registry, antiRepeat: false, fetchContext: async () => [],
    interceptIncoming: (msg) => t.router.handleIncoming(msg), onHumanMessage: (msg) => t.router.onHumanMessage(msg),
    suggest: (request) => suggestReply({ store, knowledge: null, runModel: async () => { modelCalls++; return 'Opa, tudo certo por aqui?'; }, user: { email: 'w' }, request }) });
  const upsert = (text, key = {}, message = { conversation: text }) => ({ event: 'messages.upsert', instance: 'WA', data: { key: { id: `M${Math.random().toString(36).slice(2)}`, remoteJid: JID, fromMe: false, ...key }, message, messageTimestamp: Math.floor(Date.now() / 1000) } });
  const run = async (p) => { await suggester.handleWebhook(p); await suggester.whenIdle(); };

  await run(upsert('oi, tudo bem?'));
  assert.equal(modelCalls, 1, 'without a menu session the AI works as usual');
  await t.router.sendMenu({ jid: JID, instance: 'WA', menuId: t.menu.id, mode: 'text' });
  await run(upsert('1'));
  assert.equal(modelCalls, 1, 'the contact answered the menu: no AI draft for that message');
  assert.equal(t.texts().length, 2, 'menu + the action reply');
  await t.router.sendMenu({ jid: JID, instance: 'WA', menuId: t.menu.id, mode: 'text' });
  const menuId = t.registry.has('T3') ? 'T3' : 'T4';
  await run(upsert('', { fromMe: true, id: menuId }, { conversation: 'menu' }));   // eco da nossa própria mensagem
  assert.ok(await t.store.getSession(JID), 'our own echo does not cancel the session');
  t.clock.v = 10000;   // passou a janela de eco dos nossos envios
  await run(upsert('opa, deixa comigo', { fromMe: true, id: 'HUMAN1' }));
  assert.equal(await t.store.getSession(JID), null, 'a human writing cancels the menu');
  // botão nativo (resposta) é entendido como mensagem do contato
  const nativeReply = upsert('', {}, { buttonsResponseMessage: { selectedButtonId: 'm:1:2', selectedDisplayText: 'Pedir orçamento' } });
  const [parsed] = parseUpsert(nativeReply);
  assert.equal(parsed.replyId, 'm:1:2'); assert.equal(parsed.text, 'Pedir orçamento'); assert.equal(parsed.plain, false);
  assert.equal(selectedReplyId({ message: { interactiveResponseMessage: { nativeFlowResponseMessage: { paramsJson: '{"id":"m:1:3"}' } } } }), 'm:1:3');
  assert.equal(selectedReplyId({ message: { listResponseMessage: { singleSelectReply: { selectedRowId: 'm:1:4' } } } }), 'm:1:4');
  // grupos nunca
  const g = await setup();
  await g.store.saveSession({ jid: GROUP, menu_id: g.menu.id, awaiting: 'choice', mode_used: 'text', expires_at: new Date(Date.now() + 60000).toISOString() });
  const before = g.sent.length;
  await createAutoSuggester({ store, getDb: async () => db, debounceMs: 5, interceptIncoming: (m) => g.router.handleIncoming(m), fetchContext: async () => [], suggest: async () => null })
    .handleWebhook(upsert('1', { remoteJid: GROUP }));
  assert.equal(g.sent.length, before, 'groups are ignored before any menu logic');
});

test('sends per incoming message are capped and active/inactive buttons are respected', async () => {
  const t = await setup();
  const long = validateItems([item('Muito', [reply('1'), reply('2'), reply('3'), reply('4'), reply('5'), reply('6')])]).items;
  await t.store.replaceItems(t.menu.id, long);
  await t.router.sendMenu({ jid: JID, instance: 'WA', menuId: t.menu.id, mode: 'text' });
  const before = t.texts().length;
  await t.router.handleIncoming(t.incoming('1'));
  assert.equal(t.texts().length - before, 4, 'at most 4 messages per incoming message');
  assert.equal(activeItems([{ position: 2, active: true, label: 'b' }, { position: 1, active: false, label: 'a' }, { position: 3, active: true, label: 'c' }]).map((i) => i.label).join(), 'b,c');
});
