import React, { useMemo, useState } from 'react'
import {
  ArrowLeft,
  Users,
  KanbanSquare,
  Search,
  UserPlus,
  MoreVertical,
  MessageCircle,
  Inbox,
} from 'lucide-react'
import { useWhatsApp } from '@/context/WhatsAppContext'
import { Contact, CrmStageId } from '@/types/whatsapp'
import { CRM_STAGES, getStageLabel } from '@/data/crmData'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import { ContactDetailsModal } from '@/components/ContactDetailsModal'
import { cn } from '@/lib/utils'

interface ContactsCrmPanelProps {
  onClose: () => void
  onOpenChat: (contactId: string) => void
}

// Tela unificada: lista de contatos com o estágio visível + kanban do CRM na mesma página
export const ContactsCrmPanel: React.FC<ContactsCrmPanelProps> = ({ onClose, onOpenChat }) => {
  const { contacts, crmStages, setContactStage, addContact } = useWhatsApp()
  const [view, setView] = useState<'contacts' | 'pipeline'>('contacts')
  const [search, setSearch] = useState('')
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<CrmStageId | null>(null)
  const { toast } = useToast()

  const stageOf = (contactId: string): CrmStageId => crmStages[contactId] || 'novo'

  const filteredContacts = useMemo(
    () =>
      contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.phone.toLowerCase().includes(search.toLowerCase()),
      ),
    [contacts, search],
  )

  const dealsByStage = useMemo(() => {
    const map: Record<CrmStageId, Contact[]> = {
      novo: [],
      'em-contato': [],
      'em-negociacao': [],
      fechado: [],
    }
    filteredContacts.forEach((c) => map[stageOf(c.id)].push(c))
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredContacts, crmStages])

  const moveToStage = (contact: Contact, stage: CrmStageId) => {
    if (stageOf(contact.id) === stage) return
    setContactStage(contact.id, stage)
    toast({
      title: 'Negócio atualizado',
      description: `${contact.name} movido para "${getStageLabel(stage)}".`,
    })
  }

  const handleDrop = (stage: CrmStageId) => {
    if (!dragId) return
    const contact = contacts.find((c) => c.id === dragId)
    if (contact) moveToStage(contact, stage)
    setDragId(null)
    setOverStage(null)
  }

  const handleAddContact = () => {
    const created = addContact('Novo contato', '+55 11 90000-0000')
    toast({
      title: 'Contato adicionado',
      description: `${created.name} criado — edite os dados no modal de detalhes.`,
    })
    setSelectedContact(created)
  }

  const renderCard = (contact: Contact) => {
    const currentStage = stageOf(contact.id)
    const isDragging = dragId === contact.id

    return (
      <div
        key={contact.id}
        draggable
        onDragStart={() => setDragId(contact.id)}
        onDragEnd={() => {
          setDragId(null)
          setOverStage(null)
        }}
        onClick={() => setSelectedContact(contact)}
        className={cn(
          'rounded-lg bg-[#2a3942] border border-[#374248] p-2.5 cursor-grab active:cursor-grabbing hover:border-[#00a884]/60 transition-all',
          isDragging && 'opacity-40',
        )}
      >
        <div className="flex items-start space-x-2.5">
          <img
            src={contact.avatar}
            alt={contact.name}
            className="w-9 h-9 rounded-full object-cover ring-1 ring-white/10 shrink-0"
            draggable={false}
          />

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-100 truncate">{contact.name}</p>
            <p className="text-[11px] text-slate-400 truncate mt-0.5">{contact.phone}</p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title="Opções do negócio"
                className="w-6 h-6 flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-[#374248]/60 transition-colors shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-[#233138] border-[#2a3942] text-slate-200"
            >
              <DropdownMenuLabel className="text-xs text-slate-400">Mover para</DropdownMenuLabel>
              {CRM_STAGES.filter((s) => s.id !== currentStage).map((s) => (
                <DropdownMenuItem
                  key={s.id}
                  onClick={() => moveToStage(contact, s.id)}
                  className="cursor-pointer hover:bg-[#182229]"
                >
                  <span className={`w-2 h-2 rounded-full ${s.dot} mr-2`} />
                  {s.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="bg-[#2a3942]" />
              <DropdownMenuItem
                onClick={() => onOpenChat(contact.id)}
                className="cursor-pointer hover:bg-[#182229]"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Abrir conversa
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[#374248]/60">
          <span className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
            {getStageLabel(currentStage)}
          </span>
          <button
            type="button"
            title="Abrir conversa no WhatsApp"
            onClick={(e) => {
              e.stopPropagation()
              onOpenChat(contact.id)
            }}
            className="text-slate-400 hover:text-[#00a884] transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full md:w-[380px] lg:w-[420px] flex flex-col h-full bg-[#111b21] border-r border-[#222d34] text-slate-100 z-30 shrink-0">
      {/* Cabeçalho */}
      <div className="h-16 px-4 bg-[#202c33] flex items-center space-x-3 border-b border-[#2a3942] shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-slate-300 hover:text-white -ml-2"
          title="Voltar para as conversas"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-tight">Contatos e CRM</h2>
          <p className="text-[11px] text-slate-400 leading-tight">
            {contacts.length} contatos • {contacts.length} negócios
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleAddContact}
          className="ml-auto text-slate-300 hover:text-white"
          title="Adicionar novo contato"
        >
          <UserPlus className="w-5 h-5" />
        </Button>
      </div>

      {/* Alternador de visão: lista / pipeline */}
      <div className="p-3 pb-0 bg-[#111b21] border-b border-[#222d34]">
        <div className="flex bg-[#202c33] rounded-lg p-0.5 mb-2">
          <button
            type="button"
            onClick={() => setView('contacts')}
            className={cn(
              'flex-1 flex items-center justify-center space-x-1.5 py-1.5 rounded-md text-xs font-medium transition-colors',
              view === 'contacts'
                ? 'bg-[#2a3942] text-white'
                : 'text-slate-400 hover:text-slate-200',
            )}
          >
            <Users className="w-4 h-4" />
            <span>Contatos</span>
          </button>
          <button
            type="button"
            onClick={() => setView('pipeline')}
            className={cn(
              'flex-1 flex items-center justify-center space-x-1.5 py-1.5 rounded-md text-xs font-medium transition-colors',
              view === 'pipeline'
                ? 'bg-[#2a3942] text-white'
                : 'text-slate-400 hover:text-slate-200',
            )}
          >
            <KanbanSquare className="w-4 h-4" />
            <span>Pipeline</span>
          </button>
        </div>
      </div>

      {/* Busca */}
      <div className="p-3 bg-[#111b21] border-b border-[#222d34]">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Pesquisar contatos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-[#202c33] border-none text-white placeholder-slate-400 h-9 text-xs sm:text-sm focus-visible:ring-1 focus-visible:ring-[#00a884]"
          />
        </div>
      </div>

      {/* VISÃO CONTATOS: lista com estágio visível */}
      {view === 'contacts' && (
        <div className="flex-1 overflow-y-auto divide-y divide-[#202c33]/40">
          <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#00a884]">
            Contatos no WhatsApp ({filteredContacts.length})
          </div>

          {filteredContacts.length === 0 ? (
            <div className="text-center py-10 px-4 text-slate-400 text-sm">
              Nenhum contato encontrado com "{search}".
            </div>
          ) : (
            filteredContacts.map((contact) => {
              const stageConfig = CRM_STAGES.find((s) => s.id === stageOf(contact.id))

              return (
                <div
                  key={contact.id}
                  onClick={() => setSelectedContact(contact)}
                  className="flex items-center px-4 py-3 hover:bg-[#202c33] cursor-pointer transition-colors"
                >
                  <div className="relative shrink-0 mr-3">
                    <img
                      src={contact.avatar}
                      alt={contact.name}
                      className="w-11 h-11 rounded-full object-cover"
                    />
                    {contact.online && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#00a884] rounded-full border border-[#111b21]" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-slate-100 truncate">
                        {contact.name}
                      </h3>
                      <span
                        className="flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#202c33] border border-[#2a3942] text-slate-300 shrink-0"
                        title="Estágio no CRM"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${stageConfig?.dot} mr-1`} />
                        {stageConfig?.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{contact.phone}</p>
                    {contact.about && (
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">{contact.about}</p>
                    )}
                  </div>

                  <MessageCircle
                    className="w-4 h-4 text-slate-400 opacity-60 hover:opacity-100 ml-2 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenChat(contact.id)
                    }}
                  />
                </div>
              )
            })
          )}
        </div>
      )}

      {/* VISÃO PIPELINE: kanban com arrastar entre estágios */}
      {view === 'pipeline' && (
        <div className="flex-1 min-h-0 flex gap-2.5 p-3 overflow-x-auto bg-[#0b141a]">
          {CRM_STAGES.map((stage) => {
            const deals = dealsByStage[stage.id]
            const isOver = overStage === stage.id

            return (
              <div
                key={stage.id}
                onDragOver={(e) => {
                  e.preventDefault()
                  setOverStage(stage.id)
                }}
                onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
                onDrop={(e) => {
                  e.preventDefault()
                  handleDrop(stage.id)
                }}
                className={cn(
                  'flex flex-col w-[230px] shrink-0 rounded-xl border transition-colors',
                  isOver ? 'border-[#00a884] bg-[#111b21]' : 'border-[#2a3942] bg-[#202c33]',
                )}
              >
                {/* Cabeçalho da coluna */}
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#2a3942] shrink-0">
                  <div className="flex items-center space-x-2 min-w-0">
                    <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', stage.dot)} />
                    <h3 className="text-sm font-semibold text-slate-200 truncate">{stage.label}</h3>
                  </div>
                  <span className="text-[11px] text-slate-400 bg-[#111b21] px-2 py-0.5 rounded-full shrink-0">
                    {deals.length}
                  </span>
                </div>

                {/* Cards do estágio */}
                <div className="flex-1 min-h-[120px] overflow-y-auto p-2 space-y-2">
                  {deals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full min-h-[110px] text-center px-3">
                      <Inbox className="w-6 h-6 text-slate-600 mb-1.5" />
                      <p className="text-[11px] text-slate-500">
                        Arraste um contato para o estágio "{stage.label}"
                      </p>
                    </div>
                  ) : (
                    deals.map((contact) => renderCard(contact))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Rodapé */}
      <div className="px-4 py-2 border-t border-[#222d34] bg-[#111b21] shrink-0 flex items-center text-[11px] text-slate-500">
        {view === 'pipeline' ? (
          <>
            <MessageCircle className="w-3.5 h-3.5 text-[#00a884] mr-1.5 shrink-0" />
            Arraste os cards entre estágios; clique em um card para ver os detalhes.
          </>
        ) : (
          <>
            <Users className="w-3.5 h-3.5 text-[#00a884] mr-1.5 shrink-0" />
            Clique em um contato para ver os detalhes e o estágio no CRM.
          </>
        )}
      </div>

      {/* Modal de detalhes do contato */}
      <ContactDetailsModal
        contact={selectedContact}
        onClose={() => setSelectedContact(null)}
        onOpenChat={(id) => {
          setSelectedContact(null)
          onOpenChat(id)
        }}
      />
    </div>
  )
}
