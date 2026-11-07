import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Menu, MenuPreview, MenusUnavailableError, listMenus, getMenu, previewMenu, sendMenu } from '@/lib/menus'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  jid: string
  contactName: string
  instance: string | null
  onSent?: () => void
}

/** Envia um menu numa conversa existente. Sempre manual: nada é enviado até clicar em "Enviar menu". */
export const SendMenuDialog: React.FC<Props> = ({ open, onOpenChange, jid, contactName, instance, onSent }) => {
  const { toast } = useToast()
  const [menus, setMenus] = useState<Menu[]>([])
  const [menuId, setMenuId] = useState<number | ''>('')
  const [mode, setMode] = useState<'native' | 'text'>('native')
  const [preview, setPreview] = useState<MenuPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null); setPreview(null); setMenuId('')
    listMenus().then(({ menus: all }) => setMenus(all.filter((m) => m.active && (m.item_count ?? 0) > 0)))
      .catch((e) => setError(e instanceof MenusUnavailableError ? 'Os menus ainda não estão habilitados neste servidor.' : e instanceof Error ? e.message : 'Não foi possível carregar os menus.'))
  }, [open])

  useEffect(() => {
    if (menuId === '') { setPreview(null); return }
    const chosen = menus.find((m) => m.id === menuId)
    if (chosen) setMode(chosen.render_mode)
    getMenu(menuId).then(({ menu }) => previewMenu({ ...menu, footer: menu.footer || '' }, menu.items)).then(setPreview).catch(() => setPreview(null))
  }, [menuId, menus])

  const send = async () => {
    if (menuId === '' || !instance) return
    setBusy(true); setError(null)
    try {
      const r = await sendMenu(menuId, jid, instance, mode)
      toast({
        title: r.fallback ? 'Enviado como texto numerado' : r.modeUsed === 'native' ? 'Menu enviado como botões' : 'Menu enviado como texto numerado',
        description: r.fallback ? 'O botão do WhatsApp falhou, então mandei o menu em texto (uma vez só).'
          : r.nativeUnconfirmed ? 'O WhatsApp pode aceitar botões e não entregar. Se o contato não receber, use “Reenviar como texto” na faixa da conversa.' : 'O menu fica ativo por 30 minutos ou até você escrever na conversa.',
      })
      onOpenChange(false); onSent?.()
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível enviar o menu.') } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-[#2a3942] bg-[#111b21] text-slate-100">
        <DialogHeader>
          <DialogTitle>Enviar menu para {contactName}</DialogTitle>
          <DialogDescription className="text-slate-400">Só sai quando você clicar em enviar. As respostas do contato (1, 2, 3 ou o botão) disparam as ações que você montou.</DialogDescription>
        </DialogHeader>
        <label className="block text-xs">Menu
          <select value={menuId} onChange={(e) => setMenuId(e.target.value ? Number(e.target.value) : '')} aria-label="Menu a enviar" className="mt-1 w-full rounded bg-[#2a3942] px-2 py-1.5 text-sm text-slate-100">
            <option value="">Escolha…</option>{menus.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.item_count} botões)</option>)}
          </select></label>
        {menuId !== '' && (
          <label className="block text-xs">Como enviar
            <select value={mode} onChange={(e) => setMode(e.target.value as 'native' | 'text')} aria-label="Como enviar" className="mt-1 w-full rounded bg-[#2a3942] px-2 py-1.5 text-sm text-slate-100">
              <option value="native">Botões do WhatsApp (se falhar, texto numerado)</option><option value="text">Texto numerado</option>
            </select></label>
        )}
        {mode === 'native' && menuId !== '' && <p role="note" className="flex gap-2 rounded bg-amber-950/50 p-2 text-[11px] text-amber-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />Botão nativo pode ser aceito e nunca chegar ao contato. Na dúvida, envie como texto numerado.</p>}
        {preview && <div className="max-h-48 overflow-y-auto rounded-lg rounded-tl-none bg-[#202c33] p-3 text-sm" data-testid="send-preview"><p className="whitespace-pre-wrap">{preview.text}</p></div>}
        {!instance && <p role="alert" className="text-xs text-amber-200">Conecte o WhatsApp para enviar.</p>}
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" disabled={busy || menuId === '' || !instance} onClick={() => void send()} className="bg-[#00a884] text-white hover:bg-[#008f72]">{busy ? 'Enviando…' : 'Enviar menu'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
