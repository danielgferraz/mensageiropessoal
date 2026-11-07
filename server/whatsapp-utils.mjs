// Utilitários puros sobre payloads da Evolution API (webhook e findMessages). Sem rede, sem efeitos colaterais.

const CHAT_JID = /^\d+(?:-\d+)?@(s\.whatsapp\.net|g\.us|lid)$/;
const PHONE_JID = /^\d+@s\.whatsapp\.net$/;

export function cleanJid(value) {
  if (typeof value !== 'string') return null;
  const jid = value.replace(/:\d+@/, '@');
  return CHAT_JID.test(jid) ? jid : null;
}
export const isGroupJid = (jid) => typeof jid === 'string' && jid.endsWith('@g.us');
export const isPhoneJid = (jid) => PHONE_JID.test(jid || '');
export const phoneOf = (jid) => (isPhoneJid(jid) ? jid.split('@')[0] : '');

/** Texto real da mensagem; '' quando não há texto (áudio, figurinha, mídia sem legenda). */
export function plainText(row) {
  const m = row?.message || {};
  const wrapped = m.ephemeralMessage?.message || m.viewOnceMessage?.message;
  if (wrapped) return plainText({ message: wrapped });
  const text = m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.videoMessage?.caption || '';
  return typeof text === 'string' ? text.trim() : '';
}

/** Texto puro digitado pelo contato (sem legenda de mídia): único tipo que pode receber resposta automática. */
export function isPlainText(row) {
  const m = row?.message || {};
  const wrapped = m.ephemeralMessage?.message || m.viewOnceMessage?.message;
  if (wrapped) return isPlainText({ message: wrapped });
  const text = m.conversation || m.extendedTextMessage?.text;
  return typeof text === 'string' && !!text.trim() && !m.imageMessage && !m.videoMessage && !m.audioMessage && !m.documentMessage && !m.stickerMessage;
}

/** Texto para contexto de conversa: mídia sem legenda vira um marcador curto. */
export function contextText(row) {
  const text = plainText(row);
  if (text) return text;
  const m = row?.message || {};
  if (m.imageMessage) return '[foto]';
  if (m.videoMessage) return '[vídeo]';
  if (m.audioMessage) return '[áudio]';
  if (m.documentMessage) return '[documento]';
  if (m.stickerMessage) return '[figurinha]';
  return '';
}

export function secondsOf(row) {
  const raw = row?.messageTimestamp;
  if (raw !== undefined && raw !== null) return Number(raw?.low ?? raw) || 0;
  return Date.parse(row?.updatedAt || row?.createdAt || '') / 1000 || 0;
}

/** JIDs que identificam a mesma conversa: o telefone (quando conhecido) primeiro, depois o @lid original. */
export function candidateJids(key) {
  const remote = cleanJid(key?.remoteJid);
  const alts = [key?.remoteJidAlt, key?.senderPn, key?.participantAlt].map(cleanJid).filter(Boolean);
  const phone = alts.find((jid) => isPhoneJid(jid) && jid !== remote);
  return [...new Set([isPhoneJid(remote) ? remote : phone, remote, ...alts].filter(Boolean))];
}

export function normalizeEventName(value) {
  return String(value || '').toLowerCase().replace(/_/g, '.');
}

/**
 * Extrai mensagens recebidas de um webhook messages.upsert. Ignora outros eventos.
 * Retorna uma lista de { instance, id, jids, text, fromMe, isGroup, atMs, pushName }.
 */
export function parseUpsert(payload) {
  if (!payload || typeof payload !== 'object') return [];
  if (normalizeEventName(payload.event) !== 'messages.upsert') return [];
  const rows = Array.isArray(payload.data) ? payload.data : payload.data ? [payload.data] : [];
  const instance = typeof payload.instance === 'string' ? payload.instance : (payload.instance?.instanceName || '');
  return rows.flatMap((row) => {
    const key = row?.key;
    const jids = candidateJids(key);
    if (!key?.id || !jids.length) return [];
    return [{
      instance, id: String(key.id), jids, fromMe: key.fromMe === true,
      isGroup: jids.some(isGroupJid), text: plainText(row), plain: isPlainText(row),
      atMs: secondsOf(row) * 1000, pushName: typeof row.pushName === 'string' ? row.pushName.slice(0, 120) : '',
    }];
  });
}

/** Linhas de uma resposta do findMessages (aceita { messages: { records } }, { records } ou array). */
export function rowsOf(data) {
  const envelope = data?.messages || data;
  const rows = Array.isArray(envelope) ? envelope : envelope?.records;
  return Array.isArray(rows) ? rows : [];
}

/** Une linhas de vários JIDs do mesmo contato, remove repetidas por id, ordena do mais antigo e corta nas últimas `limit`. */
export function toContextMessages(rowSets, limit = 20) {
  const byId = new Map();
  for (const row of rowSets.flat()) {
    const id = row?.key?.id;
    const text = contextText(row);
    if (!id || !text || byId.has(id)) continue;
    byId.set(id, { id, fromMe: row.key.fromMe === true, text, at: secondsOf(row) });
  }
  return [...byId.values()].sort((a, b) => a.at - b.at).slice(-limit);
}
