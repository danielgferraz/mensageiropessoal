import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useWhatsApp } from '@/context/WhatsAppContext'
import { getStyleCandidates, getStyleSamples, saveStyleSamples } from '@/lib/copilot'

const MAX = 10

/** Escolha de até 10 mensagens suas para o atendente copiar o jeito (tamanho, gírias, pontuação), nunca o conteúdo. */
export const StyleSamplesSection: React.FC = () => {
  const { instanceName } = useWhatsApp()
  const [saved, setSaved] = useState<string[]>([])
  const [candidates, setCandidates] = useState<string[] | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getStyleSamples().then(({ samples }) => { setSaved(samples); setPicked(samples) }).catch(() => undefined)
  }, [])

  const run = async (work: () => Promise<void>) => {
    setBusy(true); setError(null); setMessage(null)
    try { await work() } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível concluir.') } finally { setBusy(false) }
  }
  const toggle = (text: string) => setPicked((prev) => (prev.includes(text) ? prev.filter((t) => t !== text) : prev.length >= MAX ? prev : [...prev, text]))
  const options = [...new Set([...(candidates || []), ...saved])]

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-slate-400">Escolha até {MAX} mensagens que você mesmo costuma mandar. O atendente imita o jeito (tamanho, gírias, pontuação) e nunca o conteúdo. Só aparecem frases curtas, sem número, link, e-mail nem nome de pessoa. Elas são enviadas ao modelo como exemplos.</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="secondary" disabled={busy || !instanceName}
          onClick={() => run(async () => { const r = await getStyleCandidates(instanceName!); setCandidates(r.candidates); if (!r.candidates.length) setMessage('Não encontrei mensagens suas que sirvam de exemplo.') })}>
          Buscar exemplos nas minhas mensagens enviadas
        </Button>
        {!instanceName && <span className="text-[11px] text-amber-200">Conecte o WhatsApp para buscar.</span>}
        <span className="text-[11px] text-slate-400" aria-live="polite">{picked.length}/{MAX} escolhidas · {saved.length} salvas</span>
      </div>
      {options.length > 0 && (
        <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg bg-[#0b141a] p-2 text-xs">
          {options.map((text) => (
            <li key={text}><label className="flex items-center gap-2"><input type="checkbox" checked={picked.includes(text)} onChange={() => toggle(text)} disabled={!picked.includes(text) && picked.length >= MAX} />{text}</label></li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={() => run(async () => { const r = await saveStyleSamples(picked); setSaved(r.samples); setPicked(r.samples); setMessage(`${r.samples.length} exemplo(s) salvo(s).`) })}>Salvar exemplos</Button>
        {picked.length === 0 && saved.length > 0 && <span className="text-[11px] text-amber-200">Salvar sem nenhuma escolhida remove todos os exemplos.</span>}
      </div>
      {message && <p role="status" className="text-xs text-emerald-300">{message}</p>}
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    </div>
  )
}
