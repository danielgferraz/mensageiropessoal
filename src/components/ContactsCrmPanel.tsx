import React, { useMemo, useState } from 'react'
import { ArrowLeft, Users, Search, UserPlus, MessageCircle } from 'lucide-react'
import { useWhatsApp } from '@/context/WhatsAppContext'
import { Contact, CrmStageId } from '@/types/whatsapp'
import { findStage, getStageLabelIn } from '@/data/crmData'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { ContactDetailsModal } from '@/components/ContactDetailsModal'
import { PipelineBoard } from '@/components/crm/PipelineBoard'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

interface ContactsCrmPanelProps {
  onClose: () => void
  onOpenChat: (contactId: string) => void
}

// Lista de contatos: usada no mobile (aba) e fixa à esquerda no desktop
const ContactsList: React.FC<{
  contacts: Contact[]
  search: string
  stageOf: (contactId: string) => CrmStageId
  stageLabelOf: (stage: CrmStageId) => string
  stageDotOf: (stage: CrmStageId) => string
  onSelectContact: (contact: Contact) => void
  onOpenChat: (contactId: string) => void
  className?: string
}> = ({
  contacts,
  search,
  stageOf,
  stageLabelOf,
  stageDotOf,
  onSelectContact,
  onOpenChat,
  className,
}) => {
  return (
    <div className={cn('flex flex-col h-full min-h-0', className)}>
      <div className="flex-1 overflow-y-auto divide-y divide-[#202c33]/40">
        {contacts.length === 0 ? (
          <div className="text-center py-10 px-4 text-slate-400 text-sm">
            Nenhum contato encontrado com "{search}".
          </div>
        ) : (
          contacts.map((contact) => {
            const stage = stageOf(contact.id)

            return (
              <div
                key={contact.id}
                onClick={() => onSelectContact(contact)}
                className="flex items-center px-4 py-3 hover:bg-[#202c33] cursor-pointer transition-colors"
              >
                <div className="relative shrink-0 mr-3">
                  <img
                    src={contact.avatar}
                    alt={contact.name}
                    className="w-11 h-11 rounded-full object-cover"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-medium text-slate-100 truncate">{contact.name}</h3>
                    <span
                      className="flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#202c33] border border-[#2a3942] text-slate-300 shrink-0"
                      title="Estágio no CRM"
                    >
                      <span className={cn('w-1.5 h-1.5 rounded-full mr-1', stageDotOf(stage))} />
                      {stageLabelOf(stage)}
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
    </div>
  )
}

// Tela unificada: no desktop contatos fixos à esquerda e pipeline fixo à direita,
// sem abas; no mobile volta ao alternador "Contatos" / "Pipeline"
export const ContactsCrmPanel: React.FC<ContactsCrmPanelProps> = ({ onClose, onOpenChat }) => {
  const { contacts, crmStages, setContactStage, crmStageList, addContact } = useWhatsApp()
  const [view, setView] = useState<'contacts' | 'pipeline'>('contacts')
  const [search, setSearch] = useState('')
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<CrmStageId | null>(null)
  const { toast } = useToast()
  const isMobile = useIsMobile()

  const stageOf = (contactId: string): CrmStageId => crmStages[contactId] || crmStageList[0].id
  const stageLabelOf = (stage: CrmStageId) => getStageLabelIn(crmStageList, stage)
  const stageDotOf = (stage: CrmStageId) => findStage(crmStageList, stage).dot

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
    const map: Record<string, Contact[]> = {}
    crmStageList.forEach((s) => {
      map[s.id] = []
    })
    filteredContacts.forEach((c) => {
      const stage = stageOf(c.id)
      if (map[stage]) map[stage].push(c)
    })
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredContacts, crmStages, crmStageList])

  const moveToStage = (contact: Contact, stage: CrmStageId) => {
    if (stageOf(contact.id) === stage) return
    setContactStage(contact.id, stage)
    toast({
      title: 'Negócio atualizado',
      description: `${contact.name} movido para "${stageLabelOf(stage)}".`,
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

  const contactsList = (
    <ContactsList
      contacts={filteredContacts}
      search={search}
      stageOf={stageOf}
      stageLabelOf={stageLabelOf}
      stageDotOf={stageDotOf}
      onSelectContact={setSelectedContact}
      onOpenChat={onOpenChat}
      className="flex-1"
    />
  )

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full bg-[#111b21] border-r border-[#222d34] text-slate-100 z-30 min-w-0">
      {/* Cabeçalho (mobile: ocupa a tela toda; desktop: só a metade esquerda) */}
      <div className="md:hidden h-16 px-4 bg-[#202c33] flex items-center space-x-3 border-b border-[#2a3942] shrink-0">
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

      {/* Alternador de visão: apenas no mobile */}
      {isMobile && (
        <div className="p-3 pb-0 bg-[#111b21] border-b border-[#222d34] shrink-0">
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
              Contatos
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
              Pipeline
            </button>
          </div>
        </div>
      )}

      {/* Mobile: mostra só a visão ativa */}
      {isMobile && view === 'contacts' && (
        <div className="flex-1 min-h-0 flex flex-col">{contactsList}</div>
      )}

      {/* Mobile: pipeline em tela cheia */}
      {isMobile && view === 'pipeline' && (
        <PipelineBoard
          stageList={crmStageList}
          dealsByStage={dealsByStage}
          stageOf={stageOf}
          moveToStage={moveToStage}
          onOpenChat={(id) => onOpenChat(id)}
          onSelectContact={setSelectedContact}
          dragId={dragId}
          setDragId={setDragId}
          overStage={overStage}
          setOverStage={setOverStage}
        />
      )}

      {/* Desktop: metade esquerda fixa = lista de contatos */}
      {!isMobile && (
        <div className="w-1/2 max-w-[480px] flex flex-col h-full border-r border-[#222d34] shrink-0">
          {/* Cabeçalho da metade esquerda */}
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
              <h2 className="text-base font-semibold leading-tight">Contatos</h2>
              <p className="text-[11px] text-slate-400 leading-tight">{contacts.length} contatos</p>
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

          {/* Busca */}
          <div className="p-3 bg-[#111b21] border-b border-[#222d34] shrink-0">
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

          {contactsList}
        </div>
      )}

      {/* Desktop: metade direita fixa = pipeline kanban */}
      {!isMobile && (
        <div className="flex-1 min-w-0 flex flex-col h-full">
          <PipelineBoard
            stageList={crmStageList}
            dealsByStage={dealsByStage}
            stageOf={stageOf}
            moveToStage={moveToStage}
            onOpenChat={(id) => onOpenChat(id)}
            onSelectContact={setSelectedContact}
            dragId={dragId}
            setDragId={setDragId}
            overStage={overStage}
            setOverStage={setOverStage}
          />
        </div>
      )}

      {/* Rodapé (mobile apenas — no desktop o pipeline tem dica própria) */}
      {isMobile && (
        <div className="px-4 py-2 border-t border-[#222d34] bg-[#111b21] shrink-0 flex items-center text-[11px] text-slate-500">
          <Users className="w-3.5 h-3.5 text-[#00a884] mr-1.5 shrink-0" />
          {view === 'pipeline'
            ? 'Arraste os cards entre estágios; clique em um card para ver os detalhes.'
            : 'Clique em um contato para ver os detalhes e o estágio no CRM.'}
        </div>
      )}

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
