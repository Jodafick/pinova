<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { SponsoredAd } from '../types'
import { isPartnerAd, isPinPromo } from '../types'
import { useI18n } from '../i18n'
import api from '../api'
import OfflineImg from './OfflineImg.vue'

const props = defineProps<{
  item: SponsoredAd
  variant?: 'story' | 'detail'
}>()

const emit = defineEmits<{ (e: 'dismiss'): void }>()

const { t } = useI18n()
const router = useRouter()

const badge = () => (isPinPromo(props.item) ? t('feed.pinPromo.badge') : t('feed.partnerAd.badge'))

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
  if (isPinPromo(props.item)) {
    try {
      await api.post(`monetization/pin-promo-campaigns/${props.item.campaignId}/click/`)
    } catch {
      /* ignore */
    }
    const cta = props.item.ctaUrl?.trim()
    if (cta) {
      window.open(cta, '_blank', 'noopener,noreferrer')
      return
    }
    if (props.item.pinSlug) {
      void router.push({ path: '/', query: { pin: props.item.pinSlug } })
    }
  }
}
</script>

<template>
  <div
    class="sponsored-native-strip flex items-center gap-2.5 rounded-2xl border backdrop-blur-md transition active:scale-[0.99]"
    :class="
      variant === 'story'
        ? 'border-white/15 bg-black/45 px-3 py-2.5 text-white'
        : 'border-pink-200/50 dark:border-pink-500/25 bg-white/90 dark:bg-neutral-900/90 px-3 py-2 shadow-sm'
    "
    role="button"
    tabindex="0"
    @click="onTap"
    @keydown.enter="onTap"
  >
    <div
      v-if="item.imageUrl"
      class="h-10 w-10 rounded-lg overflow-hidden shrink-0 bg-neutral-200"
    >
      <OfflineImg :src="item.imageUrl" :alt="item.title" class="w-full h-full object-cover" />
    </div>
    <div class="min-w-0 flex-1">
      <p class="text-[10px] font-bold uppercase tracking-wide opacity-80">{{ badge() }}</p>
      <p class="text-xs font-semibold truncate" :class="variant === 'story' ? 'text-white' : 'text-neutral-900 dark:text-neutral-100'">
        {{ item.title }}
      </p>
      <p v-if="item.sponsorName" class="text-[10px] truncate opacity-70">{{ item.sponsorName }}</p>
    </div>
    <span
      class="shrink-0 text-[10px] font-bold rounded-full px-2.5 py-1"
      :class="variant === 'story' ? 'bg-white text-pink-800' : 'bg-pink-700 text-white'"
    >
      {{ isPinPromo(item) ? t('feed.pinPromo.ctaShort') : t('feed.partnerAd.ctaShort') }}
    </span>
    <button
      type="button"
      class="shrink-0 h-6 w-6 rounded-full flex items-center justify-center opacity-60 hover:opacity-100"
      :aria-label="t('common.close')"
      @click.stop="emit('dismiss')"
    >
      <span class="material-symbols-outlined text-base">close</span>
    </button>
  </div>
</template>
