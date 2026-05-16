import { onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { usePwaContext } from './usePwaContext'
import { requestPwaInstallModalOpen } from '../utils/pwaInstallBridge'
import { isPwaInstallSnoozed } from '../utils/pwaInstallStorage'

/** Une seule proposition automatique par session navigateur (onglet). */
const SESSION_AUTO_PROMPT_KEY = 'pinova:pwa:auto-prompt:shown-session'

/** Délai après navigation sur une page « éligible » (évite le flash au chargement). */
const AUTO_PROMPT_DELAY_MS = 12000

function pathExcluded(pathname: string): boolean {
  const p = (pathname.split('?')[0] || '/').replace(/\/+$/, '') || '/'
  const prefixes = [
    '/login',
    '/register',
    '/forgot-password',
    '/verify-otp',
    '/verify-email',
    '/auth/mobile',
    '/reset-password',
    '/password-reset-confirm',
    '/settings',
  ]
  return prefixes.some((pre) => p === pre || p.startsWith(`${pre}/`))
}

/**
 * Proposition d’installation PWA sur mobile (navigateur), surtout iOS où il n’y a pas de `beforeinstallprompt`.
 * Android : s’affiche aussi si aucun événement natif n’est encore arrivé — l’utilisateur peut réessayer ou utiliser le menu ⋮.
 */
export function usePwaInstallPrompt() {
  const route = useRoute()
  const { isMobile, isStandalone } = usePwaContext()
  let timer: ReturnType<typeof setTimeout> | null = null

  function clearTimer() {
    if (timer != null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function schedulePrompt() {
    if (timer != null) return
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem(SESSION_AUTO_PROMPT_KEY) === '1') return
    if (!isMobile.value || isStandalone.value) return
    if (pathExcluded(route.path)) return
    if (isPwaInstallSnoozed()) return

    timer = setTimeout(() => {
      timer = null
      try {
        sessionStorage.setItem(SESSION_AUTO_PROMPT_KEY, '1')
      } catch {
        /* ignore */
      }
      requestPwaInstallModalOpen()
    }, AUTO_PROMPT_DELAY_MS)
  }

  watch(
    () => [route.path, isStandalone.value, isMobile.value] as const,
    () => {
      if (typeof window === 'undefined') return
      if (sessionStorage.getItem(SESSION_AUTO_PROMPT_KEY) === '1') return

      if (!isMobile.value || isStandalone.value) {
        clearTimer()
        return
      }
      if (pathExcluded(route.path)) {
        clearTimer()
        return
      }
      if (isPwaInstallSnoozed()) return
      schedulePrompt()
    },
    { immediate: true },
  )

  onUnmounted(() => {
    clearTimer()
  })
}
