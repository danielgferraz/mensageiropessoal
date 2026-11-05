import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3333', 10);
const EVOLUTION_URL = process.env.EVOLUTION_URL || 'http://127.0.0.1:8080';
const EVOLUTION_APIKEY = process.env.EVOLUTION_APIKEY || '957b79630f4904dde12deebc6f063b5bd7bb0c2daba5484c8b41b6e31e35ac4e';
const AGY_BIN = process.env.AGY_BIN || '/home/opc/.local/bin/agy';
const DIST_DIR = path.resolve(__dirname, '../dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.webmanifest': 'application/manifest+json',
};

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 10 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        resolve({ raw: data });
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
  });
  res.end(JSON.stringify(data));
}

async function handleApi(req, res, apiPath) {
  const method = req.method;

  // Pre-flight CORS
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
    });
    res.end();
    return;
  }

  // Health check
  if (apiPath === '/health') {
    return sendJson(res, 200, {
      status: 'ok',
      service: 'mensageiro-backend',
      evolution: EVOLUTION_URL,
      agyBin: AGY_BIN,
      hasAgy: fs.existsSync(AGY_BIN),
      timestamp: new Date().toISOString()
    });
  }

  // Antigravity CLI Chat endpoint
  if (apiPath === '/antigravity/chat' && method === 'POST') {
    const body = await parseBody(req);
    const prompt = body.prompt || body.message;
    if (!prompt || typeof prompt !== 'string') {
      return sendJson(res, 400, { error: 'Campo prompt obrigatório.' });
    }

    if (!fs.existsSync(AGY_BIN)) {
      return sendJson(res, 200, {
        success: true,
        response: `[Antigravity Simulado] Executável "${AGY_BIN}" não encontrado neste host local. Recebido: "${prompt}". Na VPS Oracle, o binário executará nativamente via CLI.`,
        simulated: true,
      });
    }

    // Executa o agy CLI na VPS
    execFile(
      AGY_BIN,
      ['-p', prompt],
      {
        timeout: 90000,
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env, PATH: `${process.env.PATH}:/home/opc/.local/bin` }
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error('[AGY Error]', error, stderr);
          return sendJson(res, 500, {
            error: 'Falha ao executar Antigravity CLI.',
            details: error.message,
            stderr: stderr || null,
          });
        }
        return sendJson(res, 200, {
          success: true,
          response: stdout.trim(),
        });
      }
    );
    return;
  }

  // Evolution API: Listar instâncias
  if (apiPath === '/whatsapp/instances' && method === 'GET') {
    try {
      const resp = await fetch(`${EVOLUTION_URL}/instance/fetchInstances`, {
        headers: { apikey: EVOLUTION_APIKEY },
      });
      const data = await resp.json();
      return sendJson(res, resp.status, data);
    } catch (err) {
      console.error('[Evolution API error]', err);
      return sendJson(res, 502, { error: 'Falha ao conectar com Evolution API', details: err.message });
    }
  }

  // Evolution API: Criar nova instância
  if (apiPath === '/whatsapp/instances' && method === 'POST') {
    const body = await parseBody(req);
    const instanceName = body.instanceName || body.name;
    if (!instanceName) {
      return sendJson(res, 400, { error: 'instanceName é obrigatório.' });
    }

    try {
      const payload = {
        instanceName: instanceName.trim(),
        token: body.token || undefined,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        rejectCall: false,
        msgCall: '',
        groupsIgnore: false,
        alwaysOnline: false,
        readMessages: false,
        readStatus: false,
        syncFullHistory: false,
      };

      const resp = await fetch(`${EVOLUTION_URL}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: EVOLUTION_APIKEY,
        },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      return sendJson(res, resp.status, data);
    } catch (err) {
      console.error('[Evolution create error]', err);
      return sendJson(res, 502, { error: 'Falha ao criar instância no Evolution API', details: err.message });
    }
  }

  // Evolution API: Obter QR Code / Connect
  const connectMatch = apiPath.match(/^\/whatsapp\/connect\/([^/]+)$/);
  if (connectMatch && method === 'GET') {
    const instanceName = connectMatch[1];
    try {
      const resp = await fetch(`${EVOLUTION_URL}/instance/connect/${instanceName}`, {
        headers: { apikey: EVOLUTION_APIKEY },
      });
      const data = await resp.json();
      return sendJson(res, resp.status, data);
    } catch (err) {
      console.error('[Evolution connect error]', err);
      return sendJson(res, 502, { error: 'Falha ao conectar instância', details: err.message });
    }
  }

  // Evolution API: Status da conexão
  const statusMatch = apiPath.match(/^\/whatsapp\/status\/([^/]+)$/);
  if (statusMatch && method === 'GET') {
    const instanceName = statusMatch[1];
    try {
      const resp = await fetch(`${EVOLUTION_URL}/instance/connectionState/${instanceName}`, {
        headers: { apikey: EVOLUTION_APIKEY },
      });
      const data = await resp.json();
      return sendJson(res, resp.status, data);
    } catch (err) {
      console.error('[Evolution status error]', err);
      return sendJson(res, 502, { error: 'Falha ao obter status', details: err.message });
    }
  }

  // Evolution API: Deletar instância
  const deleteMatch = apiPath.match(/^\/whatsapp\/instances\/([^/]+)$/);
  if (deleteMatch && method === 'DELETE') {
    const instanceName = deleteMatch[1];
    try {
      const resp = await fetch(`${EVOLUTION_URL}/instance/delete/${instanceName}`, {
        method: 'DELETE',
        headers: { apikey: EVOLUTION_APIKEY },
      });
      const data = await resp.json();
      return sendJson(res, resp.status, data);
    } catch (err) {
      console.error('[Evolution delete error]', err);
      return sendJson(res, 502, { error: 'Falha ao excluir instância', details: err.message });
    }
  }

  // Evolution API: Buscar conversas
  const chatsMatch = apiPath.match(/^\/whatsapp\/chats\/([^/]+)$/);
  if (chatsMatch && method === 'POST') {
    const instanceName = chatsMatch[1];
    try {
      const body = await parseBody(req);
      const resp = await fetch(`${EVOLUTION_URL}/chat/findChats/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: EVOLUTION_APIKEY,
        },
        body: JSON.stringify(body || {}),
      });
      const data = await resp.json();
      return sendJson(res, resp.status, data);
    } catch (err) {
      console.error('[Evolution findChats error]', err);
      return sendJson(res, 502, { error: 'Falha ao buscar chats', details: err.message });
    }
  }

  // Evolution API: Buscar mensagens
  const messagesMatch = apiPath.match(/^\/whatsapp\/messages\/([^/]+)$/);
  if (messagesMatch && method === 'POST') {
    const instanceName = messagesMatch[1];
    try {
      const body = await parseBody(req);
      const resp = await fetch(`${EVOLUTION_URL}/chat/findMessages/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: EVOLUTION_APIKEY,
        },
        body: JSON.stringify(body || {}),
      });
      const data = await resp.json();
      return sendJson(res, resp.status, data);
    } catch (err) {
      console.error('[Evolution findMessages error]', err);
      return sendJson(res, 502, { error: 'Falha ao buscar mensagens', details: err.message });
    }
  }

  // Evolution API: Enviar mensagem de texto
  const sendMatch = apiPath.match(/^\/whatsapp\/send-message\/([^/]+)$/);
  if (sendMatch && method === 'POST') {
    const instanceName = sendMatch[1];
    try {
      const body = await parseBody(req);
      if (!body.number || !body.text) {
        return sendJson(res, 400, { error: 'Campos number e text são obrigatórios.' });
      }

      // Normaliza número
      let number = String(body.number).replace(/\D/g, '');
      const resp = await fetch(`${EVOLUTION_URL}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: EVOLUTION_APIKEY,
        },
        body: JSON.stringify({
          number,
          text: body.text,
          delay: 1200,
        }),
      });
      const data = await resp.json();
      return sendJson(res, resp.status, data);
    } catch (err) {
      console.error('[Evolution sendText error]', err);
      return sendJson(res, 502, { error: 'Falha ao enviar mensagem', details: err.message });
    }
  }

  // Rota desconhecida de API
  return sendJson(res, 404, { error: 'Endpoint de API não encontrado.' });
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(urlObj.pathname);

  // Normaliza caminhos com ou sem prefixo /mensageiro
  if (pathname.startsWith('/mensageiro/api/')) {
    const apiSubPath = pathname.replace('/mensageiro/api', '');
    return handleApi(req, res, apiSubPath);
  }
  if (pathname.startsWith('/api/')) {
    const apiSubPath = pathname.replace('/api', '');
    return handleApi(req, res, apiSubPath);
  }

  // Servir arquivos estáticos do Vite
  let staticPath = pathname;
  if (staticPath.startsWith('/mensageiro/')) {
    staticPath = staticPath.replace('/mensageiro/', '');
  } else if (staticPath === '/mensageiro') {
    res.writeHead(301, { Location: '/mensageiro/' });
    res.end();
    return;
  }

  if (staticPath === '' || staticPath === '/') {
    staticPath = 'index.html';
  }

  const filePath = path.join(DIST_DIR, staticPath);

  // Verifica se o arquivo existe dentro do diretório dist
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // Fallback SPA para index.html
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(indexPath).pipe(res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Build estático não encontrado. Execute npm run build primeiro.');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Mensageiro Server] Rodando na porta ${PORT}`);
  console.log(`[Mensageiro Server] Evolution URL: ${EVOLUTION_URL}`);
  console.log(`[Mensageiro Server] Antigravity CLI: ${AGY_BIN}`);
});
