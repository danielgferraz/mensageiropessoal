import React, { createContext, useContext, useState, useEffect } from 'react'
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
import {
  DEFAULT_USER,
  INITIAL_CONTACTS,
  INITIAL_CONVERSATIONS,
  INITIAL_MESSAGES,
} from '@/data/mockData'
import {
  CRM_STAGE_COLORS,
  CrmStageConfig,
  DEFAULT_CRM_STAGE_LIST,
  DEFAULT_CRM_STAGES,
} from '@/data/crmData'
import { DEFAULT_LABELS, DEFAULT_QUICK_REPLIES } from '@/data/labelsData'

interface WhatsAppContextType {
  user: UserProfile
  setUser: (user: UserProfile) => void
  contacts: Contact[]
  conversations: Conversation[]
  messages: Record<string, Message[]>
  activeChatId: string | null
  setActiveChatId: (id: string | null) => void
  activeMedia: MessageMedia | null
  setActiveMedia: (media: MessageMedia | null) => void
  sendMessage: (conversationId: string, text?: string, media?: MessageMedia) => void
  createGroup: (name: string, participantIds: string[], avatar?: string) => string
  addContact: (name: string, phone: string, about?: string) => Contact
  updateContact: (contactId: string, name: string, about?: string, phone?: string) => void
  startChatWithContact: (contactId: string) => string
  markAsRead: (conversationId: string) => void
  resetData: () => void
  // CRM (pipeline de negócios em memória)
  crmStages: Record<string, CrmStageId>
  setContactStage: (contactId: string, stage: CrmStageId) => void
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
  QUICK_REPLIES: 'wa_clone_quick_replies',
  CONTACT_NOTES: 'wa_clone_contact_notes',
  LOGS: 'wa_clone_event_logs',
  CONNECTIONS: 'wa_clone_evolution_connections',
}

export const WhatsAppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUserState] = useState<UserProfile>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USER)
    return saved ? JSON.parse(saved) : DEFAULT_USER
  })

  const [contacts, setContacts] = useState<Contact[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CONTACTS)
    return saved ? JSON.parse(saved) : INITIAL_CONTACTS
  })

  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS)
    return saved ? JSON.parse(saved) : INITIAL_CONVERSATIONS
  })

  const [messages, setMessages] = useState<Record<string, Message[]>>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.MESSAGES)
    return saved ? JSON.parse(saved) : INITIAL_MESSAGES
  })

  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [activeMedia, setActiveMedia] = useState<MessageMedia | null>(null)

  // CRM: estágio de cada contato no pipeline (dados de exemplo, persistidos localmente)
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
  const [contactNotes, setContactNotes] = useState<ContactNote[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CONTACT_NOTES)
    try {
      const parsed = saved ? (JSON.parse(saved) as unknown) : null
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (n) =>
            n &&
            typeof n.id === 'string' &&
            typeof n.contactId === 'string' &&
            typeof n.text === 'string',
        )
      }
    } catch {
      // ignora
    }
    // Seeds iniciais de exemplo para enriquecer os primeiros contatos
    return [
      {
        id: 'note-init-1',
        contactId: 'c1',
        text: 'Cliente prefere reuniões às terças no período da tarde.',
        createdAt: new Date(Date.now() - 86400000 * 2).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
      {
        id: 'note-init-2',
        contactId: 'c2',
        text: 'Aguardando validação da proposta comercial pelo departamento financeiro.',
        createdAt: new Date(Date.now() - 86400000).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
    ]
  })

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
    const nowStr = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    return [
      {
        id: `log-init-1`,
        timestamp: nowStr,
        action: 'app_start',
        description: 'Sessão iniciada e dados do WhatsApp carregados.',
        level: 'info',
      },
    ]
  })

  // Conexões da Evolution API (cadastro local)
  const [connections, setConnections] = useState<EvolutionConnection[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CONNECTIONS)
    try {
      const parsed = saved ? (JSON.parse(saved) as unknown) : null
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter(
          (c) =>
            c &&
            typeof c.id === 'string' &&
            typeof c.name === 'string' &&
            typeof c.serverUrl === 'string',
        )
      }
    } catch {
      // ignora
    }
    // Exemplo inicial didático
    return [
      {
        id: 'conn-demo-1',
        name: 'Servidor Principal (Produção)',
        serverUrl: 'https://api.evolution.exemplo.com',
        apiKey: 'evo_sec_9948271038194aef91c89',
        instanceName: 'whatsapp-atendimento-01',
        isActive: true,
        status: 'connected',
        createdAt: new Date().toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }),
      },
    ]
  })

  // Persist state to localStorage for seamless refreshing
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user))
  }, [user])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(contacts))
  }, [contacts])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations))
  }, [conversations])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages))
  }, [messages])

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
    localStorage.setItem(STORAGE_KEYS.QUICK_REPLIES, JSON.stringify(quickReplies))
  }, [quickReplies])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CONTACT_NOTES, JSON.stringify(contactNotes))
  }, [contactNotes])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs))
  }, [logs])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CONNECTIONS, JSON.stringify(connections))
  }, [connections])

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

  const sendMessage = (conversationId: string, text?: string, media?: MessageMedia) => {
    if (!text && !media) return

    const now = new Date()
    const timeString = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}`

    const newMessageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`

    const newMessage: Message = {
      id: newMessageId,
      conversationId,
      senderId: 'me',
      senderName: user.name || 'Você',
      text: text?.trim(),
      media,
      timestamp: timeString,
      status: 'sent',
    }

    // Add to messages
    setMessages((prev) => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] || []), newMessage],
    }))

    // Update conversation last message
    const previewText = media
      ? media.type === 'image'
        ? `📷 ${media.caption || 'Foto'}`
        : `🎥 ${media.caption || 'Vídeo'}`
      : text || ''

    setConversations((prev) => {
      const target = prev.find((c) => c.id === conversationId)
      const otherConvs = prev.filter((c) => c.id !== conversationId)

      if (target) {
        const updated: Conversation = {
          ...target,
          lastMessage: {
            text: previewText,
            timestamp: timeString,
            senderId: 'me',
            status: 'sent',
          },
        }
        return [updated, ...otherConvs]
      }
      return prev
    })

    const targetConv = conversations.find((c) => c.id === conversationId)
    addLog(
      'message_sent',
      `Mensagem enviada para "${targetConv ? targetConv.name : conversationId}": ${previewText.slice(0, 40)}${previewText.length > 40 ? '...' : ''}`,
      'info',
    )

    // Simulate delivery ticks (sent -> delivered in 1s, delivered -> read in 2.5s)
    setTimeout(() => {
      setMessages((prev) => {
        const convMsgs = prev[conversationId] || []
        return {
          ...prev,
          [conversationId]: convMsgs.map((m) =>
            m.id === newMessageId ? { ...m, status: 'delivered' } : m,
          ),
        }
      })
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId && c.lastMessage?.senderId === 'me'
            ? { ...c, lastMessage: { ...c.lastMessage, status: 'delivered' } }
            : c,
        ),
      )
    }, 1200)

    // Simulate contact auto-reply and blue ticks (lida)
    setTimeout(() => {
      // Set to read
      setMessages((prev) => {
        const convMsgs = prev[conversationId] || []
        return {
          ...prev,
          [conversationId]: convMsgs.map((m) =>
            m.id === newMessageId ? { ...m, status: 'read' } : m,
          ),
        }
      })
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId && c.lastMessage?.senderId === 'me'
            ? { ...c, lastMessage: { ...c.lastMessage, status: 'read' } }
            : c,
        ),
      )

      // Random friendly reply back from contact/group
      const currentConv = conversations.find((c) => c.id === conversationId)
      if (currentConv) {
        const replyTime = new Date()
        const replyTimeString = `${replyTime
          .getHours()
          .toString()
          .padStart(2, '0')}:${replyTime.getMinutes().toString().padStart(2, '0')}`

        let replySenderId = 'c1'
        let replySenderName = currentConv.name

        if (currentConv.isGroup && currentConv.participants?.length) {
          replySenderId = currentConv.participants[0]
          const c = contacts.find((contact) => contact.id === replySenderId)
          replySenderName = c ? c.name : 'Colega de grupo'
        }

        const autoReplies = [
          'Entendido, show de bola!',
          'Obrigado pelo envio! Já estou avaliando aqui.',
          'Perfeito, logo mais conversamos sobre isso.',
          'Legal! Vamos seguir com essa ideia 👍',
          'Valeu! Qualquer novidade eu te aviso.',
          'Excelente! Ficou muito bom mesmo.',
        ]
        const randomReply = autoReplies[Math.floor(Math.random() * autoReplies.length)]

        const replyMessage: Message = {
          id: `reply-${Date.now()}`,
          conversationId,
          senderId: replySenderId,
          senderName: replySenderName,
          text: randomReply,
          timestamp: replyTimeString,
          status: 'read',
        }

        setMessages((prev) => ({
          ...prev,
          [conversationId]: [...(prev[conversationId] || []), replyMessage],
        }))

        setConversations((prev) => {
          const target = prev.find((c) => c.id === conversationId)
          if (!target) return prev
          const others = prev.filter((c) => c.id !== conversationId)
          return [
            {
              ...target,
              lastMessage: {
                text: currentConv.isGroup ? `${replySenderName}: ${randomReply}` : randomReply,
                timestamp: replyTimeString,
                senderId: replySenderId,
                status: 'read',
              },
            },
            ...others,
          ]
        })
      }
    }, 3200)
  }

  const createGroup = (name: string, participantIds: string[], avatar?: string): string => {
    const newGroupId = `conv-group-${Date.now()}`
    const defaultGroupAvatar =
      avatar || `https://img.usecurling.com/p/200/200?q=group&color=green&dpr=2`

    const newConversation: Conversation = {
      id: newGroupId,
      name,
      isGroup: true,
      avatar: defaultGroupAvatar,
      participants: participantIds,
      lastMessage: {
        text: `Você criou o grupo "${name}"`,
        timestamp: 'Agora',
        senderId: 'me',
        status: 'read',
      },
      unreadCount: 0,
    }

    const systemMessage: Message = {
      id: `m-sys-${Date.now()}`,
      conversationId: newGroupId,
      senderId: 'system',
      senderName: 'Sistema',
      text: `Você criou o grupo "${name}" com ${participantIds.length} participantes.`,
      timestamp: 'Agora',
      status: 'read',
    }

    setConversations((prev) => [newConversation, ...prev])
    setMessages((prev) => ({
      ...prev,
      [newGroupId]: [systemMessage],
    }))

    addLog(
      'group_created',
      `Grupo "${name}" criado com ${participantIds.length} participantes.`,
      'success',
    )

    return newGroupId
  }

  const addContact = (name: string, phone: string, about?: string): Contact => {
    const newContactId = `c-${Date.now()}`
    const seeds = [14, 28, 42, 56, 70, 84, 98]
    const randomSeed = seeds[Math.floor(Math.random() * seeds.length)]
    const newContact: Contact = {
      id: newContactId,
      name,
      phone,
      about: about || 'Olá! Estou usando o WhatsApp.',
      avatar: `https://img.usecurling.com/ppl/medium?seed=${randomSeed}`,
      online: true,
    }

    setContacts((prev) => [newContact, ...prev])
    addLog('contact_created', `Novo contato criado: "${name}" (${phone}).`, 'success')
    return newContact
  }

  // Atualiza nome/recado/telefone de um contato existente (modal de detalhes e drawer)
  const updateContact = (contactId: string, name: string, about?: string, phone?: string) => {
    setContacts((prev) =>
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
    const existing = conversations.find((c) => !c.isGroup && c.participants?.includes(contactId))

    if (existing) {
      setActiveChatId(existing.id)
      return existing.id
    }

    // Create new conversation
    const newConvId = `conv-${Date.now()}`
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

  const setContactStage = (contactId: string, stage: CrmStageId) => {
    setCrmStages((prev) => ({ ...prev, [contactId]: stage }))
    const targetContact = contacts.find((c) => c.id === contactId)
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
  const getNotesByContact = (contactId: string): ContactNote[] => {
    return contactNotes
      .filter((n) => n.contactId === contactId)
      .sort((a, b) => b.id.localeCompare(a.id))
  }

  const addContactNote = (contactId: string, text: string): ContactNote | null => {
    const trimmed = text.trim()
    if (!trimmed) return null
    const now = new Date()
    const formattedDate = `${now.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })} às ${now.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`

    const newNote: ContactNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      contactId,
      text: trimmed,
      createdAt: formattedDate,
    }

    setContactNotes((prev) => [newNote, ...prev])
    const contact = contacts.find((c) => c.id === contactId)
    addLog(
      'contact_note_added',
      `Nova nota interna adicionada para "${contact?.name || contactId}".`,
      'info',
    )
    return newNote
  }

  const updateContactNote = (noteId: string, text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const now = new Date()
    const formattedDate = `${now.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })} às ${now.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`

    setContactNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, text: trimmed, updatedAt: formattedDate } : n)),
    )
    addLog('contact_note_updated', `Nota interna de contato atualizada.`, 'info')
  }

  const deleteContactNote = (noteId: string) => {
    setContactNotes((prev) => prev.filter((n) => n.id !== noteId))
    addLog('contact_note_deleted', `Nota interna de contato removida.`, 'warn')
  }

  // ==== CONEXÕES DA EVOLUTION API ====
  const addConnection = (
    data: Omit<EvolutionConnection, 'id' | 'createdAt' | 'updatedAt'>,
  ): EvolutionConnection | null => {
    const trimmedName = data.name.trim()
    const trimmedUrl = data.serverUrl.trim()
    if (!trimmedName || !trimmedUrl) return null

    const now = new Date()
    const formattedDate = `${now.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })} às ${now.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`

    // Se marcou como ativa ou for a primeira, desativa as outras
    const shouldBeActive = data.isActive ?? connections.length === 0

    const newConn: EvolutionConnection = {
      id: `conn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: trimmedName,
      serverUrl: trimmedUrl,
      apiKey: data.apiKey.trim(),
      instanceName: data.instanceName.trim(),
      isActive: shouldBeActive,
      status: 'connected',
      createdAt: formattedDate,
    }

    setConnections((prev) => {
      const updated = shouldBeActive ? prev.map((c) => ({ ...c, isActive: false })) : prev
      return [...updated, newConn]
    })

    addLog(
      'connection_created',
      `Nova conexão da Evolution API criada: "${trimmedName}" (${data.instanceName || 'sem instância'}).`,
      'success',
    )
    return newConn
  }

  const updateConnection = (
    id: string,
    data: Partial<Omit<EvolutionConnection, 'id' | 'createdAt'>>,
  ) => {
    const now = new Date()
    const formattedDate = `${now.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })} às ${now.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`

    setConnections((prev) => {
      let isMakingActive = data.isActive === true
      return prev.map((c) => {
        if (c.id === id) {
          return {
            ...c,
            ...data,
            name: data.name !== undefined ? data.name.trim() : c.name,
            serverUrl: data.serverUrl !== undefined ? data.serverUrl.trim() : c.serverUrl,
            apiKey: data.apiKey !== undefined ? data.apiKey.trim() : c.apiKey,
            instanceName:
              data.instanceName !== undefined ? data.instanceName.trim() : c.instanceName,
            updatedAt: formattedDate,
          }
        }
        if (isMakingActive) {
          return { ...c, isActive: false }
        }
        return c
      })
    })

    addLog('connection_updated', `Conexão da Evolution API atualizada.`, 'info')
  }

  const deleteConnection = (id: string) => {
    const target = connections.find((c) => c.id === id)
    setConnections((prev) => {
      const filtered = prev.filter((c) => c.id !== id)
      // Se a conexão excluída era ativa e restam conexões, ativa a primeira
      if (target?.isActive && filtered.length > 0) {
        return filtered.map((c, idx) => (idx === 0 ? { ...c, isActive: true } : c))
      }
      return filtered
    })
    addLog('connection_deleted', `Conexão Evolution API "${target?.name || id}" excluída.`, 'warn')
  }

  const setActiveConnection = (id: string) => {
    setConnections((prev) =>
      prev.map((c) => ({
        ...c,
        isActive: c.id === id,
      })),
    )
    const target = connections.find((c) => c.id === id)
    addLog(
      'connection_activated',
      `Conexão "${target?.name || id}" marcada como ativa/padrão.`,
      'info',
    )
  }

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
    setUserState(DEFAULT_USER)
    setContacts(INITIAL_CONTACTS)
    setConversations(INITIAL_CONVERSATIONS)
    setMessages(INITIAL_MESSAGES)
    setActiveChatId(null)
    setActiveMedia(null)
    setCrmStages(DEFAULT_CRM_STAGES)
    setCrmStageList(DEFAULT_CRM_STAGE_LIST)
    setLabels(DEFAULT_LABELS)
    setQuickReplies(DEFAULT_QUICK_REPLIES)
    setContactNotes([])
    setLogs([])
    setConnections([])
  }

  return (
    <WhatsAppContext.Provider
      value={{
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
        updateContact,
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
        togglePinConversation,
        toggleArchiveConversation,
        toggleMessageReaction,
        quickReplies,
        createQuickReply,
        updateQuickReply,
        deleteQuickReply,
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
