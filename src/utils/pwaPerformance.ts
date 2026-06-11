/**
 * Heuristiques perf PWA — utilisables hors setup Vue (offlineCache, main.ts).
 */

export function isPwaStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const nav = navigator as Navigator & { standalone?: boolean }
  if (nav.standalone === true) return true
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches
    )
  } catch {
    return false
  }
}

export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.matchMedia('(max-width: 1023px)').matches
  } catch {
    return false
  }
}

/** Mode PWA installée (surtout mobile) : préfetch/cache agressifs désactivés. */
export function isPwaLightPerfMode(): boolean {
  return isPwaStandalone() && isMobileViewport()
}

export function navigatorSaveDataEnabled(): boolean {
  if (typeof navigator === 'undefined') return false
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  return conn?.saveData === true
}
