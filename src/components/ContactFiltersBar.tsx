import React from 'react'
import { Filter, X, RotateCcw, Check, Sparkles } from 'lucide-react'
import { CrmStageConfig } from '@/data/crmData'
import { CrmStageId } from '@/types/whatsapp'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export type AboutFilter = 'all' | 'with-about' | 'without-about'

interface ContactFiltersBarProps {
  selectedStages: CrmStageId[]
  onToggleStage: (stageId: CrmStageId) => void
  aboutFilter: AboutFilter
  onSetAboutFilter: (filter: AboutFilter) => void
  onClearFilters: () => void
  hasActiveFilters: boolean
  totalCount: number
  filteredCount: number
  stageList: CrmStageConfig[]
  compact?: boolean
}

export const ContactFiltersBar: React.FC<ContactFiltersBarProps> = ({
  selectedStages,
  onToggleStage,
  aboutFilter,
  onSetAboutFilter,
  onClearFilters,
  hasActiveFilters,
  totalCount,
  filteredCount,
  stageList,
  compact = false,
}) => {
  return (
    <div className="px-3 py-2 bg-[#182229]/60 border-b border-[#222d34] flex flex-col gap-2 shrink-0">
      {/* Linha superior: contador "X de Y contatos" + botão Limpar */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center space-x-1.5 text-slate-300">
          <span className="font-semibold text-white">
            {filteredCount} de {totalCount} contatos
          </span>
          {hasActiveFilters && (
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/30">
              filtrados
            </span>
          )}
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="flex items-center space-x-1 text-[11px] text-[#00a884] hover:text-[#25d366] transition-colors font-medium px-2 py-0.5 rounded hover:bg-[#202c33]"
            title="Limpar todos os filtros e busca"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Limpar filtros</span>
          </button>
        )}
      </div>

      {/* Linha de filtros: seletor de estágios multi-seleção + filtro de recado */}
      <div className="flex items-center flex-wrap gap-1.5">
        {/* Dropdown de Estágios do CRM */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors',
                selectedStages.length > 0
                  ? 'bg-[#2a3942] border-[#00a884] text-white'
                  : 'bg-[#202c33] border-[#2a3942] text-slate-300 hover:text-white hover:border-[#374248]',
              )}
            >
              <Filter className="w-3 h-3 text-[#00a884]" />
              <span>
                {selectedStages.length === 0
                  ? 'Todos os estágios'
                  : `${selectedStages.length} estágio${selectedStages.length > 1 ? 's' : ''}`}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="bg-[#233138] border-[#2a3942] text-slate-200 w-56"
          >
            <DropdownMenuLabel className="text-xs text-slate-400 flex items-center justify-between">
              <span>Filtrar por estágio (CRM)</span>
              {selectedStages.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    selectedStages.forEach((s) => onToggleStage(s))
                  }}
                  className="text-[10px] text-[#00a884] hover:underline"
                >
                  Desmarcar
                </button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[#2a3942]" />
            {stageList.map((stage) => {
              const isSelected = selectedStages.includes(stage.id)
              return (
                <DropdownMenuItem
                  key={stage.id}
                  onClick={(e) => {
                    e.preventDefault()
                    onToggleStage(stage.id)
                  }}
                  className="cursor-pointer hover:bg-[#182229] flex items-center justify-between text-xs"
                >
                  <div className="flex items-center space-x-2 truncate">
                    <span className={cn('w-2 h-2 rounded-full shrink-0', stage.dot)} />
                    <span className="truncate">{stage.label}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#00a884] shrink-0 ml-2" />}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Alternador de Recado: Todos / Com recado / Sem recado */}
        <div className="flex bg-[#202c33] rounded-md p-0.5 border border-[#2a3942]">
          <button
            type="button"
            onClick={() => onSetAboutFilter('all')}
            className={cn(
              'px-2 py-0.5 rounded text-[11px] font-medium transition-colors',
              aboutFilter === 'all'
                ? 'bg-[#2a3942] text-white'
                : 'text-slate-400 hover:text-slate-200',
            )}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => onSetAboutFilter('with-about')}
            className={cn(
              'px-2 py-0.5 rounded text-[11px] font-medium transition-colors',
              aboutFilter === 'with-about'
                ? 'bg-[#00a884]/20 text-emerald-300 font-semibold'
                : 'text-slate-400 hover:text-slate-200',
            )}
            title="Apenas contatos com recado cadastrado"
          >
            Com recado
          </button>
          <button
            type="button"
            onClick={() => onSetAboutFilter('without-about')}
            className={cn(
              'px-2 py-0.5 rounded text-[11px] font-medium transition-colors',
              aboutFilter === 'without-about'
                ? 'bg-[#00a884]/20 text-emerald-300 font-semibold'
                : 'text-slate-400 hover:text-slate-200',
            )}
            title="Apenas contatos sem recado"
          >
            Sem recado
          </button>
        </div>
      </div>

      {/* Badges de estágios selecionados para remoção rápida */}
      {selectedStages.length > 0 && !compact && (
        <div className="flex items-center flex-wrap gap-1 pt-0.5">
          {selectedStages.map((stageId) => {
            const stageConfig = stageList.find((s) => s.id === stageId)
            if (!stageConfig) return null
            return (
              <span
                key={stageId}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#202c33] text-slate-200 border border-[#2a3942] gap-1"
              >
                <span className={cn('w-1.5 h-1.5 rounded-full', stageConfig.dot)} />
                <span className="truncate max-w-[100px]">{stageConfig.label}</span>
                <button
                  type="button"
                  onClick={() => onToggleStage(stageId)}
                  className="text-slate-400 hover:text-white"
                  title={`Remover filtro de ${stageConfig.label}`}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
