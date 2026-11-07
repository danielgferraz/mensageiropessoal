import { apiFetch } from '@/lib/api'

export type AntigravityAction = 'chat' | 'summarize' | 'note' | 'crm_stage'

export interface AntigravityContextInfo {
  messages: number
  notes: number
  stage: string | null
  ai: 'suggestion' | 'human' | 'off' | 'n/a'
}
export type AntigravityProposal =
  | { type: 'note'; text: string }
  | { type: 'crm_stage'; stage: string; reason: string }

export interface AntigravityReply {
  success: boolean
  response: string
  proposal?: AntigravityProposal
  context?: AntigravityContextInfo
}

export interface AntigravityRequest {
  action?: AntigravityAction
  message?: string
  jid?: string
  aliases?: string[]
  instanceName?: string | null
  contactName?: string
  stages?: string[]
}

export class AntigravityError extends Error {
  code?: string
  constructor(message: string, code?: string) { super(message); this.code = code }
}

/** Pergunta ao Antigravity. O servidor monta o contexto da conversa; nada é gravado nem enviado por aqui. */
export async function askAntigravity(body: AntigravityRequest): Promise<AntigravityReply> {
  const res = await apiFetch('/mensageiro/api/antigravity/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, instanceName: body.instanceName || undefined }),
    signal: AbortSignal.timeout(110000),
    cache: 'no-store',
  }).catch((e: unknown) => {
    throw new AntigravityError(e instanceof DOMException && e.name === 'TimeoutError'
      ? 'O Antigravity demorou demais para responder. Tente de novo.' : 'Sem conexão com o servidor. Confira a internet e tente de novo.')
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new AntigravityError(res.status === 401 ? 'Sessão expirada. Entre novamente no TechAgenda.'
      : res.status === 403 ? 'Acesso restrito a administradores.'
      : typeof data?.error === 'string' ? data.error : 'Não foi possível falar com o Antigravity agora.', data?.code)
  }
  return data as AntigravityReply
}

/** Estado exibido no painel: sugestão x assumida por humano x IA desligada. */
export type AiBadge = 'suggestion' | 'human' | 'off' | 'group' | 'none' | 'loading' | 'unavailable'
export const AI_BADGE_LABEL: Record<AiBadge, string> = {
  suggestion: 'Sugestão · você aprova cada envio',
  human: 'Assumida por humano · IA pausada',
  off: 'IA desligada nesta conversa',
  group: 'Grupo · sem sugestões da IA',
  none: 'Nenhuma conversa escolhida',
  loading: 'Verificando a IA da conversa…',
  unavailable: 'Estado da IA indisponível',
}
