import { ref, watch, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import type { User } from '../types'
import { useAuth } from './useAuth'
import { userNeedsOnboarding } from '../utils/onboarding'
import api from '../api/index'
import { isWebPushBackendReady, isWebPushSupported } from '../utils/webPushClient'
import { onEngagementMoment, type EngagementMoment } from '../utils/engagementMoments'
import { canShowPromptAfter, setNotificationPromptOpen } from '../utils/promptCoordinator'

const DECLINED_KEY = 'fotoce_notif_prompt_declined'
const SNOOZE_KEY = 'fotoce_notif_prompt_snooze_until'
const COMPLETED_KEY = 'fotoce_notif_prompt_completed'
const SESSION_FALLBACK_KEY = 'fotoce_notif_prompt_fallback_session'

/** Délai après un moment d’engagement (laisser savourer l’action avant la demande). */
const MOMENT_DELAY_MS = 4500
/** Filet de sécurité : session mature sans signal fort. */
const FALLBACK_DELAY_MS = 90000

export type NotificationPromptReason = 'default' | 'follow' | 'save'

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
    '/create',
  ]
  return prefixes.some((pre) => p === pre || p.startsWith(`${pre}/`))
}

function shouldDeferNotificationPrompt(isAuthenticated: boolean, pathname: string, user: User | null | undefined): boolean {
  if (!isAuthenticated) return true
  if (pathExcluded(pathname)) return true
  if (userNeedsOnboarding(user)) return true
  return false
}

function storageAllowsPrompt(): boolean {
  if (typeof localStorage === 'undefined') return false
  if (localStorage.getItem(DECLINED_KEY) === '1') return false
  if (localStorage.getItem(COMPLETED_KEY) === '1') return false
  const snooze = Number(localStorage.getItem(SNOOZE_KEY) || '0')
  if (Number.isFinite(snooze) && snooze > Date.now()) return false
  return true
}

function momentToReason(moment: EngagementMoment): NotificationPromptReason {
  if (moment === 'user_followed') return 'follow'
  if (moment === 'foto_saved') return 'save'
  return 'default'
}

export function notificationPromptSnoozeDays(days = 7): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(SNOOZE_KEY, String(Date.now() + days * 86400000))
}

export function notificationPromptDeclineForever(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(DECLINED_KEY, '1')
}

export function notificationPromptMarkCompleted(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(COMPLETED_KEY, '1')
}

export function useNotificationPrompt() {
  const open = ref(false)
  const reason = ref<NotificationPromptReason>('default')
  const route = useRoute()
  const { isAuthenticated, currentUser } = useAuth()
  let timer: ReturnType<typeof setTimeout> | null = null
  let unsubscribeEngagement: (() => void) | null = null
  let sessionStartedAt = typeof window !== 'undefined' ? Date.now() : 0
  let distinctRoutes = 0
  let lastRoute = ''

  function clearTimer() {
    if (timer != null) {
      clearTimeout(timer)
      timer = null
    }
  }

  watch(open, (v) => {
    setNotificationPromptOpen(v)
  })

  async function tryOpenPrompt(triggerReason: NotificationPromptReason) {
    if (typeof window === 'undefined') return
    if (!canShowPromptAfter()) return
    if (shouldDeferNotificationPrompt(isAuthenticated.value, route.path, currentUser.value)) return
    if (!storageAllowsPrompt()) return
    if (!isWebPushSupported()) return
    if (Notification.permission !== 'default') return

    try {
      const ready = await isWebPushBackendReady(api)
      if (!ready) return
    } catch {
      return
    }

    reason.value = triggerReason
    open.value = true
  }

  function schedulePrompt(delayMs: number, triggerReason: NotificationPromptReason) {
    clearTimer()
    open.value = false

    if (typeof window === 'undefined') return
    if (shouldDeferNotificationPrompt(isAuthenticated.value, route.path, currentUser.value)) return
    if (!storageAllowsPrompt()) return
    if (!isWebPushSupported()) return
    if (Notification.permission !== 'default') return

    timer = setTimeout(() => {
      timer = null
      void tryOpenPrompt(triggerReason)
    }, delayMs)
  }

  function onEngagement(moment: EngagementMoment) {
    if (moment === 'pin_published' || moment === 'feed_engaged') return
    schedulePrompt(MOMENT_DELAY_MS, momentToReason(moment))
  }

  function scheduleSessionFallback() {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem(SESSION_FALLBACK_KEY) === '1') return
    if (Date.now() - sessionStartedAt < 50000) return
    if (distinctRoutes < 2) return
    if (pathExcluded(route.path)) return

    sessionStorage.setItem(SESSION_FALLBACK_KEY, '1')
    schedulePrompt(FALLBACK_DELAY_MS, 'default')
  }

  watch(
    () => [isAuthenticated.value, route.path, currentUser.value?.onboardingCompletedAt] as const,
    ([auth, path]) => {
      if (!auth) {
        clearTimer()
        return
      }
      const normalized = (path.split('?')[0] || '/').replace(/\/+$/, '') || '/'
      if (normalized !== lastRoute) {
        lastRoute = normalized
        distinctRoutes += 1
      }
      if (shouldDeferNotificationPrompt(auth, path, currentUser.value)) {
        clearTimer()
        return
      }
      scheduleSessionFallback()
    },
    { immediate: true },
  )

  unsubscribeEngagement = onEngagementMoment(onEngagement)

  onUnmounted(() => {
    clearTimer()
    unsubscribeEngagement?.()
    unsubscribeEngagement = null
    setNotificationPromptOpen(false)
  })

  return {
    notificationPromptOpen: open,
    notificationPromptReason: reason,
    notificationPromptSnooze: () => notificationPromptSnoozeDays(7),
    notificationPromptDecline: () => notificationPromptDeclineForever(),
  }
}
