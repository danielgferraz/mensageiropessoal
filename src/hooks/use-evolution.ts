import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { FALLBACK_AVATAR, mergeMessages, parseChats, parseInstances, parseMessages, selectInstance } from '@/lib/evolution'
import type { Instance } from '@/lib/evolution'
import type { Conversation, Message } from '@/types/whatsapp'

export async function evolutionRequest(path: string, body?: unknown, signal?: AbortSignal) {
  const res = await apiFetch(`/mensageiro/api${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000),
    cache: 'no-store',
  })
  const data = await res.json()
  if (!res.ok) throw new Error(res.status === 401 ? 'Sessão expirada. Entre novamente no TechAgenda.' :
    res.status === 403 ? 'Acesso restrito a administradores.' : path.includes('/send-message/') ? 'O envio não foi confirmado. Confira a conversa antes de tentar novamente.' : 'Não foi possível sincronizar com o WhatsApp. Tente novamente.')
  return data
}

const COPILOT: Conversation = { id: 'conv-antigravity', name: 'Antigravity Copilot', isGroup: false,
  avatar: FALLBACK_AVATAR, participants: ['c-antigravity'], pinned: true }

export function useEvolution(activeChatId: string | null) {
  const [instance, setInstance] = useState<Instance | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([COPILOT])
  const [messages, setMessages] = useState<Record<string, Message[]>>({})
  const [loading, setLoading] = useState(true)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [messageError, setMessageError] = useState<string | null>(null)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [historyPages, setHistoryPages] = useState<Record<string, number>>({})
  const [loadedPages, setLoadedPages] = useState<Record<string, number>>({})
  const [retry, setRetry] = useState(0)
  const instanceRef = useRef<string | null>(null)
  const conversationsRef = useRef<Conversation[]>([COPILOT])
  const refresh = useCallback(() => setRetry((n) => n + 1), [])
  useEffect(() => { conversationsRef.current = conversations }, [conversations])

  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    const controller = new AbortController()
    const poll = async () => {
      if (document.hidden) { timer = setTimeout(poll, 5000); return }
      try {
        const instances = parseInstances(await evolutionRequest('/whatsapp/instances', undefined, controller.signal))
        const selected = selectInstance(instances)
        if (stopped) return
        if (!selected) {
          setInstance(null)
          throw new Error('Nenhuma instância conectada. Confira a conexão do WhatsApp.')
        }
        if (instanceRef.current !== selected.name) {
          instanceRef.current = selected.name
          setMessages({}); setConversations([COPILOT])
          setLoadedPages({}); setHistoryPages({})
        }
        setInstance(selected)
        const result = parseChats(await evolutionRequest(`/whatsapp/chats/${encodeURIComponent(selected.name)}`, {}, controller.signal))
        if (stopped) return
        setConversations((previous) => {
          const known = new Set(result.conversations.flatMap((c) => [c.id, ...(c.aliases || [])]))
          return [...result.conversations.map((c) => {
            // Uma conversa antes listada pelo @lid passa a herdar fixar/arquivar/etiquetas ao ganhar o telefone.
            const saved = previous.find((p) => p.id === c.id) || previous.find((p) => c.aliases?.includes(p.id))
            return { ...c, pinned: saved?.pinned, archived: saved?.archived, labelIds: saved?.labelIds }
          }), ...previous.filter((c) => !known.has(c.id))]
        })
        setSyncError(null)
      } catch (error) {
        if (!stopped) setSyncError(error instanceof Error ? error.message : 'Falha na sincronização.')
      } finally {
        if (!stopped) { setLoading(false); timer = setTimeout(poll, 5000) }
      }
    }
    const onVisible = () => { if (!document.hidden) refresh() }
    void poll()
    document.addEventListener('visibilitychange', onVisible)
    return () => { stopped = true; clearTimeout(timer); controller.abort(); document.removeEventListener('visibilitychange', onVisible) }
  }, [retry, refresh])

  const loadMessages = useCallback(async (jid: string, page = 1, signal?: AbortSignal) => {
    const name = instanceRef.current
    if (!name || !jid.includes('@')) return
    // O mesmo contato pode ter mensagens gravadas sob o telefone e sob o @lid: consulta todos e une por id.
    const aliases = conversationsRef.current.find((c) => c.id === jid)?.aliases || []
    const results = await Promise.all([jid, ...aliases].map(async (remoteJid) => parseMessages(await evolutionRequest(`/whatsapp/messages/${encodeURIComponent(name)}`, {
      where: { key: { remoteJid } }, page, offset: 50,
    }, signal), jid, aliases)))
    if (signal?.aborted || instanceRef.current !== name) return
    const result = { records: results.flatMap((r) => r.records), pages: Math.max(...results.map((r) => r.pages)) }
    setMessages((previous) => ({ ...previous, [jid]: mergeMessages(previous[jid] || [], result.records) }))
    setHistoryPages((previous) => ({ ...previous, [jid]: result.pages }))
    setLoadedPages((previous) => ({ ...previous, [jid]: Math.max(page, previous[jid] || 1) }))
    setMessageError(null)
  }, [])

  useEffect(() => {
    if (!instance?.name || !activeChatId?.includes('@')) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    const controller = new AbortController()
    setMessageError(null); setLoadingMessages(true)
    const poll = async () => {
      if (document.hidden) { timer = setTimeout(poll, 3000); return }
      try { await loadMessages(activeChatId, 1, controller.signal) }
      catch (error) { if (!stopped) setMessageError(error instanceof Error ? error.message : 'Falha ao carregar mensagens.') }
      finally { if (!stopped) { setLoadingMessages(false); timer = setTimeout(poll, 3000) } }
    }
    void poll()
    return () => { stopped = true; clearTimeout(timer); controller.abort() }
  }, [instance?.name, activeChatId, loadMessages, retry])

  const loadOlder = async () => {
    if (!activeChatId) return
    setLoadingMessages(true)
    try { await loadMessages(activeChatId, (loadedPages[activeChatId] || 1) + 1) }
    catch { setMessageError('Não foi possível carregar o histórico. Tente novamente.') }
    finally { setLoadingMessages(false) }
  }

  return { instance, instanceRef, conversations, setConversations, messages, setMessages,
    loading, syncError, messageError, loadingMessages, refresh, loadOlder,
    hasOlder: !!activeChatId && (historyPages[activeChatId] || 1) > (loadedPages[activeChatId] || 1) }
}
