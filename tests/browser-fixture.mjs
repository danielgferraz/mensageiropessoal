// Isolated UI fixture: no production credentials, connections or external messages.
import http from 'node:http';
const jid = '5511000000000@s.whatsapp.net';
const group = '120363000000000000@g.us';
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
process.env.SUPABASE_URL = 'http://127.0.0.1:4444';
process.env.SUPABASE_ANON_KEY = 'test-only';
const { server } = await import('../server/server.mjs');
server.listen(3333, '0.0.0.0', () => console.log('Local isolated messaging fixture ready'));
