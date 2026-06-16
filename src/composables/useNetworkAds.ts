import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import api from '../api/index'
import { useAuth } from './useAuth'

export type NetworkAdWebConfig = {
  client_id: string
  feed_slot: string
  detail_slot: string
}

export type NetworkAdConfig = {
  enabled: boolean
  configured: boolean
  show: boolean
  feed_every_n: number
  web: NetworkAdWebConfig | null
  mobile: Record<string, string> | null
}

const cachedConfig: Ref<NetworkAdConfig | null> = ref(null)
let inflight: Promise<NetworkAdConfig | null> | null = null

export async function fetchNetworkAdConfig(): Promise<NetworkAdConfig | null> {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const res = await api.get<NetworkAdConfig>('monetization/network-ad-config/')
      cachedConfig.value = res.data
      return res.data
    } catch {
      cachedConfig.value = null
      return null
    } finally {
      inflight = null
    }
  })()
  return inflight
}

export function useNetworkAds() {
  const { currentUser, isAuthenticated } = useAuth()
  const config = cachedConfig
  const ready = ref(false)

  async function refresh() {
    ready.value = false
    await fetchNetworkAdConfig()
    ready.value = true
  }

  watch(
    () => [isAuthenticated.value, currentUser.value?.subscription?.adAdsEnabled, currentUser.value?.id] as const,
    () => {
      void refresh()
    },
    { immediate: true },
  )

  const showFeedAds: ComputedRef<boolean> = computed(
    () => ready.value && !!config.value?.show && !!config.value?.web?.feed_slot,
  )

  const showDetailAds: ComputedRef<boolean> = computed(
    () => ready.value && !!config.value?.show && !!config.value?.web?.detail_slot,
  )

  const feedEveryN: ComputedRef<number> = computed(() => config.value?.feed_every_n ?? 10)

  const webClientId: ComputedRef<string> = computed(() => config.value?.web?.client_id ?? '')
  const webFeedSlot: ComputedRef<string> = computed(() => config.value?.web?.feed_slot ?? '')
  const webDetailSlot: ComputedRef<string> = computed(() => config.value?.web?.detail_slot ?? '')

  return {
    config,
    ready,
    showFeedAds,
    showDetailAds,
    feedEveryN,
    webClientId,
    webFeedSlot,
    webDetailSlot,
    refresh,
  }
}

/** Insère des marqueurs pub réseau dans une liste de fotos (côté client). */
export function injectNetworkAdMarkers<T extends { id?: string | number }>(
  items: T[],
  opts: { everyN: number; enabled: boolean },
): Array<T | { feedType: 'network_ad'; id: string }> {
  if (!opts.enabled || opts.everyN < 1) return items
  const out: Array<T | { feedType: 'network_ad'; id: string }> = []
  let fotoCount = 0
  for (const item of items) {
    out.push(item)
    fotoCount += 1
    if (fotoCount % opts.everyN === 0) {
      out.push({ feedType: 'network_ad', id: `network-ad-${fotoCount}` })
    }
  }
  return out
}

export function isNetworkAdFeedItem(item: unknown): item is { feedType: 'network_ad'; id: string } {
  return (
    typeof item === 'object'
    && item !== null
    && (item as { feedType?: string }).feedType === 'network_ad'
  )
}
