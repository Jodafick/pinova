<script setup lang="ts">
import type { PartnerAd } from '../types'
import { useI18n } from '../i18n'
import api from '../api'
import OfflineImg from './OfflineImg.vue'

const props = defineProps<{ ad: PartnerAd }>()
const { t } = useI18n()

async function onCtaClick() {
  try {
    await api.post(`monetization/partner-campaigns/${props.ad.campaignId}/click/`)
  } catch {
    /* ignore */
  }
  window.open(props.ad.ctaUrl, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <article
    class="lux-pin-card partner-ad-card rounded-3xl overflow-hidden border border-pink-200/40 dark:border-pink-500/30 bg-gradient-to-b from-pink-50/80 to-white dark:from-pink-950/40 dark:to-neutral-900 shadow-sm"
    :aria-label="t('feed.partnerAd.aria', { title: ad.title })"
  >
    <div class="px-3 pt-2 pb-1 flex items-center justify-between gap-2">
      <span class="text-[10px] font-bold uppercase tracking-wide text-pink-700 dark:text-pink-400">
        {{ t('feed.partnerAd.badge') }}
      </span>
      <span v-if="ad.sponsorName" class="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
        {{ ad.sponsorName }}
      </span>
    </div>
    <div v-if="ad.imageUrl" class="relative aspect-[4/3] bg-neutral-100 dark:bg-neutral-800">
      <OfflineImg :src="ad.imageUrl" :alt="ad.title" class="w-full h-full object-cover" />
    </div>
    <div class="p-3 space-y-2">
      <h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100 line-clamp-2">{{ ad.title }}</h3>
      <p v-if="ad.body" class="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-3">{{ ad.body }}</p>
      <button
        type="button"
        class="w-full rounded-xl bg-pink-700 hover:bg-pink-800 text-white text-xs font-semibold py-2.5 transition-colors"
        @click.stop="onCtaClick"
      >
        {{ ad.ctaLabel || t('feed.partnerAd.ctaDefault') }}
      </button>
    </div>
  </article>
</template>
