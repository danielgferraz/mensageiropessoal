// Remove only the fixed legacy demo IDs. Custom records and real WhatsApp JIDs stay intact.
export function cleanDemoData(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>): void {
  const contactIds = new Set(['c1', 'c2', 'c3', 'c4', 'c5', 'c6'])
  const conversationIds = new Set(['conv-1', 'conv-2', 'conv-3', 'conv-4', 'conv-group-1', 'conv-group-2'])
  const messageIds = new Set(['msg-agy-1', 'm1-1', 'm1-2', 'm1-3', 'm1-4', 'm1-5',
    'mg-1', 'mg-2', 'mg-3', 'mg-4', 'm2-1', 'm2-2', 'm2-3', 'm3-1', 'm3-2'])
  const update = (key: string, transform: (data: any) => unknown) => {
    try {
      const raw = storage.getItem(key)
      if (!raw) return
      const data = JSON.parse(raw)
      const next = transform(data)
      if (JSON.stringify(next) !== JSON.stringify(data)) storage.setItem(key, JSON.stringify(next))
    } catch {
      // Unreadable or unavailable storage must not erase user data or prevent startup.
    }
  }
  const filter = (key: string, shouldRemove: (row: any) => boolean) => update(key, (rows) =>
    Array.isArray(rows) ? rows.filter((row) => !shouldRemove(row)) : rows)
  filter('wa_clone_contacts', (row) => contactIds.has(row?.id) || row?.id === 'c-antigravity')
  filter('wa_clone_conversations', (row) => conversationIds.has(row?.id))
  filter('wa_clone_contact_notes', (row) => ['note-init-1', 'note-init-2'].includes(row?.id))
  filter('wa_clone_event_logs', (row) => row?.id === 'log-init-1')
  filter('wa_clone_evolution_connections', (row) => row?.id === 'conn-demo-1')
  for (const key of ['wa_clone_crm_stages', 'wa_clone_contact_labels']) {
    update(key, (data) => data && typeof data === 'object' && !Array.isArray(data)
      ? Object.fromEntries(Object.entries(data).filter(([id]) => !contactIds.has(id))) : data)
  }
  update('wa_clone_messages', (data) => data && typeof data === 'object' && !Array.isArray(data)
    ? Object.fromEntries(Object.entries(data).map(([id, rows]) => [id,
      Array.isArray(rows) ? rows.filter((row) => !messageIds.has(row?.id)) : rows])) : data)
  update('wa_clone_user', (data) => {
    if (data?.name === '' && data?.phone === '+55 11 98765-4321' &&
      data?.about === 'Disponível para trocar ideias no WhatsApp Clone!' && data?.avatar?.includes('seed=88')) {
      return { name: '', avatar: '/mensageiro/icon-512.svg', about: '' }
    }
    return data
  })
}
