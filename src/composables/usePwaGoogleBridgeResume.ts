import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'
import { useAuth } from './useAuth'
import {
  clearPwaGoogleBridgeStorage,
  readPwaGoogleBridgeFromStorage,
  PWA_GOOGLE_RETURN_KEY,
} from '../utils/pwaGoogleAuth'
import { getPostAuthRouteName } from '../utils/onboarding'

const POLL_MS = 2000
const MAX_POLL_MS = 120_000

/**
 * Quand l'utilisateur revient à la PWA après OAuth dans Safari,
 * réclame la session stockée côté serveur (bridge_id + pwa_state).
 */
export function usePwaGoogleBridgeResume() {
  const router = useRouter()
  const { completeOAuthSession, isAuthenticated } = useAuth()
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let pollStartedAt = 0

  async function tryClaim(): Promise<boolean> {
    if (isAuthenticated.value) {
      clearPwaGoogleBridgeStorage()
      return false
    }
    const bridge = readPwaGoogleBridgeFromStorage()
    if (!bridge) return false

    try {
      const res = await api.post<{ access?: string; refresh?: string }>('auth/pwa/google/claim/', {
        bridge_id: bridge.bridgeId,
        pwa_state: bridge.pwaState,
      })
      if (!res.data?.access) return false
      const result = await completeOAuthSession(res.data)
      if (!result.success) return false

      clearPwaGoogleBridgeStorage()
      stopPoll()

      let returnTo = '/'
      try {
        returnTo = sessionStorage.getItem(PWA_GOOGLE_RETURN_KEY) || '/'
        sessionStorage.removeItem(PWA_GOOGLE_RETURN_KEY)
      } catch {
        /* ignore */
      }

      const routeName = getPostAuthRouteName(result.user ?? null)
      if (routeName === 'onboarding') {
        await router.replace({ name: 'onboarding' })
        return true
      }
      if (returnTo.startsWith('/') && !returnTo.startsWith('//')) {
        await router.replace(returnTo)
      } else {
        await router.replace({ name: 'home' })
      }
      return true
    } catch {
      return false
    }
  }

  function stopPoll() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  function startPollIfPending() {
    if (!readPwaGoogleBridgeFromStorage() || isAuthenticated.value) return
    if (pollTimer) return
    pollStartedAt = Date.now()
    pollTimer = setInterval(() => {
      if (Date.now() - pollStartedAt > MAX_POLL_MS) {
        stopPoll()
        return
      }
      void tryClaim()
    }, POLL_MS)
  }

  function onVisibility() {
    if (document.visibilityState === 'visible') {
      void tryClaim().then((ok) => {
        if (!ok) startPollIfPending()
      })
    }
  }

  onMounted(() => {
    void tryClaim().then((ok) => {
      if (!ok) startPollIfPending()
    })
    document.addEventListener('visibilitychange', onVisibility)
  })

  onUnmounted(() => {
    stopPoll()
    document.removeEventListener('visibilitychange', onVisibility)
  })
}
