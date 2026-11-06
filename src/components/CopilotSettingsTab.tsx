import React, { useCallback, useEffect, useState } from 'react'
import { Bot, PauseCircle, PlayCircle, RefreshCw, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { useWhatsApp } from '@/context/WhatsAppContext'
import {
  CopilotAuditEntry, CopilotConfig, CopilotStatus,
  getCopilotAudit, getCopilotStatus, saveCopilotConfig,
} from '@/lib/copilot'

const lines = (value: string) => value.split('\n').map((v) => v.trim()).filter(Boolean)

const Section: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <section className="space-y-2 rounded-xl border border-[#2a3942] bg-[#111b21] p-3">
    <h4 className="text-sm font-semibold text-slate-100">{title}</h4>
    {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    {children}
  </section>
)

export const CopilotSettingsTab: React.FC = () => {
  const { contacts, labels } = useWhatsApp()
  const { toast } = useToast()
  const [status, setStatus] = useState<CopilotStatus | null>(null)
  const [draft, setDraft] = useState<CopilotConfig | null>(null)
  const [audit, setAudit] = useState<CopilotAuditEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [rev, setRev] = useState(0)

  const load = useCallback(async () => {
    try {
      const [next, log] = await Promise.all([getCopilotStatus(), getCopilotAudit()])
      setStatus(next); setDraft(next.config); setAudit(log.entries); setError(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível carregar o atendente.') }
  }, [])
  useEffect(() => { void load() }, [load])

  if (error && !status) return <div className="space-y-3 p-4 text-sm text-slate-200"><p role="alert" className="text-red-300">{error}</p><Button variant="secondary" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Tentar novamente</Button></div>
  if (!status || !draft) return <p role="status" className="p-4 text-sm text-slate-400">Carregando atendente…</p>

  const dirty = JSON.stringify(draft) !== JSON.stringify(status.config)
  const patch = (changes: Partial<CopilotConfig>) => setDraft({ ...draft, ...changes })
  const toggle = (key: 'allowedContactIds' | 'allowedLabelIds', id: string) =>
    patch({ [key]: draft[key].includes(id) ? draft[key].filter((v) => v !== id) : [...draft[key], id] } as Partial<CopilotConfig>)

  const persist = async (changes: Partial<CopilotConfig>, message: string) => {
    setSaving(true)
    try {
      const { config } = await saveCopilotConfig(changes)
      setStatus({ ...status, config }); setDraft(config); setRev((n) => n + 1); setError(null)
      toast({ title: message })
      setAudit((await getCopilotAudit()).entries)
    } catch (e) {
      const text = e instanceof Error ? e.message : 'Não foi possível salvar.'
      setError(text); toast({ title: 'Não foi possível salvar', description: text, variant: 'destructive' })
    } finally { setSaving(false) }
  }
  // A pausa geral age na hora, sem depender do botão "Salvar".
  const togglePause = () => persist({ paused: !status.config.paused }, status.config.paused ? 'Atendente retomado' : 'Atendente em pausa geral')

  const active = status.config.enabled && !status.config.paused
  return (
    <div className="space-y-3 text-slate-200">
      <div className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${active ? 'border-[#00a884]/50 bg-[#00a884]/10' : 'border-amber-500/40 bg-amber-500/10'}`}>
        <div className="flex items-center gap-2 text-sm"><Bot className="h-5 w-5" />
          <span role="status">{!status.config.enabled ? 'Atendente desligado' : status.config.paused ? 'Em pausa geral' : 'Ativo — gera apenas rascunhos'}</span>
        </div>
        <Button type="button" size="sm" variant="secondary" disabled={saving || !status.config.enabled} onClick={togglePause}>
          {status.config.paused ? <><PlayCircle className="mr-1 h-4 w-4" />Retomar</> : <><PauseCircle className="mr-1 h-4 w-4" />Pausar tudo</>}
        </Button>
      </div>
      <p className="flex items-start gap-2 text-[11px] text-slate-400"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#00a884]" />Modo sugestão: o atendente escreve um rascunho no campo de mensagem e você revisa e envia. Nada é enviado automaticamente.</p>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}

      <Section title="Operação">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />Atendente ligado</label>
        <fieldset className="space-y-1 text-sm"><legend className="text-xs text-slate-400">Modo</legend>
          <label className="flex items-center gap-2"><input type="radio" name="copilot-mode" checked={draft.mode === 'suggestion'} onChange={() => patch({ mode: 'suggestion' })} />Sugestão (rascunho para aprovação)</label>
          <label className={`flex items-center gap-2 ${status.automaticAllowed ? '' : 'opacity-50'}`}><input type="radio" name="copilot-mode" disabled={!status.automaticAllowed} checked={draft.mode === 'automatic'} onChange={() => patch({ mode: 'automatic' })} />Automático{!status.automaticAllowed && ' (bloqueado neste servidor)'}</label>
        </fieldset>
      </Section>

      <Section title="Quem o atendente pode atender" hint="Padrão: ninguém. Só contatos salvos entram, e grupos nunca.">
        {contacts.length === 0 ? <p className="text-xs text-slate-400">Nenhum contato salvo ainda. Use “Salvar como contato” numa conversa.</p> :
          <ul className="max-h-40 space-y-1 overflow-y-auto" aria-label="Contatos permitidos">
            {contacts.map((c) => <li key={c.id}><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.allowedContactIds.includes(c.id)} onChange={() => toggle('allowedContactIds', c.id)} />{c.name}</label></li>)}
          </ul>}
        <p className="pt-1 text-xs text-slate-400">Etiquetas permitidas</p>
        <ul className="flex flex-wrap gap-2" aria-label="Etiquetas permitidas">
          {labels.map((l) => <li key={l.id}><label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={draft.allowedLabelIds.includes(l.id)} onChange={() => toggle('allowedLabelIds', l.id)} />{l.name}</label></li>)}
        </ul>
      </Section>

      <Section title="Limites" hint="Ao atingir o limite, o atendente para e você responde manualmente.">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label>Por hora, por contato<Input type="number" min={1} max={60} value={draft.maxPerHourPerContact} onChange={(e) => patch({ maxPerHourPerContact: Number(e.target.value) })} className="mt-1 bg-[#2a3942] border-[#374248] text-white" /></label>
          <label>Por dia, no total<Input type="number" min={1} max={1000} value={draft.maxPerDay} onChange={(e) => patch({ maxPerDay: Number(e.target.value) })} className="mt-1 bg-[#2a3942] border-[#374248] text-white" /></label>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.businessHours.enabled} onChange={(e) => patch({ businessHours: { ...draft.businessHours, enabled: e.target.checked } })} />Só em horário de atendimento (Brasília)</label>
        {draft.businessHours.enabled && <div className="grid grid-cols-2 gap-2 text-xs">
          <label>Início<Input type="time" value={draft.businessHours.start} onChange={(e) => patch({ businessHours: { ...draft.businessHours, start: e.target.value } })} className="mt-1 bg-[#2a3942] border-[#374248] text-white" /></label>
          <label>Fim<Input type="time" value={draft.businessHours.end} onChange={(e) => patch({ businessHours: { ...draft.businessHours, end: e.target.value } })} className="mt-1 bg-[#2a3942] border-[#374248] text-white" /></label>
        </div>}
      </Section>

      <Section title="Guardrails de conteúdo" hint="Uma entrada por linha.">
        <label className="block text-xs">Temas que o atendente não trata (passa para você)
          <Textarea key={`b${rev}`} defaultValue={draft.blockedTopics.join('\n')} onBlur={(e) => patch({ blockedTopics: lines(e.target.value) })} rows={4} className="mt-1 bg-[#2a3942] border-[#374248] text-white" /></label>
        <label className="block text-xs">Palavras que pedem atendimento humano
          <Textarea key={`h${rev}`} defaultValue={draft.handoffKeywords.join('\n')} onBlur={(e) => patch({ handoffKeywords: lines(e.target.value) })} rows={3} className="mt-1 bg-[#2a3942] border-[#374248] text-white" /></label>
        <label className="block text-xs">Sites que podem aparecer nas respostas (vazio = nenhum link)
          <Textarea key={`l${rev}`} defaultValue={draft.allowedLinkHosts.join('\n')} onBlur={(e) => patch({ allowedLinkHosts: lines(e.target.value) })} rows={2} className="mt-1 bg-[#2a3942] border-[#374248] text-white" /></label>
        <p className="text-[11px] text-slate-400">Sempre bloqueados no rascunho: CPF, CNPJ, cartão, e-mail, telefones de terceiros, senhas e chaves.</p>
      </Section>

      <Section title="Base de conhecimento (NebrIA)" hint="Leitura somente. Só entram documentos com a linha “Status: Aprovado”.">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.ragEnabled} onChange={(e) => patch({ ragEnabled: e.target.checked })} />Usar a base nas respostas</label>
        {!status.rag.configured ? <p role="status" className="text-xs text-amber-200">Nenhuma pasta configurada neste servidor (variável NEBRIA_DIR). Sem base, o atendente encaminha as dúvidas para você.</p>
          : !status.rag.available ? <p role="status" className="text-xs text-amber-200">A pasta configurada não foi encontrada no servidor.</p>
          : <p role="status" className="text-xs">{status.rag.documents.length} documento(s) aprovado(s) · {status.rag.skipped.length} ignorado(s) (rascunho ou fora do padrão).</p>}
        {status.rag.documents.length > 0 && <ul className="list-disc pl-5 text-xs text-slate-300">{status.rag.documents.map((d) => <li key={d}>{d}</li>)}</ul>}
      </Section>

      <div className="sticky bottom-0 flex items-center justify-end gap-2 bg-[#111b21] py-2 pr-16">
        {dirty && <span className="text-xs text-amber-200">Alterações não salvas</span>}
        <Button type="button" variant="ghost" disabled={!dirty || saving} onClick={() => { setDraft(status.config); setRev((n) => n + 1) }}>Descartar</Button>
        <Button type="button" disabled={!dirty || saving} onClick={() => persist({ ...draft }, 'Configuração salva')} className="bg-[#00a884] text-white hover:bg-[#008f72]">Salvar</Button>
      </div>

      <Section title="Auditoria (últimas ações)" hint="Registra decisão, motivo e fontes; não guarda o texto das conversas.">
        {audit.length === 0 ? <p className="text-xs text-slate-400">Sem registros.</p> :
          <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">{audit.slice(0, 20).map((e, i) => <li key={`${e.ts}-${i}`}><time dateTime={e.ts}>{new Date(e.ts).toLocaleString('pt-BR')}</time> · {e.action}{e.code ? ` (${e.code})` : ''}{e.reason ? ` — ${e.reason}` : ''}</li>)}</ul>}
      </Section>
    </div>
  )
}
