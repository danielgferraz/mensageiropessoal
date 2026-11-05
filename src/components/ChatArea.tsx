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
} from 'lucide-react'
import { useWhatsApp } from '@/context/WhatsAppContext'
import { Message, MessageMedia } from '@/types/whatsapp'
import { Button } from '@/components/ui/button'
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
  } = useWhatsApp()

  const [inputText, setInputText] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false)
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false)
  const [chatSearchOpen, setChatSearchOpen] = useState(false)
  const [chatSearchQuery, setChatSearchQuery] = useState('')

  // Hover de mensagem para mostrar seletor de reação
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null)

  const { toast } = useToast()
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  const activeConversation = conversations.find((c) => c.id === activeChatId)
  const chatMessages: Message[] = activeChatId ? messages[activeChatId] || [] : []

  // Em conversas individuais, o contato equivalente (para abrir os detalhes no modal)
  const activeContact = activeConversation?.participants?.length
    ? contacts.find((c) => c.id === activeConversation.participants![0])
    : undefined
  const handleOpenDetails = () => {
    if (activeContact && onOpenContactDetails) onOpenContactDetails(activeContact.id)
  }

  // Auto-scroll when messages update
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

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
          <span>🔒 Criptografado com simulação de ponta a ponta</span>
        </div>
      </div>
    )
  }

  const handleSendText = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!inputText.trim()) return

    sendMessage(activeConversation.id, inputText.trim())
    setInputText('')
    setShowEmojiPicker(false)
  }

  const handleSendMedia = (media: MessageMedia) => {
    sendMessage(activeConversation.id, undefined, media)
    toast({
      title: 'Mídia enviada!',
      description: 'Sua foto ou vídeo foi postado no chat.',
    })
  }

  const handleSelectQuickReply = (text: string) => {
    sendMessage(activeConversation.id, text)
    toast({
      title: 'Resposta rápida enviada',
      description: text.substring(0, 40) + (text.length > 40 ? '...' : ''),
    })
  }

  const filteredMessages = chatSearchQuery.trim()
    ? chatMessages.filter((m) =>
        (m.text || m.media?.caption || '').toLowerCase().includes(chatSearchQuery.toLowerCase()),
      )
    : chatMessages

  const renderStatusTicks = (status: Message['status']) => {
    switch (status) {
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
    <div className="flex-1 flex flex-col h-full bg-[#0b141a] text-slate-100 overflow-hidden relative">
      {/* Top chat header — Cabeçalho central do chat ativo */}
      <div className="h-16 px-4 wa-header-chat flex items-center justify-between shrink-0 z-20">
        <div
          className="flex items-center space-x-3 cursor-pointer overflow-hidden"
          onClick={activeConversation.isGroup ? onOpenGroupInfo : handleOpenDetails}
          title={activeConversation.isGroup ? 'Dados do grupo' : 'Ver detalhes do contato'}
        >
          {onBackMobile && (
            <Button
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

          <div className="relative">
            <img
              src={activeConversation.avatar}
              alt={activeConversation.name}
              className="w-10 h-10 rounded-full object-cover ring-1 ring-white/10"
            />
            {!activeConversation.isGroup && (
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#00a884] border-2 border-[var(--wa-header-chat-bg)] rounded-full" />
            )}
          </div>

          <div className="overflow-hidden">
            <h2 className="text-sm sm:text-base font-medium wa-header-title truncate">
              {activeConversation.name}
            </h2>
            <p className="text-xs wa-header-subtitle truncate">
              {activeConversation.isGroup
                ? `${activeConversation.participants?.length || 3} participantes`
                : 'online — clique para ver os detalhes'}
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
                description: 'Recurso fora do escopo desta versão demonstrativa.',
              })
            }
            className="w-10 h-10 wa-header-btn rounded-full hidden sm:inline-flex"
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
                description: 'Recurso fora do escopo desta versão demonstrativa.',
              })
            }
            className="w-10 h-10 wa-header-btn rounded-full hidden sm:inline-flex"
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
                onClick={() => setMediaDialogOpen(true)}
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
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 whatsapp-chat-bg">
        <div className="flex justify-center my-2">
          <div className="bg-[#182229]/90 border border-[#222d34] text-[#ffd279] text-xs px-3 py-1.5 rounded-lg shadow max-w-md text-center flex items-center justify-center space-x-1.5">
            <span>🔒 As mensagens e chamadas são simuladas localmente.</span>
          </div>
        </div>

        {filteredMessages.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            {chatSearchQuery
              ? 'Nenhuma mensagem encontrada com esse termo.'
              : 'Nenhuma mensagem nesta conversa ainda. Diga oi!'}
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isMe = msg.senderId === 'me'
            const isSystem = msg.senderId === 'system'
            const isHovered = hoveredMessageId === msg.id

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
              onClick={() => setInputText((prev) => prev + emoji)}
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

      {/* Chat bottom input bar */}
      <div className="min-h-16 bg-[#202c33] px-3 py-2 flex items-center space-x-2 border-t border-[#2a3942] z-20 shrink-0">
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
            <DropdownMenuItem
              onClick={() => setMediaDialogOpen(true)}
              className="cursor-pointer hover:bg-[#182229]"
            >
              <Paperclip className="w-4 h-4 mr-2 text-emerald-400" />
              Fotos e vídeos
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <form onSubmit={handleSendText} className="flex-1 flex items-center space-x-2">
          <Input
            type="text"
            placeholder="Mensagem"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="bg-[#2a3942] border-none text-white placeholder-slate-400 focus-visible:ring-1 focus-visible:ring-[#00a884] rounded-lg h-11 text-sm sm:text-base"
          />

          {inputText.trim() ? (
            <Button
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
                  title: 'Áudio simulado',
                  description: 'Digite uma mensagem ou anexe fotos e vídeos para enviar.',
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
