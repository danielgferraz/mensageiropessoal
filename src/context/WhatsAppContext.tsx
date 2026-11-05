import React, { createContext, useContext, useState, useEffect } from 'react'
import {
  Contact,
  Conversation,
  CrmStageId,
  Message,
  UserProfile,
  MessageMedia,
} from '@/types/whatsapp'
import {
  DEFAULT_USER,
  INITIAL_CONTACTS,
  INITIAL_CONVERSATIONS,
  INITIAL_MESSAGES,
} from '@/data/mockData'
import { DEFAULT_CRM_STAGES } from '@/data/crmData'

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
  startChatWithContact: (contactId: string) => string
  markAsRead: (conversationId: string) => void
  resetData: () => void
  // CRM (pipeline de negócios em memória)
  crmStages: Record<string, CrmStageId>
  setContactStage: (contactId: string, stage: CrmStageId) => void
}

const WhatsAppContext = createContext<WhatsAppContextType | undefined>(undefined)

const STORAGE_KEYS = {
  USER: 'wa_clone_user',
  CONTACTS: 'wa_clone_contacts',
  CONVERSATIONS: 'wa_clone_conversations',
  MESSAGES: 'wa_clone_messages',
  CRM_STAGES: 'wa_clone_crm_stages',
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
    if (saved) {
      try {
        return JSON.parse(saved) as Record<string, CrmStageId>
      } catch {
        // ignora e usa o padrão
      }
    }
    return DEFAULT_CRM_STAGES
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
    setConversations((prev) => {
      const target = prev.find((c) => c.id === conversationId)
      const previewText = media
        ? media.type === 'image'
          ? `📷 ${media.caption || 'Foto'}`
          : `🎥 ${media.caption || 'Vídeo'}`
        : text || ''

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
    return newContact
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
  }

  const resetData = () => {
    localStorage.removeItem(STORAGE_KEYS.USER)
    localStorage.removeItem(STORAGE_KEYS.CONTACTS)
    localStorage.removeItem(STORAGE_KEYS.CONVERSATIONS)
    localStorage.removeItem(STORAGE_KEYS.MESSAGES)
    localStorage.removeItem(STORAGE_KEYS.CRM_STAGES)
    setUserState(DEFAULT_USER)
    setContacts(INITIAL_CONTACTS)
    setConversations(INITIAL_CONVERSATIONS)
    setMessages(INITIAL_MESSAGES)
    setActiveChatId(null)
    setActiveMedia(null)
    setCrmStages(DEFAULT_CRM_STAGES)
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
        startChatWithContact,
        markAsRead,
        resetData,
        crmStages,
        setContactStage,
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
