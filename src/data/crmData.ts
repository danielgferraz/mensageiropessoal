import { CrmStageId } from '@/types/whatsapp'

export interface CrmStageConfig {
  id: CrmStageId
  label: string
  dot: string
  accent: string
}

// Estágios do pipeline de negócios do CRM (funciona em memória, sem banco)
export const CRM_STAGES: CrmStageConfig[] = [
  { id: 'novo', label: 'Novo', dot: 'bg-sky-400', accent: 'text-sky-400' },
  { id: 'em-contato', label: 'Em contato', dot: 'bg-amber-400', accent: 'text-amber-400' },
  { id: 'em-negociacao', label: 'Em negociação', dot: 'bg-violet-400', accent: 'text-violet-400' },
  { id: 'fechado', label: 'Fechado', dot: 'bg-emerald-400', accent: 'text-emerald-400' },
]

// Distribuição inicial dos contatos de exemplo no pipeline
export const DEFAULT_CRM_STAGES: Record<string, CrmStageId> = {
  c1: 'em-negociacao',
  c2: 'em-contato',
  c3: 'novo',
  c4: 'novo',
  c5: 'fechado',
  c6: 'em-contato',
}

export const getStageLabel = (stage: CrmStageId): string =>
  CRM_STAGES.find((s) => s.id === stage)?.label || stage
