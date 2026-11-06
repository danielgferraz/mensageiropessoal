import type { ContactNote, Message } from '../types/whatsapp.ts'

export const MAX_NOTE_LENGTH = 10000

function noteText(text: string): string {
  if (!text.trim()) throw new Error('Digite o conteúdo da nota.')
  if (text.trim().length > MAX_NOTE_LENGTH) throw new Error('A nota deve ter até 10.000 caracteres.')
  return text.trim()
}

export function createContactNote(contactId: string, text: string, author: { id: string; name: string }): ContactNote {
  if (!contactId || !author.id || !author.name.trim()) throw new Error('Contato ou autor não identificado.')
  return { id: `note-${crypto.randomUUID()}`, contactId, text: noteText(text),
    createdAt: new Date().toISOString(), authorId: author.id, authorName: author.name.trim() }
}

export function editContactNote(note: ContactNote, text: string): ContactNote {
  return { ...note, text: noteText(text), updatedAt: new Date().toISOString() }
}

export function noteTimestamp(note: Pick<ContactNote, 'createdAt'> & { id?: string }): number {
  const value = note.createdAt || ''
  const legacy = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:,?\s*(?:às\s*)?(\d{2}):(\d{2}))?$/)
  if (legacy) return new Date(+legacy[3], +legacy[2] - 1, +legacy[1], +(legacy[4] || 0), +(legacy[5] || 0)).getTime()
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return Date.parse(value) || 0
  const idTime = note.id?.match(/^note-(\d{13})(?:-|$)/)
  return idTime ? +idTime[1] : 0
}

export function formatNoteDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return value || 'Data não registrada'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Data não registrada' : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function readContactNotes(storage: Pick<Storage, 'getItem'>, key: string): ContactNote[] {
  const raw = storage.getItem(key)
  if (!raw) return []
  const data = JSON.parse(raw)
  if (!Array.isArray(data) || data.some((n) => !n || typeof n.id !== 'string' || typeof n.contactId !== 'string' ||
    typeof n.text !== 'string' || typeof n.createdAt !== 'string' ||
    ['authorId', 'authorName', 'updatedAt'].some((key) => n[key] !== undefined && typeof n[key] !== 'string'))) throw new Error('Formato inválido das notas locais.')
  return data
}

export function writeContactNotes(storage: Pick<Storage, 'setItem'>, key: string, notes: ContactNote[]): void {
  try { storage.setItem(key, JSON.stringify(notes)) }
  catch { throw new Error('Não foi possível salvar neste navegador. Verifique o espaço e a permissão de armazenamento local.') }
}

export type ChatTimelineEntry = { kind: 'message'; id: string; timestamp: number; message: Message } |
  { kind: 'note'; id: string; timestamp: number; note: ContactNote }

export function buildChatTimeline(messages: Message[], notes: ContactNote[], contactId?: string, query = ''): ChatTimelineEntry[] {
  const entries: ChatTimelineEntry[] = [
    ...messages.map((message): ChatTimelineEntry => ({ kind: 'message', id: `message-${message.id}`, timestamp: (message.sentAt || 0) * 1000, message })),
    ...notes.filter((note) => !!contactId && note.contactId === contactId).map((note): ChatTimelineEntry => ({ kind: 'note', id: note.id, timestamp: noteTimestamp(note), note })),
  ]
  const search = query.trim().toLocaleLowerCase('pt-BR')
  return entries.filter((entry) => !search || (entry.kind === 'note' ? entry.note.text : entry.message.text || entry.message.media?.caption || '').toLocaleLowerCase('pt-BR').includes(search))
    .sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id))
}
