import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createContactNote, editContactNote, noteTimestamp, readContactNotes, writeContactNotes } from '@/lib/contact-notes'
import { useAuth } from '@/context/AuthContext'
import { useEvolution, evolutionRequest } from '@/hooks/use-evolution'
import { FALLBACK_AVATAR, normalizeMessage } from '@/lib/evolution'
import { canonicalizeKeys, formatPhone } from '@/lib/jids'
import {
  Contact,
  Conversation,
  ConversationLabel,
  CrmStageId,
  Message,
  QuickReply,
  UserProfile,
  MessageMedia,
  ContactNote,
  AppEventLog,
  EvolutionConnection,
} from '@/types/whatsapp'
const DEFAULT_USER: UserProfile = { name: '', avatar: FALLBACK_AVATAR, about: '' }

import {
  CRM_STAGE_COLORS,
  CrmStageConfig,
  DEFAULT_CRM_STAGE_LIST,
  DEFAULT_CRM_STAGES,
} from '@/data/crmData'
import { DEFAULT_LABELS, DEFAULT_QUICK_REPLIES } from '@/data/labelsData'

interface WhatsAppContextType {
  loading: boolean
  syncError: string | null
  messageError: string | null
  loadingMessages: boolean
  instanceName: string | null
  refresh: () => void
  loadOlder: () => Promise<void>
  hasOlder: boolean
  user: UserProfile
  setUser: (user: UserProfile) => void
  contacts: Contact[]
  conversations: Conversation[]
  messages: Record<string, Message[]>
  activeChatId: string | null
  setActiveChatId: (id: string | null) => void
  activeMedia: MessageMedia | null
  setActiveMedia: (media: MessageMedia | null) => void
  sendMessage: (conversationId: string, text?: string, media?: MessageMedia) => Promise<void>
  createGroup: (name: string, participantIds: string[], avatar?: string) => string
  addContact: (name: string, phone: string, about?: string) => Contact
  saveConversationAsContact: (conversationId: string, name: string) => Contact
  updateContact: (contactId: string, name: string, about?: string, phone?: string) => void
  deleteContact: (contactId: string) => void
  startChatWithContact: (contactId: string) => string
  markAsRead: (conversationId: string) => void
  resetData: () => void
  // CRM (pipeline de negócios em memória)
  crmStages: Record<string, CrmStageId>
  setContactStage: (contactId: string, stage: CrmStageId | null) => void
  // CRUD de estágios do pipeline ("status")
  crmStageList: CrmStageConfig[]
  addCrmStage: (label: string, colorIndex?: number) => CrmStageConfig | null
  renameCrmStage: (stageId: CrmStageId, label: string) => void
  deleteCrmStage: (stageId: CrmStageId, moveContactsTo: CrmStageId) => void
  moveCrmStage: (stageId: CrmStageId, direction: -1 | 1) => void
  // Etiquetas (Labels)
  labels: ConversationLabel[]
  createLabel: (name: string, color: string) => ConversationLabel | null
  updateLabel: (labelId: string, name: string, color: string) => void
  deleteLabel: (labelId: string) => void
  setConversationLabels: (conversationId: string, labelIds: string[]) => void
  toggleConversationLabel: (conversationId: string, labelId: string) => void
  getContactLabelIds: (contactId: string) => string[]
  setContactLabels: (contactId: string, labelIds: string[]) => void
  toggleContactLabel: (contactId: string, labelId: string) => void
  // Arquivar & Fixar
  togglePinConversation: (conversationId: string) => void
  toggleArchiveConversation: (conversationId: string) => void
  // Reações a mensagens
  toggleMessageReaction: (conversationId: string, messageId: string, emoji: string) => void
  // Respostas Rápidas
  quickReplies: QuickReply[]
  createQuickReply: (text: string, shortcut?: string) => QuickReply | null
  updateQuickReply: (id: string, text: string, shortcut?: string) => void
  deleteQuickReply: (id: string) => void
  // Notas Internas de Contatos
  noteStorageError: string | null
  noteFocusRequest: { noteId: string; contactId: string; requestId: number } | null
  focusContactNote: (noteId: string) => void
  clearNoteFocus: () => void
  contactNotes: ContactNote[]
  getNotesByContact: (contactId: string) => ContactNote[]
  addContactNote: (contactId: string, text: string) => ContactNote | null
  updateContactNote: (noteId: string, text: string) => void
  deleteContactNote: (noteId: string) => void
  // Logs de Eventos
  logs: AppEventLog[]
  addLog: (
    action: string,
    description: string,
    level?: 'info' | 'success' | 'warn' | 'error',
    meta?: Record<string, unknown>,
  ) => void
  clearLogs: () => void
  // Conexões Evolution API
  connections: EvolutionConnection[]
  addConnection: (
    connection: Omit<EvolutionConnection, 'id' | 'createdAt' | 'updatedAt'>,
  ) => EvolutionConnection | null
  updateConnection: (
    id: string,
    data: Partial<Omit<EvolutionConnection, 'id' | 'createdAt'>>,
  ) => void
  deleteConnection: (id: string) => void
  setActiveConnection: (id: string) => void
}

const WhatsAppContext = createContext<WhatsAppContextType | undefined>(undefined)

const STORAGE_KEYS = {
  USER: 'wa_clone_user',
  CONTACTS: 'wa_clone_contacts',
  CONVERSATIONS: 'wa_clone_conversations',
  MESSAGES: 'wa_clone_messages',
  CRM_STAGES: 'wa_clone_crm_stages',
  CRM_STAGE_LIST: 'wa_clone_crm_stage_list',
  LABELS: 'wa_clone_labels',
  CONTACT_LABELS: 'wa_clone_contact_labels',
  QUICK_REPLIES: 'wa_clone_quick_replies',
  CONTACT_NOTES: 'wa_clone_contact_notes',
  SAVED_CONTACTS: 'wa_clone_saved_contacts',
  LOGS: 'wa_clone_event_logs',
  CONNECTIONS: 'wa_clone_evolution_connections',
}

export const WhatsAppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: adminUser } = useAuth()
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const remote = useEvolution(activeChatId)
  const { conversations: remoteConversations, setConversations, messages, setMessages } = remote
  // Contatos e pipeline só contêm quem foi adicionado de propósito; conversas avulsas não viram contato.
  const [savedContacts, setSavedContacts] = useState<Contact[]>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.SAVED_CONTACTS) || '[]') as unknown
      return Array.isArray(parsed) ? parsed.filter((c) => c && typeof c.id === 'string' && typeof c.name === 'string') : []
    } catch { return [] }
  })
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SAVED_CONTACTS, JSON.stringify(savedContacts)) }, [savedContacts])
  const matchesContact = (conversation: Conversation, contactId: string) =>
    conversation.id === contactId || !!conversation.aliases?.includes(contactId)
  const conversations = useMemo(() => remoteConversations.map((conversation) => {
    if (conversation.isGroup || !conversation.id.includes('@')) return conversation
    const saved = savedContacts.find((contact) => matchesContact(conversation, contact.id))
    return saved ? { ...conversation, name: saved.name, isSaved: true } : { ...conversation, isSaved: false }
  }), [remoteConversations, savedContacts])
  const contacts = useMemo(() => savedContacts.map((contact) => {
    const conversation = remoteConversations.find((c) => matchesContact(c, contact.id))
    return conversation && conversation.avatar !== FALLBACK_AVATAR ? { ...contact, avatar: conversation.avatar } : contact
  }), [savedContacts, remoteConversations])
  const [user, setUserState] = useState<UserProfile>({ ...DEFAULT_USER, name: adminUser?.fullName || 'Administrador' })
  useEffect(() => {
    if (remote.instance) setUserState({
      name: remote.instance.profileName || adminUser?.fullName || 'Administrador',
      phone: remote.instance.ownerJid?.split('@')[0],
      avatar: remote.instance.profilePicUrl || FALLBACK_AVATAR,
      about: 'WhatsApp conectado',
    })
  }, [remote.instance, adminUser?.fullName])

  const [activeMedia, setActiveMedia] = useState<MessageMedia | null>(null)

  // CRM: estágio de cada contato no pipeline, persistido localmente
  const [crmStages, setCrmStages] = useState<Record<string, CrmStageId>>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CRM_STAGES)
    try {
      const parsed = saved ? (JSON.parse(saved) as unknown) : null
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, CrmStageId>
      }
    } catch {
      // ignora e usa o padrão
    }
    return DEFAULT_CRM_STAGES
  })

  // Lista de estágios do pipeline (CRUD: criar, renomear, reordenar e excluir)
  const [crmStageList, setCrmStageList] = useState<CrmStageConfig[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CRM_STAGE_LIST)
    try {
      const parsed = saved ? (JSON.parse(saved) as unknown) : null
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .filter((s) => s && typeof s.id === 'string' && typeof s.label === 'string')
          .map((s, i) => ({
            id: s.id,
            label: s.label,
            dot: s.dot || CRM_STAGE_COLORS[i % CRM_STAGE_COLORS.length].dot,
            accent: s.accent || CRM_STAGE_COLORS[i % CRM_STAGE_COLORS.length].accent,
          }))
      }
    } catch {
      // ignora e usa o padrão
    }
    return DEFAULT_CRM_STAGE_LIST
  })

  // Etiquetas (Labels) das conversas
  const [labels, setLabels] = useState<ConversationLabel[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.LABELS)
    try {
      const parsed = saved ? (JSON.parse(saved) as unknown) : null
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((l) => l && typeof l.id === 'string' && typeof l.name === 'string')
      }
    } catch {
      // usa o padrão
    }
    return DEFAULT_LABELS
  })

  // Mapeamento de etiquetas de contatos: { [contactId]: labelId[] }
  const [contactLabels, setContactLabelsState] = useState<Record<string, string[]>>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CONTACT_LABELS)
    try {
      const parsed = saved ? (JSON.parse(saved) as unknown) : null
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, string[]>
      }
    } catch {
      // ignora
    }
    return {}
  })

  // Respostas Rápidas
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.QUICK_REPLIES)
    try {
      const parsed = saved ? (JSON.parse(saved) as unknown) : null
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((q) => q && typeof q.id === 'string' && typeof q.text === 'string')
      }
    } catch {
      // usa o padrão
    }
    return DEFAULT_QUICK_REPLIES
  })

  // Notas internas de contatos (salvas por contactId)
  const [initialNotes] = useState(() => {
    try { return { notes: readContactNotes(localStorage, STORAGE_KEYS.CONTACT_NOTES), error: false } }
    catch { return { notes: [] as ContactNote[], error: true } }
  })
  const [contactNotes, setContactNotes] = useState<ContactNote[]>(initialNotes.notes)
  const notesRef = useRef(contactNotes)
  const [noteFocusRequest, setNoteFocusRequest] = useState<{ noteId: string; contactId: string; requestId: number } | null>(null)
  const clearNoteFocus = useCallback(() => setNoteFocusRequest(null), [])
  const saveNotes = (next: ContactNote[]) => {
    if (initialNotes.error) throw new Error('As notas locais não puderam ser lidas. Os dados existentes foram preservados; recarregue após verificar o armazenamento.')
    writeContactNotes(localStorage, STORAGE_KEYS.CONTACT_NOTES, next)
    notesRef.current = next
    setContactNotes(next)
  }

  // Quando um @lid passa a ter telefone conhecido, dados locais gravados sob o @lid migram para o id canônico.
  useEffect(() => {
    const aliasMap: Record<string, string> = {}
    remoteConversations.forEach((c) => c.aliases?.forEach((alias) => { aliasMap[alias] = c.id }))
    if (!Object.keys(aliasMap).length) return
    setCrmStages((prev) => canonicalizeKeys(prev, aliasMap))
    setContactLabelsState((prev) => canonicalizeKeys(prev, aliasMap, (a, b) => [...new Set([...a, ...b])]))
    setSavedContacts((prev) => {
      if (!prev.some((c) => aliasMap[c.id])) return prev
      const moved = prev.map((c) => (aliasMap[c.id] ? { ...c, id: aliasMap[c.id] } : c))
      return moved.filter((c, i) => moved.findIndex((o) => o.id === c.id) === i)
    })
    if (!initialNotes.error && notesRef.current.some((n) => aliasMap[n.contactId])) {
      try { saveNotes(notesRef.current.map((n) => (aliasMap[n.contactId] ? { ...n, contactId: aliasMap[n.contactId] } : n))) }
      catch { /* o aviso de armazenamento já é exibido pelas notas */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteConversations])

  // Logs de eventos do aplicativo
  const [logs, setLogs] = useState<AppEventLog[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.LOGS)
    try {
      const parsed = saved ? (JSON.parse(saved) as unknown) : null
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (l) => l && typeof l.id === 'string' && typeof l.description === 'string',
        )
      }
    } catch {
      // ignora
    }
    return []
  })

  // A conexão vem exclusivamente do servidor; nenhuma chave fica no navegador.
  const connections: EvolutionConnection[] = remote.instance ? [{
    id: remote.instance.name, name: remote.instance.name, instanceName: remote.instance.name,
    serverUrl: 'Gerenciado pelo servidor', apiKey: '', isActive: true,
    status: 'connected', createdAt: '',
  }] : []

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CRM_STAGES, JSON.stringify(crmStages))
  }, [crmStages])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CRM_STAGE_LIST, JSON.stringify(crmStageList))
  }, [crmStageList])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LABELS, JSON.stringify(labels))
  }, [labels])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CONTACT_LABELS, JSON.stringify(contactLabels))
  }, [contactLabels])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.QUICK_REPLIES, JSON.stringify(quickReplies))
  }, [quickReplies])


  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs))
  }, [logs])


  const addLog = (
    action: string,
    description: string,
    level: 'info' | 'success' | 'warn' | 'error' = 'info',
    meta?: Record<string, unknown>,
  ) => {
    const now = new Date()
    const timestamp = now.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    const newLog: AppEventLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp,
      action,
      description,
      level,
      meta,
    }
    setLogs((prev) => [newLog, ...prev.slice(0, 199)]) // mantem ate 200 logs mais recentes
  }

  const clearLogs = () => {
    setLogs([])
    localStorage.removeItem(STORAGE_KEYS.LOGS)
  }

  const setUser = (updated: UserProfile) => {
    setUserState(updated)
  }

  const markAsRead = (conversationId: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)),
    )
  }

  const sendMessage = async (conversationId: string, text?: string, media?: MessageMedia) => {
    if (media) throw new Error('Envio de fotos e vídeos ainda não está disponível.')
    if (!text?.trim()) return
    if (conversationId === 'conv-antigravity') {
      const prompt: Message = { id: crypto.randomUUID(), conversationId, text: text.trim(),
        senderId: 'me', senderName: 'Você', timestamp: new Date().toLocaleTimeString('pt-BR'), status: 'sent' }
      const data = await evolutionRequest('/antigravity/chat', { prompt: text.trim() })
      if (!data.success || data.simulated) throw new Error('Antigravity indisponível neste servidor.')
      setMessages((prev) => ({ ...prev, [conversationId]: [...(prev[conversationId] || []), prompt, {
        ...prompt, id: crypto.randomUUID(), senderId: 'c-antigravity', senderName: 'Antigravity', text: data.response,
      }] }))
      return
    }
    if (!remote.instance || remote.syncError) throw new Error('Confira a conexão do WhatsApp antes de enviar.')
    const name = remote.instance.name
    const data = await evolutionRequest(`/whatsapp/send-message/${encodeURIComponent(name)}`, {
      number: conversationId, text: text.trim(),
    })
    if (remote.instanceRef.current !== name) throw new Error('A instância mudou durante o envio. Confira a conversa no WhatsApp.')
    const sent = normalizeMessage(data, conversationId)
    if (!sent) throw new Error('O servidor não confirmou o envio. Confira a conversa antes de reenviar.')
    setMessages((prev) => ({ ...prev, [conversationId]: [...(prev[conversationId] || []).filter((m) => m.id !== sent.id), sent] }))
    setConversations((prev) => prev.map((c) => c.id === conversationId ? { ...c,
      lastMessage: { text: sent.text || text.trim(), timestamp: sent.timestamp, senderId: 'me', status: sent.status },
    } : c))
    addLog('message_sent', 'Mensagem aceita pela Evolution API.', 'success')
    remote.refresh()
  }

  const createGroup = (_name: string, _participantIds: string[], _avatar?: string): string => {
    throw new Error('Crie grupos pelo WhatsApp. A criação de grupos não está disponível aqui.')
  }

  const addContact = (name: string, phone: string, about?: string): Contact => {
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 8) throw new Error('Informe o telefone com DDD.')
    const newContactId = `${digits}@s.whatsapp.net`
    const existing = contacts.find((c) => c.id === newContactId)
    if (existing) return existing
    const newContact: Contact = {
      id: newContactId,
      name,
      phone,
      about: about || 'Olá! Estou usando o WhatsApp.',
      avatar: FALLBACK_AVATAR,

    }

    setSavedContacts((prev) => [newContact, ...prev.filter((c) => c.id !== newContactId)])
    addLog('contact_created', `Novo contato criado: "${name}" (${phone}).`, 'success')
    return newContact
  }

  // Ação explícita "Salvar como contato": promove uma conversa avulsa ao cadastro (e só então ao CRM).
  const saveConversationAsContact = (conversationId: string, name: string): Contact => {
    const conversation = remoteConversations.find((c) => c.id === conversationId)
    if (!conversation || conversation.isGroup || !conversation.id.includes('@')) throw new Error('Só conversas individuais do WhatsApp podem virar contato.')
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Digite o nome do contato.')
    const existing = savedContacts.find((c) => matchesContact(conversation, c.id))
    if (existing) return existing
    const contact: Contact = { id: conversation.id, name: trimmed, phone: conversation.phone ? formatPhone(conversation.phone) : '',
      avatar: conversation.avatar, about: '' }
    setSavedContacts((prev) => [contact, ...prev])
    addLog('contact_created', `Conversa salva como contato: "${trimmed}".`, 'success')
    return contact
  }

  // Atualiza nome/recado/telefone de um contato existente (modal de detalhes e drawer)
  const updateContact = (contactId: string, name: string, about?: string, phone?: string) => {
    setSavedContacts((prev) =>
      prev.map((c) => {
        if (c.id !== contactId) return c
        addLog('contact_updated', `Contato atualizado: "${name}".`, 'info')
        return {
          ...c,
          name,
          about: about !== undefined ? (about.trim() ? about.trim() : '') : c.about,
          phone: phone?.trim() ? phone.trim() : c.phone,
        }
      }),
    )
  }

  const startChatWithContact = (contactId: string): string => {
    const contact = contacts.find((c) => c.id === contactId)
    if (!contact) return ''

    // Check if conversation already exists
    const existing = conversations.find((c) => !c.isGroup && (c.participants?.includes(contactId) || c.aliases?.includes(contactId)))

    if (existing) {
      setActiveChatId(existing.id)
      return existing.id
    }

    // Create new conversation
    const newConvId = contact.id.includes('@') ? contact.id : `${contact.phone.replace(/\D/g, '')}@s.whatsapp.net`
    const newConv: Conversation = {
      id: newConvId,
      name: contact.name,
      isGroup: false,
      avatar: contact.avatar,
      participants: [contactId],
      lastMessage: undefined,
      unreadCount: 0,
    }

    setConversations((prev) => [newConv, ...prev])
    setActiveChatId(newConvId)
    return newConvId
  }

  const deleteContact = (contactId: string) => {
    const target = savedContacts.find((c) => c.id === contactId) || contacts.find((c) => c.id === contactId)
    setSavedContacts((prev) => prev.filter((c) => c.id !== contactId))
    setCrmStages((prev) => {
      if (!(contactId in prev)) return prev
      const next = { ...prev }
      delete next[contactId]
      return next
    })
    setContactLabelsState((prev) => {
      if (!(contactId in prev)) return prev
      const next = { ...prev }
      delete next[contactId]
      return next
    })
    addLog('contact_deleted', `Contato excluído: "${target?.name || contactId}".`, 'warn')
  }

  const setContactStage = (contactId: string, stage: CrmStageId | null) => {
    const targetContact = contacts.find((c) => c.id === contactId)
    if (!stage) {
      setCrmStages((prev) => {
        if (!(contactId in prev)) return prev
        const next = { ...prev }
        delete next[contactId]
        return next
      })
      addLog(
        'crm_stage_changed',
        `Estágio CRM de "${targetContact?.name || contactId}" removido (fora do pipeline).`,
        'info',
      )
      return
    }
    setCrmStages((prev) => ({ ...prev, [contactId]: stage }))
    const stageName = crmStageList.find((s) => s.id === stage)?.label || stage
    addLog(
      'crm_stage_changed',
      `Estágio CRM de "${targetContact?.name || contactId}" alterado para "${stageName}".`,
      'info',
    )
  }

  // ==== CRUD de estágios do pipeline ====

  const addCrmStage = (label: string, colorIndex = 0): CrmStageConfig | null => {
    const trimmed = label.trim()
    if (!trimmed) return null

    const newStage: CrmStageConfig = {
      id: `stage-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      label: trimmed,
      dot: CRM_STAGE_COLORS[colorIndex % CRM_STAGE_COLORS.length].dot,
      accent: CRM_STAGE_COLORS[colorIndex % CRM_STAGE_COLORS.length].accent,
    }
    setCrmStageList((prev) => [...prev, newStage])
    return newStage
  }

  const renameCrmStage = (stageId: CrmStageId, label: string) => {
    const trimmed = label.trim()
    if (!trimmed) return
    setCrmStageList((prev) => prev.map((s) => (s.id === stageId ? { ...s, label: trimmed } : s)))
  }

  // Exclui o estágio movendo seus contatos para outro estágio escolhido pelo usuário
  const deleteCrmStage = (stageId: CrmStageId, moveContactsTo: CrmStageId) => {
    if (crmStageList.length <= 1) return
    if (moveContactsTo === stageId) return
    setCrmStageList((prev) => prev.filter((s) => s.id !== stageId))
    setCrmStages((prev) => {
      const next: Record<string, CrmStageId> = {}
      Object.entries(prev).forEach(([contactId, stage]) => {
        next[contactId] = stage === stageId ? moveContactsTo : stage
      })
      return next
    })
  }

  // Reordena o estágio uma posição para cima/baixo na lista
  const moveCrmStage = (stageId: CrmStageId, direction: -1 | 1) => {
    setCrmStageList((prev) => {
      const index = prev.findIndex((s) => s.id === stageId)
      const target = index + direction
      if (index === -1 || target < 0 || target >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.splice(target, 0, item)
      return next
    })
  }

  // ==== CRUD e Atribuição de Etiquetas ====

  const createLabel = (name: string, color: string): ConversationLabel | null => {
    const trimmed = name.trim()
    if (!trimmed) return null
    const newLabel: ConversationLabel = {
      id: `lbl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: trimmed,
      color: color || '#00a884',
    }
    setLabels((prev) => [...prev, newLabel])
    return newLabel
  }

  const updateLabel = (labelId: string, name: string, color: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setLabels((prev) => prev.map((l) => (l.id === labelId ? { ...l, name: trimmed, color } : l)))
  }

  const deleteLabel = (labelId: string) => {
    setLabels((prev) => prev.filter((l) => l.id !== labelId))
    // Remove das conversas que tinham essa etiqueta
    setConversations((prev) =>
      prev.map((c) => ({
        ...c,
        labelIds: (c.labelIds || []).filter((id) => id !== labelId),
      })),
    )
  }

  const setConversationLabels = (conversationId: string, labelIds: string[]) => {
    setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, labelIds } : c)))
  }

  const toggleConversationLabel = (conversationId: string, labelId: string) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== conversationId) return c
        const current = c.labelIds || []
        const exists = current.includes(labelId)
        const updated = exists ? current.filter((id) => id !== labelId) : [...current, labelId]
        const labelObj = labels.find((l) => l.id === labelId)
        addLog(
          'label_toggled',
          `Etiqueta "${labelObj?.name || labelId}" ${exists ? 'removida de' : 'atribuída a'} "${c.name}".`,
          'info',
        )
        return { ...c, labelIds: updated }
      }),
    )
  }

  // Obter etiquetas de um contato (combina mapeamento local com a conversa 1:1)
  const getContactLabelIds = (contactId: string): string[] => {
    if (contactLabels[contactId] !== undefined) {
      return contactLabels[contactId] || []
    }
    const conv = conversations.find((c) => !c.isGroup && c.participants?.includes(contactId))
    return conv?.labelIds || []
  }

  const setContactLabels = (contactId: string, labelIds: string[]) => {
    setContactLabelsState((prev) => ({ ...prev, [contactId]: labelIds }))
    // Sincroniza conversa 1:1 se existir
    const conv = conversations.find((c) => !c.isGroup && c.participants?.includes(contactId))
    if (conv) {
      setConversationLabels(conv.id, labelIds)
    }
  }

  const toggleContactLabel = (contactId: string, labelId: string) => {
    const current = getContactLabelIds(contactId)
    const exists = current.includes(labelId)
    const updated = exists ? current.filter((id) => id !== labelId) : [...current, labelId]
    setContactLabelsState((prev) => ({ ...prev, [contactId]: updated }))
    // Sincroniza conversa 1:1 se existir
    const conv = conversations.find((c) => !c.isGroup && c.participants?.includes(contactId))
    if (conv) {
      toggleConversationLabel(conv.id, labelId)
    }
    const labelObj = labels.find((l) => l.id === labelId)
    const contactObj = contacts.find((c) => c.id === contactId)
    addLog(
      'contact_label_toggled',
      `Etiqueta "${labelObj?.name || labelId}" ${exists ? 'removida de' : 'atribuída a'} contato "${contactObj?.name || contactId}".`,
      'info',
    )
  }

  // ==== Fixar e Arquivar ====

  const togglePinConversation = (conversationId: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, pinned: !c.pinned } : c)),
    )
  }

  const toggleArchiveConversation = (conversationId: string) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== conversationId) return c
        const nextArchived = !c.archived
        return {
          ...c,
          archived: nextArchived,
          // Ao arquivar, desafixa por padrão como no WhatsApp
          pinned: nextArchived ? false : c.pinned,
        }
      }),
    )
  }

  // ==== Reações a mensagens ====

  const toggleMessageReaction = (conversationId: string, messageId: string, emoji: string) => {
    setMessages((prev) => {
      const convMsgs = prev[conversationId] || []
      const updated = convMsgs.map((msg) => {
        if (msg.id !== messageId) return msg

        const currentList = msg.reactionList || []
        const myExisting = currentList.find((r) => r.userId === 'me')

        let nextList: { emoji: string; userId: string }[]
        if (myExisting) {
          if (myExisting.emoji === emoji) {
            // Remove reação se clicou no mesmo emoji
            nextList = currentList.filter((r) => r.userId !== 'me')
          } else {
            // Alterna para o novo emoji
            nextList = currentList.map((r) => (r.userId === 'me' ? { ...r, emoji } : r))
          }
        } else {
          // Adiciona nova reação
          nextList = [...currentList, { emoji, userId: 'me' }]
        }

        // Reconstrói o mapa agregado { [emoji]: count }
        const nextReactions: Record<string, number> = {}
        nextList.forEach((r) => {
          nextReactions[r.emoji] = (nextReactions[r.emoji] || 0) + 1
        })

        return {
          ...msg,
          reactionList: nextList,
          reactions: Object.keys(nextReactions).length > 0 ? nextReactions : undefined,
        }
      })

      return { ...prev, [conversationId]: updated }
    })
  }

  // ==== Respostas Rápidas ====

  const createQuickReply = (text: string, shortcut?: string): QuickReply | null => {
    const trimmed = text.trim()
    if (!trimmed) return null
    const newReply: QuickReply = {
      id: `qr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      text: trimmed,
      shortcut: shortcut?.trim() || undefined,
    }
    setQuickReplies((prev) => [...prev, newReply])
    return newReply
  }

  const updateQuickReply = (id: string, text: string, shortcut?: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    setQuickReplies((prev) =>
      prev.map((q) =>
        q.id === id ? { ...q, text: trimmed, shortcut: shortcut?.trim() || undefined } : q,
      ),
    )
  }

  const deleteQuickReply = (id: string) => {
    setQuickReplies((prev) => prev.filter((q) => q.id !== id))
  }

  // ==== NOTAS INTERNAS DE CONTATO ====
  const getNotesByContact = (contactId: string): ContactNote[] => contactNotes
    .filter((note) => note.contactId === contactId)
    .sort((a, b) => noteTimestamp(b) - noteTimestamp(a) || b.id.localeCompare(a.id))

  const addContactNote = (contactId: string, text: string): ContactNote | null => {
    if (!adminUser || !contacts.some((contact) => contact.id === contactId)) throw new Error('Contato ou sessão não identificado.')
    const note = createContactNote(contactId, text, { id: adminUser.id, name: adminUser.fullName || adminUser.email })
    saveNotes([...notesRef.current, note])
    return note
  }

  const updateContactNote = (noteId: string, text: string) => {
    if (!notesRef.current.some((note) => note.id === noteId)) throw new Error('Nota não encontrada. Reabra os detalhes do contato.')
    saveNotes(notesRef.current.map((note) => note.id === noteId ? editContactNote(note, text) : note))
  }

  const deleteContactNote = (noteId: string) => {
    saveNotes(notesRef.current.filter((note) => note.id !== noteId))
  }

  const focusContactNote = (noteId: string) => {
    const note = notesRef.current.find((entry) => entry.id === noteId)
    if (!note) return
    const chatId = startChatWithContact(note.contactId)
    if (chatId) setNoteFocusRequest({ noteId, contactId: note.contactId, requestId: Date.now() })
  }

  // A seleção e credenciais são administradas na VPS.
  const addConnection = () => null
  const updateConnection = () => {}
  const deleteConnection = () => {}
  const setActiveConnection = () => remote.refresh()

  const resetData = () => {
    localStorage.removeItem(STORAGE_KEYS.USER)
    localStorage.removeItem(STORAGE_KEYS.CONTACTS)
    localStorage.removeItem(STORAGE_KEYS.CONVERSATIONS)
    localStorage.removeItem(STORAGE_KEYS.MESSAGES)
    localStorage.removeItem(STORAGE_KEYS.CRM_STAGES)
    localStorage.removeItem(STORAGE_KEYS.CRM_STAGE_LIST)
    localStorage.removeItem(STORAGE_KEYS.LABELS)
    localStorage.removeItem(STORAGE_KEYS.QUICK_REPLIES)
    localStorage.removeItem(STORAGE_KEYS.CONTACT_NOTES)
    localStorage.removeItem(STORAGE_KEYS.LOGS)
    localStorage.removeItem(STORAGE_KEYS.CONNECTIONS)
    setUserState({ ...DEFAULT_USER, name: adminUser?.fullName || 'Administrador' })
    setSavedContacts([])
    setConversations([])
    setMessages({})
    setActiveChatId(null)
    setActiveMedia(null)
    setCrmStages(DEFAULT_CRM_STAGES)
    setCrmStageList(DEFAULT_CRM_STAGE_LIST)
    setLabels(DEFAULT_LABELS)
    setQuickReplies(DEFAULT_QUICK_REPLIES)
    notesRef.current = []
    setContactNotes([])
    setLogs([])
    remote.refresh()
  }

  return (
    <WhatsAppContext.Provider
      value={{
        loading: remote.loading,
        syncError: remote.syncError,
        messageError: remote.messageError,
        loadingMessages: remote.loadingMessages,
        instanceName: remote.instance?.name || null,
        refresh: remote.refresh,
        loadOlder: remote.loadOlder,
        hasOlder: remote.hasOlder,
        user,
        setUser,
        contacts,
        conversations,
        messages,
        activeChatId,
        setActiveChatId,
        activeMedia,
        setActiveMedia,
        sendMessage,
        createGroup,
        addContact,
        saveConversationAsContact,
        updateContact,
        deleteContact,
        startChatWithContact,
        markAsRead,
        resetData,
        crmStages,
        setContactStage,
        crmStageList,
        addCrmStage,
        renameCrmStage,
        deleteCrmStage,
        moveCrmStage,
        labels,
        createLabel,
        updateLabel,
        deleteLabel,
        setConversationLabels,
        toggleConversationLabel,
        getContactLabelIds,
        setContactLabels,
        toggleContactLabel,
        togglePinConversation,
        toggleArchiveConversation,
        toggleMessageReaction,
        quickReplies,
        createQuickReply,
        updateQuickReply,
        deleteQuickReply,
        noteStorageError: initialNotes.error ? 'Não foi possível ler as notas locais. Os dados existentes foram preservados. Verifique o armazenamento e recarregue a página.' : null,
        noteFocusRequest,
        focusContactNote,
        clearNoteFocus,
        contactNotes,
        getNotesByContact,
        addContactNote,
        updateContactNote,
        deleteContactNote,
        logs,
        addLog,
        clearLogs,
        connections,
        addConnection,
        updateConnection,
        deleteConnection,
        setActiveConnection,
      }}
    >
      {children}
    </WhatsAppContext.Provider>
  )
}

export const useWhatsApp = () => {
  const context = useContext(WhatsAppContext)
  if (!context) {
    throw new Error('useWhatsApp must be used within a WhatsAppProvider')
  }
  return context
}
