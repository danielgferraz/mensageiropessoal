export type MessageStatus = 'sent' | 'delivered' | 'read'

export type MediaType = 'image' | 'video'

export interface MessageMedia {
  type: MediaType
  url: string
  caption?: string
  fileName?: string
  fileSize?: string
}

export interface Message {
  id: string
  conversationId: string
  senderId: string // 'me' or contactId
  senderName: string
  text?: string
  media?: MessageMedia
  timestamp: string // ISO string or 'HH:mm'
  status: MessageStatus
  reactions?: { [emoji: string]: number }
}

export interface Contact {
  id: string
  name: string
  phone: string
  avatar: string
  about?: string
  online?: boolean
}

export interface Conversation {
  id: string
  name: string
  isGroup: boolean
  avatar: string
  participants?: string[] // Contact IDs or names
  lastMessage?: {
    text: string
    timestamp: string
    senderId: string
    status?: MessageStatus
  }
  unreadCount?: number
  pinned?: boolean
}

// Estágios do CRM são dinâmicos (CRUD de "status" no pipeline):
// o id é sempre string, os padrões continuam sendo os quatro originais
export type CrmStageId = string

export interface UserProfile {
  name: string
  phone?: string
  avatar: string
  about: string
}
