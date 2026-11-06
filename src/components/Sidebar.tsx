import { FALLBACK_AVATAR } from '@/lib/evolution'
import React, { useState } from 'react'
import {
  MessageSquare,
  Users,
  UserPlus,
  PlusCircle,
  Search,
  MoreVertical,
  Pin,
  Check,
  CheckCheck,
  RotateCcw,
  LogOut,
  SlidersHorizontal,
  Archive,
  ArchiveRestore,
  Tag,
  ChevronDown,
  ArrowLeft,
  X,
  QrCode,
} from 'lucide-react'
import { useWhatsApp } from '@/context/WhatsAppContext'
import { Conversation } from '@/types/whatsapp'
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
import { LabelsManagerDialog } from './LabelsManagerDialog'

interface SidebarProps {
  onOpenNewGroup: () => void
  onOpenContacts: () => void
  onOpenProfile: () => void
  onLogout: () => void
  onOpenMobileMenu?: () => void
  onOpenNewInstance?: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  onOpenNewGroup,
  onOpenContacts,
  onOpenProfile,
  onLogout,
  onOpenMobileMenu,
  onOpenNewInstance,
}) => {
  const {
    user,
    loading, syncError, refresh, instanceName,
    conversations,
    activeChatId,
    setActiveChatId,
    markAsRead,
    resetData,
    labels,
    togglePinConversation,
    toggleArchiveConversation,
  } = useWhatsApp()

  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'contacts' | 'groups'>('all')
  const [selectedLabelFilter, setSelectedLabelFilter] = useState<string | null>(null)
  const [showArchivedView, setShowArchivedView] = useState(false)

  // Diálogo de etiquetas
  const [labelsDialogOpen, setLabelsDialogOpen] = useState(false)
  const [targetConversationForLabels, setTargetConversationForLabels] = useState<string | null>(
    null,
  )

  const { toast } = useToast()

  // Separação entre arquivadas e ativas
  const archivedConversations = conversations.filter((c) => !!c.archived)
  const activeConversations = conversations.filter((c) => !c.archived)

  // Lista base dependendo da visão (Arquivadas ou Principal)
  const currentBaseList = showArchivedView ? archivedConversations : activeConversations

  // Filtro e busca
  const filteredConversations = currentBaseList.filter((c) => {
    // Busca de texto
    const query = searchQuery.toLowerCase()
    const digits = searchQuery.replace(/D/g, '')
    const matchesSearch =
      c.name.toLowerCase().includes(query) ||
      (c.pushName || '').toLowerCase().includes(query) ||
      (digits.length >= 3 && (c.phone || '').includes(digits)) ||
      (c.lastMessage?.text || '').toLowerCase().includes(query)

    if (!matchesSearch) return false

    // Filtro por etiqueta
    if (selectedLabelFilter) {
      if (!(c.labelIds || []).includes(selectedLabelFilter)) return false
    }

    if (filterType === 'unread') return (c.unreadCount || 0) > 0
    if (filterType === 'contacts') return !!c.isSaved
    if (filterType === 'groups') return c.isGroup
    return true
  })

  // Ordenação: conversas fixadas (pinned) primeiro na visão principal
  const sortedConversations = [...filteredConversations].sort((a, b) => {
    if (!showArchivedView) {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
    }
    return 0
  })

  const handleSelectChat = (conv: Conversation) => {
    setActiveChatId(conv.id)
    if (conv.unreadCount && conv.unreadCount > 0) {
      markAsRead(conv.id)
    }
  }

  const handleOpenLabelsForChat = (convId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setTargetConversationForLabels(convId)
    setLabelsDialogOpen(true)
  }

  const renderStatus = (status?: string, isMine?: boolean) => {
    if (!isMine || !status) return null
    if (status === 'read') {
      return <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] inline mr-1 shrink-0" />
    }
    if (status === 'delivered') {
      return <CheckCheck className="w-3.5 h-3.5 text-slate-400 inline mr-1 shrink-0" />
    }
    return <Check className="w-3.5 h-3.5 text-slate-400 inline mr-1 shrink-0" />
  }

  return (
    <div className="w-full min-w-0 flex flex-col h-full bg-[#111b21] wa-panel-separator-right text-slate-200 shrink-0">
      {/* Top Header — Área do perfil / conversas */}
      <div className="h-16 px-4 wa-header-sidebar flex items-center justify-between shrink-0">
        {showArchivedView ? (
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowArchivedView(false)}
              className="wa-header-btn rounded-full -ml-2"
              title="Voltar às conversas principais"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center space-x-2">
              <Archive className="w-5 h-5 text-[#00a884]" />
              <h2 className="text-base font-semibold wa-header-title">Arquivadas</h2>
            </div>
          </div>
        ) : (
          <div className="flex min-w-0 items-center space-x-2">
            {onOpenMobileMenu && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onOpenMobileMenu}
                className="md:hidden wa-header-btn rounded-full -ml-2"
                title="Abrir menu de funcionalidades"
              >
                <SlidersHorizontal className="w-5 h-5" />
              </Button>
            )}
            <div
              className="flex min-w-0 items-center space-x-2 cursor-pointer group"
              onClick={onOpenProfile}
              title="Ver seu perfil"
            >
              <div className="relative shrink-0">
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-10 h-10 rounded-full object-cover ring-1 ring-white/20 group-hover:ring-[#00a884] transition-all"
                  onError={(e) => { const t = e.currentTarget; t.onerror = null; t.src = FALLBACK_AVATAR }}
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#00a884] rounded-full border border-[var(--wa-header-sidebar-bg)]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold wa-header-title group-hover:opacity-85 transition-opacity truncate max-w-[120px] sm:max-w-[150px]">
                  {user.name || 'Você'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action icons inteligentes */}
        <div className="flex shrink-0 items-center space-x-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setTargetConversationForLabels(null)
              setLabelsDialogOpen(true)
            }}
            className="wa-header-btn rounded-full"
            title="Gerenciar Etiquetas"
          >
            <Tag className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenContacts}
            className="wa-header-btn rounded-full"
            title="Lista de Contatos"
          >
            <UserPlus className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenNewGroup}
            className="hidden"
            title="Criar novo grupo"
          >
            <Users className="w-5 h-5" />
          </Button>

          {onOpenNewInstance && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenNewInstance}
              className="hidden"
              title="Nova Instância WhatsApp (QR Code)"
            >
              <QrCode className="w-5 h-5" />
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="wa-header-btn rounded-full"
                title="Mais opções"
              >
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-[#233138] border-[#2a3942] text-slate-200"
            >
              {onOpenNewInstance && (
                <DropdownMenuItem
                  onClick={onOpenNewInstance}
                  className="cursor-pointer hover:bg-[#182229] text-[#00a884] font-medium"
                >
                  <QrCode className="w-4 h-4 mr-2 text-[#00a884]" />
                  Nova instância do WhatsApp
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={onOpenNewGroup}
                className="cursor-pointer hover:bg-[#182229]"
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                Novo grupo
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onOpenContacts}
                className="cursor-pointer hover:bg-[#182229]"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Novo contato
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setTargetConversationForLabels(null)
                  setLabelsDialogOpen(true)
                }}
                className="cursor-pointer hover:bg-[#182229]"
              >
                <Tag className="w-4 h-4 mr-2 text-[#00a884]" />
                Etiquetas coloridas
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onOpenProfile}
                className="cursor-pointer hover:bg-[#182229]"
              >
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                Meu perfil
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#2a3942]" />
              <DropdownMenuItem
                onClick={() => {
                  resetData()
                  toast({
                    title: 'Dados recarregados',
                    description: 'As conversas serão recarregadas do WhatsApp.',
                  })
                }}
                className="cursor-pointer hover:bg-[#182229] text-amber-400"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Recarregar dados do WhatsApp
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onLogout}
                className="cursor-pointer hover:bg-[#182229] text-red-400"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sair da sessão
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="px-4 py-2 text-xs border-b border-[#222d34]" role="status">
        {loading ? 'Conectando ao WhatsApp…' : syncError ? <div role="alert" className="text-red-300">{syncError} <button className="underline" onClick={refresh}>Tentar novamente</button></div> : `WhatsApp conectado · ${instanceName || '—'}`}
      </div>
      {!loading && !syncError && !conversations.some((c) => c.id.includes('@')) && <p className="p-4 text-sm text-slate-400">Nenhuma conversa do WhatsApp disponível. Inicie uma conversa pelos contatos ou aguarde a sincronização do celular.</p>}
      {/* Search Bar & Quick Filters */}
      <div className="p-3 bg-[#111b21] space-y-2 border-b border-[#222d34] shrink-0">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" />
          <Input
            placeholder={
              showArchivedView
                ? 'Pesquisar conversas arquivadas'
                : 'Pesquisar ou começar uma nova conversa'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-[#202c33] border-none text-white placeholder-slate-400 rounded-lg h-9 text-xs sm:text-sm focus-visible:ring-1 focus-visible:ring-[#00a884]"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-1.5 pt-1 overflow-x-auto text-xs no-scrollbar">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded-full transition-colors whitespace-nowrap ${
              filterType === 'all'
                ? 'bg-[#00a884] text-white font-medium'
                : 'bg-[#202c33] text-slate-300 hover:bg-[#2a3942]'
            }`}
          >
            Tudo
          </button>
          <button
            type="button"
            onClick={() => setFilterType('unread')}
            className={`px-3 py-1 rounded-full transition-colors whitespace-nowrap ${
              filterType === 'unread'
                ? 'bg-[#00a884] text-white font-medium'
                : 'bg-[#202c33] text-slate-300 hover:bg-[#2a3942]'
            }`}
          >
            Não lidas
          </button>
          <button
            type="button"
            onClick={() => setFilterType('contacts')}
            className={`px-3 py-1 rounded-full transition-colors whitespace-nowrap ${
              filterType === 'contacts'
                ? 'bg-[#00a884] text-white font-medium'
                : 'bg-[#202c33] text-slate-300 hover:bg-[#2a3942]'
            }`}
          >
            Contatos
          </button>
          <button
            type="button"
            onClick={() => setFilterType('groups')}
            className={`px-3 py-1 rounded-full transition-colors whitespace-nowrap ${
              filterType === 'groups'
                ? 'bg-[#00a884] text-white font-medium'
                : 'bg-[#202c33] text-slate-300 hover:bg-[#2a3942]'
            }`}
          >
            Grupos
          </button>

          {/* Filtro rápido por Etiquetas */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`px-3 py-1 rounded-full transition-colors whitespace-nowrap flex items-center space-x-1 ${
                  selectedLabelFilter
                    ? 'bg-[#00a884] text-white font-medium'
                    : 'bg-[#202c33] text-slate-300 hover:bg-[#2a3942]'
                }`}
              >
                <Tag className="w-3 h-3" />
                <span>
                  {selectedLabelFilter
                    ? labels.find((l) => l.id === selectedLabelFilter)?.name || 'Etiqueta'
                    : 'Etiquetas'}
                </span>
                <ChevronDown className="w-3 h-3 opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="bg-[#233138] border-[#2a3942] text-slate-200"
            >
              <DropdownMenuItem
                onClick={() => setSelectedLabelFilter(null)}
                className="cursor-pointer hover:bg-[#182229]"
              >
                Todas as etiquetas
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#2a3942]" />
              {labels.map((lbl) => (
                <DropdownMenuItem
                  key={lbl.id}
                  onClick={() => setSelectedLabelFilter(lbl.id)}
                  className="cursor-pointer hover:bg-[#182229] flex items-center space-x-2"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: lbl.color }}
                  />
                  <span>{lbl.name}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="bg-[#2a3942]" />
              <DropdownMenuItem
                onClick={() => {
                  setTargetConversationForLabels(null)
                  setLabelsDialogOpen(true)
                }}
                className="cursor-pointer hover:bg-[#182229] text-[#00a884]"
              >
                Gerenciar etiquetas...
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {selectedLabelFilter && (
            <button
              type="button"
              onClick={() => setSelectedLabelFilter(null)}
              className="px-2 py-1 rounded-full bg-[#202c33] text-slate-400 hover:text-white flex items-center text-[10px]"
              title="Limpar filtro de etiqueta"
            >
              <X className="w-3 h-3 mr-0.5" /> Limpar
            </button>
          )}
        </div>
      </div>

      {/* Item da Seção "Arquivadas" (estilo WhatsApp Web) no topo da lista principal */}
      {!showArchivedView && archivedConversations.length > 0 && (
        <div
          onClick={() => setShowArchivedView(true)}
          className="flex items-center justify-between px-4 py-3 bg-[#111b21] hover:bg-[#202c33] cursor-pointer border-b border-[#202c33] transition-colors"
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-[#202c33] flex items-center justify-center text-[#00a884]">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-100">Arquivadas</p>
              <p className="text-xs text-slate-400">
                {archivedConversations.length}{' '}
                {archivedConversations.length === 1 ? 'conversa' : 'conversas'}
              </p>
            </div>
          </div>
          <span className="text-xs text-[#00a884] font-medium hover:underline">Ver todas</span>
        </div>
      )}

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#202c33]/40">
        {sortedConversations.length === 0 && !loading ? (
          <div className="text-center py-12 px-4 text-slate-400 text-sm">
            <MessageSquare className="w-10 h-10 mx-auto text-slate-600 mb-2 opacity-50" />
            <p className="font-medium text-slate-300">
              {showArchivedView
                ? 'Nenhuma conversa arquivada'
                : selectedLabelFilter
                  ? 'Nenhuma conversa com esta etiqueta'
                  : 'Nenhuma conversa encontrada'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {showArchivedView
                ? 'Para arquivar uma conversa, clique no menu de opções ao lado dela.'
                : 'Inicie um chat clicando no ícone de contatos acima.'}
            </p>
          </div>
        ) : (
          sortedConversations.map((conv) => {
            const isActive = conv.id === activeChatId
            const isMine = conv.lastMessage?.senderId === 'me'
            const convLabels = labels.filter((l) => (conv.labelIds || []).includes(l.id))

            return (
              <div
                key={conv.id}
                role="button"
                tabIndex={0}
                aria-label={`Abrir conversa com ${conv.name}`}
                onKeyDown={(event) => {
                  if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault(); handleSelectChat(conv)
                  }
                }}
                onClick={() => handleSelectChat(conv)}
                className={`flex items-center px-3 py-3 cursor-pointer transition-colors relative group ${
                  isActive ? 'bg-[#2a3942]' : 'hover:bg-[#202c33] bg-[#111b21]'
                }`}
              >
                <div className="relative shrink-0 mr-3">
                  <img
                    src={conv.avatar}
                    alt={conv.name}
                    className="w-12 h-12 rounded-full object-cover ring-1 ring-white/10"
                    onError={(e) => { const t = e.currentTarget; t.onerror = null; t.src = FALLBACK_AVATAR }}
                  />
                  {conv.isGroup && (
                    <div className="absolute -bottom-1 -right-1 bg-[#202c33] p-0.5 rounded-full">
                      <Users className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-100 truncate">{conv.name}</h3>
                    <span
                      className={`text-[11px] shrink-0 ml-2 ${
                        (conv.unreadCount || 0) > 0
                          ? 'text-[#00a884] font-medium'
                          : 'text-slate-400'
                      }`}
                    >
                      {conv.lastMessage?.timestamp || ''}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-1 text-xs text-slate-400">
                    <p className="truncate pr-2 flex items-center min-w-0 flex-1">
                      {renderStatus(conv.lastMessage?.status, isMine)}
                      <span className="truncate">
                        {conv.lastMessage?.text || 'Nenhuma mensagem recente'}
                      </span>
                    </p>

                    <div className="flex items-center space-x-1 shrink-0 ml-1">
                      {conv.pinned && !showArchivedView && (
                        <Pin className="w-3.5 h-3.5 text-slate-400 rotate-45 shrink-0" />
                      )}
                      {(conv.unreadCount || 0) > 0 && (
                        <span className="bg-[#00a884] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-5 text-center">
                          {conv.unreadCount}
                        </span>
                      )}

                      {/* Dropdown de ações da conversa (Fixar / Arquivar / Etiquetas) */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#374248]"
                            title="Opções da conversa"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-[#233138] border-[#2a3942] text-slate-200"
                        >
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              togglePinConversation(conv.id)
                              toast({
                                title: conv.pinned ? 'Conversa desafixada' : 'Conversa fixada',
                                description: conv.pinned
                                  ? `${conv.name} não está mais no topo.`
                                  : `${conv.name} foi fixada no topo da lista.`,
                              })
                            }}
                            className="cursor-pointer hover:bg-[#182229]"
                          >
                            <Pin className="w-4 h-4 mr-2" />
                            {conv.pinned ? 'Desafixar conversa' : 'Fixar conversa'}
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleArchiveConversation(conv.id)
                              toast({
                                title: conv.archived
                                  ? 'Conversa desarquivada'
                                  : 'Conversa arquivada',
                                description: conv.archived
                                  ? `${conv.name} retornou à lista principal.`
                                  : `${conv.name} foi movida para Arquivadas.`,
                              })
                            }}
                            className="cursor-pointer hover:bg-[#182229]"
                          >
                            {conv.archived ? (
                              <>
                                <ArchiveRestore className="w-4 h-4 mr-2" />
                                Desarquivar conversa
                              </>
                            ) : (
                              <>
                                <Archive className="w-4 h-4 mr-2" />
                                Arquivar conversa
                              </>
                            )}
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={(e) => handleOpenLabelsForChat(conv.id, e)}
                            className="cursor-pointer hover:bg-[#182229]"
                          >
                            <Tag className="w-4 h-4 mr-2 text-[#00a884]" />
                            Etiquetas da conversa
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Chips coloridos das etiquetas abaixo da mensagem */}
                  {convLabels.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 mt-1.5">
                      {convLabels.map((lbl) => (
                        <span
                          key={lbl.id}
                          className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full shadow-sm"
                          style={{
                            backgroundColor: `${lbl.color}25`,
                            color: lbl.color,
                            border: `1px solid ${lbl.color}40`,
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full mr-1"
                            style={{ backgroundColor: lbl.color }}
                          />
                          {lbl.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Diálogo de Gerenciamento / Atribuição de Etiquetas */}
      <LabelsManagerDialog
        open={labelsDialogOpen}
        onOpenChange={setLabelsDialogOpen}
        targetConversationId={targetConversationForLabels}
      />
    </div>
  )
}
