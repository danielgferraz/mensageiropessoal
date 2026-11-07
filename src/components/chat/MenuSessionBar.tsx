import React, { useCallback, useEffect, useState } from 'react'
import { ListChecks } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MenuSession, endMenuSession, getMenuSession, sendMenu } from '@/lib/menus'

/** Faixa "menu em andamento" da conversa: encerrar ou reenviar como texto (quando o botão nativo não chegou). */
export const MenuSessionBar: React.FC<{ jid: string; instance: string | null; refreshKey?: number }> = ({ jid, instance, refreshKey = 0 }) => {
  const [session, setSession] = useState<MenuSession | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => { getMenuSession(jid).then((r) => setSession(r.session)).catch(() => setSession(null)) }, [jid])
  useEffect(() => {
    setSession(null); load()
    const timer = setInterval(() => { if (!document.hidden) load() }, 7000)
    return () => clearInterval(timer)
  }, [load, refreshKey])
  if (!session) return null
  const act = async (fn: () => Promise<unknown>) => { setBusy(true); setError(null); try { await fn(); load() } catch (e) { setError(e instanceof Error ? e.message : 'Falhou.') } finally { setBusy(false) } }
  const until = new Date(session.expires_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return (
    <div className="shrink-0 border-b border-[#2a3942] bg-[#1b2b31] px-3 py-1.5 text-xs text-slate-200" data-testid="menu-session-bar" aria-label="Menu em andamento">
      <div className="flex flex-wrap items-center gap-2">
        <ListChecks className="h-4 w-4 text-cyan-300" aria-hidden />
        <span>Menu em andamento: <b>{session.menu_name || 'menu'}</b> · {session.mode_used === 'native' ? 'botões do WhatsApp' : 'texto numerado'} · {session.awaiting === 'field' ? 'aguardando um dado do contato' : 'aguardando a escolha'} · vale até {until}</span>
        <div className="ml-auto flex gap-1">
          {session.mode_used === 'native' && instance && <Button type="button" size="sm" variant="ghost" disabled={busy} className="h-7 px-2 text-xs text-amber-200"
            onClick={() => act(() => sendMenu(session.menu_id, jid, instance, 'text'))}>Reenviar como texto</Button>}
          <Button type="button" size="sm" variant="ghost" disabled={busy} className="h-7 px-2 text-xs text-slate-200" onClick={() => act(() => endMenuSession(jid))}>Encerrar menu</Button>
        </div>
      </div>
      {session.mode_used === 'native' && <p className="mt-1 text-[11px] text-amber-200">O botão do WhatsApp pode ser aceito e não chegar. Se o contato disser que não viu, use “Reenviar como texto”.</p>}
      {error && <p role="alert" className="mt-1 text-red-300">{error}</p>}
    </div>
  )
}
