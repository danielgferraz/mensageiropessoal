// Fixture isolado para QA de navegador: Evolution, Supabase Auth, banco de estado e Antigravity FALSOS.
// Nenhuma mensagem real é enviada. Portas: upstream 4455, app 3355.
//   node docs/qa/20261106-scroll-antigravity/fixture.mjs
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createMemoryMenuStore } from '../../../server/menus-store.mjs';

const PN = '5511999990001@s.whatsapp.net';      // conversa longa
const PN2 = '5511999990002@s.whatsapp.net';     // histórico que chega devagar
const PN3 = '5511999990003@s.whatsapp.net';     // conversa para IA/webhook
const GROUP = '120363000000000000@g.us';
const SECRET = 'segredo-de-qa';
const now = () => Math.floor(Date.now() / 1000);

const msg = (id, jid, text, fromMe, at) => ({ key: { id, remoteJid: jid, fromMe }, pushName: 'Cliente QA', message: { conversation: text }, messageTimestamp: at, status: 'READ' });
const store = {
  [PN]: Array.from({ length: 150 }, (_, i) => msg(`L${i}`, PN, `Mensagem ${i + 1} da conversa longa ${'texto '.repeat(i % 7)}`, i % 3 === 0, now() - (150 - i) * 60)),
  [PN2]: [msg('S1', PN2, 'Primeira mensagem (histórico lento)', false, now() - 600), msg('S2', PN2, 'Segunda mensagem', true, now() - 500)],
  [PN3]: [msg('C1', PN3, 'Oi, tudo bem?', false, now() - 900), msg('C2', PN3, 'Olá! Como posso ajudar?', true, now() - 800)],
  [GROUP]: [msg('G1', GROUP, 'Mensagem no grupo', false, now() - 300)],
};
const sent = [];
const ctl = { slow: {}, agy: 'ok', agyPrompts: [], webhookCalls: 0, buttons: 'ok' };
const presences = [];
const natives = [];   // [{ route, body, at }] enviados pelas rotas sendButtons/sendList da Evolution FALSA   // [{ at, presence, number, delay }]

const state = { conv: {}, notes: [], sugs: [], crm: {}, audit: [], seq: 1 };
const conv = (jid) => state.conv[jid] || { jid, aiEnabled: false, mode: 'suggestion', autoReply: false, takenOverAt: null, lastAiReplyAt: null, lastHumanReplyAt: null, updatedAt: null };
const authorship = {};
const fakeDb = {
  menus: createMemoryMenuStore(),
  async menusAvailable() { return true; },
  async health() { return { ok: true, migration: 'qa' }; },
  async getConversation(jid) { return conv(jid); },
  async getState(jid) {
    return { conversation: conv(jid), crm: state.crm[jid] || null, notes: state.notes.filter((n) => n.jid === jid), authorship,
      suggestions: state.sugs.filter((s) => s.jid === jid && s.status === 'pending') };
  },
  async updateConversation(jid, patch) {
    const cur = conv(jid); const next = { ...cur };
    if (typeof patch.aiEnabled === 'boolean') next.aiEnabled = patch.aiEnabled;
    if (patch.mode) next.mode = patch.mode;
    if (typeof patch.autoReply === 'boolean') next.autoReply = patch.autoReply;
    if (!next.aiEnabled || next.mode === 'human') next.autoReply = false;
    state.conv[jid] = next; state.audit.push({ action: 'conversation.update', jid, after: patch });
    return next;
  },
  async addNote(jid, author, text) { const n = { id: String(state.seq++), jid, author, text, createdAt: new Date().toISOString() }; state.notes.push(n); return n; },
  async deleteNote() { return true; },
  async setCrmStage(jid, stage) { state.crm[jid] = { jid, stage, updatedBy: 'humano', updatedAt: new Date().toISOString() }; return state.crm[jid]; },
  async suggestCrmStage(jid, stage, reason) { const s = { id: String(state.seq++), jid, kind: 'crm_stage', payload: { stage, reason, currentStage: null, manualStage: false }, status: 'pending', createdAt: new Date().toISOString() }; state.sugs.push(s); return s; },
  async recordReplySuggestion(jid, draft, meta = {}) {
    for (const s of state.sugs) if (s.jid === jid && s.kind === 'reply' && s.status === 'pending') s.status = 'dismissed';
    const s = { id: String(state.seq++), jid, kind: 'reply', payload: { draft, ...(meta.auto ? { auto: true } : {}), ...(meta.sourceMessageId ? { sourceMessageId: meta.sourceMessageId } : {}) }, status: 'pending', createdAt: new Date().toISOString() };
    state.sugs.push(s); return s;
  },
  async dismissPendingReplies(jid) { let n = 0; for (const s of state.sugs) if (s.jid === jid && s.kind === 'reply' && s.status === 'pending') { s.status = 'dismissed'; n++; } return n; },
  async resolveSuggestion(id, decision) {
    const s = state.sugs.find((x) => x.id === String(id) && x.status === 'pending'); if (!s) return null;
    s.status = decision === 'accepted' ? 'accepted' : 'dismissed'; return { suggestion: s, crm: null };
  },
  async autoReplyAvailable() { return true; },
  async pauseAutoReply(jid) { const c = state.conv[jid]; if (!c?.autoReply) return false; c.autoReply = false; state.audit.push({ action: 'autoreply.paused', jid }); return true; },
  async recordSent(jid, messageId, author) { if (messageId) authorship[messageId] = author; if (author === 'ia') { state.conv[jid] = { ...conv(jid), lastAiReplyAt: new Date().toISOString() }; } },
  async listAudit() { return state.audit; },
};

const upstream = http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString(); const body = raw ? JSON.parse(raw) : {};
  res.setHeader('Content-Type', 'application/json');
  const json = (v, code = 200) => { res.statusCode = code; res.end(JSON.stringify(v)); };
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/__state') return json({ sent, state, agyPrompts: ctl.agyPrompts, webhookCalls: ctl.webhookCalls, presences, natives });
  if (url.pathname === '/__control') { Object.assign(ctl, body.set || {}); return json({ ok: true }); }
  if (url.pathname === '/__push') {  // simula mensagem recebida: grava no "WhatsApp" e dispara o webhook como a Evolution faria
    const row = msg(`IN${Date.now()}${Math.random().toString(36).slice(2, 5)}`, body.jid, body.text, !!body.fromMe, now());
    store[body.jid].push(row);
    if (body.webhook !== false) {
      ctl.webhookCalls++;
      await fetch('http://127.0.0.1:3355/mensageiro/api/webhook/evolution', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-webhook-secret': SECRET },
        body: JSON.stringify({ event: 'messages.upsert', instance: 'WA', data: row }) });
    }
    return json({ ok: true, id: row.key.id });
  }
  if (req.url.startsWith('/auth/v1/token')) return json({ access_token: 'qa-admin', user: { id: 'qa', email: 'qa@example.test' } });
  if (req.url === '/auth/v1/user') return json({ id: 'qa', email: 'qa@example.test' });
  if (req.url.startsWith('/rest/v1/profiles')) return json([{ id: 'qa', role: 'admin', full_name: 'Admin QA' }]);
  if (req.url === '/instance/fetchInstances') return json([{ name: 'WA', connectionStatus: 'open', profileName: 'QA', ownerJid: PN }]);
  if (req.url === '/chat/findChats/WA') return json(Object.entries(store).map(([jid, rows]) => ({
    remoteJid: jid, pushName: null, subject: jid === GROUP ? 'Grupo QA' : undefined, unreadCount: 0, lastMessage: rows.at(-1) })));
  if (req.url === '/group/fetchAllGroups/WA?getParticipants=false') return json([]);
  if (req.url === '/chat/findMessages/WA') {
    const jid = body.where?.key?.remoteJid;
    if (ctl.slow[jid]) await new Promise((r) => setTimeout(r, ctl.slow[jid]));
    return json({ messages: { total: store[jid]?.length || 0, pages: 1, records: [...(store[jid] || [])].reverse() } });
  }
  if (req.url === '/message/sendButtons/WA' || req.url === '/message/sendList/WA') {
    natives.push({ route: req.url.split('/')[2], body, at: Date.now() });
    if (ctl.buttons === 'error400') return json({ response: { message: ['TypeError: this.isZero is not a function'] } }, 400);
    return json({ key: { id: `NAT${natives.length}` }, status: 'PENDING' }, 201);
  }
  if (req.url === '/chat/sendPresence/WA') { presences.push({ at: Date.now(), presence: body.presence, number: body.number, delay: body.delay }); return json({}); }
  if (req.url === '/message/sendText/WA') {
    const row = msg(`SENT${sent.length}`, body.number, body.text, true, now()); row.status = 'SERVER_ACK';
    sent.push({ number: body.number, text: body.text, at: Date.now() }); store[body.number]?.push(row); return json(row);
  }
  return json({}, 404);
});
await new Promise((r) => upstream.listen(4455, '127.0.0.1', r));

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mensageiro-qa-'));
fs.mkdirSync(path.join(scratch, 'data'));
fs.writeFileSync(path.join(scratch, 'data', 'copilot-config.json'), JSON.stringify({ enabled: true, paused: false, mode: process.env.QA_MODE || 'automatic' }));
fs.mkdirSync(path.join(scratch, 'kb', '02_Servicos'), { recursive: true });
fs.writeFileSync(path.join(scratch, 'kb', '02_Servicos', 'A.md'), '# Serviço\nStatus: Aprovado\n\n## Prazo\nO prazo de entrega do serviço é de cinco dias úteis após a aprovação do cliente.');
Object.assign(process.env, { EVOLUTION_URL: 'http://127.0.0.1:4455', EVOLUTION_APIKEY: 'qa-only', SUPABASE_URL: 'http://127.0.0.1:4455', SUPABASE_ANON_KEY: 'qa-only',
  COPILOT_DATA_DIR: path.join(scratch, 'data'), NEBRIA_DIR: path.join(scratch, 'kb'), COPILOT_ALLOW_AUTOMATIC: '1', AUTO_REPLY_ANTI_REPEAT: '0', AGY_BIN: path.join(scratch, 'sem-agy'), PORT: '3355',
  EVOLUTION_WEBHOOK_SECRET: SECRET, AUTO_SUGGEST_DEBOUNCE_MS: process.env.QA_DEBOUNCE || '6000' });
const { server, __setStateDbForTests, __setAgyRunnerForTests } = await import('../../../server/server.mjs');
__setStateDbForTests(fakeDb);
__setAgyRunnerForTests(async (prompt) => {
  ctl.agyPrompts.push(prompt);
  if (ctl.agy === 'down') throw Object.assign(new Error('agy indisponível'), { code: 'agy_unavailable' });
  if (ctl.agy === 'fail') throw Object.assign(new Error('spawn /home/opc/.local/bin/agy EACCES'), { stderr: '/srv/stacks/mensageiro' });
  if (prompt.includes('Escreva o rascunho:')) return 'Olá! O prazo de entrega é de cinco dias úteis. Posso ajudar em mais algo?';
  if (prompt.includes('escreva UMA nota interna')) return 'Cliente pediu prazo de entrega; aguardando retorno sobre o orçamento.';
  if (prompt.includes('ESTAGIO:')) return 'ESTAGIO: Em contato\nMOTIVO: Cliente já conversou e pediu informação de prazo.';
  if (prompt.includes('resuma a conversa')) return 'Resumo:\n• Cliente cumprimentou e perguntou do serviço.\n• Pendência: informar o prazo.\n• Próximo passo: responder hoje.\n(Arquivo consultado: /srv/stacks/mensageiro/server/server.mjs)';
  if (prompt.includes('Reescreva o texto abaixo')) return 'Olá! Em que posso ajudar com esta conversa?';
  return 'Hello! How can I help you today in /srv/stacks/mensageiro?'; // saída "ruim" proposital: o caminho precisa ser mascarado
});
server.listen(3355, '127.0.0.1', () => console.log('QA fixture ready: http://127.0.0.1:3355/mensageiro/'));
