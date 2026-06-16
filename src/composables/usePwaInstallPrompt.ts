import { onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { usePwaContext } from './usePwaContext'
import { requestPwaInstallModalOpen } from '../utils/pwaInstallBridge'
import { isPwaInstallSnoozed } from '../utils/pwaInstallStorage'
import { onEngagementMoment, type EngagementMoment } from '../utils/engagementMoments'
import { canShowPromptAfter, isNotificationPromptOpen, markPromptShown } from '../utils/promptCoordinator'

const SESSION_AUTO_PROMPT_KEY = 'fotoce:pwa:auto-prompt:shown-session'

/** Après publication ou exploration : laisser l’utilisateur voir le résultat avant la proposition PWA. */
const MOMENT_DELAY_MS = 8000
/** Filet : navigation mobile sans signal fort. */
const FALLBACK_DELAY_MS = 22000

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
    '/onboarding',
  ]
  return prefixes.some((pre) => p === pre || p.startsWith(`${pre}/`))
}

const ENGAGEMENT_ROUTES = ['/', '/explore', '/following', '/notifications']

function isEngagementRoute(pathname: string): boolean {
  const p = (pathname.split('?')[0] || '/').replace(/\/+$/, '') || '/'
  return ENGAGEMENT_ROUTES.some((pre) => p === pre || p.startsWith(`${pre}/`))
}

/**
 * Proposition d’installation PWA au moment où l’utilisateur a déjà tiré de la valeur
 * (pin publié, feed exploré), pas au premier chargement froid.
 */
export function usePwaInstallPrompt() {
  const route = useRoute()
  const { isMobile, isStandalone, canOfferInstallExperience } = usePwaContext()
  let timer: ReturnType<typeof setTimeout> | null = null
  let unsubscribeEngagement: (() => void) | null = null

  function clearTimer() {
    if (timer != null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function canAutoPromptNow(): boolean {
    if (typeof window === 'undefined') return false
    if (sessionStorage.getItem(SESSION_AUTO_PROMPT_KEY) === '1') return false
    if (!isMobile.value || isStandalone.value) return false
    if (!canOfferInstallExperience.value) return false
    if (pathExcluded(route.path)) return false
    if (isPwaInstallSnoozed()) return false
    if (isNotificationPromptOpen()) return false
    if (!canShowPromptAfter()) return false
    return true
  }

  function openPromptOnce() {
    if (!canAutoPromptNow()) return
    try {
      sessionStorage.setItem(SESSION_AUTO_PROMPT_KEY, '1')
    } catch {
      /* ignore */
    }
    markPromptShown()
    requestPwaInstallModalOpen()
  }

  function schedulePrompt(delayMs: number) {
    clearTimer()
    if (!canAutoPromptNow()) return
    timer = setTimeout(() => {
      timer = null
      openPromptOnce()
    }, delayMs)
  }

  function onEngagement(moment: EngagementMoment) {
    if (moment === 'foto_saved' || moment === 'user_followed') return
    const delay = moment === 'pin_published' ? MOMENT_DELAY_MS : 6000
    schedulePrompt(delay)
  }

  function scheduleFallback() {
    if (!isEngagementRoute(route.path)) {
      clearTimer()
      return
    }
    schedulePrompt(FALLBACK_DELAY_MS)
  }

  watch(
    () => [route.path, isStandalone.value, isMobile.value, canOfferInstallExperience.value] as const,
    () => {
      if (typeof window === 'undefined') return
      if (sessionStorage.getItem(SESSION_AUTO_PROMPT_KEY) === '1') return

      if (!isMobile.value || isStandalone.value || !canOfferInstallExperience.value) {
        clearTimer()
        return
      }
      if (pathExcluded(route.path)) {
        clearTimer()
        return
      }
      if (isPwaInstallSnoozed()) return
      scheduleFallback()
    },
    { immediate: true },
  )

  unsubscribeEngagement = onEngagementMoment(onEngagement)

  onUnmounted(() => {
    clearTimer()
    unsubscribeEngagement?.()
    unsubscribeEngagement = null
  })
}
