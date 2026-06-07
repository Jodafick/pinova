import { watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from './useAuth'
import { useI18n } from '../i18n'
import { replayPendingIntent } from '../lib/replayPendingIntent'
import { peekPendingIntent } from '../lib/pendingIntentStorage'

let replayedThisBoot = false

export function usePendingIntentReplay() {
  const router = useRouter()
  const { isAuthenticated, currentUser } = useAuth()
  const { t } = useI18n()

  async function tryReplay() {
    if (!isAuthenticated.value || !currentUser.value || replayedThisBoot) return
    if (!peekPendingIntent()) return
    replayedThisBoot = true
    await replayPendingIntent(router, t)
  }

  watch(
    [isAuthenticated, currentUser],
    () => {
      void tryReplay()
    },
    { immediate: true },
  )

  return { tryReplay }
}
