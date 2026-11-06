import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

test('copilot routes: admin only, closed by default, drafts only and no WhatsApp send', async (t) => {
  const calls = [];
  const upstream = http.createServer(async (req, res) => {
    for await (const _ of req);
    calls.push(req.url);
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/auth/v1/user') return res.end(JSON.stringify({ id: req.headers.authorization === 'Bearer tech' ? 'tech' : 'admin', email: 'admin@example.test' }));
    if (req.url.startsWith('/rest/v1/profiles')) return res.end(JSON.stringify([{ id: 'x', role: req.url.includes('tech') ? 'tecnico' : 'admin', full_name: 'Fixture' }]));
    res.writeHead(404).end('{}');
  });
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${upstream.address().port}`;
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-data-'));
  const kb = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-kb-'));
  fs.mkdirSync(path.join(kb, '02_Servicos'));
  fs.writeFileSync(path.join(kb, '02_Servicos', 'A.md'), '# Serviço\nStatus: Aprovado\n\n## Prazo\nO prazo de entrega do serviço é de cinco dias úteis após a aprovação do cliente.');
  fs.writeFileSync(path.join(kb, '02_Servicos', 'B.md'), '# Rascunho\nStatus: Rascunho\n\n## Preço\nTexto ainda não aprovado para divulgação ao cliente final com valores internos.');
  Object.assign(process.env, { SUPABASE_URL: url, SUPABASE_ANON_KEY: 'anon', EVOLUTION_URL: url, EVOLUTION_APIKEY: 'k',
    COPILOT_DATA_DIR: data, NEBRIA_DIR: kb, AGY_BIN: path.join(data, 'missing-agy') });
  delete process.env.COPILOT_ALLOW_AUTOMATIC;
  const { server } = await import('./server.mjs');
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/mensageiro/api`;
  t.after(() => Promise.all([new Promise((r) => server.close(r)), new Promise((r) => upstream.close(r))]));
  const call = (p, options = {}) => fetch(base + p, { ...options, headers: { Authorization: 'Bearer admin', 'Content-Type': 'application/json', ...options.headers } });
  const suggest = (extra = {}) => call('/copilot/suggest', { method: 'POST', body: JSON.stringify({ contactId: '5511999990001@s.whatsapp.net', isSaved: true,
    messages: [{ fromMe: false, text: 'Qual o prazo de entrega do serviço?' }], ...extra }) });

  await t.test('anonymous and non-admin callers are rejected', async () => {
    assert.equal((await fetch(`${base}/copilot/config`)).status, 401);
    assert.equal((await call('/copilot/config', { headers: { Authorization: 'Bearer tech' } })).status, 403);
    assert.equal((await call('/copilot/suggest', { method: 'POST', body: '{}', headers: { Authorization: 'Bearer tech' } })).status, 403);
  });

  await t.test('default config is closed and the RAG lists only approved documents', async () => {
    const body = await (await call('/copilot/config')).json();
    assert.equal(body.config.enabled, false);
    assert.equal(body.config.paused, true);
    assert.equal(body.automaticAllowed, false);
    assert.deepEqual(body.rag.documents, ['02_Servicos/A.md']);
    assert.equal(body.rag.skipped.length, 1);
    const blocked = await (await suggest()).json();
    assert.equal(blocked.blocked, true);
    assert.equal(blocked.code, 'disabled');
  });

  await t.test('automatic mode and invalid payloads are refused', async () => {
    assert.equal((await call('/copilot/config', { method: 'PUT', body: JSON.stringify({ mode: 'automatic' }) })).status, 400);
    assert.equal((await call('/copilot/config', { method: 'PUT', body: '[]' })).status, 400);
  });

  await t.test('enabled contact gets a model failure (no agy here) instead of a fabricated draft, and everything is audited', async () => {
    const saved = await (await call('/copilot/config', { method: 'PUT', body: JSON.stringify({ enabled: true, paused: false, allowedContactIds: ['5511999990001@s.whatsapp.net'] }) })).json();
    assert.equal(saved.config.updatedBy, 'admin@example.test');
    const result = await (await suggest()).json();
    assert.equal(result.draft, null);
    assert.equal(result.code, 'model_error');
    const other = await (await suggest({ contactId: '5511888880002@s.whatsapp.net' })).json();
    assert.equal(other.code, 'not_allowed');
    const audit = (await (await call('/copilot/audit')).json()).entries;
    assert.deepEqual(audit.slice(0, 2).map((e) => e.code), ['not_allowed', 'model_error']);
    assert.ok(!JSON.stringify(audit).includes('prazo de entrega'));
    assert.equal((await suggest({ messages: [] })).status, 400);
  });

  await t.test('no endpoint here ever reaches the WhatsApp send path', () => {
    assert.ok(!calls.some((c) => c.startsWith('/message/') || c.startsWith('/chat/')));
  });
});
