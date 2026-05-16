import { ref, watch, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from './useAuth'
import api from '../api'
import { isWebPushBackendReady, isWebPushSupported } from '../utils/webPushClient'

const DECLINED_KEY = 'pinova_notif_prompt_declined'
const SNOOZE_KEY = 'pinova_notif_prompt_snooze_until'
const COMPLETED_KEY = 'pinova_notif_prompt_completed'

/** Délais après navigation avant d’afficher la modale (évite le flash au login). */
const PROMPT_DELAY_MS = 14000

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

function storageAllowsPrompt(): boolean {
  if (typeof localStorage === 'undefined') return false
  if (localStorage.getItem(DECLINED_KEY) === '1') return false
  if (localStorage.getItem(COMPLETED_KEY) === '1') return false
  const snooze = Number(localStorage.getItem(SNOOZE_KEY) || '0')
  if (Number.isFinite(snooze) && snooze > Date.now()) return false
  return true
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
  const route = useRoute()
  const { isAuthenticated } = useAuth()
  let timer: ReturnType<typeof setTimeout> | null = null

  function clearTimer() {
    if (timer != null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function schedulePrompt() {
    clearTimer()
    open.value = false

    if (typeof window === 'undefined') return
    if (!isAuthenticated.value) return
    if (!storageAllowsPrompt()) return
    if (!isWebPushSupported()) return
    if (Notification.permission !== 'default') return
    if (pathExcluded(route.path)) return

    timer = setTimeout(async () => {
      timer = null
      if (!isAuthenticated.value) return
      if (Notification.permission !== 'default') return
      if (pathExcluded(route.path)) return
      if (!storageAllowsPrompt()) return

      try {
        const ready = await isWebPushBackendReady(api)
        if (!ready) return
      } catch {
        return
      }

      open.value = true
    }, PROMPT_DELAY_MS)
  }

  watch(
    () => [isAuthenticated.value, route.path] as const,
    () => {
      schedulePrompt()
    },
    { immediate: true },
  )

  onUnmounted(() => {
    clearTimer()
  })

  return {
    notificationPromptOpen: open,
    notificationPromptSnooze: () => notificationPromptSnoozeDays(7),
    notificationPromptDecline: () => notificationPromptDeclineForever(),
  }
}
