import React, { useState } from 'react'
import {
  Smile,
  Mic,
  Send,
  X,
  Phone,
  Video as VideoCallIcon,
  MoreVertical,
  Check,
  CheckCheck,
  ArrowLeft,
  Users,
  Search,
  Paperclip,
  Zap,
  Clock,
  AlertCircle,
  FileText,
  LockKeyhole,
  UserPlus,
  Bot,
} from 'lucide-react'
import { useWhatsApp } from '@/context/WhatsAppContext'
import { Message } from '@/types/whatsapp'
import { Button } from '@/components/ui/button'
import { buildChatTimeline, formatNoteDate } from '@/lib/contact-notes'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import { MessageMediaDialog } from './chat/MessageMediaDialog'
import { MessageReactionPicker } from './chat/MessageReactionPicker'
import { QuickRepliesDialog } from './QuickRepliesDialog'
import { SaveContactDialog } from './SaveContactDialog'
import { requestCopilotDraft, CopilotDraft } from '@/lib/copilot'

interface ChatAreaProps {
  onBackMobile?: () => void
  onOpenGroupInfo?: () => void
  onOpenContactDetails?: (contactId: string) => void
}

const EMOJI_LIST = ['👍', '❤️', '😂', '🔥', '🎉', '👏', '🙏', '😍', '🚀', '☕', '💡', '✨']

export const ChatArea: React.FC<ChatAreaProps> = ({
  onBackMobile,
  onOpenGroupInfo,
  onOpenContactDetails,
}) => {
  const {
    activeChatId,
    conversations,
    messages,
    sendMessage,
    setActiveMedia,
    contacts,
    toggleMessageReaction,
    messageError, loadingMessages, refresh, loadOlder, hasOlder, instanceName, syncError,
    getContactLabelIds, noteStorageError, contactNotes, addContactNote, focusContactNote, noteFocusRequest, clearNoteFocus,
  } = useWhatsApp()

  const [composerMode, setComposerMode] = useState<'message' | 'note'>('message')
  const [saveContactFor, setSaveContactFor] = useState<string | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const [copilotResult, setCopilotResult] = useState<(CopilotDraft & { chatId: string }) | { chatId: string; error: string } | null>(null)
  const [noteText, setNoteText] = useState('')
  const [noteError, setNoteError] = useState<string | null>(null)
  const noteDrafts = React.useRef<Record<string, string>>({})
  const [inputText, setInputText] = useState('')
  const drafts = React.useRef<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false)
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false)
  const [chatSearchOpen, setChatSearchOpen] = useState(false)
  const [chatSearchQuery, setChatSearchQuery] = useState('')

  // Hover de mensagem para mostrar seletor de reação
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null)

  const { toast } = useToast()
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  const activeChatRef = React.useRef(activeChatId)
  activeChatRef.current = activeChatId
  const activeConversation = conversations.find((c) => c.id === activeChatId)
  const chatMessages: Message[] = activeChatId ? messages[activeChatId] || [] : []

  // Em conversas individuais, o contato equivalente (para abrir os detalhes no modal)
  const activeContact = activeConversation?.participants?.length
    ? contacts.find((c) => c.id === activeConversation.participants![0])
    : undefined
  const canSaveContact = !!activeConversation && !activeConversation.isGroup && activeConversation.id.includes('@') && !activeConversation.isSaved
  const canSuggest = !!activeConversation && !!activeContact && !activeConversation.isGroup && activeConversation.id.includes('@')
  const suggestReply = async () => {
    if (!activeConversation || !activeContact || suggesting) return
    const chatId = activeConversation.id
    setSuggesting(true); setCopilotResult(null)
    try {
      const result = await requestCopilotDraft({
        contactId: activeContact.id, isSaved: true, isGroup: false, labelIds: getContactLabelIds(activeContact.id),
        contactPhone: activeConversation.phone,
        messages: chatMessages.filter((m) => m.text).slice(-20).map((m) => ({ fromMe: m.senderId === 'me', text: m.text || '' })),
      })
      if (activeChatRef.current === chatId) setCopilotResult({ ...result, chatId })
    } catch (e) {
      if (activeChatRef.current === chatId) setCopilotResult({ chatId, error: e instanceof Error ? e.message : 'Não foi possível pedir o rascunho.' })
    } finally { setSuggesting(false) }
  }
  const handleOpenDetails = () => {
    if (activeContact && onOpenContactDetails) onOpenContactDetails(activeContact.id)
  }

  const scrollRef = React.useRef<HTMLDivElement>(null)
  const nearBottom = React.useRef(true)
  React.useEffect(() => {
    setInputText(drafts.current[activeChatId || ''] || '')
    setSendError(null)
    setComposerMode('message')
    setNoteText(noteDrafts.current[activeChatId || ''] || '')
    setNoteError(null)
    setCopilotResult(null)
    nearBottom.current = true
  }, [activeChatId])
  const timeline = buildChatTimeline(chatMessages, contactNotes, activeContact?.id,
    noteFocusRequest?.contactId === activeContact?.id ? '' : chatSearchQuery)
  const lastEntry = timeline.at(-1)
  React.useEffect(() => {
    if (noteFocusRequest?.contactId !== activeContact?.id || !noteFocusRequest) return
    setChatSearchQuery('')
    setChatSearchOpen(false)
    nearBottom.current = false
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(`internal-${noteFocusRequest.noteId}`)
      if (target) {
        target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' })
        target.focus({ preventScroll: true })
        clearNoteFocus()
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [noteFocusRequest, activeContact?.id, timeline.length, clearNoteFocus])
  React.useEffect(() => {
    if (nearBottom.current && !noteFocusRequest) messagesEndRef.current?.scrollIntoView({ block: 'end' })
  }, [activeChatId, lastEntry?.id, noteFocusRequest])

  if (!activeConversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#222e35] text-center border-b-[6px] border-[#00a884] h-full">
        <div className="w-56 h-56 mb-6 opacity-85 flex items-center justify-center rounded-full bg-[#111b21]/40 border border-[#2a3942]">
          <img
            src="https://img.usecurling.com/p/300/300?q=smartphone&color=green"
            alt="WhatsApp Web"
            className="w-40 h-40 object-contain rounded-2xl opacity-90 shadow-lg"
          />
        </div>
        <h2 className="text-2xl font-light text-slate-100 mb-2">WhatsApp Web</h2>
        <p className="text-sm text-slate-400 max-w-md leading-relaxed">
          Envie e receba mensagens sem precisar manter seu celular conectado. Selecione uma conversa
          ao lado para começar a bater papo.
        </p>
        <div className="mt-8 flex items-center space-x-2 text-xs text-slate-500">
          <span>{instanceName ? 'Conversas sincronizadas com o WhatsApp conectado' : 'Aguardando conexão do WhatsApp'}</span>
        </div>
      </div>
    )
  }

  const submitText = async (text: string) => {
    if (sending || !text.trim()) return
    const chatId = activeConversation.id
    setSending(true); setSendError(null)
    try {
      await sendMessage(chatId, text.trim())
      if (drafts.current[chatId] === text) {
        drafts.current[chatId] = ''
        if (activeChatRef.current === chatId) setInputText('')
      }
      setShowEmojiPicker(false)
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Falha ao enviar. Confira a conversa antes de tentar novamente.'
      if (activeChatRef.current === chatId) setSendError(detail)
      toast({ title: 'Envio não confirmado', description: detail, variant: 'destructive' })
    } finally { setSending(false) }
  }
  const handleSendText = (e?: React.FormEvent) => {
    e?.preventDefault()
    void submitText(inputText)
  }
  const handleSendMedia = () => toast({ title: 'Envio de mídia indisponível', description: 'Use o WhatsApp para enviar fotos e vídeos nesta versão.' })
  const handleSelectQuickReply = (text: string) => {
    setInputText(text)
    drafts.current[activeConversation.id] = text
  }

  const saveInternalNote = (event: React.FormEvent) => {
    event.preventDefault()
    if (!activeContact) return
    try {
      const note = addContactNote(activeContact.id, noteText)
      if (!note) return
      noteDrafts.current[activeConversation.id] = ''
      setNoteText(''); setNoteError(null)
      focusContactNote(note.id)
      toast({ title: 'Nota interna salva', description: 'Salva neste navegador. Nenhuma mensagem foi enviada ao WhatsApp.' })
    } catch (error) {
      setNoteError(error instanceof Error ? error.message : 'Não foi possível salvar a nota. Seu texto foi preservado.')
    }
  }

  const renderStatusTicks = (status: Message['status']) => {
    switch (status) {
      case 'pending': return <Clock aria-label="Aguardando confirmação" className="w-3.5 h-3.5" />
      case 'failed': return <AlertCircle aria-label="Falha no envio" className="w-3.5 h-3.5 text-red-400" />
      case 'sent':
        return <Check className="w-3.5 h-3.5 text-slate-400" />
      case 'delivered':
        return <CheckCheck className="w-3.5 h-3.5 text-slate-400" />
      case 'read':
        return <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
      default:
        return null
    }
  }

  return (
    <div className="flex-1 min-h-0 min-w-0 flex flex-col h-full bg-[#0b141a] text-slate-100 overflow-hidden relative">
      {/* Top chat header — Cabeçalho central do chat ativo */}
      <div className="h-16 px-4 wa-header-chat flex items-center justify-between shrink-0 z-20">
        <div
          className="flex items-center space-x-3 cursor-pointer overflow-hidden"
          onClick={activeConversation.isGroup ? onOpenGroupInfo : handleOpenDetails}
          title={activeConversation.isGroup ? 'Dados do grupo' : 'Ver detalhes do contato'}
        >
          {onBackMobile && (
            <Button
              aria-label="Voltar para conversas"
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                onBackMobile()
              }}
              className="md:hidden wa-header-btn rounded-full -ml-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}

          <div className="relative shrink-0">
            <img
              src={activeConversation.avatar}
              alt={activeConversation.name}
              className="w-10 h-10 rounded-full object-cover ring-1 ring-white/10"
            />

          </div>

          <div className="overflow-hidden">
            <h2 className="text-sm sm:text-base font-medium wa-header-title truncate">
              {activeConversation.name}
            </h2>
            <p className="text-xs wa-header-subtitle truncate">
              {activeConversation.isGroup
                ? 'Grupo do WhatsApp'
                : instanceName ? `WhatsApp · ${instanceName}` : 'Sem conexão'}
            </p>
          </div>
        </div>

        {/* Action icons inteligentes */}
        <div className="flex items-center space-x-0.5 sm:space-x-1.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setChatSearchOpen(!chatSearchOpen)}
            className="w-10 h-10 wa-header-btn rounded-full"
            title="Buscar mensagens no chat"
          >
            <Search className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              toast({
                title: 'Chamadas de voz',
                description: 'Chamadas não estão disponíveis neste painel. Use o WhatsApp.',
              })
            }
            className="w-10 h-10 wa-header-btn rounded-full hidden lg:inline-flex"
            title="Chamada de voz (fora do escopo)"
          >
            <Phone className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              toast({
                title: 'Chamadas de vídeo',
                description: 'Chamadas não estão disponíveis neste painel. Use o WhatsApp.',
              })
            }
            className="w-10 h-10 wa-header-btn rounded-full hidden lg:inline-flex"
            title="Chamada de vídeo (fora do escopo)"
          >
            <VideoCallIcon className="w-5 h-5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-10 h-10 wa-header-btn rounded-full"
                title="Mais opções do chat"
              >
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-[#233138] border-[#2a3942] text-slate-200"
            >
              {canSaveContact && <DropdownMenuItem onClick={() => setSaveContactFor(activeConversation.id)} className="cursor-pointer hover:bg-[#182229]">
                <UserPlus className="mr-2 h-4 w-4 text-[#00a884]" />Salvar como contato
              </DropdownMenuItem>}
              {activeContact && <DropdownMenuItem onClick={handleOpenDetails} className="cursor-pointer hover:bg-[#182229]">
                <FileText className="mr-2 h-4 w-4 text-amber-200" />Dados e notas do contato
              </DropdownMenuItem>}
              {activeConversation.isGroup && (
                <DropdownMenuItem
                  onClick={onOpenGroupInfo}
                  className="cursor-pointer hover:bg-[#182229]"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Dados do grupo
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => setQuickRepliesOpen(true)}
                className="cursor-pointer hover:bg-[#182229]"
              >
                <Zap className="w-4 h-4 mr-2 text-[#00a884]" />
                Respostas rápidas
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled
                className="cursor-pointer hover:bg-[#182229]"
              >
                <Paperclip className="w-4 h-4 mr-2 text-emerald-400" />
                Anexar foto ou vídeo
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#2a3942]" />
              <DropdownMenuItem
                onClick={() => {
                  toast({
                    title: 'Notificações silenciadas',
                    description: 'Silenciado por 8 horas (simulação).',
                  })
                }}
                className="cursor-pointer hover:bg-[#182229]"
              >
                Silenciar notificações
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* In-chat search bar */}
      {chatSearchOpen && (
        <div className="bg-[#111b21] p-2 border-b border-[#2a3942] flex items-center space-x-2 animate-fade-in shrink-0 z-10">
          <Input
            placeholder="Buscar nesta conversa..."
            value={chatSearchQuery}
            onChange={(e) => setChatSearchQuery(e.target.value)}
            className="bg-[#202c33] border-none text-white placeholder-slate-400 h-9 text-xs sm:text-sm"
            autoFocus
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setChatSearchQuery('')
              setChatSearchOpen(false)
            }}
            className="text-slate-300 hover:text-white text-xs"
          >
            Fechar
          </Button>
        </div>
      )}

      {/* Messages viewport */}
      <div ref={scrollRef} onScroll={() => {
        const el = scrollRef.current
        if (el) nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100
      }} className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 space-y-4 whatsapp-chat-bg">
        <div className="flex justify-center my-2">
          <div className="bg-[#182229]/90 border border-[#222d34] text-[#ffd279] text-xs px-3 py-1.5 rounded-lg shadow max-w-md text-center flex items-center justify-center space-x-1.5">
            <span>Mensagens sincronizadas com o WhatsApp. Mídias aparecem como resumo.</span>
          </div>
        </div>

        {activeContact && noteStorageError && <p role="alert" className="rounded-lg bg-[#30291a] p-3 text-sm text-amber-100">{noteStorageError}</p>}
        {messageError && <div role="alert" className="text-sm text-red-300 p-3 bg-[#202c33] rounded-lg">{messageError} <button onClick={refresh} className="underline">Tentar novamente</button></div>}
        {hasOlder && <div className="text-center"><Button variant="secondary" disabled={loadingMessages} onClick={() => void loadOlder()}>Carregar anteriores</Button></div>}
        {loadingMessages && <p role="status" className="text-center text-sm text-slate-400">Carregando mensagens…</p>}
        {timeline.length === 0 && !loadingMessages && !messageError ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            {chatSearchQuery
              ? 'Nenhuma mensagem encontrada com esse termo.'
              : 'Nenhuma mensagem nesta conversa ainda. Diga oi!'}
          </div>
        ) : (
          timeline.map((entry) => {
            if (entry.kind === 'note') {
              const note = entry.note
              return <article key={`note-${note.id}`} id={`internal-${note.id}`} data-note-id={note.id}
                tabIndex={-1} aria-label={`Nota interna de ${note.authorName || 'Autor não registrado'}`}
                className="internal-note mx-auto max-w-full sm:max-w-[85%] rounded-xl border border-amber-500/50 bg-[#30291a] p-3 text-amber-50 shadow-sm outline-none focus:ring-2 focus:ring-amber-300 scroll-m-6">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-amber-200">
                  <span className="flex items-center gap-1 font-semibold"><LockKeyhole className="h-4 w-4" />Nota interna</span>
                  <span>Não enviada ao WhatsApp</span>
                </div>
                <p className="my-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{note.text}</p>
                <footer className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-amber-100/80">
                  <span className="max-w-full break-words">{note.authorName || 'Autor não registrado'}</span>
                  <time dateTime={entry.timestamp ? new Date(entry.timestamp).toISOString() : undefined}>{formatNoteDate(note.createdAt)}</time>
                  {note.updatedAt && <span>· editada em {formatNoteDate(note.updatedAt)}</span>}
                </footer>
              </article>
            }
            const msg = entry.message
            const isMe = msg.senderId === 'me'
            const isSystem = msg.senderId === 'system'
            const isHovered = activeConversation.id === 'conv-antigravity' && hoveredMessageId === msg.id

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center my-2">
                  <div className="bg-[#182229]/80 text-slate-400 text-xs px-3 py-1 rounded-md border border-[#2a3942]">
                    {msg.text}
                  </div>
                </div>
              )
            }

            // Reações da mensagem
            const reactionEntries = Object.entries(msg.reactions || {})
            const myReaction = (msg.reactionList || []).find((r) => r.userId === 'me')?.emoji

            return (
              <div
                key={msg.id}
                onMouseEnter={() => setHoveredMessageId(msg.id)}
                onMouseLeave={() => setHoveredMessageId(null)}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'} group relative my-1`}
              >
                {/* Seletor flutuante de reações ao passar o mouse */}
                {isHovered && (
                  <div
                    className={`absolute -top-9 ${
                      isMe ? 'right-2' : 'left-2'
                    } z-30 pointer-events-auto`}
                  >
                    <MessageReactionPicker
                      onSelectEmoji={(emoji) =>
                        toggleMessageReaction(activeConversation.id, msg.id, emoji)
                      }
                      currentReactions={myReaction ? [myReaction] : []}
                    />
                  </div>
                )}

                <div
                  className={`relative max-w-[85%] sm:max-w-[70%] rounded-lg px-3 py-2 shadow-sm text-sm transition-all ${
                    isMe
                      ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-none'
                      : 'bg-[#202c33] text-[#e9edef] rounded-tl-none'
                  }`}
                >
                  {/* Sender name in groups */}
                  {activeConversation.isGroup && !isMe && (
                    <p className="text-xs font-semibold text-[#53bdeb] mb-1">{msg.senderName}</p>
                  )}

                  {/* Media attachment if any */}
                  {msg.media && (
                    <div className="mb-2 rounded overflow-hidden">
                      {msg.media.type === 'image' ? (
                        <div
                          className="relative cursor-pointer group/media"
                          onClick={() => setActiveMedia(msg.media || null)}
                        >
                          <img
                            src={msg.media.url}
                            alt={msg.media.caption || 'Foto enviada'}
                            className="max-h-72 w-full object-cover rounded transition-transform group-hover/media:scale-[1.01]"
                          />
                          <div className="absolute inset-0 bg-black/25 opacity-0 group-hover/media:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-xs bg-black/70 text-white px-2.5 py-1 rounded-full backdrop-blur-sm">
                              Ver em tela cheia
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="relative cursor-pointer group/media bg-black/40 rounded overflow-hidden"
                          onClick={() => setActiveMedia(msg.media || null)}
                        >
                          <video
                            src={msg.media.url}
                            className="max-h-72 w-full object-cover rounded"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover/media:bg-black/50 transition-colors">
                            <div className="w-12 h-12 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center">
                              <div className="w-0 h-0 border-y-8 border-y-transparent border-l-12 border-l-white ml-1" />
                            </div>
                          </div>
                        </div>
                      )}

                      {msg.media.caption && (
                        <p className="mt-1.5 text-slate-200 text-sm">{msg.media.caption}</p>
                      )}
                    </div>
                  )}

                  {/* Plain text */}
                  {msg.text && (
                    <p className="whitespace-pre-wrap break-words leading-relaxed pr-14">
                      {msg.text}
                    </p>
                  )}

                  {/* Message timestamp and status tick */}
                  <div className="flex items-center justify-end space-x-1 float-right mt-1 ml-2 text-[11px] text-slate-300/70 select-none">
                    <span>{msg.timestamp}</span>
                    {isMe && renderStatusTicks(msg.status)}
                  </div>

                  {/* Badges de Reações afixadas ao balão da mensagem */}
                  {reactionEntries.length > 0 && (
                    <div
                      className={`absolute -bottom-3 ${
                        isMe ? 'right-2' : 'left-2'
                      } flex items-center space-x-1 bg-[#202c33] border border-[#2a3942] rounded-full px-1.5 py-0.5 shadow-md cursor-pointer hover:scale-105 transition-transform select-none z-10`}
                      onClick={() => {
                        // Clicar no badge alterna/remove a própria reação
                        if (myReaction) {
                          toggleMessageReaction(activeConversation.id, msg.id, myReaction)
                        } else if (reactionEntries.length > 0) {
                          toggleMessageReaction(
                            activeConversation.id,
                            msg.id,
                            reactionEntries[0][0],
                          )
                        }
                      }}
                      title={myReaction ? 'Clique para remover sua reação' : 'Clique para reagir'}
                    >
                      {reactionEntries.map(([emoji, count]) => (
                        <span key={emoji} className="text-xs flex items-center">
                          <span>{emoji}</span>
                          {count > 1 && (
                            <span className="text-[10px] text-slate-300 font-semibold ml-0.5">
                              {count}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Emoji picker preview strip */}
      {showEmojiPicker && (
        <div className="bg-[#202c33] border-t border-[#2a3942] p-2 flex items-center gap-2 overflow-x-auto shrink-0 z-20">
          {EMOJI_LIST.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setInputText((prev) => { const next = prev + emoji; drafts.current[activeConversation.id] = next; return next })}
              className="text-xl p-1.5 hover:bg-[#374248] rounded transition-transform active:scale-95"
            >
              {emoji}
            </button>
          ))}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowEmojiPicker(false)}
            className="text-slate-400 hover:text-white ml-auto"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {sendError && <p role="alert" className="px-4 py-2 text-sm text-red-300 bg-[#202c33]">{sendError}</p>}
      {copilotResult && copilotResult.chatId === activeConversation.id && <div role="status" className="shrink-0 space-y-2 border-t border-[#00a884]/40 bg-[#14262c] px-3 py-2 text-sm text-slate-200">
        {'error' in copilotResult ? <p role="alert" className="text-red-300">{copilotResult.error}</p>
          : copilotResult.draft ? <>
            <p className="text-xs text-[#00a884]">Rascunho do atendente — revise antes de enviar. Nada foi enviado.</p>
            <p className="whitespace-pre-wrap">{copilotResult.draft}</p>
            {copilotResult.sources.length > 0 && <p className="text-[11px] text-slate-400">Fontes: {copilotResult.sources.map((s) => s.title).join(', ')}</p>}
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={() => { const text = copilotResult.draft!; setInputText(text); drafts.current[activeConversation.id] = text; setCopilotResult(null) }} className="bg-[#00a884] text-white hover:bg-[#008f72]">Usar no campo de mensagem</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setCopilotResult(null)} className="text-slate-200">Descartar</Button>
            </div>
          </> : <>
            <p className="text-amber-200">{copilotResult.reason}</p>
            <Button type="button" size="sm" variant="ghost" onClick={() => setCopilotResult(null)} className="text-slate-200">Fechar</Button>
          </>}
      </div>}
      {canSaveContact && <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#2a3942] bg-[#202c33] px-3 py-2 text-xs text-slate-300">
        <span>Conversa avulsa: não está em Contatos nem no pipeline.</span>
        <Button type="button" size="sm" variant="ghost" onClick={() => setSaveContactFor(activeConversation!.id)} className="text-[#00a884]"><UserPlus className="mr-1 h-4 w-4" />Salvar como contato</Button>
      </div>}
      <SaveContactDialog conversationId={saveContactFor} onOpenChange={(open) => { if (!open) setSaveContactFor(null) }} />
      {activeContact && <div className="flex shrink-0 items-center gap-1 border-t border-[#2a3942] bg-[#202c33] px-3 py-1" role="group" aria-label="Tipo de registro">
        <Button type="button" variant="ghost" aria-pressed={composerMode === 'message'} onClick={() => setComposerMode('message')}
          className={composerMode === 'message' ? 'text-emerald-300' : 'text-slate-400'}>Mensagem</Button>
        <Button type="button" variant="ghost" aria-pressed={composerMode === 'note'} onClick={() => { setComposerMode('note'); setShowEmojiPicker(false) }}
          className={composerMode === 'note' ? 'bg-amber-500/15 text-amber-200' : 'text-slate-400'}><FileText className="mr-2 h-4 w-4" />Nota interna</Button>
      </div>}
      {composerMode === 'note' && activeContact ? <form onSubmit={saveInternalNote} className="shrink-0 space-y-2 border-t border-amber-500/40 bg-[#30291a] p-3">
        <label htmlFor="timeline-note" className="block text-xs font-medium text-amber-200">Nota interna · Apenas neste navegador. Não é enviada ao WhatsApp.</label>
        <Textarea id="timeline-note" aria-label="Texto da nota interna" maxLength={10000} value={noteText} required
          onChange={(event) => { setNoteText(event.target.value); noteDrafts.current[activeConversation.id] = event.target.value }}
          aria-invalid={!!noteError} aria-describedby={noteError ? 'timeline-note-error' : undefined}
          className="min-h-[72px] max-h-32 resize-y border-amber-500/40 bg-[#211e16] text-amber-50 focus-visible:ring-amber-300" />
        {noteError && <p id="timeline-note-error" role="alert" className="text-sm text-red-300">{noteError}</p>}
        <div className="flex justify-end"><Button type="submit" disabled={!noteText.trim()} className="min-h-11 bg-amber-300 text-slate-950 hover:bg-amber-200"><FileText className="mr-2 h-4 w-4" />Salvar nota interna</Button></div>
      </form> : <>
      {/* Chat bottom input bar */}
      <div className="chat-composer min-h-16 bg-[#202c33] px-2 sm:px-3 py-2 flex items-center space-x-2 border-t border-[#2a3942] z-20 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className={`rounded-full hover:bg-[#374248]/50 ${
            showEmojiPicker ? 'text-[#00a884]' : 'text-slate-400 hover:text-white'
          }`}
          title="Emojis"
        >
          <Smile className="w-6 h-6" />
        </Button>

        {/* Menu Anexar / "+" com Mídia e Respostas Rápidas */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:text-white rounded-full hover:bg-[#374248]/50"
              title="Anexos e respostas rápidas"
            >
              <Paperclip className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="top"
            className="bg-[#233138] border-[#2a3942] text-slate-200 mb-2"
          >
            <DropdownMenuItem
              onClick={() => setQuickRepliesOpen(true)}
              className="cursor-pointer hover:bg-[#182229]"
            >
              <Zap className="w-4 h-4 mr-2 text-[#00a884]" />
              Respostas rápidas
            </DropdownMenuItem>
            {canSuggest && <DropdownMenuItem
              disabled={suggesting}
              onClick={suggestReply}
              className="cursor-pointer hover:bg-[#182229]"
            >
              <Bot className="w-4 h-4 mr-2 text-[#00a884]" />
              {suggesting ? 'Gerando rascunho…' : 'Sugerir resposta (atendente)'}
            </DropdownMenuItem>}
            <DropdownMenuItem
              disabled
              className="cursor-pointer hover:bg-[#182229]"
            >
              <Paperclip className="w-4 h-4 mr-2 text-emerald-400" />
              Fotos e vídeos
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <form onSubmit={handleSendText} className="min-w-0 flex-1 flex items-center space-x-2">
          <Input
            type="text"
            aria-label="Mensagem"
            maxLength={10000}
            autoComplete="off"
            placeholder="Mensagem"
            value={inputText}
            onChange={(e) => { setInputText(e.target.value); drafts.current[activeConversation.id] = e.target.value }}
            className="bg-[#2a3942] border-none text-white placeholder-slate-400 focus-visible:ring-1 focus-visible:ring-[#00a884] rounded-lg h-11 text-sm sm:text-base"
          />

          {inputText.trim() ? (
            <Button
              disabled={sending || (!!syncError && activeConversation.id !== 'conv-antigravity')}
              aria-label={sending ? 'Enviando mensagem' : 'Enviar mensagem'}
              type="submit"
              size="icon"
              className="bg-[#00a884] hover:bg-[#008f6f] text-white rounded-full shrink-0 w-11 h-11 shadow-md"
              title="Enviar mensagem"
            >
              <Send className="w-5 h-5 ml-0.5" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                toast({
                  title: 'Envio de áudio indisponível',
                  description: 'Use o WhatsApp para enviar áudio nesta versão.',
                })
              }}
              className="text-slate-400 hover:text-white rounded-full shrink-0 w-11 h-11"
              title="Mensagem de voz"
            >
              <Mic className="w-6 h-6" />
            </Button>
          )}
        </form>
      </div>

      </>}

      {/* Diálogo de Mídia */}
      <MessageMediaDialog
        open={mediaDialogOpen}
        onOpenChange={setMediaDialogOpen}
        onSendMedia={handleSendMedia}
      />

      {/* Diálogo de Respostas Rápidas */}
      <QuickRepliesDialog
        open={quickRepliesOpen}
        onOpenChange={setQuickRepliesOpen}
        onSelectReply={handleSelectQuickReply}
      />
    </div>
  )
}
