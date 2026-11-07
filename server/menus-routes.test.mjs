// Rotas de menus (admin) com Evolution FALSA: criação, validação, envio nativo/texto com fallback, sessões e roteamento pelo webhook.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createMemoryMenuStore } from './menus-store.mjs';

const JID = '5511999990001@s.whatsapp.net';
const GROUP = '120363000000000000@g.us';

test('menus API: admin only, validated builder, native send with automatic text fallback, sessions and webhook routing', async (t) => {
  const evo = { buttons: [], lists: [], texts: [] };
  const behavior = { buttons: 'ok', list: 'ok' };           // ok | error400 | silent | sections400
  const upstream = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/auth/v1/user') return res.end(JSON.stringify({ id: req.headers.authorization === 'Bearer tech' ? 'tech' : 'admin', email: 'admin@example.test' }));
    if (req.url.startsWith('/rest/v1/profiles')) return res.end(JSON.stringify([{ id: 'x', role: req.url.includes('tech') ? 'tecnico' : 'admin', full_name: 'Fixture' }]));
    if (req.url === '/message/sendButtons/WA') {
      evo.buttons.push(body);
      if (behavior.buttons === 'error400') return res.writeHead(400).end(JSON.stringify({ response: { message: ['TypeError: this.isZero is not a function'] } }));
      return res.writeHead(201).end(JSON.stringify(behavior.buttons === 'silent' ? { key: { id: 'NB1' }, status: 'PENDING' } : { key: { id: 'NB1' }, status: 'PENDING' }));
    }
    if (req.url === '/message/sendList/WA') {
      evo.lists.push(body);
      if (behavior.list === 'error400' || (behavior.list === 'sections400' && body.sections)) return res.writeHead(400).end('{}');
      return res.writeHead(201).end(JSON.stringify({ key: { id: 'NL1' } }));
    }
    if (req.url === '/message/sendText/WA') { evo.texts.push(body); return res.writeHead(201).end(JSON.stringify({ key: { id: `TX${evo.texts.length}` } })); }
    res.writeHead(404).end('{}');
  });
  await new Promise((r) => upstream.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${upstream.address().port}`;
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'menus-data-'));
  Object.assign(process.env, { SUPABASE_URL: url, SUPABASE_ANON_KEY: 'anon', EVOLUTION_URL: url, EVOLUTION_APIKEY: 'k', COPILOT_DATA_DIR: data, NEBRIA_DIR: '',
    AGY_BIN: path.join(data, 'sem-agy'), EVOLUTION_WEBHOOK_SECRET: 'segredo', AUTO_SUGGEST_DEBOUNCE_MS: '10' });
  delete process.env.COPILOT_ALLOW_AUTOMATIC; delete process.env.MENUS_ENABLED; delete process.env.MENUS_NATIVE;
  const { server, autoSuggester, __setStateDbForTests, __setAgyRunnerForTests } = await import('./server.mjs');
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/mensageiro/api`;
  t.after(() => Promise.all([new Promise((r) => server.close(r)), new Promise((r) => upstream.close(r))]));

  const menus = createMemoryMenuStore(); const dbCalls = []; let available = true;
  __setStateDbForTests({
    menus, menusAvailable: async () => available,
    async getConversation(jid) { return { jid, aiEnabled: false, mode: 'suggestion', autoReply: false }; },
    async recordSent(...a) { dbCalls.push(['recordSent', ...a]); }, async setCrmStage(...a) { dbCalls.push(['crm', ...a]); }, async addNote(...a) { dbCalls.push(['note', ...a]); },
    async updateConversation(...a) { dbCalls.push(['conv', ...a]); }, async dismissPendingReplies() { return 0; },
  });
  let aiCalls = 0;
  __setAgyRunnerForTests(async () => { aiCalls++; return 'Opa, tudo certo?'; });
  const call = (p, options = {}) => fetch(base + p, { ...options, headers: { Authorization: 'Bearer admin', 'Content-Type': 'application/json', ...options.headers } });
  const json = (p, method, body) => call(p, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  const hook = (data, key = {}) => fetch(`${base}/webhook/evolution`, { method: 'POST', headers: { 'x-webhook-secret': 'segredo', 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'messages.upsert', instance: 'WA', data: { key: { id: `IN${Math.random().toString(36).slice(2)}`, remoteJid: JID, fromMe: false, ...key }, messageTimestamp: Math.floor(Date.now() / 1000), ...data } }) });
  const audits = async () => (await (await call('/copilot/audit')).json()).entries;
  const reply = (text) => ({ type: 'reply', text });
  const items3 = [{ label: 'Ver os serviços', actions: [reply('Faço vídeos e roteiros.')] }, { label: 'Pedir orçamento', actions: [{ type: 'ask', field: 'name', prompt: 'Qual o seu nome?' }, { type: 'crm', stage: 'Em contato' }, reply('Anotado, {{nome}}!')] }, { label: 'Falar comigo', actions: [{ type: 'handoff', message: 'Já te respondo.' }] }];
  let menuId;

  await t.test('admin only; capabilities warn about silent native failures; preview works without the database', async () => {
    assert.equal((await fetch(`${base}/menus`)).status, 401);
    assert.equal((await json('/menus', 'GET')).status, 200);
    assert.equal((await call('/menus', { headers: { Authorization: 'Bearer tech' } })).status, 403);
    assert.equal((await call('/menus/1/send', { method: 'POST', body: '{}', headers: { Authorization: 'Bearer tech' } })).status, 403);
    const caps = await (await json('/menus/capabilities', 'GET')).json();
    assert.equal(caps.available, true); assert.equal(caps.native.enabled, true);
    assert.match(caps.native.warning, /pode ser aceito pela API e nunca chegar/);
    const preview = await (await json('/menus/preview', 'POST', { menu: { id: 3, name: 'X', description: 'Digite 1 para vendas' }, items: items3 })).json();
    assert.equal(preview.valid, true);
    assert.match(preview.text, /1 - Ver os serviços\n2 - Pedir orçamento\n3 - Falar comigo/);
    assert.equal(preview.native.kind, 'buttons'); assert.equal(preview.native.body.buttons.length, 3);
    assert.match(preview.warnings.join(' '), /URA corporativa/);
    const bad = await (await json('/menus/preview', 'POST', { menu: {}, items: [] })).json();
    assert.equal(bad.valid, false); assert.ok(bad.errors.length >= 2);
  });

  await t.test('create, edit, list and delete; invalid input is rejected with readable errors', async () => {
    assert.equal((await json('/menus', 'POST', { name: '', description: '' })).status, 400);
    const created = await json('/menus', 'POST', { name: 'Atendimento', description: 'Me conta o que você precisa:' });
    assert.equal(created.status, 201);
    menuId = (await created.json()).menu.id;
    assert.equal((await json(`/menus/${menuId}`, 'PUT', { description: 'Fala aí, o que você precisa?', render_mode: 'text' })).status, 200);
    assert.equal((await json(`/menus/${menuId}`, 'PUT', { render_mode: 'zzz' })).status, 400);
    const got = (await (await json(`/menus/${menuId}`, 'GET')).json()).menu;
    assert.deepEqual([got.description, got.render_mode], ['Fala aí, o que você precisa?', 'text']);
    assert.equal((await json(`/menus/${menuId}`, 'PUT', { render_mode: 'native' })).status, 200);
    assert.equal((await json('/menus/999', 'GET')).status, 404);
    const spare = (await (await json('/menus', 'POST', { name: 'Descartável', description: 'x' })).json()).menu.id;
    assert.equal((await json(`/menus/${spare}`, 'DELETE')).status, 200);
    assert.equal((await json(`/menus/${spare}`, 'GET')).status, 404);
    assert.deepEqual((await (await json('/menus', 'GET')).json()).menus.map((m) => m.name), ['Atendimento']);
  });

  await t.test('items: atomic ordered save keeps ids on reorder; rejects missing targets, self-links and cycles', async () => {
    assert.equal((await json(`/menus/${menuId}/items`, 'PUT', { items: [] })).status, 400);
    assert.equal((await json(`/menus/${menuId}/items`, 'PUT', { items: [{ label: 'A', actions: [{ type: 'goto', menu_id: menuId }] }] })).status, 400);
    assert.equal((await json(`/menus/${menuId}/items`, 'PUT', { items: [{ label: 'A', actions: [{ type: 'goto', menu_id: 999 }] }] })).status, 400);
    const saved = await json(`/menus/${menuId}/items`, 'PUT', { items: items3 });
    assert.equal(saved.status, 200);
    const first = (await saved.json()).items;
    assert.deepEqual(first.map((i) => [i.position, i.label]), [[1, 'Ver os serviços'], [2, 'Pedir orçamento'], [3, 'Falar comigo']]);
    const reordered = (await (await json(`/menus/${menuId}/items`, 'PUT', { items: [first[2], first[0], first[1]] })).json()).items;
    assert.deepEqual(reordered.map((i) => [i.id, i.position]), [[first[2].id, 1], [first[0].id, 2], [first[1].id, 3]], 'ids survive a reorder');
    await json(`/menus/${menuId}/items`, 'PUT', { items: first });
    const other = (await (await json('/menus', 'POST', { name: 'Outro', description: 'Qual serviço?' })).json()).menu.id;
    assert.equal((await json(`/menus/${other}/items`, 'PUT', { items: [{ label: 'Voltar', actions: [{ type: 'goto', menu_id: menuId }] }] })).status, 200);
    const cycle = await json(`/menus/${menuId}/items`, 'PUT', { items: [{ label: 'Ir', actions: [{ type: 'goto', menu_id: other }] }] });
    assert.equal(cycle.status, 400);
    assert.match((await cycle.json()).error, /círculo/);
    await json(`/menus/${other}`, 'DELETE');
  });

  await t.test('send: individual chats only; native buttons use the Evolution route with ids; mode and fallback are audited', async () => {
    assert.equal((await json(`/menus/${menuId}/send`, 'POST', { jid: GROUP, instance: 'WA' })).status, 400);
    assert.equal((await json(`/menus/${menuId}/send`, 'POST', { jid: JID, instance: '../x' })).status, 400);
    assert.equal((await json(`/menus/${menuId}/send`, 'POST', { jid: JID, instance: 'WA', mode: 'voz' })).status, 400);
    const sent = await (await json(`/menus/${menuId}/send`, 'POST', { jid: JID, instance: 'WA' })).json();
    assert.deepEqual([sent.modeUsed, sent.fallback, sent.nativeUnconfirmed], ['native', false, true]);
    assert.equal(evo.buttons.length, 1); assert.equal(evo.texts.length, 0);
    const body = evo.buttons[0];
    assert.equal(body.number, JID);
    assert.deepEqual(body.buttons.map((b) => [b.type, b.displayText]), [['reply', 'Ver os serviços'], ['reply', 'Pedir orçamento'], ['reply', 'Falar comigo']]);
    assert.ok(body.buttons.every((b) => new RegExp(`^m:${menuId}:\\d+$`).test(b.id)));
    const session = (await (await json(`/menu-sessions?jid=${encodeURIComponent(JID)}`, 'GET')).json()).session;
    assert.deepEqual([session.menu_name, session.mode_used, session.awaiting], ['Atendimento', 'native', 'choice']);
    assert.equal((await audits()).find((e) => e.action === 'menu_sent' && e.modeUsed === 'native').modeRequested, 'native');

    behavior.buttons = 'error400';   // ex.: 400 "this.isZero is not a function"
    const before = evo.texts.length;
    const fell = await (await json(`/menus/${menuId}/send`, 'POST', { jid: JID, instance: 'WA' })).json();
    assert.deepEqual([fell.modeUsed, fell.fallback, fell.reason, fell.nativeUnconfirmed], ['text', true, 'native_error', false]);
    assert.equal(evo.texts.length - before, 1, 'one numbered text, no duplicate');
    assert.match(evo.texts.at(-1).text, /1 - Ver os serviços\n2 - Pedir orçamento\n3 - Falar comigo/);
    const entry = (await audits()).find((e) => e.action === 'menu_sent' && e.fallback === true);
    assert.deepEqual([entry.modeRequested, entry.modeUsed, entry.reason], ['native', 'text', 'native_error']);

    behavior.buttons = 'ok';
    const nb = evo.buttons.length;
    const asText = await (await json(`/menus/${menuId}/send`, 'POST', { jid: JID, instance: 'WA', mode: 'text' })).json();
    assert.deepEqual([asText.modeUsed, asText.fallback], ['text', false]);
    assert.equal(evo.buttons.length, nb, '"reenviar como texto" never touches the native route');
  });

  await t.test('more than 3 buttons use the list route (sections, then values on 400); if both fail the text goes out', async () => {
    const big = (await (await json('/menus', 'POST', { name: 'Grande', description: 'Escolhe uma:', render_mode: 'native' })).json()).menu.id;
    await json(`/menus/${big}/items`, 'PUT', { items: ['Um', 'Dois', 'Três', 'Quatro', 'Cinco'].map((label) => ({ label, actions: [reply(label)] })) });
    behavior.list = 'sections400';
    const r = await (await json(`/menus/${big}/send`, 'POST', { jid: JID, instance: 'WA' })).json();
    assert.equal(r.modeUsed, 'native');
    assert.equal(evo.lists.length, 2); assert.ok(evo.lists[0].sections && !evo.lists[0].values); assert.ok(evo.lists[1].values && !evo.lists[1].sections);
    assert.equal(evo.lists[1].values[0].rows.length, 5);
    behavior.list = 'error400';
    const before = evo.texts.length;
    const f = await (await json(`/menus/${big}/send`, 'POST', { jid: JID, instance: 'WA' })).json();
    assert.deepEqual([f.modeUsed, f.fallback], ['text', true]);
    assert.equal(evo.texts.length - before, 1);
    behavior.list = 'ok';
  });

  await t.test('webhook: a contact answer runs the actions, the AI stays quiet, and a native button id routes like the number', async () => {
    await json(`/menus/${menuId}/send`, 'POST', { jid: JID, instance: 'WA', mode: 'text' });
    const texts0 = evo.texts.length;
    assert.equal((await hook({ message: { conversation: '2' } })).status, 200);
    await autoSuggester.whenIdle();
    assert.equal(evo.texts.at(-1).text, 'Qual o seu nome?'); assert.equal(evo.texts.length - texts0, 1);
    await hook({ message: { conversation: 'Ana Souza' } }); await autoSuggester.whenIdle();
    assert.equal(evo.texts.at(-1).text, 'Anotado, Ana Souza!');
    assert.deepEqual(dbCalls.find((c) => c[0] === 'crm'), ['crm', JID, 'Em contato', 'humano']);
    assert.equal(aiCalls, 0, 'the AI never ran for menu answers');
    assert.equal((await (await json(`/menu-sessions?jid=${encodeURIComponent(JID)}`, 'GET')).json()).session, null);

    const items = (await (await json(`/menus/${menuId}`, 'GET')).json()).menu.items;
    await json(`/menus/${menuId}/send`, 'POST', { jid: JID, instance: 'WA' });
    await hook({ message: { buttonsResponseMessage: { selectedButtonId: `m:${menuId}:${items[0].id}`, selectedDisplayText: 'Ver os serviços' } } }); await autoSuggester.whenIdle();
    assert.equal(evo.texts.at(-1).text, 'Faço vídeos e roteiros.');
    await json(`/menus/${menuId}/send`, 'POST', { jid: JID, instance: 'WA', mode: 'text' });
    await hook({ message: { conversation: '3' } }); await autoSuggester.whenIdle();
    assert.deepEqual(dbCalls.find((c) => c[0] === 'conv'), ['conv', JID, { mode: 'human' }, 'humano']);
    const log = await audits();
    assert.ok(!JSON.stringify(log).includes('Ana Souza'), 'audit never stores what the contact typed');
    assert.ok(log.some((e) => e.action === 'menu_choice') && log.some((e) => e.action === 'menu_handoff'));
  });

  await t.test('end session by API; without the migration the routes answer 503 but preview and capabilities still work', async () => {
    await json(`/menus/${menuId}/send`, 'POST', { jid: JID, instance: 'WA', mode: 'text' });
    assert.deepEqual(await (await json(`/menu-sessions?jid=${encodeURIComponent(JID)}`, 'DELETE')).json(), { ended: true });
    assert.equal((await (await json(`/menu-sessions?jid=${encodeURIComponent(JID)}`, 'GET')).json()).session, null);
    available = false;
    const res = await json('/menus', 'GET');
    assert.equal(res.status, 503); assert.equal((await res.json()).code, 'menus_unavailable');
    assert.equal((await json('/menus/preview', 'POST', { menu: { name: 'a', description: 'b' }, items: items3 })).status, 200);
    assert.equal((await (await json('/menus/capabilities', 'GET')).json()).available, false);
    const texts = evo.texts.length;
    await hook({ message: { conversation: '1' } }); await autoSuggester.whenIdle();
    assert.equal(evo.texts.length, texts, 'router is inert without the tables');
    available = true;
  });
});
