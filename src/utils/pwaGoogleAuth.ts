/** Pont OAuth Google : PWA iOS (standalone) → Safari → reprise dans la PWA. */

export const PWA_GOOGLE_BRIDGE_KEY = 'pwa_google_bridge_id'
export const PWA_GOOGLE_STATE_KEY = 'pwa_google_oauth_state'
export const PWA_GOOGLE_RETURN_KEY = 'pwa_google_return_to'

function randomHex(bytes = 16): string {
  const arr = new Uint8Array(bytes)
  window.crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** PWA installée sur iPhone / iPad (écran d'accueil). */
export function needsIosPwaSafariGoogleBridge(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const isIos =
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' &&
      (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 1)
  if (!isIos) return false
  const nav = navigator as Navigator & { standalone?: boolean }
  if (nav.standalone === true) return true
  try {
    return window.matchMedia('(display-mode: standalone)').matches
  } catch {
    return false
  }
}

export function isStandaloneDisplayMode(): boolean {
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

export function clearPwaGoogleBridgeStorage(): void {
  try {
    sessionStorage.removeItem(PWA_GOOGLE_BRIDGE_KEY)
    sessionStorage.removeItem(PWA_GOOGLE_STATE_KEY)
    sessionStorage.removeItem(PWA_GOOGLE_RETURN_KEY)
  } catch {
    /* ignore */
  }
}

export function readPwaGoogleBridgeFromStorage(): { bridgeId: string; pwaState: string } | null {
  try {
    const bridgeId = (sessionStorage.getItem(PWA_GOOGLE_BRIDGE_KEY) || '').trim()
    const pwaState = (sessionStorage.getItem(PWA_GOOGLE_STATE_KEY) || '').trim()
    if (!bridgeId || !pwaState) return null
    return { bridgeId, pwaState }
  } catch {
    return null
  }
}

/** Démarre le pont : page intermédiaire puis Safari (comptes Google de l'appareil). */
export function startIosPwaGoogleBridge(returnTo = '/'): void {
  const bridgeId = randomHex(16)
  const pwaState = randomHex(16)
  try {
    sessionStorage.setItem(PWA_GOOGLE_BRIDGE_KEY, bridgeId)
    sessionStorage.setItem(PWA_GOOGLE_STATE_KEY, pwaState)
    sessionStorage.setItem(PWA_GOOGLE_RETURN_KEY, returnTo)
  } catch {
    /* ignore */
  }
  const url = new URL('/auth/pwa/google', window.location.origin)
  url.searchParams.set('bridge_id', bridgeId)
  url.searchParams.set('pwa_state', pwaState)
  window.location.href = url.toString()
}

/** URL absolue à ouvrir dans Safari (mêmes paramètres bridge). */
export function buildPwaGoogleSafariUrl(bridgeId: string, pwaState: string): string {
  const url = new URL('/auth/pwa/google', window.location.origin)
  url.searchParams.set('bridge_id', bridgeId)
  url.searchParams.set('pwa_state', pwaState)
  return url.toString()
}
