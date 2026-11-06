import { apiFetch } from '@/lib/api'

export type Actor = 'ia' | 'humano'

export interface ConversationState {
  jid: string
  aiEnabled: boolean
  mode: 'suggestion' | 'human'
  takenOverAt: string | null
  lastAiReplyAt: string | null
  lastHumanReplyAt: string | null
  updatedAt: string | null
}
export interface ServerNote { id: string; jid: string; author: Actor; text: string; createdAt: string }
export interface AiSuggestion {
  id: string; jid: string; kind: 'reply' | 'crm_stage'; status: 'pending' | 'accepted' | 'dismissed'; createdAt: string
  payload: { draft?: string; stage?: string; reason?: string | null; currentStage?: string | null; manualStage?: boolean }
}
export interface ConversationSnapshot {
  conversation: ConversationState
  crm: { jid: string; stage: string | null; updatedBy: Actor; updatedAt: string } | null
  notes: ServerNote[]
  suggestions: AiSuggestion[]
  authorship: Record<string, Actor>
}

export class StateUnavailableError extends Error {}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(`/mensageiro/api/state${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 503) throw new StateUnavailableError(data?.error || 'Banco do Mensageiro indisponível.')
  if (!res.ok) throw new Error(res.status === 401 ? 'Sessão expirada. Entre novamente no TechAgenda.'
    : res.status === 403 ? 'Acesso restrito a administradores.' : data?.error || 'Falha ao falar com o servidor.')
  return data as T
}

const j = (jid: string) => encodeURIComponent(jid)

export const getConversationSnapshot = (jid: string) => call<ConversationSnapshot>(`/conversations/${j(jid)}`)
export const updateConversationState = (jid: string, patch: { aiEnabled?: boolean; mode?: 'suggestion' | 'human' }) =>
  call<{ conversation: ConversationState }>(`/conversations/${j(jid)}`, { method: 'PUT', body: JSON.stringify(patch) })
export const resolveSuggestion = (id: string, decision: 'accept' | 'dismiss') =>
  call<{ suggestion: AiSuggestion; crm: ConversationSnapshot['crm'] }>(`/suggestions/${id}/${decision}`, { method: 'POST' })
