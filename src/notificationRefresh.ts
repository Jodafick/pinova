/**
 * Rafraîchissement du badge / liste notifications côté client : pas de polling séparé,
 * on déclenche après l’activité API normale de l’utilisateur (intercepteur axios + debounce).
 */
const listeners = new Set<() => void>()
const DEBOUNCE_MS = 420
let timer: ReturnType<typeof setTimeout> | null = null

export function subscribeNotificationRefreshFromApiActivity(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function flush() {
  timer = null
  for (const fn of [...listeners]) {
    try {
      fn()
    } catch {
      /* évite une erreur liste dans intercepteur axios */
    }
  }
}

/** Depuis axios : réponses 2xx seulement, hors endpoints notifications/*. */
export function scheduleNotificationRefreshFromApi(): void {
  if (listeners.size === 0) return
  if (timer) clearTimeout(timer)
  timer = setTimeout(flush, DEBOUNCE_MS)
}
