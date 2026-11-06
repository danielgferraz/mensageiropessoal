import assert from 'node:assert/strict';
import http from 'node:http';
import { test } from 'node:test';

test('admin messaging proxy against an isolated local upstream', async t => {
  const calls = [];
  const upstream = http.createServer(async (req, res) => {
    const body = [];
    for await (const chunk of req) body.push(chunk);
    const payload = Buffer.concat(body).toString();
    calls.push({ path: req.url, body: payload ? JSON.parse(payload) : null });
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/auth/v1/user') {
      return res.end(JSON.stringify({ id: req.headers.authorization === 'Bearer technician-fixture' ? 'technician' : 'admin', email: 'fixture@example.test' }));
    }
    if (req.url.startsWith('/rest/v1/profiles')) {
      return res.end(JSON.stringify([{ id: 'fixture', role: req.url.includes('technician') ? 'tecnico' : 'admin', full_name: 'Fixture' }]));
    }
    if (req.url === '/instance/fetchInstances') {
      return res.end(JSON.stringify([{ name: 'WA', connectionStatus: 'open', ownerJid: '5511000000000@s.whatsapp.net', profileName: 'Fixture', token: 'upstream-only-fixture', hash: { apikey: 'upstream-only-fixture' } }]));
    }
    if (req.url === '/instance/create') return res.end(JSON.stringify({ instance: { instanceName: 'WA', status: 'close' }, hash: { apikey: 'upstream-only-fixture' }, qrcode: { base64: 'data:image/png;base64,fixture' } }));
    if (req.url === '/chat/findChats/WA') return res.end(JSON.stringify([{ remoteJid: '5511000000000@s.whatsapp.net', unreadCount: 1 }]));
    if (req.url === '/chat/findMessages/WA') return res.end(JSON.stringify({ messages: { records: [{ key: { id: 'message-fixture' } }], total: 1 } }));
    if (req.url === '/message/sendText/WA') return res.end(JSON.stringify({ key: { id: 'sent-fixture', remoteJid: JSON.parse(payload).number, fromMe: true }, status: 'PENDING' }));
    res.writeHead(404).end('{}');
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const upstreamUrl = `http://127.0.0.1:${upstream.address().port}`;
  process.env.EVOLUTION_URL = upstreamUrl;
  process.env.EVOLUTION_APIKEY = 'local-test-key';
  process.env.SUPABASE_URL = upstreamUrl;
  process.env.SUPABASE_ANON_KEY = 'local-test-anon';
  const { server, sanitizeInstances, normalizeRecipient } = await import('./server.mjs');
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await Promise.all([new Promise(resolve => server.close(resolve)), new Promise(resolve => upstream.close(resolve))]);
  });
  const request = (path, options = {}) => fetch(`${base}/mensageiro/api${path}`, {
    ...options, headers: { Authorization: 'Bearer admin-fixture', 'Content-Type': 'application/json', ...options.headers },
  });

  await t.test('anonymous and non-admin requests never reach Evolution', async () => {
    const before = calls.filter(call => call.path.startsWith('/chat/')).length;
    assert.equal((await fetch(`${base}/api/whatsapp/instances`)).status, 401);
    assert.equal((await request('/whatsapp/chats/WA', { method: 'POST', body: '{}', headers: { Authorization: 'Bearer technician-fixture' } })).status, 403);
    assert.equal(calls.filter(call => call.path.startsWith('/chat/')).length, before);
  });
  await t.test('instance list contains safe profile scalars and no upstream credentials', async () => {
    const response = await request('/whatsapp/instances');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const instances = await response.json();
    assert.equal(instances[0].instanceName, 'WA');
    assert.equal(instances[0].connectionStatus, 'open');
    assert.ok(!JSON.stringify(instances).includes('upstream-only-fixture'));
    assert.deepEqual(sanitizeInstances([{ instance: { instanceName: 'WA', status: 'open', token: 'hidden' } }])[0].name, 'WA');
  });
  await t.test('chat and paginated message payloads are forwarded intact', async () => {
    const chatResponse = await request('/whatsapp/chats/WA', { method: 'POST', body: '{}' });
    assert.equal((await chatResponse.json())[0].remoteJid, '5511000000000@s.whatsapp.net');
    const query = { where: { key: { remoteJid: '5511000000000@s.whatsapp.net' } }, page: 2, offset: 50 };
    const response = await request('/whatsapp/messages/WA', { method: 'POST', body: JSON.stringify(query) });
    assert.equal((await response.json()).messages.records[0].key.id, 'message-fixture');
    assert.deepEqual(calls.findLast(call => call.path === '/chat/findMessages/WA').body, query);
  });
  await t.test('instance creation keeps QR output and strips generated credentials', async () => {
    const response = await request('/whatsapp/instances', { method: 'POST', body: JSON.stringify({ instanceName: 'WA' }) });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.instance.instanceName, 'WA');
    assert.equal(data.qrcode.base64, 'data:image/png;base64,fixture');
    assert.ok(!JSON.stringify(data).includes('upstream-only-fixture'));
  });
  await t.test('send preserves individual, group and lid routing identities', async () => {
    for (const number of ['5511000000000@s.whatsapp.net', '120363000000000000@g.us', '123456789@lid']) {
      const response = await request('/whatsapp/send-message/WA', { method: 'POST', body: JSON.stringify({ number, text: 'Local fixture only' }) });
      assert.equal(response.status, 200);
      assert.equal(calls.findLast(call => call.path === '/message/sendText/WA').body.number, number);
    }
    assert.equal(normalizeRecipient('+55 (11) 99999-0000'), '5511999990000');
  });
  await t.test('invalid recipients, text and instance paths fail before forwarding', async () => {
    const before = calls.filter(call => call.path.startsWith('/message/')).length;
    for (const body of [{ number: 'status@broadcast', text: 'text' }, { number: '5511000000000', text: ' ' }, { number: '5511000000000', text: 'a'.repeat(10001) }]) {
      assert.equal((await request('/whatsapp/send-message/WA', { method: 'POST', body: JSON.stringify(body) })).status, 400);
    }
    assert.equal((await request('/whatsapp/chats/WA%3Ftoken', { method: 'POST', body: '{}' })).status, 400);
    assert.equal(calls.filter(call => call.path.startsWith('/message/')).length, before);
  });
  await t.test('invalid JSON and URI encoding do not crash subsequent requests', async () => {
    assert.equal((await request('/whatsapp/messages/WA', { method: 'POST', body: '{invalid' })).status, 400);
    assert.equal((await fetch(`${base}/mensageiro/%zz`)).status, 400);
    assert.equal((await request('/health')).status, 200);
  });
  await t.test('encoded Windows traversal is denied and service worker can revalidate', async () => {
    const response = await fetch(`${base}/mensageiro/..%5cserver%5cserver.mjs`);
    assert.equal(response.status, 403);
    const worker = await fetch(`${base}/mensageiro/sw.js`);
    assert.equal(worker.status, 200);
    assert.equal(worker.headers.get('cache-control'), 'no-cache');
  });
  await t.test('missing server API key fails closed without contacting Evolution', async () => {
    delete process.env.EVOLUTION_APIKEY;
    const { server: unconfiguredServer } = await import('./server.mjs?unconfigured-fixture');
    await new Promise(resolve => unconfiguredServer.listen(0, '127.0.0.1', resolve));
    try {
      const before = calls.filter(call => call.path.startsWith('/instance/')).length;
      const response = await fetch(`http://127.0.0.1:${unconfiguredServer.address().port}/api/whatsapp/instances`, { headers: { Authorization: 'Bearer admin-fixture' } });
      assert.equal(response.status, 503);
      assert.equal(calls.filter(call => call.path.startsWith('/instance/')).length, before);
    } finally {
      await new Promise(resolve => unconfiguredServer.close(resolve));
    }
  });
});
