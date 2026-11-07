// Regras puras do "colar no fim" da conversa (testáveis sem navegador).

/** Tolerância (px) para considerar que o usuário está no fim da conversa. */
export const NEAR_BOTTOM_PX = 100

export interface ScrollMetrics { scrollHeight: number; scrollTop: number; clientHeight: number }

export const distanceFromBottom = (el: ScrollMetrics) => el.scrollHeight - el.scrollTop - el.clientHeight
export const isNearBottom = (el: ScrollMetrics, threshold = NEAR_BOTTOM_PX) => distanceFromBottom(el) <= threshold

export interface TimelineMark { id: string; incoming: boolean }

/**
 * Quantas entradas recebidas chegaram depois do último item que o usuário viu (marcador `seenLastId`).
 * Se o marcador sumiu da lista (filtro de busca, troca de conversa), não conta nada: melhor não avisar do que avisar errado.
 */
export function countUnseenIncoming(entries: TimelineMark[], seenLastId: string | null): number {
  if (!seenLastId) return 0
  let index = -1
  for (let i = entries.length - 1; i >= 0; i--) if (entries[i].id === seenLastId) { index = i; break }
  if (index < 0) return 0
  return entries.slice(index + 1).filter((entry) => entry.incoming).length
}

export const unseenLabel = (count: number) => (count === 1 ? '1 nova mensagem' : `${count} novas mensagens`)
