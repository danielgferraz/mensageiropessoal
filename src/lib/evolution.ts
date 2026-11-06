import type { Conversation, Message, MessageStatus } from '../types/whatsapp.ts'
import { chatIdentity, formatPhone, isGroupJid, phoneOf } from './jids.ts'

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

export function normalizeMessage(row: any, jid: string, aliases: string[] = []): Message | null {
  if (!row?.key?.id || (row.key.remoteJid && row.key.remoteJid !== jid && !aliases.includes(row.key.remoteJid))) return null
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

export function parseMessages(data: any, jid: string, aliases: string[] = []): { records: Message[]; pages: number } {
  const envelope = data?.messages || data
  const rows = Array.isArray(envelope) ? envelope : envelope?.records
  if (!Array.isArray(rows)) throw new Error('Resposta inválida ao carregar mensagens.')
  return {
    records: rows.map((row) => normalizeMessage(row, jid, aliases)).filter(Boolean) as Message[],
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

export function parseChats(data: any): { conversations: Conversation[] } {
  const rows = Array.isArray(data) ? data : data?.chats
  if (!Array.isArray(rows)) throw new Error('Resposta inválida ao carregar conversas.')
  const entries = rows.flatMap((row) => { const identity = chatIdentity(row); return identity ? [{ row, identity }] : [] })
  // Um @lid sem telefone declarado na própria linha herda o telefone de outra linha que o cita como alias.
  const phoneByAlias = new Map<string, string>()
  for (const { identity } of entries) for (const alias of identity.aliases) if (phoneOf(identity.id)) phoneByAlias.set(alias, identity.id)
  const groups = new Map<string, { identity: { id: string; aliases: string[] }; rows: any[] }>()
  for (const { row, identity } of entries) {
    const id = phoneByAlias.get(identity.id) || identity.id
    const aliases = identity.id === id ? identity.aliases : [...identity.aliases, identity.id]
    const group = groups.get(id) || { identity: { id, aliases: [] }, rows: [] }
    group.identity.aliases = [...new Set([...group.identity.aliases, ...aliases])].filter((alias) => alias !== id)
    group.rows.push(row)
    groups.set(id, group)
  }
  const conversations: Conversation[] = [...groups.values()].map(({ identity, rows: members }) => {
    const isGroup = isGroupJid(identity.id)
    const text = (read: (row: any) => unknown) => members.map(read).find((v) => typeof v === 'string' && v.trim()) as string | undefined
    const pushName = text((r) => r.pushName) || text((r) => (r.lastMessage?.key?.fromMe ? undefined : r.lastMessage?.pushName))
    const phone = phoneOf(identity.id)
    const name = isGroup ? text((r) => r.subject) || text((r) => r.name) || identity.id.split('@')[0]
      : phone ? formatPhone(phone) : pushName || 'Número não identificado'
    const picture = text((r) => (/^https:\/\//.test(r.profilePicUrl || '') ? r.profilePicUrl : undefined))
    const withLast = members.filter((r) => r.lastMessage).map((r) => ({ r, last: normalizeMessage(r.lastMessage, identity.id, identity.aliases) }))
      .filter((entry) => entry.last).sort((a, b) => (b.last!.sentAt || 0) - (a.last!.sentAt || 0))[0]
    const last = withLast?.last
    return {
      id: identity.id, name, isGroup, avatar: picture || FALLBACK_AVATAR,
      aliases: identity.aliases.length ? identity.aliases : undefined,
      phone, pushName: isGroup ? undefined : pushName,
      participants: isGroup ? [] : [identity.id],
      unreadCount: members.reduce((sum, r) => sum + (Number(r.unreadCount ?? r.unreadMessages) || 0), 0),
      lastMessage: last ? { text: last.text || '', timestamp: last.timestamp, senderId: last.senderId, status: last.status } : undefined,
      updatedAt: last?.sentAt || Math.max(0, ...members.map(secondsOf)),
    }
  })
  conversations.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  return { conversations }
}
