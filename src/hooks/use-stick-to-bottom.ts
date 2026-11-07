import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { countUnseenIncoming, isNearBottom, type TimelineMark } from '@/lib/stick-to-bottom'

interface Options {
  /** Identifica a conversa aberta; ao mudar, a lista abre sempre na última mensagem. */
  chatKey: string | null
  /** Entradas da conversa em ordem cronológica. */
  entries: TimelineMark[]
  /** Enquanto verdadeiro (foco em nota, busca), nada é rolado automaticamente nem contado. */
  paused?: boolean
}

/**
 * Mantém a conversa no fim, como o WhatsApp:
 * - abre na última mensagem (sem animação), inclusive quando o histórico chega depois do primeiro render;
 * - novas mensagens acompanham a rolagem quando o usuário já está no fim (tolerância de 100 px);
 * - se o usuário subiu para ler o histórico, não puxa a tela e conta as novas mensagens recebidas;
 * - reancora no fim quando a altura muda depois do render (imagem, áudio, barra de IA), só se estava no fim.
 */
export function useStickToBottom({ chatKey, entries, paused = false }: Options) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const stuck = useRef(true)
  const seenLastId = useRef<string | null>(null)
  const pausedRef = useRef(paused)
  const entriesRef = useRef(entries)
  pausedRef.current = paused
  entriesRef.current = entries
  const [unseen, setUnseen] = useState(0)

  const toBottom = useCallback(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'instant' })
  }, [])
  const markSeen = useCallback(() => {
    seenLastId.current = entriesRef.current.at(-1)?.id ?? null
    setUnseen(0)
  }, [])

  /** Leva ao fim e volta a seguir as novas mensagens (envio, botão "novas mensagens"). */
  const scrollToBottom = useCallback(() => {
    stuck.current = true
    toBottom()
    markSeen()
  }, [toBottom, markSeen])

  // Troca de conversa: sempre na última mensagem.
  useLayoutEffect(() => {
    stuck.current = true
    markSeen()
    toBottom()
  }, [chatKey, toBottom, markSeen])

  // Altura mudou depois do render (mídia carregando, histórico chegando, barra de IA): reancora se estava no fim.
  useEffect(() => {
    const content = contentRef.current
    const viewport = scrollRef.current
    if (!content || !viewport || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => { if (stuck.current && !pausedRef.current) toBottom() })
    observer.observe(content)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [chatKey, toBottom])

  // Entrou mensagem: segue se estava no fim; senão só conta.
  const lastId = entries.at(-1)?.id ?? null
  useLayoutEffect(() => {
    if (pausedRef.current) return
    if (stuck.current) { toBottom(); markSeen() }
    else setUnseen(countUnseenIncoming(entriesRef.current, seenLastId.current))
  }, [lastId, entries.length, toBottom, markSeen])

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const near = isNearBottom(el)
    stuck.current = near
    if (near) markSeen()
  }, [markSeen])

  return { scrollRef, contentRef, onScroll, scrollToBottom, unseen, stuck }
}
