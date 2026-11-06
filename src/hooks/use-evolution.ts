import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { FALLBACK_AVATAR, mergeMessages, parseChats, parseInstances, parseMessages, selectInstance } from '@/lib/evolution'
import type { Instance } from '@/lib/evolution'
import type { Contact, Conversation, Message } from '@/types/whatsapp'

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
  const [contacts, setContacts] = useState<Contact[]>([])
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
  const refresh = useCallback(() => setRetry((n) => n + 1), [])

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
          setMessages({}); setConversations([COPILOT]); setContacts([])
          setLoadedPages({}); setHistoryPages({})
        }
        setInstance(selected)
        const result = parseChats(await evolutionRequest(`/whatsapp/chats/${encodeURIComponent(selected.name)}`, {}, controller.signal))
        if (stopped) return
        setConversations((previous) => {
          const seen = new Set(result.conversations.map((c) => c.id))
          return [...result.conversations.map((c) => {
            const saved = previous.find((p) => p.id === c.id)
            return { ...c, pinned: saved?.pinned, archived: saved?.archived, labelIds: saved?.labelIds }
          }), ...previous.filter((c) => !seen.has(c.id))]
        })
        setContacts((previous) => [...result.contacts, ...previous.filter((p) => !result.contacts.some((c) => c.id === p.id))])
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
    const result = parseMessages(await evolutionRequest(`/whatsapp/messages/${encodeURIComponent(name)}`, {
      where: { key: { remoteJid: jid } }, page, offset: 50,
    }, signal), jid)
    if (signal?.aborted || instanceRef.current !== name) return
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

  return { instance, instanceRef, contacts, setContacts, conversations, setConversations, messages, setMessages,
    loading, syncError, messageError, loadingMessages, refresh, loadOlder,
    hasOlder: !!activeChatId && (historyPages[activeChatId] || 1) > (loadedPages[activeChatId] || 1) }
}
