<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'
import { useAuth } from '../composables/useAuth'
import { useI18n } from '../i18n'
import { useAppModal } from '../composables/useAppModal'
import SponsoredContentCard from '../components/SponsoredContentCard.vue'
import type { PinPromo } from '../types'

type Pack = { slug: string; label: string; duration_hours: number; amount: number; currency_iso: string }

type CampaignRow = {
  id: number
  pin_slug: string
  pin_title: string
  pin_image_url: string
  headline: string
  body: string
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

const router = useRouter()
const { t } = useI18n()
const { isAuthenticated } = useAuth()
const { showAlert } = useAppModal()

const campaigns = ref<CampaignRow[]>([])
const packs = ref<Pack[]>([])
const pending = ref(false)
const pinSlug = ref('')
const headline = ref('')
const body = ref('')
const packageSlug = ref('')
const topicSlug = ref('')

const preview = computed((): PinPromo | null => {
  if (!pinSlug.value.trim()) return null
  return {
    feedType: 'pin_promo',
    id: 'preview',
    campaignId: 0,
    pinSlug: pinSlug.value.trim(),
    pinId: 0,
    title: headline.value.trim() || t('promote.campaigns.previewTitle'),
    body: body.value.trim(),
    sponsorName: '@vous',
    username: 'vous',
    imageUrl: '',
    ctaLabel: t('feed.pinPromo.ctaDefault'),
  }
})

onMounted(async () => {
  if (!isAuthenticated.value) {
    void router.replace({ name: 'login' })
    return
  }
  const [cRes, pRes] = await Promise.all([
    api.get<{ results: CampaignRow[] }>('monetization/pin-promo-campaigns/'),
    api.get<{ results: Pack[] }>('monetization/boost-packages/'),
  ])
  campaigns.value = cRes.data.results ?? []
  packs.value = pRes.data.results ?? []
  if (packs.value[0]) packageSlug.value = packs.value[0].slug
})

async function submit() {
  if (!pinSlug.value.trim() || !packageSlug.value) {
    await showAlert(t('promote.campaigns.validation'), { variant: 'warning' })
    return
  }
  pending.value = true
  try {
    const res = await api.post('monetization/pin-promo-campaigns/', {
      pin_slug: pinSlug.value.trim(),
      package: packageSlug.value,
      headline: headline.value.trim(),
      body: body.value.trim(),
      topic_slug: topicSlug.value.trim(),
    })
    const data = res.data as { checkout_url?: string; status?: string; sandbox?: boolean }
    if (data.checkout_url) {
      window.location.href = data.checkout_url
      return
    }
    if (data.status === 'active' || data.sandbox) {
      await showAlert(t('promote.campaigns.created'), { variant: 'success' })
      const cRes = await api.get<{ results: CampaignRow[] }>('monetization/pin-promo-campaigns/')
      campaigns.value = cRes.data.results ?? []
      pinSlug.value = ''
      headline.value = ''
      body.value = ''
      return
    }
    await showAlert(t('promote.campaigns.error'), { variant: 'danger' })
  } catch {
    await showAlert(t('promote.campaigns.error'), { variant: 'danger' })
  } finally {
    pending.value = false
  }
}

async function togglePause(row: CampaignRow) {
  const next = row.status === 'active' ? 'paused' : 'active'
  await api.patch(`monetization/pin-promo-campaigns/${row.id}/`, { status: next })
  const cRes = await api.get<{ results: CampaignRow[] }>('monetization/pin-promo-campaigns/')
  campaigns.value = cRes.data.results ?? []
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 py-8 space-y-8">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-xs font-bold uppercase tracking-widest text-pink-600">{{ t('promote.campaigns.kicker') }}</p>
        <h1 class="text-2xl sm:text-3xl font-bold">{{ t('promote.campaigns.title') }}</h1>
        <p class="text-sm text-neutral-600 dark:text-neutral-400 mt-1 max-w-xl">{{ t('promote.campaigns.subtitle') }}</p>
      </div>
      <button
        type="button"
        class="rounded-xl bg-pink-700 text-white text-sm font-semibold px-4 py-2"
        @click="router.push({ name: 'boost-promote' })"
      >
        {{ t('promote.campaigns.boostOnly') }}
      </button>
    </header>

    <div class="grid lg:grid-cols-2 gap-8">
      <section class="space-y-4 rounded-2xl border app-divider-subtle p-5 bg-white/70 dark:bg-neutral-900/50">
        <h2 class="font-semibold">{{ t('promote.campaigns.formTitle') }}</h2>
        <label class="block text-sm space-y-1">
          <span>{{ t('promote.campaigns.pinSlug') }}</span>
          <input v-model="pinSlug" class="w-full rounded-xl border app-divider-subtle px-3 py-2 text-sm" />
        </label>
        <label class="block text-sm space-y-1">
          <span>{{ t('promote.campaigns.headline') }}</span>
          <input v-model="headline" class="w-full rounded-xl border app-divider-subtle px-3 py-2 text-sm" />
        </label>
        <label class="block text-sm space-y-1">
          <span>{{ t('promote.campaigns.body') }}</span>
          <textarea v-model="body" rows="3" class="w-full rounded-xl border app-divider-subtle px-3 py-2 text-sm" />
        </label>
        <label class="block text-sm space-y-1">
          <span>{{ t('promote.campaigns.package') }}</span>
          <select v-model="packageSlug" class="w-full rounded-xl border app-divider-subtle px-3 py-2 text-sm">
            <option v-for="p in packs" :key="p.slug" :value="p.slug">
              {{ p.label }} — {{ p.amount }} {{ p.currency_iso }}
            </option>
          </select>
        </label>
        <label class="block text-sm space-y-1">
          <span>{{ t('promote.campaigns.topic') }}</span>
          <input v-model="topicSlug" class="w-full rounded-xl border app-divider-subtle px-3 py-2 text-sm" />
        </label>
        <button
          type="button"
          class="w-full rounded-xl bg-pink-700 hover:bg-pink-800 text-white font-semibold py-3 disabled:opacity-50"
          :disabled="pending"
          @click="submit"
        >
          {{ pending ? t('common.loading') : t('promote.campaigns.publish') }}
        </button>
      </section>

      <section class="space-y-3">
        <h2 class="font-semibold">{{ t('promote.campaigns.preview') }}</h2>
        <SponsoredContentCard v-if="preview" :item="preview" variant="feed" />
        <p v-else class="text-sm text-neutral-500">{{ t('promote.campaigns.previewEmpty') }}</p>
      </section>
    </div>

    <section class="space-y-4">
      <h2 class="text-lg font-semibold">{{ t('promote.campaigns.trackingTitle') }}</h2>
      <div v-if="!campaigns.length" class="rounded-2xl border app-divider-subtle p-8 text-center text-sm text-neutral-500">
        {{ t('promote.campaigns.trackingEmpty') }}
      </div>
      <div v-else class="grid gap-3 sm:grid-cols-2">
        <div
          v-for="c in campaigns"
          :key="c.id"
          class="rounded-2xl border app-divider-subtle p-4 space-y-3 bg-white/60 dark:bg-neutral-900/40"
        >
          <div class="flex justify-between gap-2">
            <div>
              <p class="font-semibold text-sm">{{ c.headline || c.pin_title }}</p>
              <p class="text-xs text-neutral-500">{{ c.pin_slug }} · {{ c.status }}</p>
            </div>
            <button
              v-if="c.status === 'active' || c.status === 'paused'"
              type="button"
              class="text-xs font-semibold text-pink-700"
              @click="togglePause(c)"
            >
              {{ c.status === 'active' ? t('promote.campaigns.pause') : t('promote.campaigns.resume') }}
            </button>
          </div>
          <div class="grid grid-cols-4 gap-2 text-center">
            <div class="rounded-lg bg-pink-50 dark:bg-pink-950/30 p-2">
              <p class="text-lg font-bold text-pink-700">{{ c.impressions }}</p>
              <p class="text-[10px] uppercase text-neutral-500">{{ t('promote.campaigns.impressions') }}</p>
            </div>
            <div class="rounded-lg bg-pink-50 dark:bg-pink-950/30 p-2">
              <p class="text-lg font-bold text-pink-700">{{ c.clicks }}</p>
              <p class="text-[10px] uppercase text-neutral-500">{{ t('promote.campaigns.clicks') }}</p>
            </div>
            <div class="rounded-lg bg-pink-50 dark:bg-pink-950/30 p-2">
              <p class="text-lg font-bold text-pink-700">{{ c.pin_views }}</p>
              <p class="text-[10px] uppercase text-neutral-500">{{ t('promote.campaigns.views') }}</p>
            </div>
            <div class="rounded-lg bg-pink-50 dark:bg-pink-950/30 p-2">
              <p class="text-lg font-bold text-pink-700">{{ c.ctr }}%</p>
              <p class="text-[10px] uppercase text-neutral-500">CTR</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
