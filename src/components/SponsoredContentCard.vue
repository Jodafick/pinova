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

async function onCta() {
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
    class="sponsored-card overflow-hidden transition-shadow"
    :class="[
      variant === 'feed'
        ? 'lux-pin-card rounded-3xl border border-pink-200/50 dark:border-pink-500/35 bg-gradient-to-b from-pink-50/90 to-white dark:from-pink-950/50 dark:to-neutral-900 shadow-md hover:shadow-lg'
        : variant === 'story'
          ? 'rounded-2xl border border-white/20 bg-black/55 backdrop-blur-md shadow-2xl'
          : 'rounded-2xl border border-pink-200/40 dark:border-pink-500/30 bg-white/95 dark:bg-neutral-900/95 shadow-sm',
    ]"
  >
    <div
      class="flex items-center justify-between gap-2"
      :class="variant === 'story' ? 'px-3 pt-2 pb-1' : 'px-3 pt-2 pb-1'"
    >
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
    <div class="space-y-2" :class="variant === 'story' ? 'p-3' : 'p-3'">
      <h3
        class="font-semibold line-clamp-2"
        :class="[
          variant === 'story' ? 'text-sm text-white' : 'text-sm text-neutral-900 dark:text-neutral-100',
        ]"
      >
        {{ item.title }}
      </h3>
      <p
        v-if="item.body && variant !== 'story'"
        class="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2"
      >
        {{ item.body }}
      </p>
      <button
        type="button"
        class="w-full rounded-xl text-xs font-semibold py-2.5 transition-colors"
        :class="
          variant === 'story'
            ? 'bg-white text-pink-700 hover:bg-pink-50'
            : 'bg-pink-700 hover:bg-pink-800 text-white'
        "
        @click.stop="onCta"
      >
        {{ isPinPromo(item) ? item.ctaLabel : item.ctaLabel || t('feed.partnerAd.ctaDefault') }}
      </button>
    </div>
  </article>
</template>
