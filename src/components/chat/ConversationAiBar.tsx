import { useState } from 'react'
import { Bot, Hand, RotateCcw, Check, X, StickyNote, ChevronDown, ChevronUp, MessageSquareText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConversationSnapshot, AiSuggestion, updateConversationState, resolveSuggestion } from '@/lib/conversation-state'
import { formatNoteDate } from '@/lib/contact-notes'

interface Props {
  jid: string
  snapshot: ConversationSnapshot | null
  error: string | null
  onChange: () => void
  /** Leva o rascunho pronto para o campo de mensagem (nada é enviado). */
  onUseReply?: (suggestion: AiSuggestion) => void
}

// Controle por conversa do Antigravity em MODO SUGESTÃO: nada aqui envia mensagem.
export function ConversationAiBar({ jid, snapshot, error, onChange, onUseReply }: Props) {
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [showNotes, setShowNotes] = useState(false)
  if (error) return <div className="shrink-0 border-b border-[#2a3942] bg-[#111b21] px-3 py-1 text-[11px] text-slate-500">IA: {error}</div>
  if (!snapshot) return null
  const { conversation: c, suggestions, notes } = snapshot
  const iaNotes = notes.filter((n) => n.author === 'ia')
  const crmSuggestions = suggestions.filter((s) => s.kind === 'crm_stage')
  // O servidor mantém no máximo uma sugestão de resposta pendente por conversa
  const replySuggestion = suggestions.find((s) => s.kind === 'reply' && s.payload.draft)
  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return
    setBusy(true); setActionError(null)
    try { await fn(); onChange() } catch (e) { setActionError(e instanceof Error ? e.message : 'Falha ao salvar.') } finally { setBusy(false) }
  }
  const status = !c.aiEnabled ? 'IA desligada nesta conversa' : c.mode === 'human' ? 'Assumida por humano — IA pausada' : 'IA em modo sugestão (você aprova cada envio)'

  return (
    <div className="shrink-0 border-b border-[#2a3942] bg-[#111b21] px-3 py-1.5 text-xs text-slate-300" aria-label="Controle da IA nesta conversa">
      <div className="flex flex-wrap items-center gap-2">
        <Bot className={`h-4 w-4 ${c.aiEnabled && c.mode === 'suggestion' ? 'text-[#00a884]' : 'text-slate-500'}`} aria-hidden />
        <span data-testid="ai-status">{status}</span>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Button type="button" size="sm" variant="ghost" disabled={busy} className="h-7 px-2 text-xs text-slate-200"
            onClick={() => run(() => updateConversationState(jid, { aiEnabled: !c.aiEnabled }))}>
            {c.aiEnabled ? 'Desligar sugestões' : 'Ligar sugestões'}
          </Button>
          {c.aiEnabled && (c.mode === 'suggestion'
            ? <Button type="button" size="sm" variant="ghost" disabled={busy} className="h-7 px-2 text-xs text-amber-200"
                onClick={() => run(() => updateConversationState(jid, { mode: 'human' }))}><Hand className="mr-1 h-3.5 w-3.5" />Assumir</Button>
            : <Button type="button" size="sm" variant="ghost" disabled={busy} className="h-7 px-2 text-xs text-[#00a884]"
                onClick={() => run(() => updateConversationState(jid, { mode: 'suggestion' }))}><RotateCcw className="mr-1 h-3.5 w-3.5" />Devolver para a IA</Button>)}
          {iaNotes.length > 0 && <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setShowNotes((v) => !v)}
            aria-expanded={showNotes}><StickyNote className="mr-1 h-3.5 w-3.5" />Notas da IA ({iaNotes.length}){showNotes ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />}</Button>}
        </div>
      </div>
      {c.aiEnabled && c.mode === 'suggestion' && replySuggestion && (
        <div className="mt-1 rounded border border-[#00a884]/40 bg-[#14262c] px-2 py-1.5" data-testid="reply-suggestion">
          <p className="flex items-center gap-1 text-[11px] text-[#00a884]"><MessageSquareText className="h-3.5 w-3.5" aria-hidden />
            {replySuggestion.payload.auto ? 'Sugestão pronta da IA' : 'Sugestão da IA'} — nada é enviado sem o seu clique</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-100">{replySuggestion.payload.draft}</p>
          <div className="mt-1.5 flex gap-1">
            <Button type="button" size="sm" disabled={busy} className="h-7 bg-[#00a884] px-2 text-xs text-white hover:bg-[#008f72]"
              onClick={() => onUseReply?.(replySuggestion)}><Check className="mr-1 h-3.5 w-3.5" />Usar e editar no campo de mensagem</Button>
            <Button type="button" size="sm" variant="ghost" disabled={busy} className="h-7 px-2 text-xs text-slate-200"
              onClick={() => run(() => resolveSuggestion(replySuggestion.id, 'dismiss'))}><X className="mr-1 h-3.5 w-3.5" />Descartar</Button>
          </div>
        </div>
      )}
      {crmSuggestions.map((s) => (
        <div key={s.id} className="mt-1 flex flex-wrap items-center gap-2 rounded bg-[#1b2b31] px-2 py-1">
          <span>IA sugere estágio <b>{s.payload.stage}</b>{s.payload.reason ? ` — ${s.payload.reason}` : ''}</span>
          {s.payload.manualStage && <span className="text-amber-200">(estágio atual "{s.payload.currentStage ?? 'nenhum'}" foi definido por humano)</span>}
          <div className="ml-auto flex gap-1">
            <Button type="button" size="sm" disabled={busy} className="h-6 bg-[#00a884] px-2 text-xs text-white hover:bg-[#008f72]"
              onClick={() => run(() => resolveSuggestion(s.id, 'accept'))}><Check className="mr-1 h-3 w-3" />Aceitar</Button>
            <Button type="button" size="sm" variant="ghost" disabled={busy} className="h-6 px-2 text-xs text-slate-200"
              onClick={() => run(() => resolveSuggestion(s.id, 'dismiss'))}><X className="mr-1 h-3 w-3" />Descartar</Button>
          </div>
        </div>
      ))}
      {showNotes && <ul className="mt-1 space-y-1">
        {iaNotes.map((n) => <li key={n.id} className="rounded bg-[#1b2b31] px-2 py-1"><span className="text-[10px] text-slate-500">IA · {formatNoteDate(n.createdAt)}</span><p className="whitespace-pre-wrap">{n.text}</p></li>)}
      </ul>}
      {actionError && <p role="alert" className="mt-1 text-red-300">{actionError}</p>}
    </div>
  )
}
