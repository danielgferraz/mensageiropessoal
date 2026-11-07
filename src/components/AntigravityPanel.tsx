import React, { useEffect, useMemo, useReducer, useState } from 'react'
import { ArrowDown, ArrowLeft, Bot, Check, ClipboardList, FileText, Hourglass, ListChecks, MessageSquareText, Send, Sparkles, X } from 'lucide-react'
import { FALLBACK_AVATAR } from '@/lib/evolution'
import { useWhatsApp } from '@/context/WhatsAppContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useStickToBottom } from '@/hooks/use-stick-to-bottom'
import { unseenLabel } from '@/lib/stick-to-bottom'
import {
  AI_BADGE_LABEL, AiBadge, AntigravityContextInfo, AntigravityProposal, askAntigravity,
} from '@/lib/antigravity'
import { requestCopilotDraft } from '@/lib/copilot'
import { addServerNote, getConversationSnapshot, suggestCrmStage } from '@/lib/conversation-state'

type ProposalState = 'pending' | 'done' | 'dismissed'
type Item =
  | { id: string; kind: 'user'; text: string }
  | { id: string; kind: 'assistant'; text: string; context?: AntigravityContextInfo }
  | { id: string; kind: 'error'; text: string }
  | { id: string; kind: 'proposal'; text: string; jid: string; proposal: AntigravityProposal | { type: 'awaiting' }; state: ProposalState; result?: string }
  | { id: string; kind: 'draft'; text: string; chatId: string; sources: string[]; state: ProposalState }

// Conversas ficam na memória enquanto a página estiver aberta (uma conversa por conversa do WhatsApp)
let threads: Record<string, Item[]> = {}
const GENERAL = '_geral'
const uid = () => crypto.randomUUID()

const BADGE_STYLE: Record<AiBadge, string> = {
  auto: 'bg-[#00a884]/30 text-[#7fe3cb] font-medium',
  suggestion: 'bg-[#00a884]/20 text-[#7fe3cb]',
  human: 'bg-amber-500/20 text-amber-200',
  off: 'bg-slate-600/30 text-slate-300',
  group: 'bg-slate-600/30 text-slate-300',
  none: 'bg-slate-600/30 text-slate-300',
  loading: 'bg-slate-600/30 text-slate-400',
  unavailable: 'bg-red-500/20 text-red-200',
}

export const AntigravityPanel: React.FC<{ onBackMobile?: () => void }> = ({ onBackMobile }) => {
  const { conversations, contacts, instanceName, getContactLabelIds, crmStageList, antigravityTarget, setAntigravityTarget, setActiveChatId } = useWhatsApp()
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  const [busy, setBusy] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [badge, setBadge] = useState<AiBadge>('none')
  const [stateReload, setStateReload] = useState(0)

  const choices = useMemo(() => conversations.filter((c) => c.id !== 'conv-antigravity' && c.id.includes('@'))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 80), [conversations])
  const target = choices.find((c) => c.id === antigravityTarget) || null
  const contact = target && !target.isGroup ? contacts.find((c) => c.id === target.participants?.[0]) : undefined
  // Mesma regra da conversa: o contato salvo, senão o próprio id da conversa
  const jid = target && !target.isGroup ? (contact?.id || target.id) : target?.isGroup ? target.id : null
  const key = target?.id || GENERAL
  const items = threads[key] || []
  const push = (...added: Item[]) => { threads = { ...threads, [key]: [...(threads[key] || []), ...added] }; rerender() }
  const patch = (id: string, change: Partial<Item>) => {
    threads = { ...threads, [key]: (threads[key] || []).map((i) => (i.id === id ? ({ ...i, ...change } as Item) : i)) }
    rerender()
  }

  const targetId = target?.id
  const targetIsGroup = !!target?.isGroup
  useEffect(() => {
    if (!targetId || !jid) { setBadge('none'); return }
    if (targetIsGroup) { setBadge('group'); return }
    let alive = true
    setBadge('loading')
    getConversationSnapshot(jid)
      .then(({ conversation: c }) => { if (alive) setBadge(!c.aiEnabled ? 'off' : c.mode === 'human' ? 'human' : c.autoReply ? 'auto' : 'suggestion') })
      .catch(() => { if (alive) setBadge('unavailable') })
    return () => { alive = false }
  }, [targetId, targetIsGroup, jid, stateReload])

  const { scrollRef, contentRef, onScroll, scrollToBottom, unseen } = useStickToBottom({
    chatKey: key,
    entries: items.map((i) => ({ id: i.id, incoming: i.kind !== 'user' })),
  })

  const base = () => ({
    jid: jid || undefined, aliases: target?.aliases, instanceName, contactName: target?.name,
  })
  const run = async (label: string, work: () => Promise<void>) => {
    if (busy) return
    setBusy(label)
    try { await work() }
    catch (e) { push({ id: uid(), kind: 'error', text: e instanceof Error ? e.message : 'Algo deu errado. Tente de novo.' }) }
    finally { setBusy(null) }
  }
  const needConversation = !target || !jid

  const send = (event?: React.FormEvent) => {
    event?.preventDefault()
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    scrollToBottom()
    push({ id: uid(), kind: 'user', text })
    void run('chat', async () => {
      const reply = await askAntigravity({ ...base(), action: 'chat', message: text })
      push({ id: uid(), kind: 'assistant', text: reply.response, context: reply.context })
    })
  }
  const summarize = () => run('summarize', async () => {
    push({ id: uid(), kind: 'user', text: 'Resumir esta conversa' })
    const reply = await askAntigravity({ ...base(), action: 'summarize' })
    push({ id: uid(), kind: 'assistant', text: reply.response, context: reply.context })
  })
  const proposeNote = () => run('note', async () => {
    push({ id: uid(), kind: 'user', text: 'Criar nota interna' })
    const reply = await askAntigravity({ ...base(), action: 'note' })
    if (!reply.proposal) throw new Error('O Antigravity não devolveu uma nota. Tente de novo.')
    push({ id: uid(), kind: 'proposal', jid: jid!, text: 'Nota interna proposta. Ela só é salva se você confirmar.', proposal: reply.proposal, state: 'pending' })
  })
  const proposeStage = () => run('crm_stage', async () => {
    push({ id: uid(), kind: 'user', text: 'Sugerir estágio do CRM' })
    const stages = crmStageList.map((s) => s.label)
    const reply = await askAntigravity({ ...base(), action: 'crm_stage', stages })
    if (reply.proposal) push({ id: uid(), kind: 'proposal', jid: jid!, text: reply.response, proposal: reply.proposal, state: 'pending' })
    else push({ id: uid(), kind: 'assistant', text: reply.response, context: reply.context })
  })
  const proposeAwaiting = () => {
    push({ id: uid(), kind: 'user', text: 'Marcar como aguardando retorno' },
      { id: uid(), kind: 'proposal', jid: jid!, text: 'Vou registrar uma nota interna "Aguardando retorno do cliente" nesta conversa. Confirma?', proposal: { type: 'awaiting' }, state: 'pending' })
  }
  const suggestReply = () => run('reply', async () => {
    push({ id: uid(), kind: 'user', text: 'Sugerir resposta' })
    const result = await requestCopilotDraft({
      contactId: jid!, isSaved: !!contact, isGroup: false, labelIds: contact ? getContactLabelIds(contact.id) : [],
      contactPhone: target?.phone, messages: [], instanceName: instanceName || undefined, aliases: target?.aliases,
    })
    if (result.draft) push({ id: uid(), kind: 'draft', chatId: target!.id, text: result.draft, sources: result.sources.map((s) => s.title), state: 'pending' })
    else push({ id: uid(), kind: 'assistant', text: result.reason || 'Não consegui sugerir uma resposta com segurança. Responda manualmente.' })
    setStateReload((n) => n + 1)
  })

  const confirm = async (item: Extract<Item, { kind: 'proposal' }>) => {
    if (busy) return
    setBusy('confirm')
    try {
      const p = item.proposal
      if (p.type === 'note') {
        await addServerNote(item.jid, p.text, 'ia')
        patch(item.id, { state: 'done', result: 'Nota salva. Ela aparece em "Notas da IA" na conversa.' })
      } else if (p.type === 'crm_stage') {
        await suggestCrmStage(item.jid, p.stage, p.reason)
        patch(item.id, { state: 'done', result: 'Sugestão registrada. Aceite ou descarte na barra da IA, dentro da conversa.' })
      } else {
        const when = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
        await addServerNote(item.jid, `Aguardando retorno do cliente (marcado em ${when}).`, 'humano')
        patch(item.id, { state: 'done', result: 'Marcado como aguardando retorno (nota interna registrada).' })
      }
    } catch (e) {
      push({ id: uid(), kind: 'error', text: e instanceof Error ? e.message : 'Não foi possível salvar. Nada foi alterado.' })
    } finally { setBusy(null) }
  }

  const quick: { label: string; icon: React.ElementType; onClick: () => void; disabled: boolean; hint?: string }[] = [
    { label: 'Resumir conversa', icon: ClipboardList, onClick: summarize, disabled: needConversation },
    { label: 'Sugerir resposta', icon: MessageSquareText, onClick: suggestReply, disabled: needConversation || !!target?.isGroup, hint: 'Só em conversas individuais' },
    { label: 'Criar nota interna', icon: FileText, onClick: proposeNote, disabled: needConversation },
    { label: 'Sugerir estágio', icon: ListChecks, onClick: proposeStage, disabled: needConversation || !!target?.isGroup || !crmStageList.length, hint: 'Só em conversas individuais' },
    { label: 'Aguardando retorno', icon: Hourglass, onClick: proposeAwaiting, disabled: needConversation || !!target?.isGroup, hint: 'Só em conversas individuais' },
  ]
  const lastContext = [...items].reverse().find((i) => i.kind === 'assistant' && i.context) as Extract<Item, { kind: 'assistant' }> | undefined

  return (
    <div className="flex-1 min-h-0 min-w-0 flex flex-col h-full bg-[#0b141a] text-slate-100 overflow-hidden relative" data-testid="antigravity-panel">
      <div className="h-16 px-4 wa-header-chat flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center space-x-3 overflow-hidden">
          {onBackMobile && <Button aria-label="Voltar para conversas" variant="ghost" size="icon" onClick={onBackMobile} className="md:hidden wa-header-btn rounded-full -ml-2"><ArrowLeft className="w-5 h-5" /></Button>}
          <div className="relative shrink-0">
            <img src={FALLBACK_AVATAR} alt="" className="w-10 h-10 rounded-full object-cover ring-1 ring-white/10" />
          </div>
          <div className="overflow-hidden">
            <h2 className="text-sm sm:text-base font-medium wa-header-title truncate">Antigravity</h2>
            <p className="text-xs wa-header-subtitle truncate">Assistente interno · só sugere, você confirma</p>
          </div>
        </div>
      </div>

      <div className="shrink-0 space-y-2 border-b border-[#2a3942] bg-[#111b21] px-3 py-2 text-xs text-slate-300">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="ag-target" className="text-slate-400">Conversa:</label>
          <select id="ag-target" value={target?.id || ''} onChange={(e) => { setAntigravityTarget(e.target.value || null) }}
            className="min-w-0 max-w-full flex-1 rounded bg-[#202c33] px-2 py-1.5 text-sm text-slate-100 outline-none focus-visible:ring-1 focus-visible:ring-[#00a884] sm:flex-none sm:w-72">
            <option value="">Nenhuma (pergunta geral)</option>
            {choices.map((c) => <option key={c.id} value={c.id}>{c.isGroup ? '👥 ' : ''}{c.name}</option>)}
          </select>
          <span data-testid="ag-ai-state" className={`rounded px-2 py-1 ${BADGE_STYLE[badge]}`}>{AI_BADGE_LABEL[badge]}</span>
          {target && <Button type="button" size="sm" variant="ghost" className="ml-auto h-7 px-2 text-xs text-[#00a884]" onClick={() => setActiveChatId(target.id)}>Abrir conversa</Button>}
        </div>
        {!target && <p className="text-slate-400">Escolha uma conversa para o Antigravity ver as últimas mensagens, notas e o estágio do CRM. Sem conversa, ele responde só perguntas gerais.</p>}
        {lastContext?.context && target && <p className="text-slate-500">Contexto usado: {lastContext.context.messages} mensagens, {lastContext.context.notes} notas, estágio {lastContext.context.stage || 'não definido'}.</p>}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Ações rápidas">
          {quick.map(({ label, icon: Icon, onClick, disabled, hint }) => (
            <Button key={label} type="button" size="sm" variant="secondary" disabled={disabled || !!busy} onClick={onClick} title={disabled && target ? hint : undefined}
              className="h-8 bg-[#202c33] text-xs text-slate-100 hover:bg-[#2a3942]"><Icon className="mr-1.5 h-3.5 w-3.5 text-cyan-300" aria-hidden />{label}</Button>
          ))}
        </div>
      </div>

      <div className="relative flex-1 min-h-0 flex flex-col">
        <div ref={scrollRef} onScroll={onScroll} data-testid="antigravity-viewport" className="flex-1 min-h-0 overflow-y-auto whatsapp-chat-bg">
          <div ref={contentRef} className="p-3 sm:p-6 space-y-3">
            {items.length === 0 && (
              <div className="mx-auto max-w-md rounded-lg bg-[#182229]/90 border border-[#222d34] p-4 text-center text-sm text-slate-300">
                <Sparkles className="mx-auto mb-2 h-6 w-6 text-cyan-300" aria-hidden />
                <p>Olá! Escolha uma conversa e use as ações rápidas, ou me pergunte algo.</p>
                <p className="mt-1 text-xs text-slate-400">Eu só sugiro. Nada é enviado ao cliente nem salvo sem a sua confirmação.</p>
              </div>
            )}
            {items.map((item) => {
              if (item.kind === 'user') return <div key={item.id} className="flex justify-end"><p className="max-w-[85%] sm:max-w-[70%] whitespace-pre-wrap break-words rounded-lg rounded-tr-none bg-[#005c4b] px-3 py-2 text-sm">{item.text}</p></div>
              if (item.kind === 'error') return <div key={item.id} role="alert" className="flex"><p className="max-w-[85%] sm:max-w-[70%] rounded-lg bg-red-950/60 border border-red-500/40 px-3 py-2 text-sm text-red-100">{item.text}</p></div>
              if (item.kind === 'assistant') return <div key={item.id} className="flex"><p className="max-w-[85%] sm:max-w-[70%] whitespace-pre-wrap break-words rounded-lg rounded-tl-none bg-[#202c33] px-3 py-2 text-sm">{item.text}</p></div>
              if (item.kind === 'draft') {
                return (
                  <div key={item.id} className="flex"><div className="max-w-[90%] sm:max-w-[75%] rounded-lg border border-[#00a884]/40 bg-[#14262c] px-3 py-2 text-sm">
                    <p className="text-xs text-[#00a884]">Rascunho de resposta — nada foi enviado</p>
                    <p className="mt-1 whitespace-pre-wrap break-words">{item.text}</p>
                    {item.sources.length > 0 && <p className="mt-1 text-[11px] text-slate-400">Fontes: {item.sources.join(', ')}</p>}
                    {item.state === 'pending' ? (
                      <div className="mt-2 flex gap-2">
                        <Button type="button" size="sm" className="h-7 bg-[#00a884] px-2 text-xs text-white hover:bg-[#008f72]" onClick={() => setActiveChatId(item.chatId)}>Abrir conversa para revisar</Button>
                        <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => patch(item.id, { state: 'dismissed' })}>Fechar</Button>
                      </div>
                    ) : <p className="mt-1 text-xs text-slate-400">Fechado. O rascunho continua na conversa até você usar ou descartar.</p>}
                  </div></div>
                )
              }
              const p = item.proposal
              return (
                <div key={item.id} className="flex"><div className="max-w-[90%] sm:max-w-[75%] rounded-lg border border-amber-400/40 bg-[#30291a] px-3 py-2 text-sm text-amber-50">
                  <p className="text-xs text-amber-200">Precisa da sua confirmação</p>
                  <p className="mt-1 whitespace-pre-wrap break-words">{item.text}</p>
                  {p.type === 'note' && <p className="mt-1 whitespace-pre-wrap break-words rounded bg-black/20 px-2 py-1">{p.text}</p>}
                  {p.type === 'crm_stage' && <p className="mt-1 rounded bg-black/20 px-2 py-1">Estágio sugerido: <b>{p.stage}</b></p>}
                  {item.state === 'pending' && (
                    <div className="mt-2 flex gap-2">
                      <Button type="button" size="sm" disabled={!!busy} onClick={() => void confirm(item)} className="h-7 bg-amber-300 px-2 text-xs text-slate-950 hover:bg-amber-200"><Check className="mr-1 h-3.5 w-3.5" />
                        {p.type === 'note' ? 'Salvar nota' : p.type === 'crm_stage' ? 'Registrar sugestão' : 'Confirmar'}</Button>
                      <Button type="button" size="sm" variant="ghost" disabled={!!busy} onClick={() => patch(item.id, { state: 'dismissed', result: 'Descartado. Nada foi salvo.' })} className="h-7 px-2 text-xs text-amber-100"><X className="mr-1 h-3.5 w-3.5" />Descartar</Button>
                    </div>
                  )}
                  {item.state !== 'pending' && item.result && <p className="mt-2 text-xs text-amber-100/80">{item.result}</p>}
                </div></div>
              )
            })}
            {busy && <p role="status" className="text-xs text-slate-400">O Antigravity está pensando…</p>}
          </div>
        </div>
        {unseen > 0 && (
          <button type="button" onClick={scrollToBottom} className="absolute bottom-3 right-4 z-10 flex items-center gap-1.5 rounded-full bg-[#00a884] px-3 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-[#008f72]">
            <ArrowDown className="h-4 w-4" aria-hidden /><span role="status" aria-live="polite">{unseenLabel(unseen)}</span>
          </button>
        )}
      </div>

      <form onSubmit={send} className="chat-composer min-h-16 bg-[#202c33] px-2 sm:px-3 py-2 flex items-center space-x-2 border-t border-[#2a3942] z-20 shrink-0">
        <Bot className="ml-1 h-5 w-5 shrink-0 text-cyan-300" aria-hidden />
        <Input aria-label="Pergunta para o Antigravity" maxLength={2000} autoComplete="off" value={input} onChange={(e) => setInput(e.target.value)}
          placeholder={target ? `Pergunte sobre ${target.name}` : 'Pergunte algo ao Antigravity'}
          className="bg-[#2a3942] border-none text-white placeholder-slate-400 focus-visible:ring-1 focus-visible:ring-[#00a884] rounded-lg h-11 text-sm sm:text-base" />
        <Button type="submit" size="icon" disabled={!input.trim() || !!busy} aria-label="Enviar pergunta" className="bg-[#00a884] hover:bg-[#008f6f] text-white rounded-full shrink-0 w-11 h-11 shadow-md"><Send className="w-5 h-5 ml-0.5" /></Button>
      </form>
    </div>
  )
}
