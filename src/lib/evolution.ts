import type { Contact, Conversation, Message, MessageStatus } from '../types/whatsapp.ts'

export const FALLBACK_AVATAR = '/mensageiro/icon-512.svg'
export interface Instance {
  name: string
  connectionStatus: string
  ownerJid?: string
  profileName?: string
  profilePicUrl?: string
}

export function parseInstances(data: unknown): Instance[] {
  if (!Array.isArray(data)) throw new Error('Resposta inválida ao consultar instâncias.')
  return data.map((entry) => {
    const row = entry.instance || entry
    return {
      name: row.name || row.instanceName,
      connectionStatus: row.connectionStatus || row.status || row.state,
      ownerJid: row.ownerJid,
      profileName: row.profileName,
      profilePicUrl: row.profilePicUrl,
    }
  }).filter((row) => typeof row.name === 'string')
}

export function selectInstance(instances: Instance[]): Instance | undefined {
  return instances.find((i) => i.name === 'WA' && i.connectionStatus === 'open') ||
    instances.find((i) => i.connectionStatus === 'open')
}

export function messageText(row: any): string {
  const m = row?.message || {}
  const wrapped = m.ephemeralMessage?.message || m.viewOnceMessage?.message
  if (wrapped) return messageText({ message: wrapped })
  return m.conversation || m.extendedTextMessage?.text ||
    m.imageMessage?.caption || m.videoMessage?.caption ||
    (m.imageMessage ? '📷 Foto' : m.videoMessage ? '🎥 Vídeo' :
      m.audioMessage ? '🎵 Áudio' : m.documentMessage ? `📎 ${m.documentMessage.fileName || 'Documento'}` :
      m.stickerMessage ? 'Figurinha' : '[Mensagem não textual]')
}

function statusOf(value: unknown): MessageStatus {
  if (value === 'READ' || value === 'PLAYED' || value === 4 || value === 5) return 'read'
  if (value === 'DELIVERY_ACK' || value === 3) return 'delivered'
  if (value === 'PENDING' || value === 1) return 'pending'
  if (value === 'ERROR' || value === 0) return 'failed'
  return 'sent'
}

function secondsOf(row: any): number {
  const raw = row?.messageTimestamp
  if (raw !== undefined) return Number(raw?.low ?? raw) || 0
  return Date.parse(row?.updatedAt || row?.createdAt || '') / 1000 || 0
}

function clock(seconds: number): string {
  return seconds ? new Date(seconds * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''
}

export function normalizeMessage(row: any, jid: string): Message | null {
  if (!row?.key?.id || (row.key.remoteJid && row.key.remoteJid !== jid)) return null
  const sentAt = secondsOf(row)
  const updates = row.MessageUpdate || []
  return {
    id: row.key.id,
    conversationId: jid,
    senderId: row.key.fromMe ? 'me' : row.key.participant || jid,
    senderName: row.key.fromMe ? 'Você' : row.pushName || row.key.participant || jid.split('@')[0],
    text: messageText(row),
    timestamp: clock(sentAt),
    sentAt,
    status: statusOf(updates.at(-1)?.status ?? row.status),
  }
}

export function parseMessages(data: any, jid: string): { records: Message[]; pages: number } {
  const envelope = data?.messages || data
  const rows = Array.isArray(envelope) ? envelope : envelope?.records
  if (!Array.isArray(rows)) throw new Error('Resposta inválida ao carregar mensagens.')
  return {
    records: rows.map((row) => normalizeMessage(row, jid)).filter(Boolean) as Message[],
    pages: Math.max(1, Number(envelope.pages) || 1),
  }
}

export function mergeMessages(previous: Message[], incoming: Message[]): Message[] {
  const byId = new Map(previous.map((message) => [message.id, message]))
  const rank = { pending: 0, sent: 1, delivered: 2, read: 3, failed: -1 }
  incoming.forEach((message) => {
    const previous = byId.get(message.id)
    const status = previous && message.status !== 'failed' && rank[previous.status] > rank[message.status] ? previous.status : message.status
    byId.set(message.id, { ...message, status })
  })
  return [...byId.values()].sort((a, b) => (a.sentAt || 0) - (b.sentAt || 0))
}

export function parseChats(data: any): { conversations: Conversation[]; contacts: Contact[] } {
  const rows = Array.isArray(data) ? data : data?.chats
  if (!Array.isArray(rows)) throw new Error('Resposta inválida ao carregar conversas.')
  const contacts: Contact[] = []
  const conversations: Conversation[] = []
  for (const row of rows) {
    const jid = row.remoteJid || row.lastMessage?.key?.remoteJid
    if (typeof jid !== 'string' || !/^\d+(?:-\d+)?@(s\.whatsapp\.net|g\.us|lid)$/.test(jid)) continue
    const isGroup = jid.endsWith('@g.us')
    const name = row.name || row.subject || row.pushName || jid.split('@')[0]
    const avatar = /^https:\/\//.test(row.profilePicUrl || '') ? row.profilePicUrl : FALLBACK_AVATAR
    const last = row.lastMessage && normalizeMessage(row.lastMessage, jid)
    if (!isGroup) contacts.push({ id: jid, name, phone: jid.split('@')[0], avatar })
    conversations.push({
      id: jid, name, isGroup, avatar, participants: isGroup ? [] : [jid],
      unreadCount: row.unreadCount || 0,
      lastMessage: last ? { text: last.text || '', timestamp: last.timestamp, senderId: last.senderId, status: last.status } : undefined,
      updatedAt: last?.sentAt || secondsOf(row),
    })
  }
  conversations.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  return { conversations, contacts }
}
