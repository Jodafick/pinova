import { computed, ref } from 'vue'
import api from '../api'
import { useI18n } from '../i18n'
import { useAuth } from './useAuth'
import { mapDjangoPinToFrontend } from './usePins'
import type { Pin } from '../types'

export type BoostPack = {
  slug: string
  label: string
  duration_hours: number
  amount: number
  currency_iso: string
}

export type BoostHistoryRow = {
  id: number
  pin_slug: string
  pin_title: string
  package_label: string
  status: string
  starts_at: string | null
  ends_at: string | null
}

export type CampaignRow = {
  id: number
  pin_slug: string
  pin_title: string
  image_url: string
  headline: string
  body: string
  cta_label: string
  cta_url: string
  package_label: string
  package_slug: string
  status: string
  impressions: number
  clicks: number
  pin_views: number
  ctr: number
  starts_at: string | null
  ends_at: string | null
}

const PINS_PAGE_SIZE = 20

export function usePromoteHub() {
  const { currentLang } = useI18n()
  const { currentUser } = useAuth()

  const packs = ref<BoostPack[]>([])
  const history = ref<BoostHistoryRow[]>([])
  const campaigns = ref<CampaignRow[]>([])
  const myPins = ref<Pin[]>([])
  const selectedSlug = ref('')
  const loading = ref(false)
  const pinsLoading = ref(false)
  const pinsLoadingMore = ref(false)
  const pinsPage = ref(1)
  const pinsHasMore = ref(false)

  const selectedPin = computed(() => myPins.value.find((p) => p.slug === selectedSlug.value) ?? null)

  async function loadCatalog() {
    loading.value = true
    try {
      const [packRes, histRes, campRes] = await Promise.all([
        api.get<{ results: BoostPack[] }>('monetization/boost-packages/'),
        api.get<{ results: BoostHistoryRow[] }>('monetization/my-boosts/'),
        api.get<{ results: CampaignRow[] }>('monetization/pin-promo-campaigns/'),
      ])
      packs.value = packRes.data.results ?? []
      history.value = histRes.data.results ?? []
      campaigns.value = campRes.data.results ?? []
    } finally {
      loading.value = false
    }
  }

  async function loadMyPins(preferredSlug?: string, reset = true) {
    const username = currentUser.value?.username
    if (!username) return
    if (reset) {
      pinsLoading.value = true
      pinsPage.value = 1
      myPins.value = []
    } else {
      pinsLoadingMore.value = true
    }
    try {
      const page = reset ? 1 : pinsPage.value + 1
      const res = await api.get<{ results: unknown[]; next?: string | null }>('pins/', {
        params: {
          author: username,
          page,
          page_size: PINS_PAGE_SIZE,
          lang: currentLang.value,
        },
      })
      const batch = (res.data.results ?? []).map((row) => mapDjangoPinToFrontend(row as Record<string, unknown>))
      myPins.value = reset ? batch : [...myPins.value, ...batch]
      pinsPage.value = page
      pinsHasMore.value = !!res.data.next
      if (preferredSlug && myPins.value.some((p) => p.slug === preferredSlug)) {
        selectedSlug.value = preferredSlug
      } else if (reset && !selectedSlug.value && myPins.value[0]) {
        selectedSlug.value = myPins.value[0].slug
      }
    } finally {
      pinsLoading.value = false
      pinsLoadingMore.value = false
    }
  }

  function formatDuration(h: number, t: (k: string, p?: Record<string, string | number>) => string) {
    if (h >= 168) return t('promote.boost.durationDays', { n: Math.round(h / 24) })
    if (h >= 24) return t('promote.boost.durationDay', { n: Math.round(h / 24) })
    return t('promote.boost.durationHours', { n: h })
  }

  function formatMoney(amount: number, iso: string) {
    try {
      return new Intl.NumberFormat(currentLang.value || 'fr', {
        style: 'currency',
        currency: iso || 'XOF',
        maximumFractionDigits: 0,
      }).format(amount)
    } catch {
      return `${amount} ${iso}`
    }
  }

  return {
    packs,
    history,
    campaigns,
    myPins,
    selectedSlug,
    selectedPin,
    loading,
    pinsLoading,
    pinsLoadingMore,
    pinsHasMore,
    loadCatalog,
    loadMyPins,
    formatDuration,
    formatMoney,
  }
}
