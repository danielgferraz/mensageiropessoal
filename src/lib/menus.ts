import { apiFetch } from '@/lib/api'

export type ActionType = 'reply' | 'ask' | 'crm' | 'note' | 'handoff' | 'goto'
export type RenderMode = 'native' | 'text'

export interface MenuAction {
  type: ActionType
  text?: string                   // reply, note
  field?: string                  // ask
  prompt?: string                 // ask
  validate?: 'text' | 'email'     // ask
  stage?: string | null           // crm
  note?: string | null            // crm
  message?: string | null         // handoff
  menu_id?: number                // goto
}
export interface MenuItem { id?: number | null; position?: number; label: string; aliases: string[]; actions: MenuAction[]; active: boolean }
export interface Menu {
  id: number; name: string; description: string; footer: string | null; render_mode: RenderMode; active: boolean
  item_count?: number; items: MenuItem[]
}
export interface MenuDraft { name: string; description: string; footer: string; render_mode: RenderMode; active: boolean }
export interface MenuPreview {
  valid: boolean; errors: string[]; warnings: string[]; text: string
  native: { kind: 'buttons' | 'list'; body: { buttons?: { displayText: string; id: string }[]; sections?: { rows: { title: string }[] }[]; buttonText?: string; title: string; description: string } }
}
export interface MenuSession { jid: string; menu_id: number; menu_name: string | null; awaiting: 'choice' | 'field'; mode_used: RenderMode; expires_at: string }
export interface MenuSendResult { modeUsed: RenderMode; modeRequested: RenderMode; fallback: boolean; reason: string | null; expiresAt: string; nativeUnconfirmed: boolean }
export interface MenuCapabilities { available: boolean; enabled: boolean; native: { enabled: boolean; warning: string }; limits: { items: number; nativeButtons: number; nativeLabel: number } }

export class MenusUnavailableError extends Error {}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(`/mensageiro/api${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers }, signal: AbortSignal.timeout(30000), cache: 'no-store' })
  const data = await res.json().catch(() => ({}))
  if (res.status === 503 && data?.code === 'menus_unavailable') throw new MenusUnavailableError(data.error)
  if (!res.ok) throw new Error(res.status === 401 ? 'Sessão expirada. Entre novamente no TechAgenda.' : res.status === 403 ? 'Acesso restrito a administradores.' : data?.error || 'Não foi possível falar com o servidor.')
  return data as T
}
const body = (value: unknown) => JSON.stringify(value)

export const getMenuCapabilities = () => call<MenuCapabilities>('/menus/capabilities')
export const listMenus = () => call<{ menus: Menu[] }>('/menus')
export const getMenu = (id: number) => call<{ menu: Menu }>(`/menus/${id}`)
export const createMenu = (draft: MenuDraft) => call<{ menu: Menu; warnings: string[] }>('/menus', { method: 'POST', body: body(draft) })
export const updateMenu = (id: number, draft: MenuDraft) => call<{ menu: Menu; warnings: string[] }>(`/menus/${id}`, { method: 'PUT', body: body(draft) })
export const deleteMenu = (id: number) => call<unknown>(`/menus/${id}`, { method: 'DELETE' })
export const saveMenuItems = (id: number, items: MenuItem[]) => call<{ items: MenuItem[]; warnings: string[] }>(`/menus/${id}/items`, { method: 'PUT', body: body({ items }) })
export const previewMenu = (menu: Partial<MenuDraft> & { id?: number }, items: MenuItem[]) => call<MenuPreview>('/menus/preview', { method: 'POST', body: body({ menu, items }) })
export const sendMenu = (id: number, jid: string, instance: string, mode?: RenderMode) => call<MenuSendResult>(`/menus/${id}/send`, { method: 'POST', body: body({ jid, instance, mode }) })
export const getMenuSession = (jid: string) => call<{ session: MenuSession | null }>(`/menu-sessions?jid=${encodeURIComponent(jid)}`)
export const endMenuSession = (jid: string) => call<{ ended: boolean }>(`/menu-sessions?jid=${encodeURIComponent(jid)}`, { method: 'DELETE' })

export const FIELD_OPTIONS: { value: string; label: string }[] = [
  { value: 'name', label: 'Nome' }, { value: 'email', label: 'E-mail' }, { value: 'city', label: 'Cidade' }, { value: 'service', label: 'Tipo de serviço' },
]
export const ACTION_LABELS: Record<ActionType, string> = {
  reply: 'Responder com texto', ask: 'Pedir um dado', crm: 'Mover no CRM / criar nota', note: 'Criar nota interna', handoff: 'Chamar o Daniel (assumir)', goto: 'Ir para outro menu',
}
export const newAction = (type: ActionType): MenuAction => {
  switch (type) {
    case 'reply': return { type, text: '' }
    case 'ask': return { type, field: 'name', prompt: '', validate: 'text' }
    case 'crm': return { type, stage: '', note: '' }
    case 'note': return { type, text: '' }
    case 'handoff': return { type, message: '' }
    default: return { type }
  }
}
/** O que acontece quando o contato escolhe um botão (usado na simulação; nada é enviado). */
export function describeAction(a: MenuAction, menus: Menu[]): string {
  switch (a.type) {
    case 'reply': return `Responde: “${a.text || '…'}”`
    case 'ask': return `Pergunta: “${a.prompt || '…'}” e guarda como ${FIELD_OPTIONS.find((f) => f.value === a.field)?.label.toLowerCase() || a.field}`
    case 'crm': return `${a.stage ? `Move para “${a.stage}”` : ''}${a.stage && a.note ? ' e ' : ''}${a.note ? 'cria uma nota interna' : ''}`
    case 'note': return 'Cria uma nota interna'
    case 'handoff': return `Assume a conversa${a.message ? ` e avisa: “${a.message}”` : ''}`
    case 'goto': return `Envia o menu “${menus.find((m) => m.id === a.menu_id)?.name || '…'}”`
  }
}
