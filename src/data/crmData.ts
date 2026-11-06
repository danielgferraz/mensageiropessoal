import { CrmStageId } from '@/types/whatsapp'

export interface CrmStageConfig {
  id: CrmStageId
  label: string
  dot: string
  accent: string
}

// Estágios padrão do pipeline (o usuário pode criar, renomear, reordenar e excluir)
export const DEFAULT_CRM_STAGE_LIST: CrmStageConfig[] = [
  { id: 'novo', label: 'Novo', dot: 'bg-sky-400', accent: 'text-sky-400' },
  { id: 'em-contato', label: 'Em contato', dot: 'bg-amber-400', accent: 'text-amber-400' },
  { id: 'em-negociacao', label: 'Em negociação', dot: 'bg-violet-400', accent: 'text-violet-400' },
  { id: 'fechado', label: 'Fechado', dot: 'bg-emerald-400', accent: 'text-emerald-400' },
]

// Alias de compatibilidade com o restante do app
export const CRM_STAGES = DEFAULT_CRM_STAGE_LIST

// Paleta de cores disponível para os pontos dos estágios criados pelo usuário
export const CRM_STAGE_COLORS: { dot: string; accent: string; label: string }[] = [
  { dot: 'bg-sky-400', accent: 'text-sky-400', label: 'Azul' },
  { dot: 'bg-amber-400', accent: 'text-amber-400', label: 'Âmbar' },
  { dot: 'bg-violet-400', accent: 'text-violet-400', label: 'Violeta' },
  { dot: 'bg-emerald-400', accent: 'text-emerald-400', label: 'Verde' },
  { dot: 'bg-rose-400', accent: 'text-rose-400', label: 'Rosa' },
  { dot: 'bg-cyan-400', accent: 'text-cyan-400', label: 'Ciano' },
  { dot: 'bg-orange-400', accent: 'text-orange-400', label: 'Laranja' },
  { dot: 'bg-fuchsia-400', accent: 'text-fuchsia-400', label: 'Magenta' },
]

export const DEFAULT_CRM_STAGES: Record<string, CrmStageId> = {}

// Busca a configuração de um estágio em qualquer lista (com fallback seguro)
export const findStage = (
  stages: CrmStageConfig[],
  stage: CrmStageId | undefined,
): CrmStageConfig => {
  const found = stages.find((s) => s.id === stage)
  if (found) return found
  return (
    stages[0] || { id: 'novo', label: stage || 'Novo', dot: 'bg-sky-400', accent: 'text-sky-400' }
  )
}

// Rótulo do estágio em qualquer lista (retorna o próprio id quando não encontrado)
export const getStageLabelIn = (stages: CrmStageConfig[], stage: CrmStageId): string =>
  stages.find((s) => s.id === stage)?.label || stage

// Mantido para usos existentes (lista padrão)
export const getStageLabel = (stage: CrmStageId): string =>
  getStageLabelIn(DEFAULT_CRM_STAGE_LIST, stage)
