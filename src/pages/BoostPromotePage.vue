<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api'
import { useAuth } from '../composables/useAuth'
import { useI18n } from '../i18n'
import { useAppModal } from '../composables/useAppModal'
import { usePromoteHub } from '../composables/usePromoteHub'
import PinPickerField from '../components/PinPickerField.vue'
import CampaignTargetingPanel from '../components/CampaignTargetingPanel.vue'
import SponsoredContentCard from '../components/SponsoredContentCard.vue'
import {
  appendCampaignToFormData,
  emptyTargeting,
  type CampaignTargeting,
} from '../composables/useCampaignTargeting'
import type { PinPromo } from '../types'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { isAuthenticated, currentUser } = useAuth()
const { showAlert } = useAppModal()
const {
  packs,
  history,
  campaigns,
  myPins,
  selectedSlug,
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
const targeting = ref<CampaignTargeting>(emptyTargeting())
const packageSlug = ref('')

const pinFromQuery = computed(() => String(route.query.pin || '').trim())

const campaignPreview = computed((): PinPromo | null => {
  if (!headline.value.trim()) return null
  return {
    feedType: 'pin_promo',
    id: 'preview',
    campaignId: 0,
    title: headline.value.trim(),
    body: body.value.trim(),
    sponsorName: currentUser.value?.username ? `@${currentUser.value.username}` : '',
    username: currentUser.value?.username ?? '',
    imageUrl: mediaPreviewUrl.value,
    mediaUrl: mediaPreviewUrl.value,
    mediaType: mediaType.value,
    ctaLabel: ctaLabel.value.trim() || t('feed.partnerAd.ctaDefault'),
    ctaUrl: ctaUrl.value.trim(),
  }
})

function onMediaChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  mediaFile.value = file
  if (!file) {
    mediaPreviewUrl.value = ''
    return
  }
  const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(file.name)
  mediaType.value = isVideo ? 'video' : 'image'
  mediaPreviewUrl.value = URL.createObjectURL(file)
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
  if (packs.value[0]) packageSlug.value = packs.value[0].slug
})

async function startBoost(packSlug: string) {
  if (!selectedSlug.value) return
  busy.value = true
  try {
    const res = await api.post(`monetization/pins/${encodeURIComponent(selectedSlug.value)}/boost/`, { package: packSlug })
    const data = res.data as { checkout_url?: string; status?: string }
    if (data.checkout_url) {
      window.location.href = data.checkout_url
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
      window.location.href = data.checkout_url
      return
    }
    if (data.status === 'active' || data.sandbox) {
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
  <div class="min-h-[70vh] pb-16">
    <div class="relative overflow-hidden rounded-b-[2rem] bg-gradient-to-br from-pink-600 via-pink-700 to-amber-600 text-white px-4 sm:px-8 pt-8 pb-10">
      <div class="max-w-4xl mx-auto relative z-[1]">
        <p class="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">{{ t('promote.hub.kicker') }}</p>
        <h1 class="text-2xl sm:text-3xl font-black mt-1">{{ t('promote.hub.title') }}</h1>
        <p class="text-sm text-white/85 mt-2 max-w-lg">{{ t('promote.hub.subtitle') }}</p>
      </div>
      <div class="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
    </div>

    <div class="max-w-4xl mx-auto px-4 -mt-6 relative z-[2] space-y-6">
      <div class="flex gap-2 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-900">
        <button
          v-for="id in (['boost', 'campaigns', 'stats'] as const)"
          :key="id"
          type="button"
          class="flex-1 rounded-lg py-2.5 text-xs font-bold capitalize transition"
          :class="tab === id ? 'bg-white dark:bg-neutral-800 shadow text-pink-700' : 'text-neutral-500'"
          @click="tab = id"
        >
          {{ t(`promote.hub.tab.${id}`) }}
        </button>
      </div>

      <section v-if="tab === 'boost'" class="space-y-4">
        <section class="app-card rounded-2xl p-4 shadow-lg">
          <p class="text-xs font-semibold text-neutral-500 mb-3">{{ t('promote.sheet.pickPin') }}</p>
          <PinPickerField
            :pins="myPins"
            :selected-slug="selectedSlug"
            :loading="pinsLoading"
            :loading-more="pinsLoadingMore"
            :has-more="pinsHasMore"
            @select="selectedSlug = $event"
            @load-more="loadMyPins(undefined, false)"
          />
        </section>

        <button
          v-for="(p, idx) in packs"
          :key="p.slug"
          type="button"
          class="w-full app-card flex items-center justify-between px-5 py-4 text-left transition hover:shadow-md disabled:opacity-50"
          :class="idx === 1 ? 'ring-2 ring-pink-400/50' : ''"
          :disabled="busy || !selectedSlug"
          @click="startBoost(p.slug)"
        >
          <div>
            <p class="font-bold">{{ p.label }}</p>
            <p class="text-xs text-neutral-500">{{ formatDuration(p.duration_hours, t) }}</p>
          </div>
          <p class="text-lg font-black text-pink-700">{{ formatMoney(p.amount, p.currency_iso) }}</p>
        </button>
        <div v-if="history.length" class="app-card p-4 space-y-2">
          <p class="text-sm font-semibold">{{ t('promote.boost.historyTitle') }}</p>
          <div v-for="row in history.slice(0, 5)" :key="row.id" class="flex justify-between text-sm border-t app-divider-subtle pt-2">
            <span class="truncate">{{ row.pin_title || row.pin_slug }}</span>
            <span class="text-xs text-neutral-500 shrink-0 ml-2">{{ row.status }}</span>
          </div>
        </div>
      </section>

      <section v-else-if="tab === 'campaigns'" class="grid lg:grid-cols-2 gap-6">
        <div class="app-card p-5 space-y-3">
          <h2 class="font-bold">{{ t('promote.campaigns.formTitle') }}</h2>
          <p class="text-xs text-neutral-500">{{ t('promote.sheet.campaignHint') }}</p>
          <input v-model="headline" class="w-full rounded-xl border app-divider-subtle px-3 py-2.5 text-sm" :placeholder="t('promote.campaigns.headlineRequired')" />
          <textarea v-model="body" rows="3" class="w-full rounded-xl border app-divider-subtle px-3 py-2.5 text-sm" :placeholder="t('promote.campaigns.body')" />
          <input v-model="ctaUrl" type="url" class="w-full rounded-xl border app-divider-subtle px-3 py-2.5 text-sm" :placeholder="t('promote.campaigns.ctaUrl')" />
          <input v-model="ctaLabel" class="w-full rounded-xl border app-divider-subtle px-3 py-2.5 text-sm" :placeholder="t('promote.campaigns.ctaLabel')" />
          <input type="file" accept="image/*,video/mp4,video/webm,video/quicktime" class="w-full text-sm" @change="onMediaChange" />
          <p class="text-[11px] text-neutral-500">{{ t('promote.campaigns.mediaHint') }}</p>
          <CampaignTargetingPanel v-model="targeting" />
          <select v-model="packageSlug" class="w-full rounded-xl border app-divider-subtle px-3 py-2.5 text-sm">
            <option v-for="p in packs" :key="p.slug" :value="p.slug">
              {{ p.label }} — {{ formatMoney(p.amount, p.currency_iso) }}
            </option>
          </select>
          <button
            type="button"
            class="w-full rounded-xl bg-pink-700 text-white font-bold py-3 disabled:opacity-50"
            :disabled="busy"
            @click="startCampaign"
          >
            {{ t('promote.campaigns.publish') }}
          </button>
        </div>
        <div class="space-y-2">
          <p class="text-sm font-semibold">{{ t('promote.campaigns.preview') }}</p>
          <SponsoredContentCard v-if="campaignPreview" :item="campaignPreview" variant="feed" />
          <p v-else class="text-sm text-neutral-500">{{ t('promote.campaigns.previewEmpty') }}</p>
        </div>
      </section>

      <section v-else class="grid sm:grid-cols-2 gap-3">
        <div v-for="c in campaigns" :key="c.id" class="app-card p-4 space-y-3">
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
          <div class="grid grid-cols-4 gap-1.5 text-center text-xs">
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
