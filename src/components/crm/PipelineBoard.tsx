import React, { useState } from 'react'
import { FALLBACK_AVATAR } from '@/lib/evolution'
import {
  MoreVertical,
  MessageCircle,
  Inbox,
  Plus,
  Settings2,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  XCircle,
} from 'lucide-react'
import { Contact, CrmStageId } from '@/types/whatsapp'
import { CrmStageConfig } from '@/data/crmData'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useWhatsApp } from '@/context/WhatsAppContext'
import { StageDialogState, StageDialogs } from './StageDialogs'

interface PipelineBoardProps {
  stageList: CrmStageConfig[]
  /** contatos filtrados, agrupados por estágio */
  dealsByStage: Record<CrmStageId, Contact[]>
  stageOf: (contactId: string) => CrmStageId | null
  moveToStage: (contact: Contact, stage: CrmStageId | null) => void
  onOpenChat: (contactId: string) => void
  onSelectContact: (contact: Contact) => void
  dragId: string | null
  setDragId: (id: string | null) => void
  overStage: CrmStageId | null
  setOverStage: (id: CrmStageId | null) => void
}

// Kanban do pipeline com CRUD de estágios: criar, renomear, reordenar e excluir
export const PipelineBoard: React.FC<PipelineBoardProps> = ({
  stageList,
  dealsByStage,
  stageOf,
  moveToStage,
  onOpenChat,
  onSelectContact,
  dragId,
  setDragId,
  overStage,
  setOverStage,
}) => {
  const { addCrmStage, renameCrmStage, deleteCrmStage, moveCrmStage, labels, getContactLabelIds } =
    useWhatsApp()
  const [dialog, setDialog] = useState<StageDialogState>({ kind: 'none' })

  const handleMove = (contact: Contact, stage: CrmStageId | null) => moveToStage(contact, stage)

  return (
    <div className="relative flex-1 min-h-0 flex flex-col w-full h-full overflow-hidden">
      {/* Botão de gerenciamento dos estágios */}
      <div className="absolute top-3 right-3 z-20">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="Gerenciar estágios do pipeline"
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium wa-header-btn border border-[var(--wa-header-border)] shadow-sm"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span className="font-medium">Estágios</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="bg-[#233138] border-[#2a3942] text-slate-200 w-64"
          >
            <DropdownMenuLabel className="text-xs text-slate-400">
              Estágios do pipeline
            </DropdownMenuLabel>
            {stageList.map((stage, index) => (
              <div
                key={stage.id}
                className="flex items-center px-2 py-1.5 rounded-md hover:bg-[#182229]"
              >
                <span className={cn('w-2 h-2 rounded-full shrink-0 mr-2', stage.dot)} />
                <span className="flex-1 text-xs truncate">{stage.label}</span>
                <div className="flex items-center shrink-0">
                  <button
                    type="button"
                    title="Mover para a esquerda"
                    disabled={index === 0}
                    onClick={() => moveCrmStage(stage.id, -1)}
                    className="p-1 text-slate-400 hover:text-white disabled:opacity-25"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Mover para a direita"
                    disabled={index === stageList.length - 1}
                    onClick={() => moveCrmStage(stage.id, 1)}
                    className="p-1 text-slate-400 hover:text-white disabled:opacity-25"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Renomear estágio"
                    onClick={() => setDialog({ kind: 'rename', stageId: stage.id })}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Excluir estágio"
                    disabled={stageList.length <= 1}
                    onClick={() => setDialog({ kind: 'delete', stageId: stage.id })}
                    className="p-1 text-red-400 hover:text-red-300 disabled:opacity-25"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            <DropdownMenuSeparator className="bg-[#2a3942]" />
            <DropdownMenuItem
              onClick={() => setDialog({ kind: 'create' })}
              className="cursor-pointer hover:bg-[#182229] text-[#00a884] font-medium"
            >
              <Plus className="w-4 h-4 mr-2" />
              Criar novo estágio
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Colunas do kanban (rolagem horizontal por coluna com larguras adaptadas ao toque) */}
      <div className="flex-1 min-h-0 flex gap-2.5 sm:gap-3 p-2.5 sm:p-3 overflow-x-auto bg-[#0b141a] snap-x snap-mandatory sm:snap-none">
        {stageList.map((stage) => {
          const deals = dealsByStage[stage.id] || []
          const isOver = overStage === stage.id

          return (
            <div
              key={stage.id}
              onDragOver={(e) => {
                e.preventDefault()
                setOverStage(stage.id)
              }}
              onDragLeave={() => {
                if (overStage === stage.id) setOverStage(null)
              }}
              onDrop={(e) => {
                e.preventDefault()
                const dropped = dragId
                setDragId(null)
                setOverStage(null)
                if (!dropped) return
                const contact = stageList
                  .flatMap((s) => dealsByStage[s.id] || [])
                  .find((c) => c.id === dropped)
                if (contact && stage.id !== stageOf(contact.id)) handleMove(contact, stage.id)
              }}
              className={cn(
                'flex flex-col w-[82vw] max-w-[300px] sm:w-[240px] md:w-[250px] shrink-0 rounded-xl border transition-colors snap-center',
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
                  deals.map((contact) => {
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
                        onClick={() => onSelectContact(contact)}
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
                            onError={(e) => { const t = e.currentTarget; t.onerror = null; t.src = FALLBACK_AVATAR }}
                          />

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-100 truncate">
                              {contact.name}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">
                              {contact.phone}
                            </p>
                            {(() => {
                              const contactLabelIds = getContactLabelIds(contact.id)
                              const contactLabels = labels.filter((l) =>
                                contactLabelIds.includes(l.id),
                              )
                              if (contactLabels.length === 0) return null
                              return (
                                <div className="flex items-center gap-1 mt-1 flex-wrap">
                                  {contactLabels.map((lbl) => (
                                    <span
                                      key={lbl.id}
                                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium text-white shadow-xs wa-tag-badge"
                                      style={{ backgroundColor: lbl.color }}
                                    >
                                      {lbl.name}
                                    </span>
                                  ))}
                                </div>
                              )
                            })()}
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
                              <DropdownMenuLabel className="text-xs text-slate-400">
                                Mover para
                              </DropdownMenuLabel>
                              {stageList
                                .filter((s) => s.id !== currentStage)
                                .map((s) => (
                                  <DropdownMenuItem
                                    key={s.id}
                                    onClick={() => handleMove(contact, s.id)}
                                    className="cursor-pointer hover:bg-[#182229]"
                                  >
                                    <span className={cn('w-2 h-2 rounded-full mr-2', s.dot)} />
                                    {s.label}
                                  </DropdownMenuItem>
                                ))}
                              <DropdownMenuSeparator className="bg-[#2a3942]" />
                              <DropdownMenuItem
                                onClick={() => handleMove(contact, null)}
                                className="cursor-pointer hover:bg-rose-950/40 text-rose-300 hover:text-rose-200"
                              >
                                <XCircle className="w-4 h-4 mr-2 text-rose-400" />
                                Remover do pipeline
                              </DropdownMenuItem>
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
                            {stageList.find((s) => s.id === currentStage)?.label || currentStage}
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
                  })
                )}
              </div>
            </div>
          )
        })}

        {/* Coluna de atalho para criar estágio */}
        <button
          type="button"
          onClick={() => setDialog({ kind: 'create' })}
          title="Criar novo estágio"
          className="flex flex-col items-center justify-center w-[54px] shrink-0 self-stretch rounded-xl border border-dashed border-[#2a3942] text-slate-500 hover:text-[#00a884] hover:border-[#00a884]/60 transition-colors"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Modais de CRUD de estágios */}
      <StageDialogs
        dialog={dialog}
        onClose={() => setDialog({ kind: 'none' })}
        stageList={stageList}
        addCrmStage={addCrmStage}
        renameCrmStage={renameCrmStage}
        deleteCrmStage={deleteCrmStage}
      />
    </div>
  )
}
