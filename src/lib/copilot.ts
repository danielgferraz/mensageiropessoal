import { apiFetch } from '@/lib/api'

export interface CopilotConfig {
  enabled: boolean
  paused: boolean
  mode: 'suggestion' | 'automatic'
  allowedContactIds: string[]
  allowedLabelIds: string[]
  blockedTopics: string[]
  handoffKeywords: string[]
  allowedLinkHosts: string[]
  maxPerHourPerContact: number
  maxPerDay: number
  businessHours: { enabled: boolean; start: string; end: string; utcOffsetMinutes: number }
  ragEnabled: boolean
  ragFolders: string[]
  updatedAt: string | null
  updatedBy: string | null
}

export interface CopilotStatus {
  config: CopilotConfig
  automaticAllowed: boolean
  rag: { configured: boolean; available: boolean; documents: string[]; skipped: { path: string; reason: string }[] }
}

export interface CopilotAuditEntry { ts: string; action: string; code?: string; reason?: string; contactId?: string; user?: string }

export interface CopilotDraft {
  draft: string | null
  blocked: boolean
  code: string
  reason: string
  sources: { source: string; title: string; version?: string }[]
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(`/mensageiro/api/copilot${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    signal: AbortSignal.timeout(100000),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(res.status === 401 ? 'Sessão expirada. Entre novamente no TechAgenda.'
    : res.status === 403 ? 'Acesso restrito a administradores.' : data?.error || 'Não foi possível falar com o atendente.')
  return data as T
}

export const getCopilotStatus = () => call<CopilotStatus>('/config')
export const saveCopilotConfig = (patch: Partial<CopilotConfig>) => call<{ config: CopilotConfig }>('/config', { method: 'PUT', body: JSON.stringify(patch) })
export const getCopilotAudit = () => call<{ entries: CopilotAuditEntry[] }>('/audit')
export const requestCopilotDraft = (body: {
  contactId: string; isSaved: boolean; isGroup: boolean; labelIds: string[]; contactPhone?: string
  messages: { fromMe: boolean; text: string }[]
}) => call<CopilotDraft>('/suggest', { method: 'POST', body: JSON.stringify(body) })
