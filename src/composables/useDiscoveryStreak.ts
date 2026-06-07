import { onMounted, ref, watch, type Ref } from 'vue'
import api from '../api/index'
import { useAuth } from './useAuth'
export type DiscoveryStreak = {
  count: number
  best: number
  last_date: string | null
  paused: boolean
  at_risk?: boolean
  grace_days: number
}

export function useDiscoveryStreak(active: Ref<boolean>) {
  const { isAuthenticated } = useAuth()
  const streak = ref<DiscoveryStreak | null>(null)

  async function refresh() {
    if (!isAuthenticated.value) {
      streak.value = null
      return
    }
    try {
      const res = await api.post<DiscoveryStreak>('me/discovery-streak/')
      streak.value = res.data
    } catch {
      streak.value = null
    }
  }

  watch(active, (on) => {
    if (on) void refresh()
  })

  onMounted(() => {
    if (active.value) void refresh()
  })

  return { streak, refresh }
}
