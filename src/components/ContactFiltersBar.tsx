import React from 'react'
import { RotateCcw, Check } from 'lucide-react'
import { CrmStageConfig } from '@/data/crmData'
import { CrmStageId } from '@/types/whatsapp'
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
    <div className="px-3 py-2 bg-[#182229]/80 border-b border-[#222d34] flex flex-col gap-2 shrink-0">
      {/* Linha superior: contador "X de Y contatos" + botão Limpar */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center space-x-1.5 text-slate-300">
          <span className="font-semibold text-white">
            {filteredCount} de {totalCount} contatos
          </span>
          {hasActiveFilters && (
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/30 font-medium">
              filtrados
            </span>
          )}
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="flex items-center space-x-1 text-xs text-[#00a884] hover:text-[#25d366] transition-colors font-medium px-2 py-1 rounded hover:bg-[#202c33] active:scale-95"
            title="Limpar todos os filtros e busca"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Limpar</span>
          </button>
        )}
      </div>

      {/* Linha de filtros com rolagem horizontal touch-friendly no mobile */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar flex-nowrap sm:flex-wrap">
        {/* Chips rápidos de estágio para toque direto */}
        {stageList.map((stage) => {
          const isSelected = selectedStages.includes(stage.id)
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => onToggleStage(stage.id)}
              className={cn(
                'inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-all shrink-0 active:scale-95',
                isSelected
                  ? 'bg-[#00a884] border-[#00a884] text-white shadow-sm'
                  : 'bg-[#202c33] border-[#2a3942] text-slate-300 hover:text-white hover:border-[#374248]',
              )}
            >
              <span
                className={cn('w-2 h-2 rounded-full shrink-0', stage.dot, isSelected && 'bg-white')}
              />
              <span className="whitespace-nowrap">{stage.label}</span>
              {isSelected && <Check className="w-3 h-3 text-white ml-0.5" />}
            </button>
          )
        })}
      </div>

      {/* Linha secundária de filtro de recado */}
      <div className="flex items-center justify-between gap-1.5 pt-0.5">
        {/* Alternador de Recado: Todos / Com recado / Sem recado */}
        <div className="flex bg-[#202c33] rounded-md p-0.5 border border-[#2a3942] w-full sm:w-auto">
          <button
            type="button"
            onClick={() => onSetAboutFilter('all')}
            className={cn(
              'flex-1 sm:flex-initial px-2.5 py-1 rounded text-xs font-medium transition-colors',
              aboutFilter === 'all'
                ? 'bg-[#2a3942] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200',
            )}
          >
            Todos recados
          </button>
          <button
            type="button"
            onClick={() => onSetAboutFilter('with-about')}
            className={cn(
              'flex-1 sm:flex-initial px-2.5 py-1 rounded text-xs font-medium transition-colors',
              aboutFilter === 'with-about'
                ? 'bg-[#00a884] text-white font-semibold shadow-sm'
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
              'flex-1 sm:flex-initial px-2.5 py-1 rounded text-xs font-medium transition-colors',
              aboutFilter === 'without-about'
                ? 'bg-[#00a884] text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200',
            )}
            title="Apenas contatos sem recado"
          >
            Sem recado
          </button>
        </div>
      </div>
    </div>
  )
}
