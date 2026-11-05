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

interface SidebarProps {
  onOpenNewGroup: () => void
  onOpenContacts: () => void
  onOpenProfile: () => void
  onLogout: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  onOpenNewGroup,
  onOpenContacts,
  onOpenProfile,
  onLogout,
}) => {
  const { user, conversations, activeChatId, setActiveChatId, markAsRead, resetData } =
    useWhatsApp()

  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'groups'>('all')
  const { toast } = useToast()

  const filteredConversations = conversations.filter((c) => {
    // text search
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.lastMessage?.text || '').toLowerCase().includes(searchQuery.toLowerCase())

    if (!matchesSearch) return false

    if (filterType === 'unread') return (c.unreadCount || 0) > 0
    if (filterType === 'groups') return c.isGroup
    return true
  })

  const handleSelectChat = (conv: Conversation) => {
    setActiveChatId(conv.id)
    if (conv.unreadCount && conv.unreadCount > 0) {
      markAsRead(conv.id)
    }
  }

  const renderStatus = (status?: string, isMine?: boolean) => {
    if (!isMine || !status) return null
    if (status === 'read') {
      return <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] inline mr-1" />
    }
    if (status === 'delivered') {
      return <CheckCheck className="w-3.5 h-3.5 text-slate-400 inline mr-1" />
    }
    return <Check className="w-3.5 h-3.5 text-slate-400 inline mr-1" />
  }

  return (
    <div className="w-full md:w-[380px] lg:w-[420px] flex flex-col h-full bg-[#111b21] border-r border-[#222d34] text-slate-200 shrink-0">
      {/* Top Header */}
      <div className="h-16 px-4 bg-[#202c33] flex items-center justify-between border-b border-[#2a3942]">
        <div
          className="flex items-center space-x-3 cursor-pointer group"
          onClick={onOpenProfile}
          title="Ver seu perfil"
        >
          <div className="relative">
            <img
              src={user.avatar}
              alt={user.name}
              className="w-10 h-10 rounded-full object-cover ring-1 ring-white/20 group-hover:ring-[#00a884] transition-all"
            />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#00a884] rounded-full border border-[#202c33]" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors truncate max-w-[130px]">
              {user.name || 'Você'}
            </p>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center space-x-1 text-slate-400">
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenContacts}
            className="hover:text-white hover:bg-[#374248]/50 rounded-full"
            title="Lista de Contatos"
          >
            <UserPlus className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenNewGroup}
            className="hover:text-white hover:bg-[#374248]/50 rounded-full"
            title="Criar novo grupo"
          >
            <Users className="w-5 h-5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="hover:text-white hover:bg-[#374248]/50 rounded-full"
              >
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-[#233138] border-[#2a3942] text-slate-200"
            >
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
                    title: 'Dados restaurados',
                    description: 'As conversas voltaram ao estado de exemplo original.',
                  })
                }}
                className="cursor-pointer hover:bg-[#182229] text-amber-400"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Restaurar dados de exemplo
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

      {/* Search Bar & Quick Filters */}
      <div className="p-3 bg-[#111b21] space-y-2 border-b border-[#222d34]">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Pesquisar ou começar uma nova conversa"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-[#202c33] border-none text-white placeholder-slate-400 rounded-lg h-9 text-xs sm:text-sm focus-visible:ring-1 focus-visible:ring-[#00a884]"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-1.5 pt-1 overflow-x-auto text-xs">
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
            onClick={() => setFilterType('groups')}
            className={`px-3 py-1 rounded-full transition-colors whitespace-nowrap ${
              filterType === 'groups'
                ? 'bg-[#00a884] text-white font-medium'
                : 'bg-[#202c33] text-slate-300 hover:bg-[#2a3942]'
            }`}
          >
            Grupos
          </button>
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#202c33]/40">
        {filteredConversations.length === 0 ? (
          <div className="text-center py-12 px-4 text-slate-400 text-sm">
            <MessageSquare className="w-10 h-10 mx-auto text-slate-600 mb-2 opacity-50" />
            <p className="font-medium text-slate-300">Nenhuma conversa encontrada</p>
            <p className="text-xs text-slate-500 mt-1">
              Inicie um chat clicando no ícone de contatos acima.
            </p>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isActive = conv.id === activeChatId
            const isMine = conv.lastMessage?.senderId === 'me'

            return (
              <div
                key={conv.id}
                onClick={() => handleSelectChat(conv)}
                className={`flex items-center px-3 py-3 cursor-pointer transition-colors relative ${
                  isActive ? 'bg-[#2a3942]' : 'hover:bg-[#202c33] bg-[#111b21]'
                }`}
              >
                <div className="relative shrink-0 mr-3">
                  <img
                    src={conv.avatar}
                    alt={conv.name}
                    className="w-12 h-12 rounded-full object-cover ring-1 ring-white/10"
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
                    <p className="truncate pr-2 flex items-center">
                      {renderStatus(conv.lastMessage?.status, isMine)}
                      <span className="truncate">
                        {conv.lastMessage?.text || 'Nenhuma mensagem recente'}
                      </span>
                    </p>

                    <div className="flex items-center space-x-1 shrink-0">
                      {conv.pinned && <Pin className="w-3.5 h-3.5 text-slate-400 rotate-45" />}
                      {(conv.unreadCount || 0) > 0 && (
                        <span className="bg-[#00a884] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-5 text-center">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
