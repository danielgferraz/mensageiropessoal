import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { createStore, suggestReply, validateConfig } from './copilot.mjs';
import { loadKnowledge } from './rag.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3333', 10);
const EVOLUTION_URL = process.env.EVOLUTION_URL || 'http://127.0.0.1:8080';
const EVOLUTION_APIKEY = process.env.EVOLUTION_APIKEY || '';
const AGY_BIN = process.env.AGY_BIN || '/home/opc/.local/bin/agy';
const DIST_DIR = path.resolve(__dirname, '../dist');
// Atendente (Copilot): dados do servidor ficam fora do build; a base NebrIA é lida em modo somente leitura.
const COPILOT_DATA_DIR = process.env.COPILOT_DATA_DIR || path.resolve(__dirname, 'data');
const NEBRIA_DIR = process.env.NEBRIA_DIR || '';
const COPILOT_ALLOW_AUTOMATIC = process.env.COPILOT_ALLOW_AUTOMATIC === '1';
const copilotStore = createStore(COPILOT_DATA_DIR);
let knowledgeCache = { at: 0, key: '', value: null };
function currentKnowledge(config) {
  const key = JSON.stringify([NEBRIA_DIR, config.ragFolders]);
  if (!knowledgeCache.value || knowledgeCache.key !== key || Date.now() - knowledgeCache.at > 60000) {
    knowledgeCache = { at: Date.now(), key, value: loadKnowledge(NEBRIA_DIR, config.ragFolders) };
  }
  return knowledgeCache.value;
}
function runAgy(prompt) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(AGY_BIN)) return reject(new Error('agy indisponível'));
    execFile(AGY_BIN, ['-p', prompt], { timeout: 90000, maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, PATH: `${process.env.PATH}:/home/opc/.local/bin` } },
    (error, stdout) => (error ? reject(error) : resolve(stdout)));
  });
}
const text = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');

function fetchUpstream(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
}

// Cache de metadados de grupos (nome/tamanho/foto), 10 min por instância; falha silenciosa
const GROUP_CACHE_TTL_MS = 10 * 60 * 1000;
const groupCache = new Map();
export async function getGroupMetadata(instanceName) {
  const cached = groupCache.get(instanceName);
  if (cached && Date.now() - cached.at < GROUP_CACHE_TTL_MS) return cached.map;
  const map = new Map();
  try {
    const resp = await fetchUpstream(`${EVOLUTION_URL}/group/fetchAllGroups/${encodeURIComponent(instanceName)}?getParticipants=false`, {
      headers: { apikey: EVOLUTION_APIKEY },
    });
    const rows = resp.ok ? await resp.json() : [];
    for (const g of Array.isArray(rows) ? rows : []) {
      if (typeof g?.id !== 'string') continue;
      map.set(g.id, {
        subject: typeof g.subject === 'string' && g.subject.trim() ? g.subject.trim() : null,
        size: Number.isFinite(g.size) ? g.size : null,
        pictureUrl: typeof g.pictureUrl === 'string' ? g.pictureUrl : null,
      });
    }
    groupCache.set(instanceName, { at: Date.now(), map });
  } catch (err) {
    console.error('[Evolution fetchAllGroups error]', err.message);
    if (cached) return cached.map;
  }
  return map;
}

export function sanitizeInstances(data) {
  const rows = Array.isArray(data) ? data : Array.isArray(data?.instances) ? data.instances : [];
  const stringValue = value => typeof value === 'string' ? value : null;
  return rows.map(row => {
    const instance = row?.instance || row;
    return {
      name: stringValue(instance?.name) || stringValue(instance?.instanceName) || '',
      instanceName: stringValue(instance?.instanceName) || stringValue(instance?.name) || '',
      connectionStatus: stringValue(instance?.connectionStatus) || stringValue(instance?.status) || stringValue(instance?.state) || 'close',
      ownerJid: stringValue(instance?.ownerJid) || stringValue(instance?.owner),
      profileName: stringValue(instance?.profileName),
      profilePicUrl: stringValue(instance?.profilePicUrl) || stringValue(instance?.profilePictureUrl),
    };
  }).filter(instance => instance.name);
}

function validInstanceName(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
}

export function normalizeRecipient(value) {
  if (typeof value !== 'string') return null;
  const number = value.trim();
  if (/^\d+(?:-\d+)?@g\.us$/.test(number) || /^\d+@(s\.whatsapp\.net|lid)$/.test(number)) return number;
  if (!/^[+\d ()-]+$/.test(number)) return null;
  const digits = number.replace(/\D/g, '');
  return /^\d{7,15}$/.test(digits) ? digits : null;
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:18180';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImE3ZDQwYzk0LTYwYWUtNDg3Yi04MDNkLTU0Y2VmMzhhNTljMyJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6Imh0dHBzOi8vd3d3LnRlY2hhZ2VuZGEuYXBwLmJyL2F1dGgvdjEiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiaWF0IjoxNzkzNjQ1MTQzLCJleHAiOjE3OTYyMzcxNDN9.bRw-pTO9XDbcQ1jnTkninnZvgFU6cUGDblxSmfr8ZiU4mwWsivy7NztFeSwwqQtY8b6PG-mThe1HXK2mckvs_A';

// Cache em memória para tokens validados (evita requisições repetitivas ao Auth em polling)
const adminTokenCache = new Map(); // token -> { user, expiresAt }

async function verifyAdminAuth(req) {
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { authorized: false, status: 401, error: 'Token de autenticação não fornecido.' };
  }
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return { authorized: false, status: 401, error: 'Token vazio.' };
  }

  // Verifica cache ativo
  const cached = adminTokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return { authorized: true, user: cached.user };
  }

  try {
    // 1. Valida token com Supabase Auth
    const userRes = await fetchUpstream(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!userRes.ok) {
      return { authorized: false, status: 401, error: 'Token de autenticação inválido ou expirado.' };
    }

    const userData = await userRes.json();
    if (!userData || !userData.id) {
      return { authorized: false, status: 401, error: 'Usuário não identificado.' };
    }

    // 2. Consulta perfil em public.profiles para validar role 'admin'
    const profileRes = await fetchUpstream(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userData.id}&select=id,role,full_name`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!profileRes.ok) {
      return { authorized: false, status: 500, error: 'Falha ao consultar perfil do usuário.' };
    }

    const profiles = await profileRes.json();
    if (!Array.isArray(profiles) || profiles.length === 0) {
      return { authorized: false, status: 403, error: 'Perfil de usuário não encontrado.' };
    }

    const profile = profiles[0];
    if (profile.role !== 'admin') {
      return {
        authorized: false,
        status: 403,
        error: `Acesso negado: o perfil "${profile.role}" não possui permissão de Administrador.`,
        role: profile.role,
      };
    }

    const adminUser = {
      id: userData.id,
      email: userData.email,
      fullName: profile.full_name || userData.email,
      role: 'admin',
    };

    // Cache por 60 segundos
    adminTokenCache.set(token, {
      user: adminUser,
      expiresAt: Date.now() + 60 * 1000,
    });

    return { authorized: true, user: adminUser };
  } catch (err) {
    console.error('[Admin Auth Verification Error]', err);
    return { authorized: false, status: 502, error: 'Erro de comunicação com o serviço de autenticação.' };
  }
}

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
        const parsed = JSON.parse(data);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid JSON object');
        resolve(parsed);
      } catch (err) {
        reject(Object.assign(new Error('JSON inválido.'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
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

  // Auth: Login como Administrador via Supabase Auth
  if (apiPath === '/auth/login' && method === 'POST') {
    const body = await parseBody(req);
    const { email, password } = body;
    if (!email || !password) {
      return sendJson(res, 400, { success: false, error: 'Email e senha são obrigatórios.' });
    }

    try {
      const loginRes = await fetchUpstream(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await loginRes.json();
      if (!loginRes.ok || !data.access_token) {
        return sendJson(res, 401, {
          success: false,
          error: data.error_description || data.msg || 'Credenciais inválidas.',
        });
      }

      const token = data.access_token;
      const profileRes = await fetchUpstream(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${data.user.id}&select=id,role,full_name`, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
        },
      });

      const profiles = await profileRes.json();
      if (!Array.isArray(profiles) || profiles.length === 0 || profiles[0].role !== 'admin') {
        const userRole = profiles?.[0]?.role || 'sem perfil';
        return sendJson(res, 403, {
          success: false,
          error: `Acesso negado: sua conta possui o perfil "${userRole}". O Mensageiro é restrito a Administradores.`,
        });
      }

      const adminUser = {
        id: data.user.id,
        email: data.user.email,
        fullName: profiles[0].full_name || data.user.email,
        role: 'admin',
      };

      adminTokenCache.set(token, {
        user: adminUser,
        expiresAt: Date.now() + 60 * 1000,
      });

      return sendJson(res, 200, {
        success: true,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user: adminUser,
      });
    } catch (err) {
      if (err.statusCode) return sendJson(res, err.statusCode, { error: err.message });
      console.error('[Login Error]', err);
      return sendJson(res, 502, { success: false, error: 'Falha de comunicação com Supabase Auth.', details: err.message });
    }
  }

  // Auth: Verificação de sessão existente
  if (apiPath === '/auth/verify' && method === 'GET') {
    const auth = await verifyAdminAuth(req);
    if (!auth.authorized) {
      return sendJson(res, auth.status || 401, { authorized: false, error: auth.error, role: auth.role });
    }
    return sendJson(res, 200, { authorized: true, user: auth.user });
  }

  // A partir daqui, TODOS os endpoints de API exigem autorização de Administrador
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) {
    return sendJson(res, auth.status || 401, { error: auth.error, role: auth.role });
  }

  if (apiPath.startsWith('/whatsapp/')) {
    if (!EVOLUTION_APIKEY) return sendJson(res, 503, { error: 'Evolution API não configurada no servidor.' });
    const instancePath = apiPath.match(/^\/whatsapp\/(?:connect|status|instances|chats|messages|send-message)\/(.+)$/);
    if (instancePath && !validInstanceName(instancePath[1])) {
      return sendJson(res, 400, { error: 'Nome de instância inválido.' });
    }
  }

  // Atendente Copilot: configuração, auditoria e rascunhos (nunca envia mensagens)
  if (apiPath.startsWith('/copilot/')) {
    if (apiPath === '/copilot/config' && method === 'GET') {
      const config = copilotStore.readConfig();
      const knowledge = currentKnowledge(config);
      return sendJson(res, 200, { config, automaticAllowed: COPILOT_ALLOW_AUTOMATIC,
        rag: { configured: !!NEBRIA_DIR, available: knowledge.available, documents: knowledge.documents, skipped: knowledge.skipped } });
    }
    if (apiPath === '/copilot/config' && method === 'PUT') {
      const body = await parseBody(req);
      const next = validateConfig(body, copilotStore.readConfig(), { allowAutomatic: COPILOT_ALLOW_AUTOMATIC });
      next.updatedAt = new Date().toISOString();
      next.updatedBy = auth.user?.email || auth.user?.id || null;
      copilotStore.writeConfig(next);
      copilotStore.audit({ action: 'config', user: next.updatedBy, enabled: next.enabled, paused: next.paused, mode: next.mode,
        allowedContacts: next.allowedContactIds.length, allowedLabels: next.allowedLabelIds.length });
      knowledgeCache = { at: 0, key: '', value: null };
      return sendJson(res, 200, { config: next });
    }
    if (apiPath === '/copilot/audit' && method === 'GET') return sendJson(res, 200, { entries: copilotStore.readAudit(100) });
    if (apiPath === '/copilot/suggest' && method === 'POST') {
      const body = await parseBody(req);
      const messages = Array.isArray(body.messages) ? body.messages.slice(-20).map((m) => ({ fromMe: !!m?.fromMe, text: text(m?.text, 800) })).filter((m) => m.text) : [];
      const lastIncoming = [...messages].reverse().find((m) => !m.fromMe)?.text || '';
      if (!text(body.contactId, 200) || !lastIncoming) return sendJson(res, 400, { error: 'Conversa sem mensagem do cliente para responder.' });
      const config = copilotStore.readConfig();
      const result = await suggestReply({ store: copilotStore, knowledge: currentKnowledge(config), runModel: runAgy, user: auth.user,
        request: { contactId: text(body.contactId, 200), isSaved: body.isSaved === true, isGroup: body.isGroup === true,
          labelIds: Array.isArray(body.labelIds) ? body.labelIds.filter((id) => typeof id === 'string').slice(0, 50) : [],
          contactPhone: text(body.contactPhone, 30).replace(/D/g, ''), messages, lastIncoming } });
      return sendJson(res, 200, result);
    }
    return sendJson(res, 404, { error: 'Rota não encontrada.' });
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
      const resp = await fetchUpstream(`${EVOLUTION_URL}/instance/fetchInstances`, {
        headers: { apikey: EVOLUTION_APIKEY },
      });
      const data = await resp.json();
      return sendJson(res, resp.status, resp.ok ? sanitizeInstances(data) : { error: 'Falha ao listar instâncias.' });
    } catch (err) {
      if (err.statusCode) return sendJson(res, err.statusCode, { error: err.message });
      console.error('[Evolution API error]', err);
      return sendJson(res, 502, { error: 'Falha ao conectar com Evolution API', details: err.message });
    }
  }

  // Evolution API: Criar nova instância
  if (apiPath === '/whatsapp/instances' && method === 'POST') {
    const body = await parseBody(req);
    const instanceName = body.instanceName || body.name;
    if (!validInstanceName(instanceName)) {
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

      const resp = await fetchUpstream(`${EVOLUTION_URL}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: EVOLUTION_APIKEY,
        },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok) return sendJson(res, resp.status, { error: 'Falha ao criar instância.' });
      const qr = data.qrcode || {};
      return sendJson(res, resp.status, {
        instance: sanitizeInstances([data.instance || { name: instanceName }])[0],
        qrcode: { base64: qr.base64, pairingCode: qr.pairingCode, code: qr.code },
      });
    } catch (err) {
      if (err.statusCode) return sendJson(res, err.statusCode, { error: err.message });
      console.error('[Evolution create error]', err);
      return sendJson(res, 502, { error: 'Falha ao criar instância no Evolution API', details: err.message });
    }
  }

  // Evolution API: Obter QR Code / Connect
  const connectMatch = apiPath.match(/^\/whatsapp\/connect\/([^/]+)$/);
  if (connectMatch && method === 'GET') {
    const instanceName = connectMatch[1];
    try {
      const resp = await fetchUpstream(`${EVOLUTION_URL}/instance/connect/${encodeURIComponent(instanceName)}`, {
        headers: { apikey: EVOLUTION_APIKEY },
      });
      const data = await resp.json();
      return sendJson(res, resp.status, data);
    } catch (err) {
      if (err.statusCode) return sendJson(res, err.statusCode, { error: err.message });
      console.error('[Evolution connect error]', err);
      return sendJson(res, 502, { error: 'Falha ao conectar instância', details: err.message });
    }
  }

  // Evolution API: Status da conexão
  const statusMatch = apiPath.match(/^\/whatsapp\/status\/([^/]+)$/);
  if (statusMatch && method === 'GET') {
    const instanceName = statusMatch[1];
    try {
      const resp = await fetchUpstream(`${EVOLUTION_URL}/instance/connectionState/${encodeURIComponent(instanceName)}`, {
        headers: { apikey: EVOLUTION_APIKEY },
      });
      const data = await resp.json();
      return sendJson(res, resp.status, data);
    } catch (err) {
      if (err.statusCode) return sendJson(res, err.statusCode, { error: err.message });
      console.error('[Evolution status error]', err);
      return sendJson(res, 502, { error: 'Falha ao obter status', details: err.message });
    }
  }

  // Evolution API: Deletar instância
  const deleteMatch = apiPath.match(/^\/whatsapp\/instances\/([^/]+)$/);
  if (deleteMatch && method === 'DELETE') {
    const instanceName = deleteMatch[1];
    try {
      const resp = await fetchUpstream(`${EVOLUTION_URL}/instance/delete/${encodeURIComponent(instanceName)}`, {
        method: 'DELETE',
        headers: { apikey: EVOLUTION_APIKEY },
      });
      const data = await resp.json();
      return sendJson(res, resp.status, data);
    } catch (err) {
      if (err.statusCode) return sendJson(res, err.statusCode, { error: err.message });
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
      const resp = await fetchUpstream(`${EVOLUTION_URL}/chat/findChats/${encodeURIComponent(instanceName)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: EVOLUTION_APIKEY,
        },
        body: JSON.stringify(body || {}),
      });
      const data = await resp.json();
      if (resp.ok && Array.isArray(data) && data.some((c) => String(c?.remoteJid || '').endsWith('@g.us'))) {
        const groups = await getGroupMetadata(instanceName);
        for (const chat of data) {
          const meta = groups.get(String(chat?.remoteJid || ''));
          if (!meta) continue;
          if (!chat.subject && meta.subject) chat.subject = meta.subject;
          if (chat.groupSize == null && meta.size != null) chat.groupSize = meta.size;
          if (!chat.profilePicUrl && meta.pictureUrl) chat.profilePicUrl = meta.pictureUrl;
        }
      }
      return sendJson(res, resp.status, data);
    } catch (err) {
      if (err.statusCode) return sendJson(res, err.statusCode, { error: err.message });
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
      const resp = await fetchUpstream(`${EVOLUTION_URL}/chat/findMessages/${encodeURIComponent(instanceName)}`, {
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
      if (err.statusCode) return sendJson(res, err.statusCode, { error: err.message });
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
      const number = normalizeRecipient(body.number);
      if (!number || typeof body.text !== 'string' || !body.text.trim() || body.text.length > 10000) {
        return sendJson(res, 400, { error: 'Informe um destinatário válido e texto de 1 a 10000 caracteres.' });
      }
      const resp = await fetchUpstream(`${EVOLUTION_URL}/message/sendText/${encodeURIComponent(instanceName)}`, {
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
      if (err.statusCode) return sendJson(res, err.statusCode, { error: err.message });
      console.error('[Evolution sendText error]', err);
      return sendJson(res, 502, { error: 'Falha ao enviar mensagem', details: err.message });
    }
  }

  // Rota desconhecida de API
  return sendJson(res, 404, { error: 'Endpoint de API não encontrado.' });
}

async function handleRequest(req, res) {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(urlObj.pathname);
  if (pathname.includes('\\') || pathname.includes('\0')) {
    return sendJson(res, 403, { error: 'Caminho inválido.' });
  }

  // Normaliza caminhos com ou sem prefixo /mensageiro
  if (pathname.startsWith('/mensageiro/api/')) {
    const apiSubPath = pathname.replace('/mensageiro/api', '');
    return await handleApi(req, res, apiSubPath);
  }
  if (pathname.startsWith('/api/')) {
    const apiSubPath = pathname.replace('/api', '');
    return await handleApi(req, res, apiSubPath);
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

  const filePath = path.resolve(DIST_DIR, staticPath.replace(/^[/\\]+/, ''));
  const relativePath = path.relative(DIST_DIR, filePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return sendJson(res, 403, { error: 'Caminho inválido.' });
  }

  // Verifica se o arquivo existe dentro do diretório dist
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' || path.basename(filePath) === 'sw.js' || ext === '.webmanifest' ? 'no-cache' : 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
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
}

export const server = http.createServer((req, res) => {
  handleRequest(req, res).catch(err => {
    if (res.headersSent) return res.destroy();
    sendJson(res, err instanceof URIError ? 400 : err.statusCode || 500, { error: err.statusCode ? err.message : 'Não foi possível processar a solicitação.' });
  });
});

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Mensageiro Server] Rodando na porta ${PORT}`);
  console.log(`[Mensageiro Server] Evolution URL: ${EVOLUTION_URL}`);
  console.log(`[Mensageiro Server] Antigravity CLI: ${AGY_BIN}`);
});
