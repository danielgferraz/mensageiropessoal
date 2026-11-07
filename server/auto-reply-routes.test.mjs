// Rotas com COPILOT_ALLOW_AUTOMATIC=1 contra uma Evolution FALSA. Nenhuma mensagem real.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const PN = '5511999990001@s.whatsapp.net';
const GROUP = '120363000000000000@g.us';
const DRAFT = 'O prazo de entrega do serviço é de cinco dias úteis. Posso ajudar em mais algo?';

test('automatic send end to end: webhook -> draft -> fake Evolution sendText, with admin-only opt-in rules', async (t) => {
  const sends = []; const presences = [];
  const upstream = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/auth/v1/user') return res.end(JSON.stringify({ id: 'admin', email: 'admin@example.test' }));
    if (req.url.startsWith('/rest/v1/profiles')) return res.end(JSON.stringify([{ id: 'x', role: 'admin', full_name: 'Fixture' }]));
    if (req.url === '/chat/findMessages/WA') return res.end(JSON.stringify({ messages: { records: [] } }));
    if (req.url === '/chat/sendPresence/WA') { presences.push(body); return res.end('{}'); }
    if (req.url === '/message/sendText/WA') { sends.push(body); return res.end(JSON.stringify({ key: { id: `SENT${sends.length}`, remoteJid: body.number, fromMe: true } })); }
    res.writeHead(404).end('{}');
  });
  await new Promise((r) => upstream.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${upstream.address().port}`;
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-data-'));
  const kb = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-kb-'));
  fs.mkdirSync(path.join(kb, '02_Servicos'));
  fs.writeFileSync(path.join(kb, '02_Servicos', 'A.md'), '# Serviço\nStatus: Aprovado\n\n## Prazo\nO prazo de entrega do serviço é de cinco dias úteis após a aprovação do cliente.');
  Object.assign(process.env, { SUPABASE_URL: url, SUPABASE_ANON_KEY: 'anon', EVOLUTION_URL: url, EVOLUTION_APIKEY: 'k', COPILOT_DATA_DIR: data, NEBRIA_DIR: kb,
    AGY_BIN: path.join(data, 'sem-agy'), EVOLUTION_WEBHOOK_SECRET: 'segredo', AUTO_SUGGEST_DEBOUNCE_MS: '10', COPILOT_ALLOW_AUTOMATIC: '1', AUTO_REPLY_ANTI_REPEAT: '0' });
  const { server, autoSuggester, __setAgyRunnerForTests, __setStateDbForTests } = await import('./server.mjs');
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/mensageiro/api`;
  t.after(() => Promise.all([new Promise((r) => server.close(r)), new Promise((r) => upstream.close(r))]));

  const conv = {}; const suggestions = []; const sentRows = []; const updates = [];
  __setStateDbForTests({
    async autoReplyAvailable() { return true; },
    async getConversation(jid) { return { jid, aiEnabled: false, mode: 'suggestion', autoReply: false, lastAiReplyAt: null, ...(conv[jid] || {}) }; },
    async getState(jid) { return { conversation: { jid, aiEnabled: false, mode: 'suggestion', autoReply: false, ...(conv[jid] || {}) }, crm: null, notes: [], suggestions: [], authorship: {} }; },
    async updateConversation(jid, patch) { updates.push([jid, patch]); conv[jid] = { ...(conv[jid] || {}), aiEnabled: patch.aiEnabled ?? conv[jid]?.aiEnabled ?? false, mode: patch.mode ?? 'suggestion', autoReply: patch.autoReply === true }; return { jid, ...conv[jid] }; },
    async recordReplySuggestion(jid, draft, meta) { const s = { id: String(suggestions.length + 1), jid, draft, meta, status: 'pending' }; suggestions.push(s); return s; },
    async dismissPendingReplies() { return 0; },
    async resolveSuggestion(id) { const s = suggestions.find((x) => x.id === String(id) && x.status === 'pending'); if (!s) return null; s.status = 'accepted'; return { suggestion: s }; },
    async recordSent(jid, messageId, author) { sentRows.push({ jid, messageId, author }); },
    async pauseAutoReply() { return false; },
  });
  __setAgyRunnerForTests(async () => DRAFT);
  const call = (p, options = {}) => fetch(base + p, { ...options, headers: { Authorization: 'Bearer admin', 'Content-Type': 'application/json', ...options.headers } });
  const put = (jid, body) => call(`/state/conversations/${encodeURIComponent(jid)}`, { method: 'PUT', body: JSON.stringify(body) });
  const hook = (key = {}) => fetch(`${base}/webhook/evolution`, { method: 'POST', headers: { 'x-webhook-secret': 'segredo', 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'messages.upsert', instance: 'WA', data: { key: { id: `IN${Math.random().toString(36).slice(2)}`, remoteJid: PN, fromMe: false, ...key },
      message: { conversation: 'Qual o prazo de entrega do serviço?' }, messageTimestamp: Math.floor(Date.now() / 1000) } }) });

  await t.test('opt-in rules: global mode, groups and the UI flag', async () => {
    await call('/copilot/config', { method: 'PUT', body: JSON.stringify({ enabled: true, paused: false, mode: 'suggestion' }) });
    const refused = await put(PN, { aiEnabled: true, autoReply: true });
    assert.equal(refused.status, 400);
    assert.match((await refused.json()).error, /modo Automático/);
    assert.equal((await put(GROUP, { autoReply: true })).status, 400);
    const snap = await (await call(`/state/conversations/${encodeURIComponent(PN)}`)).json();
    assert.deepEqual(snap.automatic, { allowed: false, serverAllowed: true, available: true });

    assert.equal((await call('/copilot/config', { method: 'PUT', body: JSON.stringify({ mode: 'automatic' }) })).status, 200);
    const snap2 = await (await call(`/state/conversations/${encodeURIComponent(PN)}`)).json();
    assert.equal(snap2.automatic.allowed, true);
    assert.equal((await put(PN, { aiEnabled: true, autoReply: true })).status, 200);
    assert.deepEqual(updates.at(-1), [PN, { aiEnabled: true, mode: undefined, autoReply: true }]);
  });

  await t.test('sends exactly one reply through sendText; a second message inside the window stays a suggestion', async () => {
    assert.equal((await hook()).status, 200);
    await autoSuggester.whenIdle();
    assert.equal(sends.length, 1);
    assert.equal(sends[0].number, PN);
    assert.equal(sends[0].text, DRAFT);
    assert.deepEqual(sentRows, [{ jid: PN, messageId: 'SENT1', author: 'ia' }]);
    assert.equal(suggestions[0].status, 'accepted');
    assert.equal(presences[0].presence, 'composing', 'typing starts before the reply');
    assert.equal(presences[0].number, PN);
    assert.ok(presences[0].delay > 0);
    assert.deepEqual(presences.at(-1), { number: PN, presence: 'paused', delay: 0 }, 'and always ends with paused');
    await hook(); await autoSuggester.whenIdle();
    assert.equal(sends.length, 1, 'window of 60 s between automatic replies');
    assert.equal(suggestions.filter((s) => s.status === 'pending').length, 1);
    const audit = (await (await call('/copilot/audit')).json()).entries;
    assert.ok(audit.some((e) => e.action === 'auto_sent' && e.messageId === 'SENT1'));
    assert.ok(audit.some((e) => e.action === 'auto_skip' && e.code === 'rate_window'));
    assert.ok(!JSON.stringify(audit).includes('cinco dias'));
  });

  await t.test('pausing the assistant stops everything immediately', async () => {
    await call('/copilot/config', { method: 'PUT', body: JSON.stringify({ paused: true }) });
    const before = sends.length;
    conv[PN].lastAiReplyAt = null;
    await hook(); await autoSuggester.whenIdle();
    assert.equal(sends.length, before);
  });
});
