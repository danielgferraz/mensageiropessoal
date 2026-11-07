// "Meu jeito de escrever": candidatas vêm só das mensagens ENVIADAS pelo próprio admin, filtradas; o admin escolhe; nada vaza para outro contato.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const PN = '5511999990001@s.whatsapp.net';
const PN2 = '5511999990002@s.whatsapp.net';
const GROUP = '120363000000000000@g.us';
const row = (id, jid, text, fromMe, at) => ({ key: { id, remoteJid: jid, fromMe }, message: { conversation: text }, messageTimestamp: at });

test('style routes: admin only, candidates from own sent messages, sanitized, chosen samples feed the prompt', async (t) => {
  const calls = [];
  const upstream = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
    calls.push({ url: req.url, body });
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/auth/v1/user') return res.end(JSON.stringify({ id: req.headers.authorization === 'Bearer tech' ? 'tech' : 'admin', email: 'admin@example.test' }));
    if (req.url.startsWith('/rest/v1/profiles')) return res.end(JSON.stringify([{ id: 'x', role: req.url.includes('tech') ? 'tecnico' : 'admin', full_name: 'Fixture' }]));
    if (req.url === '/chat/findChats/WA') return res.end(JSON.stringify([{ remoteJid: PN }, { remoteJid: PN2 }, { remoteJid: GROUP }]));
    if (req.url === '/chat/findMessages/WA') {
      const jid = body.where.key.remoteJid;
      if (jid === PN) return res.end(JSON.stringify({ messages: { records: [
        row('a1', PN, 'opa blz, te falo já', true, 10), row('a2', PN, 'quero um orçamento', false, 11), row('a3', PN, 'me liga no 11 99999-0001', true, 12),
        row('a4', PN, 'fala com a Maria que ela resolve', true, 13), row('a5', PN, 'Claro! Qualquer dúvida é só chamar.', true, 14), row('a6', PN, 'fechou, valeu', true, 15) ] } }));
      if (jid === PN2) return res.end(JSON.stringify({ messages: { records: [row('b1', PN2, 'OPA BLZ, te falo já', true, 20), row('b2', PN2, 'tmj', true, 21), row('b3', PN2, 'veja https://site.com', true, 22)] } }));
    }
    res.writeHead(404).end('{}');
  });
  await new Promise((r) => upstream.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${upstream.address().port}`;
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'style-data-'));
  Object.assign(process.env, { SUPABASE_URL: url, SUPABASE_ANON_KEY: 'anon', EVOLUTION_URL: url, EVOLUTION_APIKEY: 'k', COPILOT_DATA_DIR: data, NEBRIA_DIR: '', AGY_BIN: path.join(data, 'sem-agy') });
  delete process.env.COPILOT_ALLOW_AUTOMATIC;
  const { server, __setAgyRunnerForTests } = await import('./server.mjs');
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/mensageiro/api`;
  t.after(() => Promise.all([new Promise((r) => server.close(r)), new Promise((r) => upstream.close(r))]));
  const call = (p, options = {}) => fetch(base + p, { ...options, headers: { Authorization: 'Bearer admin', 'Content-Type': 'application/json', ...options.headers } });

  await t.test('anonymous and non-admin callers are rejected', async () => {
    for (const p of ['/copilot/style-samples', '/copilot/style-candidates?instance=WA']) {
      assert.equal((await fetch(base + p)).status, 401);
      assert.equal((await call(p, { headers: { Authorization: 'Bearer tech' } })).status, 403);
    }
    assert.equal((await call('/copilot/style-samples', { method: 'PUT', body: '{"samples":["oi"]}', headers: { Authorization: 'Bearer tech' } })).status, 403);
  });

  await t.test('candidates: only messages sent by the owner that pass the filter; groups skipped; nothing is saved by looking', async () => {
    assert.equal((await call('/copilot/style-candidates?instance=../x')).status, 400);
    const { candidates } = await (await call('/copilot/style-candidates?instance=WA')).json();
    assert.deepEqual(candidates.sort(), ['fechou, valeu', 'opa blz, te falo já', 'tmj']);
    assert.ok(!calls.some((c) => c.body?.where?.key?.remoteJid === GROUP), 'group chats are not read');
    assert.deepEqual((await (await call('/copilot/style-samples')).json()).samples, []);
  });

  await t.test('saving keeps only clean samples (max 10) and the audit has counts, never the text', async () => {
    const put = await (await call('/copilot/style-samples', { method: 'PUT', body: JSON.stringify({ samples: ['opa blz, te falo já', 'me liga 11 99999-0001', 'fala com o Carlos', 'tmj'] }) })).json();
    assert.deepEqual(put.samples, ['opa blz, te falo já', 'tmj']);
    assert.deepEqual((await (await call('/copilot/style-samples')).json()).samples, put.samples);
    const audit = (await (await call('/copilot/audit')).json()).entries;
    assert.ok(audit.some((e) => e.action === 'style_samples' && e.count === 2));
    assert.ok(!JSON.stringify(audit).includes('te falo'));
  });

  await t.test('chosen samples reach the manual draft prompt; nothing else from other chats does', async () => {
    fs.writeFileSync(path.join(data, 'copilot-config.json'), JSON.stringify({ enabled: true, paused: false, mode: 'suggestion', allowedContactIds: [PN] }));
    const prompts = [];
    __setAgyRunnerForTests(async (prompt) => { prompts.push(prompt); return 'Fala, pode mandar.'; });
    const r = await (await call('/copilot/suggest', { method: 'POST', body: JSON.stringify({ contactId: PN, isSaved: true, messages: [{ fromMe: false, text: 'oi, tudo certo?' }] }) })).json();
    assert.equal(r.draft, 'Fala, pode mandar.');
    assert.match(prompts[0], /<EXEMPLOS_DO_JEITO_DO_DANIEL>\n- opa blz, te falo já\n- tmj\n<\/EXEMPLOS_DO_JEITO_DO_DANIEL>/);
    assert.ok(!/quero um orçamento|Maria|99999/.test(prompts[0]), 'no content of other conversations');
    __setAgyRunnerForTests(null);
  });
});
