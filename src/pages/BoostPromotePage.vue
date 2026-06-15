<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api/index'
import { useAuth } from '../composables/useAuth'
import { useI18n } from '../i18n'
import { useAppModal } from '../composables/useAppModal'
import { defaultBoostPackSlug, usePromoteHub } from '../composables/usePromoteHub'
import BoostWizardPanel from '../components/BoostWizardPanel.vue'
import CampaignComposer from '../components/CampaignComposer.vue'
import { appendCampaignToFormData, emptyTargeting, type CampaignTargeting } from '../composables/useCampaignTargeting'
import { openCheckoutFlow } from '../utils/checkoutFlow'
import { trackEvent } from '../lib/analytics'
import { useCampaignDraft, clearCampaignDraft } from '../composables/useCampaignDraft'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { isAuthenticated } = useAuth()
const { showAlert } = useAppModal()
const {
  boostPacks,
  campaignPacks,
  history,
  campaigns,
  myPins,
  selectedSlug,
  selectedPin,
  pinsLoading,
  pinsLoadingMore,
  pinsHasMore,
  loadCatalog,
  loadMyPins,
  formatDuration,
  formatMoney,
} = usePromoteHub()

const tab = ref<'boost' | 'campaigns' | 'stats'>('boost')
const busy = ref(false)
const headline = ref('')
const body = ref('')
const ctaUrl = ref('')
const ctaLabel = ref('')
const mediaFile = ref<File | null>(null)
const mediaType = ref<'image' | 'video'>('image')
const mediaPreviewUrl = ref('')
const mediaFileName = ref('')
const targeting = ref<CampaignTargeting>(emptyTargeting())
const packageSlug = ref('')

useCampaignDraft({ headline, body, ctaUrl, ctaLabel, packageSlug, targeting })

const pinFromQuery = computed(() => String(route.query.pin || '').trim())

function onCampaignMedia(payload: { file: File | null; previewUrl: string; mediaType: 'image' | 'video'; fileName: string }) {
  mediaFile.value = payload.file
  mediaPreviewUrl.value = payload.previewUrl
  mediaType.value = payload.mediaType
  mediaFileName.value = payload.fileName
}

onMounted(async () => {
  if (!isAuthenticated.value) {
    void router.replace({ name: 'login', query: { redirect: encodeURIComponent(route.fullPath) } })
    return
  }
  const qTab = String(route.query.tab || '')
  if (qTab === 'campaigns' || qTab === 'stats') tab.value = qTab
  await loadCatalog()
  if (tab.value === 'boost' || pinFromQuery.value) {
    await loadMyPins(pinFromQuery.value)
  }
  if (campaignPacks.value[0] && !packageSlug.value) {
    packageSlug.value = defaultBoostPackSlug(campaignPacks.value)
  }
})

async function startBoost(packSlug: string) {
  if (!selectedSlug.value) return
  trackEvent('boost_started', { pin_slug: selectedSlug.value, package: packSlug })
  busy.value = true
  try {
    const res = await api.post(`monetization/pins/${encodeURIComponent(selectedSlug.value)}/boost/`, { package: packSlug })
    const data = res.data as { checkout_url?: string; status?: string }
    if (data.checkout_url) {
      openCheckoutFlow(router, 'boost', data.checkout_url)
      return
    }
    if (data.status === 'active') {
      await showAlert(t('pin.boost.success'), { variant: 'success' })
      await loadCatalog()
      return
    }
    await showAlert(t('pin.boost.error'), { variant: 'danger' })
  } catch {
    await showAlert(t('pin.boost.error'), { variant: 'danger' })
  } finally {
    busy.value = false
  }
}

async function startCampaign() {
  if (!headline.value.trim() || !ctaUrl.value.trim() || !packageSlug.value) {
    await showAlert(t('promote.campaigns.validation'), { variant: 'warning' })
    return
  }
  busy.value = true
  try {
    const fd = new FormData()
    appendCampaignToFormData(fd, {
      headline: headline.value.trim(),
      body: body.value.trim(),
      ctaUrl: ctaUrl.value.trim(),
      ctaLabel: ctaLabel.value.trim() || t('feed.partnerAd.ctaDefault'),
      packageSlug: packageSlug.value,
      targeting: targeting.value,
      mediaFile: mediaFile.value,
      mediaType: mediaType.value,
    })
    const res = await api.post('monetization/pin-promo-campaigns/', fd)
    const data = res.data as { checkout_url?: string; status?: string; sandbox?: boolean }
    if (data.checkout_url) {
      trackEvent('campaign_launched', { package: packageSlug.value, checkout: true })
      openCheckoutFlow(router, 'campaign', data.checkout_url)
      return
    }
    if (data.status === 'active' || data.sandbox) {
      trackEvent('campaign_launched', { package: packageSlug.value, checkout: false })
      clearCampaignDraft()
      await showAlert(t('promote.campaigns.created'), { variant: 'success' })
      await loadCatalog()
      tab.value = 'stats'
      return
    }
    await showAlert(t('promote.campaigns.error'), { variant: 'danger' })
  } catch {
    await showAlert(t('promote.campaigns.error'), { variant: 'danger' })
  } finally {
    busy.value = false
  }
}

async function togglePause(id: number, status: string) {
  const next = status === 'active' ? 'paused' : 'active'
  await api.patch(`monetization/pin-promo-campaigns/${id}/`, { status: next })
  await loadCatalog()
}
</script>

<template>
  <div class="min-h-0 flex-1 w-full min-w-0 overflow-x-hidden pb-[calc(4rem+env(safe-area-inset-bottom,0px))] sm:pb-16">
    <div class="relative overflow-hidden rounded-b-[2rem] bg-gradient-to-br from-pink-600 via-pink-700 to-amber-600 text-white px-4 sm:px-8 pt-8 pb-10">
      <div class="max-w-4xl mx-auto relative z-[1] w-full min-w-0">
        <p class="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">{{ t('promote.hub.kicker') }}</p>
        <h1 class="text-2xl sm:text-3xl font-black mt-1">{{ t('promote.hub.title') }}</h1>
        <p class="text-sm text-white/85 mt-2 max-w-lg">{{ t('promote.hub.subtitle') }}</p>
      </div>
      <div class="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
    </div>

    <div class="max-w-4xl mx-auto px-4 sm:px-6 -mt-6 relative z-[2] space-y-6 w-full min-w-0">
      <div class="flex gap-1 sm:gap-2 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-900 w-full min-w-0">
        <button
          v-for="id in (['boost', 'campaigns', 'stats'] as const)"
          :key="id"
          type="button"
          class="flex-1 min-w-0 rounded-lg py-2.5 px-1 sm:px-2 text-[10px] sm:text-xs font-bold capitalize transition truncate"
          :class="tab === id ? 'bg-white dark:bg-neutral-800 shadow text-pink-700' : 'text-neutral-500'"
          @click="tab = id"
        >
          {{ t(`promote.hub.tab.${id}`) }}
        </button>
      </div>

      <section v-if="tab === 'boost'" class="app-card rounded-2xl p-4 sm:p-6 shadow-lg w-full min-w-0 overflow-hidden">
        <BoostWizardPanel
          :packs="boostPacks"
          :my-pins="myPins"
          :selected-slug="selectedSlug"
          :selected-pin="selectedPin"
          :pins-loading="pinsLoading"
          :pins-loading-more="pinsLoadingMore"
          :pins-has-more="pinsHasMore"
          :history="history"
          :busy="busy"
          :format-duration="formatDuration"
          :format-money="formatMoney"
          @update:selected-slug="selectedSlug = $event"
          @load-more-pins="loadMyPins(undefined, false)"
          @confirm-boost="startBoost"
          @boost-again="selectedSlug = $event"
        />
      </section>

      <section v-else-if="tab === 'campaigns'" class="app-card rounded-2xl p-4 sm:p-6 shadow-lg w-full min-w-0 overflow-hidden">
        <CampaignComposer
          :packs="campaignPacks"
          :headline="headline"
          :body="body"
          :cta-url="ctaUrl"
          :cta-label="ctaLabel"
          :package-slug="packageSlug"
          :targeting="targeting"
          :media-preview-url="mediaPreviewUrl"
          :media-type="mediaType"
          :media-file-name="mediaFileName"
          :busy="busy"
          :format-money="formatMoney"
          @update:headline="headline = $event"
          @update:body="body = $event"
          @update:cta-url="ctaUrl = $event"
          @update:cta-label="ctaLabel = $event"
          @update:package-slug="packageSlug = $event"
          @update:targeting="targeting = $event"
          @media="onCampaignMedia"
          @submit="startCampaign"
        />
      </section>

      <section v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full min-w-0">
        <div v-for="c in campaigns" :key="c.id" class="app-card p-4 space-y-3 min-w-0">
          <div class="flex justify-between gap-2">
            <div class="min-w-0">
              <p class="font-semibold text-sm truncate">{{ c.headline || c.pin_title }}</p>
              <p class="text-xs text-neutral-500 truncate">{{ c.cta_url || c.pin_slug }} · {{ c.status }}</p>
            </div>
            <button
              v-if="c.status === 'active' || c.status === 'paused'"
              type="button"
              class="text-xs font-bold text-pink-700 shrink-0"
              @click="togglePause(c.id, c.status)"
            >
              {{ c.status === 'active' ? t('promote.campaigns.pause') : t('promote.campaigns.resume') }}
            </button>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center text-xs">
            <div class="rounded-lg bg-pink-50 dark:bg-pink-950/40 p-2"><p class="font-bold">{{ c.impressions }}</p><p class="text-[9px] opacity-70">{{ t('promote.campaigns.impressions') }}</p></div>
            <div class="rounded-lg bg-pink-50 dark:bg-pink-950/40 p-2"><p class="font-bold">{{ c.clicks }}</p><p class="text-[9px] opacity-70">{{ t('promote.campaigns.clicks') }}</p></div>
            <div class="rounded-lg bg-pink-50 dark:bg-pink-950/40 p-2"><p class="font-bold">{{ c.pin_views }}</p><p class="text-[9px] opacity-70">{{ t('promote.campaigns.views') }}</p></div>
            <div class="rounded-lg bg-pink-50 dark:bg-pink-950/40 p-2"><p class="font-bold">{{ c.ctr }}%</p><p class="text-[9px] opacity-70">CTR</p></div>
          </div>
        </div>
        <p v-if="!campaigns.length" class="text-sm text-neutral-500 col-span-full text-center py-8">{{ t('promote.campaigns.trackingEmpty') }}</p>
      </section>
    </div>
  </div>
</template>
