/** Cache disque page 1 des notifications (cold start + retour arrière sans flash). */

const DISK_PREFIX = 'pinova_disk_notifications_p1_v1:'
const TTL_MS = 15 * 60 * 1000

export type CachedNotificationsPage = {
  items: unknown[]
  hasNext: boolean
  savedAt: number
}

function diskKey(lang: string): string {
  return `${DISK_PREFIX}${lang || 'fr'}`
}

export function getCachedNotificationsFirstPage(lang: string): CachedNotificationsPage | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(diskKey(lang))
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedNotificationsPage
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > TTL_MS) {
      window.localStorage.removeItem(diskKey(lang))
      return null
    }
    if (!Array.isArray(parsed.items)) return null
    return parsed
  } catch {
    return null
  }
}

export function setCachedNotificationsFirstPage(
  lang: string,
  items: unknown[],
  hasNext: boolean,
): void {
  if (typeof window === 'undefined') return
  try {
    const payload: CachedNotificationsPage = {
      items: items.slice(0, 40),
      hasNext,
      savedAt: Date.now(),
    }
    window.localStorage.setItem(diskKey(lang), JSON.stringify(payload))
  } catch {
    /* quota */
  }
}

export function clearNotificationsClientCache(): void {
  if (typeof window === 'undefined') return
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const k = window.localStorage.key(i)
      if (k?.startsWith(DISK_PREFIX)) window.localStorage.removeItem(k)
    }
  } catch {
    /* noop */
  }
}
