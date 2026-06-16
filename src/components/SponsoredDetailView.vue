<script setup lang="ts">
import { computed } from 'vue'
import type { SponsoredAd } from '../types'
import { isPartnerAd, isFotoPromo } from '../types'
import { useI18n } from '../i18n'
import api from '../api/index'
import OfflineImg from './OfflineImg.vue'
import OfflineVideo from './OfflineVideo.vue'

const props = withDefaults(
  defineProps<{
    item: SponsoredAd
    tone?: 'light' | 'dark'
    layout?: 'mobile' | 'desktop'
  }>(),
  { tone: 'dark', layout: 'mobile' },
)

const emit = defineEmits<{ (e: 'cta'): void }>()

const { t } = useI18n()

const badge = computed(() =>
  isFotoPromo(props.item) ? t('feed.fotoPromo.badge') : t('feed.partnerAd.badge'),
)

const ctaLabel = computed(() =>
  isFotoPromo(props.item)
    ? props.item.ctaLabel || t('feed.fotoPromo.ctaDefault')
    : props.item.ctaLabel || t('feed.partnerAd.ctaDefault'),
)

const heroUrl = computed(() => {
  if (isFotoPromo(props.item) && props.item.mediaUrl) return props.item.mediaUrl
  return props.item.imageUrl
})

async function onCta() {
  if (isPartnerAd(props.item)) {
    try {
      await api.post(`monetization/partner-campaigns/${props.item.campaignId}/click/`)
    } catch {
      /* ignore */
    }
    window.open(props.item.ctaUrl, '_blank', 'noopener,noreferrer')
    emit('cta')
    return
  }
  if (isFotoPromo(props.item)) {
    try {
      await api.post(`monetization/foto-promo-campaigns/${props.item.campaignId}/click/`)
    } catch {
      /* ignore */
    }
    const cta = props.item.ctaUrl?.trim()
    if (cta) window.open(cta, '_blank', 'noopener,noreferrer')
    emit('cta')
  }
}
</script>

<template>
  <div
    class="sponsored-detail-view flex h-full min-h-0 w-full flex-col"
    :class="tone === 'dark' ? 'text-white' : 'text-neutral-900 dark:text-neutral-100'"
  >
    <div
      v-if="heroUrl || (isFotoPromo(item) && item.mediaType === 'video' && item.mediaUrl)"
      class="relative w-full shrink-0 overflow-hidden bg-neutral-900"
      :class="layout === 'desktop' ? 'max-h-[min(52vh,520px)] aspect-[16/10]' : 'aspect-[4/5] max-h-[58vh]'"
    >
      <OfflineVideo
        v-if="isFotoPromo(item) && item.mediaType === 'video' && item.mediaUrl"
        :src="item.mediaUrl"
        class="h-full w-full object-cover"
        muted
        playsinline
        preload="metadata"
      />
      <OfflineImg
        v-else-if="heroUrl"
        :src="heroUrl"
        :alt="item.title"
        class="h-full w-full object-cover"
      />
      <div
        class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent"
      />
      <div class="absolute left-4 top-4 flex flex-wrap items-center gap-2">
        <span
          class="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide"
          :class="tone === 'dark' ? 'bg-pink-600/90 text-white' : 'bg-pink-700 text-white'"
        >
          {{ badge }}
        </span>
        <span
          v-if="item.sponsorName"
          class="rounded-full px-3 py-1 text-[10px] font-medium backdrop-blur-md"
          :class="tone === 'dark' ? 'bg-black/45 text-white/90' : 'bg-white/85 text-neutral-700'"
        >
          {{ item.sponsorName }}
        </span>
      </div>
    </div>

    <div
      class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5"
      :class="tone === 'dark' ? 'bg-gradient-to-b from-neutral-950 to-black' : 'bg-white dark:bg-neutral-950'"
    >
      <div class="space-y-3">
        <h2
          class="font-semibold leading-tight"
          :class="layout === 'desktop' ? 'text-2xl' : 'text-xl'"
        >
          {{ item.title }}
        </h2>
        <p
          v-if="item.body"
          class="text-sm leading-relaxed"
          :class="tone === 'dark' ? 'text-white/80' : 'text-neutral-600 dark:text-neutral-300'"
        >
          {{ item.body }}
        </p>
      </div>

      <button
        type="button"
        class="mt-auto w-full rounded-2xl py-3.5 text-sm font-bold shadow-lg transition active:scale-[0.99]"
        :class="tone === 'dark' ? 'bg-white text-pink-800' : 'bg-pink-700 text-white'"
        @click="onCta"
      >
        {{ ctaLabel }}
      </button>
    </div>
  </div>
</template>
