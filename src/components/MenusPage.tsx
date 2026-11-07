import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, GripVertical, Menu as MenuIcon, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { useWhatsApp } from '@/context/WhatsAppContext'
import {
  ACTION_LABELS, ActionType, FIELD_OPTIONS, Menu, MenuAction, MenuCapabilities, MenuDraft, MenuItem, MenuPreview, MenusUnavailableError,
  createMenu, deleteMenu, describeAction, getMenu, getMenuCapabilities, listMenus, newAction, previewMenu, saveMenuItems, updateMenu,
} from '@/lib/menus'

type DraftItem = MenuItem & { _key: string }
const uid = () => Math.random().toString(36).slice(2, 9)
const EMPTY: MenuDraft = { name: '', description: '', footer: '', render_mode: 'text', active: true }
const fieldClass = 'mt-1 w-full rounded bg-[#2a3942] px-2 py-1.5 text-sm text-slate-100 outline-none focus-visible:ring-1 focus-visible:ring-[#00a884]'
const blankItem = (): DraftItem => ({ _key: uid(), label: '', aliases: [], actions: [{ type: 'reply', text: '' }], active: true })

export const MenusPage: React.FC<{ onOpenMobileMenu?: () => void }> = ({ onOpenMobileMenu }) => {
  const { crmStageList } = useWhatsApp()
  const { toast } = useToast()
  const [caps, setCaps] = useState<MenuCapabilities | null>(null)
  const [menus, setMenus] = useState<Menu[]>([])
  const [unavailable, setUnavailable] = useState(false)
  const [selected, setSelected] = useState<number | 'new' | null>(null)
  const [draft, setDraft] = useState<MenuDraft>(EMPTY)
  const [items, setItems] = useState<DraftItem[]>([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<MenuPreview | null>(null)
  const [tab, setTab] = useState<'native' | 'text'>('native')
  const [simulated, setSimulated] = useState<number | null>(null)
  const [view, setView] = useState<'list' | 'editor' | 'preview'>('list')
  const dragFrom = useRef<number | null>(null)

  const reload = useCallback(async () => {
    try {
      const [c, l] = await Promise.all([getMenuCapabilities(), listMenus().catch((e) => { if (e instanceof MenusUnavailableError) return null; throw e })])
      setCaps(c)
      if (!l) { setUnavailable(true); return }
      setUnavailable(false); setMenus(l.menus)
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível carregar os menus.') }
  }, [])
  useEffect(() => { void reload() }, [reload])

  const select = async (id: number | 'new') => {
    setError(null); setSimulated(null); setView('editor')
    if (id === 'new') { setSelected('new'); setDraft(EMPTY); setItems([blankItem()]); setDirty(false); return }
    try {
      const { menu } = await getMenu(id)
      setSelected(id)
      setDraft({ name: menu.name, description: menu.description, footer: menu.footer || '', render_mode: menu.render_mode, active: menu.active })
      setItems(menu.items.map((i) => ({ ...i, _key: uid() }))); setDirty(false)
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível abrir o menu.') }
  }

  const stripItems = (list: DraftItem[]): MenuItem[] => list.map(({ _key, ...rest }) => { void _key; return rest })
  // Prévia ao vivo (o servidor valida e renderiza exatamente o que o contato vê)
  useEffect(() => {
    if (selected === null) return
    const timer = setTimeout(() => {
      previewMenu({ ...draft, id: typeof selected === 'number' ? selected : 0 }, stripItems(items)).then(setPreview).catch(() => setPreview(null))
    }, 350)
    return () => clearTimeout(timer)
  }, [draft, items, selected])

  const patchDraft = (p: Partial<MenuDraft>) => { setDraft((d) => ({ ...d, ...p })); setDirty(true) }
  const patchItems = (fn: (list: DraftItem[]) => DraftItem[]) => { setItems(fn); setDirty(true) }
  const patchItem = (i: number, p: Partial<DraftItem>) => patchItems((l) => l.map((it, n) => (n === i ? { ...it, ...p } : it)))
  const moveItem = (from: number, to: number) => patchItems((l) => {
    if (to < 0 || to >= l.length || from === to) return l
    const next = [...l]; const [it] = next.splice(from, 1); next.splice(to, 0, it); return next
  })
  const patchAction = (i: number, a: number, p: Partial<MenuAction>) => patchItem(i, { actions: items[i].actions.map((x, n) => (n === a ? { ...x, ...p } : x)) })
  const moveAction = (i: number, a: number, dir: number) => {
    const list = [...items[i].actions]; const to = a + dir
    if (to < 0 || to >= list.length) return
    const [x] = list.splice(a, 1); list.splice(to, 0, x); patchItem(i, { actions: list })
  }

  const save = async () => {
    setSaving(true); setError(null)
    let id = selected
    try {
      if (selected === 'new') { const r = await createMenu(draft); id = r.menu.id; setSelected(r.menu.id) }
      else if (typeof selected === 'number') await updateMenu(selected, draft)
      const r = await saveMenuItems(id as number, stripItems(items))   // salva a lista inteira, na ordem da tela
      setItems((prev) => prev.map((it, n) => ({ ...it, id: r.items[n]?.id ?? it.id })))
      setDirty(false)
      toast({ title: 'Menu salvo', description: r.warnings[0] || 'Nada foi enviado a ninguém.' })
      await reload()
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar.') } finally { setSaving(false) }
  }
  const remove = async () => {
    if (typeof selected !== 'number' || !window.confirm(`Apagar o menu “${draft.name}”? Sessões em andamento deste menu serão encerradas.`)) return
    try { await deleteMenu(selected); setSelected(null); setView('list'); await reload() } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível apagar.') }
  }

  const otherMenus = useMemo(() => menus.filter((m) => m.id !== selected), [menus, selected])
  const simulate = simulated !== null ? items[simulated] : null
  const activeIdx = items.map((it, n) => (it.active ? n : -1)).filter((n) => n >= 0)
  const nativeUnavailable = caps ? !caps.native.enabled : false

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col bg-[#0b141a] text-slate-100" data-testid="menus-page">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-[#2a3942] bg-[#202c33] px-4">
        {onOpenMobileMenu && <Button type="button" variant="ghost" size="icon" aria-label="Abrir menu lateral" onClick={onOpenMobileMenu} className="md:hidden"><MenuIcon className="h-5 w-5" /></Button>}
        <h2 className="text-base font-medium">Menus e botões</h2>
        <p className="hidden text-xs text-slate-400 sm:block">Você monta o fluxo; ele só sai quando você enviar numa conversa.</p>
        <div className="ml-auto flex gap-1 lg:hidden" role="tablist" aria-label="Seções">
          {(['list', 'editor', 'preview'] as const).map((v) => <Button key={v} type="button" size="sm" variant={view === v ? 'secondary' : 'ghost'} onClick={() => setView(v)} role="tab" aria-selected={view === v}>{v === 'list' ? 'Menus' : v === 'editor' ? 'Editor' : 'Prévia'}</Button>)}
        </div>
      </header>

      {unavailable && <p role="alert" className="shrink-0 bg-amber-950/60 px-4 py-2 text-sm text-amber-100">Os menus ainda não estão habilitados neste servidor (falta aplicar a migração do banco). A prévia do editor funciona, mas não dá para salvar nem enviar.</p>}
      {error && <p role="alert" className="shrink-0 whitespace-pre-wrap bg-red-950/60 px-4 py-2 text-sm text-red-100">{error}</p>}

      <div className="flex min-h-0 flex-1">
        {/* Lista */}
        <aside className={`${view === 'list' ? 'flex' : 'hidden'} w-full shrink-0 flex-col border-r border-[#2a3942] bg-[#111b21] lg:flex lg:w-64`} aria-label="Menus">
          <div className="p-2"><Button type="button" className="w-full bg-[#00a884] text-white hover:bg-[#008f72]" disabled={unavailable} onClick={() => void select('new')}><Plus className="mr-1 h-4 w-4" />Novo menu</Button></div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {menus.length === 0 && !unavailable && <li className="px-3 py-4 text-xs text-slate-400">Nenhum menu ainda. Crie o primeiro e escolha o que cada botão faz.</li>}
            {menus.map((m) => (
              <li key={m.id}><button type="button" onClick={() => void select(m.id)} aria-current={selected === m.id}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-[#202c33] ${selected === m.id ? 'bg-[#202c33]' : ''}`}>
                <span className="block truncate font-medium">{m.name}</span>
                <span className="text-[11px] text-slate-400">{m.item_count ?? 0} botões · {m.render_mode === 'native' ? 'nativo' : 'texto'}{m.active ? '' : ' · desativado'}</span>
              </button></li>
            ))}
          </ul>
        </aside>

        {/* Editor */}
        <main className={`${view === 'editor' ? 'block' : 'hidden'} min-w-0 flex-1 overflow-y-auto p-4 lg:block`} aria-label="Editor do menu">
          {selected === null ? <p className="text-sm text-slate-400">Escolha um menu na lista ou crie um novo.</p> : (
            <div className="mx-auto max-w-2xl space-y-4">
              <section className="space-y-2 rounded-xl border border-[#2a3942] bg-[#111b21] p-3">
                <label className="block text-xs">Nome interno (só você vê)
                  <Input value={draft.name} maxLength={60} onChange={(e) => patchDraft({ name: e.target.value })} aria-label="Nome do menu" className="mt-1 border-[#374248] bg-[#2a3942]" /></label>
                <label className="block text-xs">O que o contato lê primeiro (escreva como numa conversa)
                  <Textarea value={draft.description} maxLength={600} rows={2} onChange={(e) => patchDraft({ description: e.target.value })} aria-label="Texto de abertura" className="mt-1 border-[#374248] bg-[#2a3942]" placeholder="Me conta o que você precisa:" /></label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block text-xs">Como enviar
                    <select value={draft.render_mode} onChange={(e) => patchDraft({ render_mode: e.target.value as MenuDraft['render_mode'] })} aria-label="Modo de envio" className={fieldClass}>
                      <option value="native">Botões do WhatsApp (se falhar, cai para texto numerado)</option>
                      <option value="text">Texto numerado (1, 2, 3...)</option>
                    </select></label>
                  <label className="flex items-end gap-2 pb-1 text-sm"><input type="checkbox" checked={draft.active} onChange={(e) => patchDraft({ active: e.target.checked })} />Menu ativo</label>
                </div>
                {draft.render_mode === 'native' && (
                  <p role="note" className="flex gap-2 rounded bg-amber-950/50 p-2 text-[11px] text-amber-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>{caps?.native.warning || 'Botão nativo pode ser aceito e nunca chegar ao contato.'} {nativeUnavailable && 'O modo nativo está desligado neste servidor: o envio sai como texto numerado.'} Na dúvida, troque para texto numerado com um clique: <button type="button" className="underline" onClick={() => patchDraft({ render_mode: 'text' })}>usar texto numerado</button>.</span></p>
                )}
              </section>

              <section aria-label="Botões" className="space-y-2">
                <h3 className="text-sm font-semibold">Botões (arraste ou use as setas para ordenar)</h3>
                {items.map((it, i) => (
                  <div key={it._key} draggable onDragStart={() => { dragFrom.current = i }} onDragOver={(e) => e.preventDefault()}
                    onDrop={() => { if (dragFrom.current !== null) moveItem(dragFrom.current, i); dragFrom.current = null }}
                    className={`space-y-2 rounded-xl border bg-[#111b21] p-3 ${it.active ? 'border-[#2a3942]' : 'border-[#2a3942] opacity-60'}`} data-testid="menu-item">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-500" aria-hidden />
                      <span className="w-5 text-xs text-slate-400">{i + 1}</span>
                      <Input value={it.label} maxLength={40} onChange={(e) => patchItem(i, { label: e.target.value })} aria-label={`Rótulo do botão ${i + 1}`} placeholder="Ver os serviços" className="h-8 border-[#374248] bg-[#2a3942]" />
                      <Button type="button" size="icon" variant="ghost" aria-label={`Subir botão ${i + 1}`} disabled={i === 0} onClick={() => moveItem(i, i - 1)} className="h-8 w-8"><ArrowUp className="h-4 w-4" /></Button>
                      <Button type="button" size="icon" variant="ghost" aria-label={`Descer botão ${i + 1}`} disabled={i === items.length - 1} onClick={() => moveItem(i, i + 1)} className="h-8 w-8"><ArrowDown className="h-4 w-4" /></Button>
                      <Button type="button" size="icon" variant="ghost" aria-label={`Remover botão ${i + 1}`} onClick={() => patchItems((l) => l.filter((_, n) => n !== i))} className="h-8 w-8 text-red-300"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 pl-7 text-xs">
                      <label>Também vale digitar <Input value={it.aliases.join(', ')} onChange={(e) => patchItem(i, { aliases: e.target.value.split(',').map((a) => a.trim()).filter(Boolean) })} aria-label={`Apelidos do botão ${i + 1}`} placeholder="servicos, serviço" className="mt-1 h-8 w-56 border-[#374248] bg-[#2a3942]" /></label>
                      <label className="flex items-center gap-1"><input type="checkbox" checked={it.active} onChange={(e) => patchItem(i, { active: e.target.checked })} />Ativo</label>
                    </div>
                    <ol className="space-y-2 pl-7">
                      {it.actions.map((a, n) => (
                        <li key={n} className="rounded-lg bg-[#0b141a] p-2 text-xs" data-testid="menu-action">
                          <div className="flex items-center gap-2">
                            <select value={a.type} aria-label={`Ação ${n + 1} do botão ${i + 1}`} onChange={(e) => patchItem(i, { actions: it.actions.map((x, k) => (k === n ? newAction(e.target.value as ActionType) : x)) })} className={`${fieldClass} mt-0 flex-1`}>
                              {(Object.keys(ACTION_LABELS) as ActionType[]).map((t) => <option key={t} value={t}>{ACTION_LABELS[t]}</option>)}
                            </select>
                            <Button type="button" size="icon" variant="ghost" aria-label={`Subir ação ${n + 1}`} disabled={n === 0} onClick={() => moveAction(i, n, -1)} className="h-7 w-7"><ArrowUp className="h-3.5 w-3.5" /></Button>
                            <Button type="button" size="icon" variant="ghost" aria-label={`Descer ação ${n + 1}`} disabled={n === it.actions.length - 1} onClick={() => moveAction(i, n, 1)} className="h-7 w-7"><ArrowDown className="h-3.5 w-3.5" /></Button>
                            <Button type="button" size="icon" variant="ghost" aria-label={`Remover ação ${n + 1}`} disabled={it.actions.length === 1} onClick={() => patchItem(i, { actions: it.actions.filter((_, k) => k !== n) })} className="h-7 w-7 text-red-300"><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                          {a.type === 'reply' && <Textarea value={a.text || ''} rows={2} maxLength={1000} onChange={(e) => patchAction(i, n, { text: e.target.value })} aria-label="Texto da resposta" placeholder="Trabalho com edição de vídeo e roteiros. Quer ver exemplos?" className="mt-2 border-[#374248] bg-[#2a3942]" />}
                          {a.type === 'ask' && <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <label>Guardar como<select value={FIELD_OPTIONS.some((f) => f.value === a.field) ? a.field : 'custom'} onChange={(e) => patchAction(i, n, e.target.value === 'custom' ? { field: 'campo', validate: 'text' } : { field: e.target.value, validate: e.target.value === 'email' ? 'email' : 'text' })} className={fieldClass}>
                              {FIELD_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}<option value="custom">Outro campo…</option></select></label>
                            {!FIELD_OPTIONS.some((f) => f.value === a.field) && <label>Nome do campo (letras minúsculas)<Input value={a.field || ''} onChange={(e) => patchAction(i, n, { field: e.target.value })} className="mt-1 h-8 border-[#374248] bg-[#2a3942]" /></label>}
                            <label className="sm:col-span-2">Pergunta<Input value={a.prompt || ''} maxLength={300} onChange={(e) => patchAction(i, n, { prompt: e.target.value })} aria-label="Pergunta" placeholder="Qual o seu nome?" className="mt-1 h-8 border-[#374248] bg-[#2a3942]" /></label></div>}
                          {a.type === 'crm' && <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <label>Mover para o estágio<select value={a.stage || ''} onChange={(e) => patchAction(i, n, { stage: e.target.value })} className={fieldClass}>
                              <option value="">Não mover</option>{crmStageList.map((s) => <option key={s.id} value={s.label}>{s.label}</option>)}</select></label>
                            <label>Nota interna (opcional; use {'{{resumo}}'} para os dados coletados)<Textarea value={a.note || ''} rows={2} maxLength={500} onChange={(e) => patchAction(i, n, { note: e.target.value })} className="mt-1 border-[#374248] bg-[#2a3942]" /></label></div>}
                          {a.type === 'note' && <Textarea value={a.text || ''} rows={2} maxLength={500} onChange={(e) => patchAction(i, n, { text: e.target.value })} aria-label="Texto da nota" placeholder="Pediu orçamento: {{resumo}}" className="mt-2 border-[#374248] bg-[#2a3942]" />}
                          {a.type === 'handoff' && <label className="mt-2 block">Aviso ao contato (opcional)<Input value={a.message || ''} maxLength={300} onChange={(e) => patchAction(i, n, { message: e.target.value })} placeholder="Já te respondo aqui mesmo." className="mt-1 h-8 border-[#374248] bg-[#2a3942]" /></label>}
                          {a.type === 'goto' && <label className="mt-2 block">Menu de destino<select value={a.menu_id || ''} onChange={(e) => patchAction(i, n, { menu_id: Number(e.target.value) })} className={fieldClass}>
                            <option value="">Escolha…</option>{otherMenus.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>}
                        </li>
                      ))}
                    </ol>
                    {it.actions.length < 6 && <Button type="button" size="sm" variant="ghost" className="ml-7 h-7 text-xs text-[#00a884]" onClick={() => patchItem(i, { actions: [...it.actions, newAction('reply')] })}><Plus className="mr-1 h-3.5 w-3.5" />Adicionar ação</Button>}
                  </div>
                ))}
                <Button type="button" variant="secondary" disabled={items.length >= 10} onClick={() => patchItems((l) => [...l, blankItem()])}><Plus className="mr-1 h-4 w-4" />Adicionar botão</Button>
              </section>

              <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-[#2a3942] bg-[#0b141a] py-3">
                <Button type="button" onClick={() => void save()} disabled={saving || unavailable} className="bg-[#00a884] text-white hover:bg-[#008f72]">{saving ? 'Salvando…' : 'Salvar'}</Button>
                {dirty && <span role="status" className="text-xs text-amber-200">Alterações não salvas</span>}
                {typeof selected === 'number' && <Button type="button" variant="ghost" onClick={() => void remove()} className="ml-auto text-red-300">Apagar menu</Button>}
                <span className="text-[11px] text-slate-500">Para enviar a um contato: abra a conversa e use “Enviar menu…”.</span>
              </div>
            </div>
          )}
        </main>

        {/* Prévia */}
        <aside className={`${view === 'preview' ? 'block' : 'hidden'} w-full shrink-0 overflow-y-auto border-l border-[#2a3942] bg-[#111b21] p-3 lg:block lg:w-80`} aria-label="Pré-visualização">
          <h3 className="mb-2 text-sm font-semibold">Como o contato vê</h3>
          {!preview ? <p className="text-xs text-slate-400">A prévia aparece quando você abre um menu.</p> : (<>
            <div className="mb-2 flex gap-1" role="tablist">
              <Button type="button" size="sm" role="tab" aria-selected={tab === 'native'} variant={tab === 'native' ? 'secondary' : 'ghost'} onClick={() => setTab('native')}>Botões</Button>
              <Button type="button" size="sm" role="tab" aria-selected={tab === 'text'} variant={tab === 'text' ? 'secondary' : 'ghost'} onClick={() => setTab('text')}>Texto numerado</Button>
            </div>
            {tab === 'text' ? (
              <div className="rounded-lg rounded-tl-none bg-[#202c33] p-3 text-sm" data-testid="preview-text"><p className="whitespace-pre-wrap">{preview.text}</p>
                <div className="mt-3 flex flex-wrap gap-1">{items.filter((i) => i.active).map((it, n) => <Button key={it._key} type="button" size="sm" variant="secondary" className="h-7 text-xs" onClick={() => setSimulated(items.indexOf(it))}>{n + 1}</Button>)}</div></div>
            ) : (
              <div className="rounded-lg rounded-tl-none bg-[#202c33] p-3 text-sm" data-testid="preview-native">
                <p className="font-semibold">{preview.native.body.title}</p><p className="text-slate-300">{preview.native.body.description}</p>
                {preview.native.kind === 'buttons'
                  ? <div className="mt-2 space-y-1">{preview.native.body.buttons?.map((b, n) => <button key={b.id} type="button" onClick={() => setSimulated(activeIdx[n] ?? null)} className="block w-full rounded bg-[#2a3942] px-2 py-1.5 text-center text-[#53bdeb] hover:bg-[#374248]">{b.displayText}</button>)}</div>
                  : <div className="mt-2"><p className="rounded bg-[#2a3942] px-2 py-1.5 text-center text-[#53bdeb]">{preview.native.body.buttonText}</p>
                    <ul className="mt-1 space-y-1 text-xs">{preview.native.body.sections?.[0]?.rows.map((r, n) => <li key={n}><button type="button" onClick={() => setSimulated(activeIdx[n] ?? null)} className="w-full rounded bg-[#182229] px-2 py-1 text-left hover:bg-[#2a3942]">{r.title}</button></li>)}</ul></div>}
                {draft.render_mode === 'text' && <p className="mt-2 text-[11px] text-slate-400">Este menu está configurado para sair como texto numerado.</p>}
              </div>
            )}
            {preview.errors.length > 0 && <ul role="alert" className="mt-2 list-disc space-y-1 pl-4 text-xs text-red-300">{preview.errors.map((m) => <li key={m}>{m}</li>)}</ul>}
            {preview.warnings.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-amber-200">{preview.warnings.map((m) => <li key={m}>{m}</li>)}</ul>}
            <div className="mt-3 rounded-lg bg-[#0b141a] p-2 text-xs" aria-live="polite" data-testid="simulation">
              <p className="font-semibold text-slate-200">Simulação (nada é enviado)</p>
              {!simulate ? <p className="text-slate-400">Clique num botão acima para ver o que acontece.</p> : (<>
                <p className="mt-1 text-slate-300">Contato escolheu “{simulate.label || '…'}”:</p>
                <ol className="mt-1 list-decimal space-y-1 pl-4 text-slate-300">{simulate.actions.map((a, n) => <li key={n}>{describeAction(a, menus)}</li>)}</ol></>)}
            </div>
          </>)}
        </aside>
      </div>
    </div>
  )
}
