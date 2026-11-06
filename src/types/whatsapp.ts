export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed'

export type MediaType = 'image' | 'video'

export interface MessageMedia {
  type: MediaType
  url: string
  caption?: string
  fileName?: string
  fileSize?: string
}

export interface MessageReaction {
  emoji: string
  userId: string // 'me' ou contactId
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
  sentAt?: number
  reactions?: { [emoji: string]: number } // legibilidade / contagem simples
  reactionList?: MessageReaction[] // lista detalhada para saber se 'me' reagiu
}

export interface ConversationLabel {
  id: string
  name: string
  color: string // classe de cor ou hex
}

export interface QuickReply {
  id: string
  shortcut?: string // atalho opcional ex: "/ola"
  text: string
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
  updatedAt?: number
  isGroup: boolean
  avatar: string
  aliases?: string[] // outros JIDs do mesmo contato (ex.: @lid)
  phone?: string // só dígitos; ausente quando o telefone não é conhecido
  pushName?: string // nome público informado pelo WhatsApp (não é nome salvo)
  isSaved?: boolean // há contato cadastrado na plataforma
  participants?: string[] // Contact IDs or names
  lastMessage?: {
    text: string
    timestamp: string
    senderId: string
    status?: MessageStatus
  }
  unreadCount?: number
  pinned?: boolean
  archived?: boolean
  labelIds?: string[] // IDs de etiquetas atribuídas
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

// Nota interna associada a um contato
export interface ContactNote {
  id: string
  contactId: string
  text: string
  createdAt: string // ISO string ou formatado
  authorId?: string
  authorName?: string
  updatedAt?: string
}

// Log de evento da aplicação
export interface AppEventLog {
  id: string
  timestamp: string // ISO ou formatado HH:mm:ss
  action: string // ex: 'message_sent', 'contact_created', etc.
  description: string
  level?: 'info' | 'success' | 'warn' | 'error'
  meta?: Record<string, unknown>
}

// Cadastro local de Conexão Evolution API (preparação de integração futura)
export interface EvolutionConnection {
  id: string
  name: string
  serverUrl: string
  apiKey: string
  instanceName: string
  isActive?: boolean // marcada como conexão padrão / ativa
  status?: 'connected' | 'disconnected' | 'connecting'
  createdAt: string
  updatedAt?: string
}
