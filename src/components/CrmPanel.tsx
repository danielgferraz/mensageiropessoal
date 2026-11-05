import React, { useMemo, useState } from 'react'
import {
  ArrowLeft,
  KanbanSquare,
  Search,
  MoreVertical,
  MessageCircle,
  Inbox,
  Check,
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

interface CrmPanelProps {
  onBack: () => void
  onOpenChat: (contactId: string) => void
}

export const CrmPanel: React.FC<CrmPanelProps> = ({ onBack, onOpenChat }) => {
  const { contacts, crmStages, setContactStage } = useWhatsApp()
  const [search, setSearch] = useState('')
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
        className={`rounded-lg bg-[#2a3942] border border-[#374248] p-2.5 cursor-grab active:cursor-grabbing hover:border-[#00a884]/60 transition-all ${
          isDragging ? 'opacity-40' : ''
        }`}
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
            onClick={() => onOpenChat(contact.id)}
            className="text-slate-400 hover:text-[#00a884] transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-1 min-w-0 flex-col bg-[#111b21] text-slate-100">
      {/* Cabeçalho */}
      <div className="h-16 px-4 bg-[#202c33] flex items-center space-x-3 border-b border-[#2a3942] shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="text-slate-300 hover:text-white -ml-2"
          title="Voltar para as conversas"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <KanbanSquare className="w-5 h-5 text-[#00a884] shrink-0" />
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-tight">CRM</h2>
          <p className="text-[11px] text-slate-400 leading-tight">
            Pipeline de clientes • {contacts.length} negócios
          </p>
        </div>

        <div className="ml-auto relative hidden sm:flex items-center w-64">
          <Search className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Buscar negócio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-[#2a3942] border-none text-white placeholder-slate-400 h-9 text-xs sm:text-sm focus-visible:ring-1 focus-visible:ring-[#00a884]"
          />
        </div>
      </div>

      {/* Busca no celular */}
      <div className="sm:hidden p-3 border-b border-[#222d34]">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Buscar negócio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-[#2a3942] border-none text-white placeholder-slate-400 h-9 text-sm"
          />
        </div>
      </div>

      {/* Quadro de estágios (kanban) */}
      <div className="flex-1 min-h-0 flex gap-3 p-4 overflow-x-auto bg-[#0b141a]">
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
              className={`flex flex-col w-[250px] shrink-0 rounded-xl border transition-colors ${
                isOver ? 'border-[#00a884] bg-[#111b21]' : 'border-[#2a3942] bg-[#202c33]'
              }`}
            >
              {/* Cabeçalho da coluna */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#2a3942] shrink-0">
                <div className="flex items-center space-x-2 min-w-0">
                  <span className={`w-2.5 h-2.5 rounded-full ${stage.dot} shrink-0`} />
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

      {/* Dica de uso */}
      <div className="px-4 py-2 border-t border-[#222d34] bg-[#111b21] shrink-0 flex items-center text-[11px] text-slate-500">
        <Check className="w-3.5 h-3.5 text-[#00a884] mr-1.5 shrink-0" />
        Arraste os cards entre os estágios ou use o menu do card para mover. Os dados são de
        exemplo, salvos apenas neste navegador.
      </div>
    </div>
  )
}
