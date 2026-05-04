/**
 * Badge non lues : le backend envoie `X-Pinova-Unread-Notifications` sur les réponses API
 * (intercepteur axios → `applyUnreadCountFromResponseHeader`).
 * Plus besoin d’une requête `unread_count/` à chaque navigation.
 */
const unreadHeaderListeners = new Set<(n: number) => void>()

/** Nom d’en-tête (minuscules pour axios dans le navigateur). */
export const UNREAD_NOTIFICATION_RESPONSE_HEADER = 'x-pinova-unread-notifications'

export function subscribeUnreadCountFromHeader(listener: (count: number) => void): () => void {
  unreadHeaderListeners.add(listener)
  return () => unreadHeaderListeners.delete(listener)
}

export function applyUnreadCountFromResponseHeader(raw: string | null | undefined): void {
  if (raw === undefined || raw === null || raw === '') return
  const n = parseInt(String(raw), 10)
  if (!Number.isFinite(n) || n < 0) return
  for (const fn of [...unreadHeaderListeners]) {
    try {
      fn(n)
    } catch {
      /* ne pas casser l’intercepteur */
    }
  }
}
