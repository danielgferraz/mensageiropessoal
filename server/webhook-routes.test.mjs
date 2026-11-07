import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const PN = '5511999990001@s.whatsapp.net';

test('webhook + antigravity routes against an isolated upstream (no real agy, no WhatsApp send)', async (t) => {
  const calls = [];
  const upstream = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
    calls.push({ url: req.url, body });
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/auth/v1/user') return res.end(JSON.stringify({ id: 'admin', email: 'admin@example.test' }));
    if (req.url.startsWith('/rest/v1/profiles')) return res.end(JSON.stringify([{ id: 'x', role: 'admin', full_name: 'Fixture' }]));
    if (req.url === '/chat/findMessages/WA') return res.end(JSON.stringify({ messages: { records: [
      { key: { id: 'm1', remoteJid: PN, fromMe: false }, message: { conversation: 'Quero orçamento da escada' }, messageTimestamp: 100 },
      { key: { id: 'm2', remoteJid: PN, fromMe: true }, message: { conversation: 'Claro, qual o tamanho?' }, messageTimestamp: 101 },
    ], pages: 1 } }));
    res.writeHead(404).end('{}');
  });
  await new Promise((r) => upstream.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${upstream.address().port}`;
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'wh-data-'));
  Object.assign(process.env, { SUPABASE_URL: url, SUPABASE_ANON_KEY: 'anon', EVOLUTION_URL: url, EVOLUTION_APIKEY: 'k', COPILOT_DATA_DIR: data,
    AGY_BIN: path.join(data, 'sem-agy'), EVOLUTION_WEBHOOK_SECRET: 'segredo-de-teste', AUTO_SUGGEST_DEBOUNCE_MS: '15', NEBRIA_DIR: '' });
  delete process.env.COPILOT_ALLOW_AUTOMATIC;
  const mod = await import('./server.mjs');
  const { server, autoSuggester, __setAgyRunnerForTests, __setStateDbForTests } = mod;
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/mensageiro/api`;
  t.after(() => Promise.all([new Promise((r) => server.close(r)), new Promise((r) => upstream.close(r))]));
  const call = (p, options = {}) => fetch(base + p, { ...options, headers: { Authorization: 'Bearer admin', 'Content-Type': 'application/json', ...options.headers } });
  const chat = (body) => call('/antigravity/chat', { method: 'POST', body: JSON.stringify(body) });

  await t.test('webhook needs the secret and does not use the admin login', async () => {
    const payload = JSON.stringify({ event: 'messages.upsert', instance: 'WA', data: { key: { id: 'x1', remoteJid: PN, fromMe: false }, message: { conversation: 'oi' }, messageTimestamp: Math.floor(Date.now() / 1000) } });
    const hook = (query = '', headers = {}) => fetch(`${base}/webhook/evolution${query}`, { method: 'POST', body: payload, headers: { 'Content-Type': 'application/json', ...headers } });
    assert.equal((await hook()).status, 401);
    assert.equal((await hook('', { Authorization: 'Bearer admin' })).status, 401, 'admin token is not the webhook secret');
    assert.equal((await hook('?token=errado')).status, 401);
    const ok = await hook('?token=segredo-de-teste');
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).received, 1);
    assert.equal((await hook('', { 'x-webhook-secret': 'segredo-de-teste' })).status, 200);
  });

  await t.test('end to end: opted-in conversation gets a pending draft, nothing is sent to WhatsApp', async () => {
    const suggestions = [];
    const conv = { [PN]: { aiEnabled: true, mode: 'suggestion' } };
    __setStateDbForTests({
      async getConversation(jid) { return { jid, aiEnabled: false, mode: 'suggestion', ...(conv[jid] || {}) }; },
      async dismissPendingReplies() { return 0; },
      async getState() { return { conversation: { aiEnabled: true, mode: 'human' }, crm: { stage: 'Em contato' }, notes: [{ author: 'humano', text: 'Cliente prefere tarde' }] }; },
      async recordReplySuggestion(jid, draft, meta) { suggestions.push({ jid, draft, meta }); return { id: '7' }; },
    });
    fs.writeFileSync(path.join(data, 'copilot-config.json'), JSON.stringify({ enabled: true, paused: false, mode: 'suggestion' }));
    const prompts = [];
    __setAgyRunnerForTests(async (prompt) => { prompts.push(prompt); return 'O prazo é de cinco dias úteis. Posso ajudar em mais algo?'; });
    const r = await fetch(`${base}/webhook/evolution`, { method: 'POST', headers: { 'x-webhook-secret': 'segredo-de-teste', 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'messages.upsert', instance: 'WA', data: { key: { id: 'inc1', remoteJid: PN, fromMe: false }, message: { conversation: 'Qual o prazo do serviço?' }, messageTimestamp: Math.floor(Date.now() / 1000) } }) });
    assert.equal(r.status, 200);
    await autoSuggester.whenIdle();
    assert.equal(suggestions.length, 1);
    assert.equal(suggestions[0].meta.auto, true);
    assert.equal(suggestions[0].meta.sourceMessageId, 'inc1');
    assert.match(prompts[0], /Quero orçamento da escada/, 'context comes from Evolution findMessages');
    assert.ok(!calls.some((c) => /sendText|send-message/.test(c.url)), 'no outbound WhatsApp message');
    __setAgyRunnerForTests(null);
  });

  await t.test('antigravity chat: admin only, validated input, clear errors when the CLI is down', async () => {
    assert.equal((await fetch(`${base}/antigravity/chat`, { method: 'POST', body: '{}' })).status, 401);
    assert.equal((await chat({})).status, 400);
    assert.equal((await chat({ prompt: 'x'.repeat(2500) })).status, 400);
    assert.equal((await chat({ action: 'apagar', prompt: 'oi' })).status, 400);
    assert.equal((await chat({ action: 'summarize' })).status, 400, 'actions need a conversation');
    const down = await chat({ prompt: 'olá' });
    assert.equal(down.status, 503);
    const body = await down.json();
    assert.equal(body.code, 'agy_unavailable');
    assert.match(body.error, /fora do ar/);
    assert.ok(!JSON.stringify(body).includes(data), 'no internal path in the error');
  });

  await t.test('antigravity chat builds the prompt with real context, answers pt-BR without internal paths', async () => {
    const seen = [];
    __setAgyRunnerForTests(async (prompt) => { seen.push(prompt); return 'Olá! Posso ajudar no projeto /srv/stacks/mensageiro/server/server.mjs com o orçamento.'; });
    const r = await chat({ prompt: 'O que o cliente quer?', jid: PN, instanceName: 'WA', contactName: 'Maria' });
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.ok(!/\/srv|stacks/.test(body.response), body.response);
    assert.deepEqual(body.context, { messages: 2, notes: 1, stage: 'Em contato', ai: 'human' });
    assert.match(seen[0], /assumida por humano/);
    assert.match(seen[0], /Cliente prefere tarde/);
    assert.match(seen[0], /Contato: Maria/);
    assert.match(seen[0], /CLIENTE: Quero orçamento da escada/);
    assert.match(seen[0], /DANIEL: Claro, qual o tamanho\?/);
    assert.match(seen[0], /Pedido do Daniel: O que o cliente quer\?/);

    const note = await (await chat({ action: 'note', jid: PN, instanceName: 'WA' })).json();
    assert.equal(note.proposal.type, 'note');
    __setAgyRunnerForTests(async () => 'ESTAGIO: Em negociacao\nMOTIVO: Pediu orçamento');
    const stage = await (await chat({ action: 'crm_stage', jid: PN, instanceName: 'WA', stages: ['Novo', 'Em negociação'] })).json();
    assert.deepEqual(stage.proposal, { type: 'crm_stage', stage: 'Em negociação', reason: 'Pediu orçamento' });
    assert.equal((await chat({ action: 'crm_stage', jid: PN, instanceName: 'WA' })).status, 400);

    const prompts = [];
    __setAgyRunnerForTests(async (prompt) => { prompts.push(prompt); return prompts.length === 1 ? 'Hello! How can I help you today?' : 'Olá! Em que posso ajudar você hoje?'; });
    const pt = await (await chat({ prompt: 'olá' })).json();
    assert.equal(pt.response, 'Olá! Em que posso ajudar você hoje?', 'English answer is rewritten in Portuguese');
    assert.match(prompts[1], /Reescreva o texto abaixo em português do Brasil/);
    __setAgyRunnerForTests(async () => 'Hello! How can I help you today?');
    const stuck = await chat({ prompt: 'olá' });
    assert.equal(stuck.status, 502);
    assert.equal((await stuck.json()).code, 'agy_language');
    __setAgyRunnerForTests(async () => { throw Object.assign(new Error('spawn /home/opc/.local/bin/agy EACCES'), { stderr: '/srv/secret' }); });
    const fail = await chat({ prompt: 'oi' });
    assert.equal(fail.status, 502);
    assert.ok(!/\/home|\/srv|EACCES|stderr/.test(await fail.text()));
    __setAgyRunnerForTests(null);
  });

  await t.test('audit records antigravity use without the conversation text', async () => {
    const audit = await (await call('/copilot/audit')).json();
    const entries = audit.entries.filter((e) => e.action === 'antigravity');
    assert.ok(entries.length >= 3);
    assert.ok(!JSON.stringify(audit.entries).includes('Quero orçamento'));
  });
});
