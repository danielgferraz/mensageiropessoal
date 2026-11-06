// Isolated UI fixture: no production credentials, connections or external messages.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const jid = '5511000000000@s.whatsapp.net';
const group = '120363000000000000@g.us';
const dupPhone = '5511999990001@s.whatsapp.net';
const dupLid = '100000000000001@lid';
const orphanLid = '100000000000009@lid';
const strangerPhone = '5511988887777@s.whatsapp.net';
let failure = '';
let incoming = 0;
let latency = 0;
const sent = [];
const message = (id, remoteJid, text, fromMe = false, seconds = 1700000000) => ({
  key: { id, remoteJid, fromMe }, pushName: 'Contato de teste', message: { conversation: text }, messageTimestamp: seconds, status: 'READ',
});
const upstream = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
  res.setHeader('Content-Type', 'application/json');
  const json = (value) => res.end(JSON.stringify(value));
  if (req.url === '/__stats') return json({ sentCount: sent.length });
  if (req.url === '/__control') { failure = body.failure || ''; incoming = body.incoming || 0; latency = body.latency || 0; return json({ ok: true }); }
  if (req.url.startsWith('/auth/v1/token')) return json({ access_token: 'admin-ui-fixture', user: { id: 'test', email: 'admin@example.test' } });
  if (req.url === '/auth/v1/user') return json({ id: 'test', email: 'admin@example.test' });
  if (req.url.startsWith('/rest/v1/profiles')) return json([{ id: 'test', role: failure === 'permission' ? 'tecnico' : 'admin', full_name: 'Administrador de teste' }]);
  if (failure === 'sync' && req.url.startsWith('/chat/')) return res.writeHead(503).end('{}');
  if (latency && req.url === '/instance/fetchInstances') await new Promise(resolve => setTimeout(resolve, latency));
  if (req.url === '/instance/fetchInstances') return json(failure === 'disconnected' ? [] : [{ name: 'WA', connectionStatus: 'open', profileName: 'Administrador de teste', ownerJid: jid }]);
  if (req.url === '/chat/findChats/WA') return json(failure === 'empty' ? [] : [
    { remoteJid: jid, pushName: 'Contato de teste com nome longo para validar a tela', unreadCount: 2, lastMessage: message('hello', jid, 'Olá! Esta conversa usa apenas dados de teste.') },
    { remoteJid: group, subject: 'Grupo de teste', unreadCount: 0, lastMessage: message('group', group, 'Mensagem do grupo') },
    { remoteJid: dupLid, pushName: null, profilePicUrl: 'https://example.test/same.jpg', unreadCount: 1,
      lastMessage: { ...message('dup-lid', dupLid, 'Oi, tudo bem? Qual o prazo de entrega do serviço?', false, 1700000300), key: { id: 'dup-lid', remoteJid: dupLid, remoteJidAlt: dupPhone, fromMe: false }, pushName: 'Cliente Duplicado' } },
    { remoteJid: dupPhone, pushName: null, profilePicUrl: 'https://example.test/same.jpg', unreadCount: 0, lastMessage: message('dup-pn', dupPhone, 'Resposta enviada', true, 1700000400) },
    { remoteJid: orphanLid, pushName: null, lastMessage: { ...message('orphan', orphanLid, 'Mensagem de ID interno', false, 1700000100), pushName: 'Sem Número' } },
    { remoteJid: strangerPhone, pushName: null, unreadCount: 0, lastMessage: message('stranger', strangerPhone, 'Número desconhecido', false, 1700000050) },
  ]);
  if (req.url === '/chat/findMessages/WA') {
    const target = body.where?.key?.remoteJid || jid;
    const records = body.page === 2 ? [message('older', target, 'Mensagem anterior', false, 1699990000)] : [
      message('hello', target, 'Olá! Esta conversa usa apenas dados de teste.'),
      ...sent.filter((m) => m.key.remoteJid === target),
      ...(incoming ? [message('new', target, 'Recebida por polling', false, 1800000000)] : []),
    ];
    return json({ messages: { total: records.length + 1, pages: 2, records } });
  }
  if (req.url === '/message/sendText/WA') {
    if (failure === 'send') return res.writeHead(503).end('{}');
    const row = message(`sent-${sent.length}`, body.number, body.text, true, 1799999999);
    row.status = 'SERVER_ACK';
    sent.push(row);
    return json(row);
  }
  return res.writeHead(404).end('{}');
});
await new Promise((resolve) => upstream.listen(4444, '0.0.0.0', resolve));
process.env.EVOLUTION_URL = 'http://127.0.0.1:4444';
process.env.EVOLUTION_APIKEY = 'test-only';
// Atendente: dados e base de conhecimento descartáveis (fora do repositório).
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mensageiro-fixture-'));
fs.mkdirSync(path.join(scratch, 'kb', '02_Servicos'), { recursive: true });
fs.writeFileSync(path.join(scratch, 'kb', '02_Servicos', 'Fixture.md'), '# Serviço de teste\nStatus: Aprovado\n\n## Prazo\nO prazo de entrega do serviço de teste é de cinco dias úteis.');
process.env.COPILOT_DATA_DIR = path.join(scratch, 'data');
process.env.NEBRIA_DIR = path.join(scratch, 'kb');
process.env.AGY_BIN = path.join(scratch, 'sem-agy');
process.env.SUPABASE_URL = 'http://127.0.0.1:4444';
process.env.SUPABASE_ANON_KEY = 'test-only';
const { server } = await import('../server/server.mjs');
server.listen(3333, '0.0.0.0', () => console.log('Local isolated messaging fixture ready'));
