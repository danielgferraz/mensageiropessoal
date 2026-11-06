const PHONE_JID = /^\d+@s\.whatsapp\.net$/
const CHAT_JID = /^\d+(?:-\d+)?@(s\.whatsapp\.net|g\.us|lid)$/

export type ChatIdentity = { id: string; aliases: string[] }

/** Remove o sufixo de dispositivo (`:12`) e valida o formato do JID. */
export function cleanJid(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const jid = value.replace(/:\d+@/, '@')
  return CHAT_JID.test(jid) ? jid : null
}

export const isLidJid = (jid: string) => jid.endsWith('@lid')
export const isGroupJid = (jid: string) => jid.endsWith('@g.us')
export const isPhoneJid = (jid: string) => PHONE_JID.test(jid)

/** Número de telefone (só dígitos) de um JID `@s.whatsapp.net`; undefined para `@lid` e grupos. */
export function phoneOf(jid: string): string | undefined {
  return isPhoneJid(jid) ? jid.split('@')[0] : undefined
}

const ALT_FIELDS: Array<(row: any) => unknown> = [
  (row) => row.remoteJidAlt,
  (row) => row.lastMessage?.key?.remoteJidAlt,
  (row) => row.lastMessage?.key?.senderPn,
  (row) => row.lastMessage?.senderPn,
  (row) => row.senderPn,
]

/** Procura, numa linha de chat `@lid`, o JID de telefone equivalente que a Evolution informa. */
function findPhoneJid(row: any, exclude: string): string | null {
  for (const read of ALT_FIELDS) {
    const jid = cleanJid(read(row))
    if (jid && isPhoneJid(jid) && jid !== exclude) return jid
  }
  for (const source of [row.lastMessage?.key, row]) {
    if (!source || typeof source !== 'object') continue
    for (const value of Object.values(source)) {
      const jid = cleanJid(value)
      if (jid && isPhoneJid(jid) && jid !== exclude) return jid
    }
  }
  return null
}

/**
 * Identidade canônica de uma linha de chat: o telefone quando se conhece, senão o JID original.
 * O `@lid` (e qualquer outro JID do mesmo contato) vira alias, para unir conversas duplicadas.
 */
export function chatIdentity(row: any): ChatIdentity | null {
  const jid = cleanJid(row?.remoteJid) || cleanJid(row?.lastMessage?.key?.remoteJid)
  if (!jid) return null
  if (isGroupJid(jid)) return { id: jid, aliases: [] }
  if (isLidJid(jid)) {
    const phone = findPhoneJid(row, jid)
    return phone ? { id: phone, aliases: [jid] } : { id: jid, aliases: [] }
  }
  const other = cleanJid(row?.lastMessage?.key?.remoteJid)
  return { id: jid, aliases: other && other !== jid && !isGroupJid(other) ? [other] : [] }
}

/** Telefone formatado como no WhatsApp: +55 15 99740-7121. */
export function formatPhone(digits: string): string {
  const clean = digits.replace(/\D/g, '')
  if (!clean) return ''
  const br = clean.match(/^55(\d{2})(9?\d{4})(\d{4})$/)
  if (br) return `+55 ${br[1]} ${br[2]}-${br[3]}`
  return `+${clean}`
}

/** Reescreve as chaves de um mapa usando o dicionário alias → id canônico. Retorna o mesmo objeto se nada mudar. */
export function canonicalizeKeys<T>(record: Record<string, T>, aliasMap: Record<string, string>, merge: (a: T, b: T) => T = (a) => a): Record<string, T> {
  if (!Object.keys(record).some((key) => aliasMap[key] && aliasMap[key] !== key)) return record
  const next: Record<string, T> = {}
  for (const [key, value] of Object.entries(record)) {
    const target = aliasMap[key] || key
    next[target] = target in next ? merge(next[target], value) : value
  }
  return next
}
