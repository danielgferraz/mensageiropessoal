import React, { useMemo, useState } from 'react'
import { ArrowLeft, Users, Search, UserPlus, MessageCircle, RotateCcw, XCircle } from 'lucide-react'
import { useWhatsApp } from '@/context/WhatsAppContext'
import { Contact, CrmStageId } from '@/types/whatsapp'
import { findStage, getStageLabelIn } from '@/data/crmData'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { ContactDetailsModal } from '@/components/ContactDetailsModal'
import { NewContactDialog } from '@/components/NewContactDialog'
import { PipelineBoard } from '@/components/crm/PipelineBoard'
import { ContactFiltersBar, AboutFilter } from '@/components/ContactFiltersBar'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

interface ContactsCrmPanelProps {
  onClose: () => void
  onOpenChat: (contactId: string) => void
  onOpenMobileMenu?: () => void
}

// Normaliza texto removendo acentos e espaços supérfluos para busca insensível a acentuação
const normalizeText = (text: string) =>
  (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

// Lista de contatos: usada no mobile (aba) e fixa à esquerda no desktop
const ContactsList: React.FC<{
  contacts: Contact[]
  search: string
  hasActiveFilters: boolean
  onClearFilters: () => void
  stageOf: (contactId: string) => CrmStageId
  stageLabelOf: (stage: CrmStageId) => string
  stageDotOf: (stage: CrmStageId) => string
  getContactLabelIds: (contactId: string) => string[]
  labels: { id: string; name: string; color: string }[]
  onSelectContact: (contact: Contact) => void
  onOpenChat: (contactId: string) => void
  className?: string
}> = ({
  contacts,
  search,
  hasActiveFilters,
  onClearFilters,
  stageOf,
  stageLabelOf,
  stageDotOf,
  getContactLabelIds,
  labels,
  onSelectContact,
  onOpenChat,
  className,
}) => {
  return (
    <div className={cn('flex flex-col h-full min-h-0', className)}>
      <div className="flex-1 overflow-y-auto divide-y divide-[#202c33]/40">
        {contacts.length === 0 ? (
          <div className="text-center py-12 px-6 text-slate-400 flex flex-col items-center">
            <XCircle className="w-10 h-10 text-slate-600 mb-3" />
            <p className="text-sm font-medium text-slate-300 mb-1">Nenhum contato encontrado</p>
            <p className="text-xs text-slate-500 max-w-xs leading-relaxed mb-4">
              {search
                ? `Não encontramos nenhum resultado para "${search}". Verifique a digitação ou remova filtros.`
                : 'Nenhum contato corresponde aos filtros de estágio/recado aplicados.'}
            </p>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={onClearFilters}
                className="bg-[#202c33] border-[#2a3942] text-[#00a884] hover:text-white hover:bg-[#2a3942] text-xs space-x-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpar todos os filtros</span>
              </Button>
            )}
          </div>
        ) : (
          contacts.map((contact) => {
            const stage = stageOf(contact.id)
            const contactLabelIds = getContactLabelIds(contact.id)
            const contactLabels = labels.filter((l) => contactLabelIds.includes(l.id))

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
                  {contactLabels.length > 0 && (
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {contactLabels.map((lbl) => (
                        <span
                          key={lbl.id}
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-white shadow-xs"
                          style={{ backgroundColor: lbl.color }}
                        >
                          {lbl.name}
                        </span>
                      ))}
                    </div>
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
export const ContactsCrmPanel: React.FC<ContactsCrmPanelProps> = ({
  onClose,
  onOpenChat,
  onOpenMobileMenu,
}) => {
  const { contacts, crmStages, setContactStage, crmStageList, labels, getContactLabelIds } =
    useWhatsApp()
  const [view, setView] = useState<'contacts' | 'pipeline'>('contacts')
  const [search, setSearch] = useState('')
  const [selectedStages, setSelectedStages] = useState<CrmStageId[]>([])
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null)
  const [aboutFilter, setAboutFilter] = useState<AboutFilter>('all')
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<CrmStageId | null>(null)
  const { toast } = useToast()
  const isMobile = useIsMobile()

  const stageOf = (contactId: string): CrmStageId => crmStages[contactId] || crmStageList[0].id
  const stageLabelOf = (stage: CrmStageId) => getStageLabelIn(crmStageList, stage)
  const stageDotOf = (stage: CrmStageId) => findStage(crmStageList, stage).dot

  const handleToggleStage = (stageId: CrmStageId) => {
    setSelectedStages((prev) =>
      prev.includes(stageId) ? prev.filter((id) => id !== stageId) : [...prev, stageId],
    )
  }

  const handleClearFilters = () => {
    setSearch('')
    setSelectedStages([])
    setSelectedLabelId(null)
    setAboutFilter('all')
  }

  const hasActiveFilters = Boolean(
    search.trim() || selectedStages.length > 0 || selectedLabelId !== null || aboutFilter !== 'all',
  )

  const filteredContacts = useMemo(() => {
    const term = normalizeText(search.trim())
    const digitsTerm = search.replace(/\D/g, '')

    return contacts.filter((c) => {
      // 1. Filtro de texto (nome ou telefone normalizado sem acento; dígitos do telefone)
      if (term) {
        const normName = normalizeText(c.name)
        const normPhone = normalizeText(c.phone)
        const digitsPhone = c.phone.replace(/\D/g, '')

        const matchName = normName.includes(term)
        const matchPhone = normPhone.includes(term)
        const matchDigits = digitsTerm.length > 0 && digitsPhone.includes(digitsTerm)

        if (!matchName && !matchPhone && !matchDigits) {
          return false
        }
      }

      // 2. Filtro de Estágio do CRM (multi-seleção)
      if (selectedStages.length > 0) {
        const contactStage = stageOf(c.id)
        if (!selectedStages.includes(contactStage)) {
          return false
        }
      }

      // 3. Filtro de Etiqueta (tag)
      if (selectedLabelId !== null) {
        const contactLabelIds = getContactLabelIds(c.id)
        if (!contactLabelIds.includes(selectedLabelId)) {
          return false
        }
      }

      // 4. Filtro de Recado (ter / não ter)
      if (aboutFilter === 'with-about') {
        if (!c.about || !c.about.trim()) return false
      } else if (aboutFilter === 'without-about') {
        if (c.about && c.about.trim().length > 0) return false
      }

      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    contacts,
    search,
    selectedStages,
    selectedLabelId,
    aboutFilter,
    crmStages,
    crmStageList,
    getContactLabelIds,
  ])

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

  const contactsList = (
    <ContactsList
      contacts={filteredContacts}
      search={search}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={handleClearFilters}
      stageOf={stageOf}
      stageLabelOf={stageLabelOf}
      stageDotOf={stageDotOf}
      getContactLabelIds={getContactLabelIds}
      labels={labels}
      onSelectContact={setSelectedContact}
      onOpenChat={onOpenChat}
      className="flex-1"
    />
  )

  const filtersBar = (
    <ContactFiltersBar
      selectedStages={selectedStages}
      onToggleStage={handleToggleStage}
      selectedLabelId={selectedLabelId}
      onSelectLabel={setSelectedLabelId}
      availableLabels={labels}
      aboutFilter={aboutFilter}
      onSetAboutFilter={setAboutFilter}
      onClearFilters={handleClearFilters}
      hasActiveFilters={hasActiveFilters}
      totalCount={contacts.length}
      filteredCount={filteredContacts.length}
      stageList={crmStageList}
    />
  )

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full bg-[#111b21] border-r border-[#222d34] text-slate-100 z-30 min-w-0">
      {/* Cabeçalho (mobile: ocupa a tela toda; desktop: só a metade esquerda) */}
      <div className="md:hidden h-16 px-4 wa-header-sidebar flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="wa-header-btn rounded-full -ml-2"
            title="Voltar para as conversas"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h2 className="text-base font-semibold leading-tight wa-header-title">
              Contatos e CRM
            </h2>
            <p className="text-[11px] wa-header-subtitle leading-tight">
              {contacts.length} contatos • {contacts.length} negócios
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsAddOpen(true)}
            className="wa-header-btn rounded-full"
            title="Adicionar novo contato"
          >
            <UserPlus className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Mobile: ABAS NO TOPO (logo abaixo do cabeçalho, sticky) + busca e filtros touch-friendly */}
      {isMobile && (
        <div className="flex flex-col shrink-0 sticky top-0 z-20 bg-[#111b21] shadow-sm">
          {/* Abas no topo da página */}
          <div className="px-3 pt-2 pb-2 bg-[#111b21] border-b border-[#222d34]">
            <div className="flex bg-[#202c33] rounded-xl p-1 shadow-inner border border-[#2a3942]">
              <button
                type="button"
                onClick={() => setView('contacts')}
                className={cn(
                  'flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-semibold transition-all active:scale-95',
                  view === 'contacts'
                    ? 'bg-[#00a884] text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200',
                )}
              >
                <Users className="w-4 h-4" />
                <span>Contatos ({filteredContacts.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setView('pipeline')}
                className={cn(
                  'flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-semibold transition-all active:scale-95',
                  view === 'pipeline'
                    ? 'bg-[#00a884] text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200',
                )}
              >
                <span>Pipeline ({filteredContacts.length})</span>
              </button>
            </div>
          </div>

          {/* Campo de busca e filtros aparecem SOMENTE na aba Contatos no mobile */}
          {view === 'contacts' && (
            <>
              {/* Campo de busca integrado */}
              <div className="p-3 bg-[#111b21] border-b border-[#222d34] shrink-0">
                <div className="relative flex items-center">
                  <Search className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" />
                  <Input
                    placeholder="Pesquisar contatos por nome ou telefone..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 pr-8 bg-[#202c33] border border-[#2a3942] text-white placeholder-slate-400 h-10 text-xs sm:text-sm focus-visible:ring-1 focus-visible:ring-[#00a884] rounded-lg"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="absolute right-2.5 text-slate-400 hover:text-white"
                      title="Limpar busca"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Filtros compactos touch-friendly */}
              {filtersBar}
            </>
          )}
        </div>
      )}

      {/* Mobile: mostra só a visão ativa */}
      {isMobile && view === 'contacts' && (
        <div className="flex-1 min-h-0 flex flex-col">{contactsList}</div>
      )}

      {/* Mobile: pipeline em tela cheia */}
      {isMobile && view === 'pipeline' && (
        <div className="flex-1 min-h-0 flex flex-col">
          {hasActiveFilters && (
            <div className="px-3 py-1.5 bg-[#182229] border-b border-[#222d34] flex items-center justify-between text-xs shrink-0">
              <span className="text-slate-400 text-[11px]">
                Filtros ativos: <strong className="text-white">{filteredContacts.length}</strong>{' '}
                contatos
              </span>
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs text-[#00a884] hover:text-[#25d366] font-medium"
              >
                Limpar filtros
              </button>
            </div>
          )}
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

      {/* Desktop: coluna esquerda fixa = lista de contatos (420px a 460px) */}
      {!isMobile && (
        <div className="w-[380px] lg:w-[420px] xl:w-[460px] flex flex-col h-full border-r border-[#222d34] shrink-0">
          {/* Cabeçalho da metade esquerda */}
          <div className="h-16 px-4 wa-header-sidebar flex items-center space-x-3 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="wa-header-btn rounded-full -ml-2"
              title="Voltar para as conversas"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0">
              <h2 className="text-base font-semibold leading-tight wa-header-title">Contatos</h2>
              <p className="text-[11px] wa-header-subtitle leading-tight">
                {contacts.length} contatos
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsAddOpen(true)}
              className="ml-auto wa-header-btn rounded-full"
              title="Adicionar novo contato"
            >
              <UserPlus className="w-5 h-5" />
            </Button>
          </div>

          {/* Busca por texto e número */}
          <div className="p-3 bg-[#111b21] border-b border-[#222d34] shrink-0">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Pesquisar nome, 'joao' ou telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-[#202c33] border-none text-white placeholder-slate-400 h-9 text-xs sm:text-sm focus-visible:ring-1 focus-visible:ring-[#00a884]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Barra de Filtros Avançados: estágios, recado, contador X de Y e limpar tudo */}
          {filtersBar}

          {contactsList}
        </div>
      )}

      {/* Desktop: área direita = pipeline kanban ocupando todo o espaço restante */}
      {!isMobile && (
        <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
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

      {/* Modal de novo contato com campo de telefone editável */}
      <NewContactDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        onContactCreated={(created) => setSelectedContact(created)}
      />
    </div>
  )
}
