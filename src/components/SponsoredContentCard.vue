<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { SponsoredAd } from '../types'
import { isPartnerAd, isPinPromo } from '../types'
import { useI18n } from '../i18n'
import api from '../api'
import OfflineImg from './OfflineImg.vue'

const props = withDefaults(
  defineProps<{
    item: SponsoredAd
    variant?: 'feed' | 'detail' | 'story'
  }>(),
  { variant: 'feed' },
)

const { t } = useI18n()
const router = useRouter()

const badge = computed(() =>
  isPinPromo(props.item) ? t('feed.pinPromo.badge') : t('feed.partnerAd.badge'),
)

const ctaLabel = computed(() =>
  isPinPromo(props.item)
    ? props.item.ctaLabel || t('feed.pinPromo.ctaShort')
    : props.item.ctaLabel || t('feed.partnerAd.ctaShort'),
)

async function onTap() {
  if (isPartnerAd(props.item)) {
    try {
      await api.post(`monetization/partner-campaigns/${props.item.campaignId}/click/`)
    } catch {
      /* ignore */
    }
    window.open(props.item.ctaUrl, '_blank', 'noopener,noreferrer')
    return
  }
  if (isPinPromo(props.item) && props.item.pinSlug) {
    try {
      await api.post(`monetization/pin-promo-campaigns/${props.item.campaignId}/click/`)
    } catch {
      /* ignore */
    }
    void router.push({ path: '/', query: { pin: props.item.pinSlug } })
  }
}
</script>

<template>
  <article
    v-if="variant === 'feed'"
    class="sponsored-card lux-pin-card rounded-3xl overflow-hidden border border-pink-200/40 dark:border-pink-500/25 bg-white dark:bg-neutral-900 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
    role="button"
    tabindex="0"
    @click="onTap"
    @keydown.enter="onTap"
  >
    <div class="flex items-stretch gap-0 min-h-[5.5rem]">
      <div
        v-if="item.imageUrl"
        class="w-[4.5rem] shrink-0 bg-neutral-100 dark:bg-neutral-800"
      >
        <OfflineImg :src="item.imageUrl" :alt="item.title" class="w-full h-full object-cover min-h-[5.5rem]" />
      </div>
      <div class="flex-1 min-w-0 px-3 py-2.5 flex flex-col justify-center gap-1">
        <div class="flex items-center justify-between gap-2">
          <span class="text-[9px] font-bold uppercase tracking-wide text-pink-600 dark:text-pink-400">{{ badge }}</span>
          <span v-if="item.sponsorName" class="text-[9px] truncate text-neutral-400 max-w-[45%]">{{ item.sponsorName }}</span>
        </div>
        <h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100 line-clamp-2 leading-snug">
          {{ item.title }}
        </h3>
        <p v-if="item.body" class="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-1">
          {{ item.body }}
        </p>
        <span class="inline-flex self-start text-[10px] font-bold text-pink-700 dark:text-pink-300 mt-0.5">
          {{ ctaLabel }} →
        </span>
      </div>
    </div>
  </article>

  <article
    v-else
    class="sponsored-card overflow-hidden transition-shadow"
    :class="
      variant === 'story'
        ? 'rounded-2xl border border-white/20 bg-black/55 backdrop-blur-md shadow-2xl'
        : 'rounded-2xl border border-pink-200/40 dark:border-pink-500/30 bg-white/95 dark:bg-neutral-900/95 shadow-sm'
    "
    role="button"
    tabindex="0"
    @click="onTap"
    @keydown.enter="onTap"
  >
    <div class="flex items-center justify-between gap-2 px-3 pt-2 pb-1">
      <span
        class="text-[10px] font-bold uppercase tracking-wide"
        :class="variant === 'story' ? 'text-pink-300' : 'text-pink-700 dark:text-pink-400'"
      >
        {{ badge }}
      </span>
      <span
        v-if="item.sponsorName"
        class="text-[10px] truncate"
        :class="variant === 'story' ? 'text-white/70' : 'text-neutral-500 dark:text-neutral-400'"
      >
        {{ item.sponsorName }}
      </span>
    </div>
    <div
      v-if="item.imageUrl"
      class="relative bg-neutral-100 dark:bg-neutral-800"
      :class="variant === 'story' ? 'aspect-[16/9] max-h-28' : 'aspect-[4/3]'"
    >
      <OfflineImg :src="item.imageUrl" :alt="item.title" class="w-full h-full object-cover" />
    </div>
    <div class="space-y-2 p-3">
      <h3
        class="font-semibold line-clamp-2 text-sm"
        :class="variant === 'story' ? 'text-white' : 'text-neutral-900 dark:text-neutral-100'"
      >
        {{ item.title }}
      </h3>
      <p
        v-if="item.body && variant !== 'story'"
        class="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2"
      >
        {{ item.body }}
      </p>
      <span
        class="inline-flex rounded-xl text-xs font-semibold py-2 px-3"
        :class="variant === 'story' ? 'bg-white text-pink-700' : 'bg-pink-700 text-white'"
      >
        {{ ctaLabel }}
      </span>
    </div>
  </article>
</template>
