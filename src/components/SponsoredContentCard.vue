<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { SponsoredAd } from '../types'
import { isPartnerAd, isPinPromo } from '../types'
import { useI18n } from '../i18n'
import api from '../api/index'
import OfflineImg from './OfflineImg.vue'
import OfflineVideo from './OfflineVideo.vue'

const props = withDefaults(
  defineProps<{
    item: SponsoredAd
    variant?: 'feed' | 'detail' | 'story'
    /** Feed : ouvrir la fiche native (overlay) au lieu du lien externe direct. */
    openInOverlay?: boolean
  }>(),
  { variant: 'feed', openInOverlay: true },
)

const emit = defineEmits<{
  (e: 'open-overlay', item: SponsoredAd): void
}>()

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

const heroUrl = computed(() => {
  if (isPinPromo(props.item) && props.item.mediaUrl) return props.item.mediaUrl
  return props.item.imageUrl
})

async function openExternal() {
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

function onTap() {
  if (props.variant === 'feed' && props.openInOverlay) {
    emit('open-overlay', props.item)
    return
  }
  void openExternal()
}

function onCtaClick(event: MouseEvent) {
  event.stopPropagation()
  void openExternal()
}
</script>

<template>
  <article
    v-if="variant === 'feed'"
    class="sponsored-card lux-pin-card group overflow-hidden rounded-3xl border-2 border-pink-300/50 dark:border-pink-500/35 bg-white dark:bg-neutral-900 shadow-[0_12px_40px_-18px_rgba(219,39,119,0.45)] hover:shadow-[0_18px_48px_-16px_rgba(219,39,119,0.5)] transition-shadow cursor-pointer"
    role="button"
    tabindex="0"
    @click="onTap"
    @keydown.enter="onTap"
  >
    <div
      v-if="heroUrl || (isPinPromo(item) && item.mediaType === 'video' && item.mediaUrl)"
      class="relative aspect-[3/4] w-full bg-neutral-100 dark:bg-neutral-800"
    >
      <OfflineVideo
        v-if="isPinPromo(item) && item.mediaType === 'video' && item.mediaUrl"
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
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <div class="absolute left-3 top-3 flex flex-wrap gap-2">
        <span class="rounded-full bg-pink-600/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow">
          {{ badge }}
        </span>
        <span
          v-if="item.sponsorName"
          class="max-w-[55%] truncate rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-medium text-white/90 backdrop-blur-sm"
        >
          {{ item.sponsorName }}
        </span>
      </div>
    </div>
    <div v-else class="bg-gradient-to-br from-pink-50 to-white px-4 py-3 dark:from-pink-950/40 dark:to-neutral-900">
      <span class="text-[10px] font-bold uppercase tracking-wide text-pink-700 dark:text-pink-400">{{ badge }}</span>
    </div>

    <div class="space-y-2 px-4 py-3.5">
      <h3 class="text-base font-semibold text-neutral-900 dark:text-neutral-100 line-clamp-2 leading-snug">
        {{ item.title }}
      </h3>
      <p v-if="item.body" class="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-3 leading-relaxed">
        {{ item.body }}
      </p>
      <div class="flex items-center justify-between gap-2 pt-1">
        <span class="text-[11px] font-semibold text-pink-700 dark:text-pink-300">
          {{ t('feed.partnerAd.openDetail') }}
        </span>
        <button
          type="button"
          class="rounded-full bg-pink-700 px-3 py-1.5 text-[11px] font-bold text-white transition group-hover:bg-pink-800"
          @click="onCtaClick"
        >
          {{ ctaLabel }}
        </button>
      </div>
    </div>
  </article>

  <article
    v-else
    class="sponsored-card overflow-hidden transition-shadow"
    :class="
      variant === 'story'
        ? 'rounded-2xl border border-white/20 bg-black/55 backdrop-blur-md shadow-2xl'
        : 'rounded-3xl border-2 border-pink-300/50 dark:border-pink-500/35 bg-white dark:bg-neutral-900 shadow-[0_12px_40px_-18px_rgba(219,39,119,0.35)]'
    "
    role="button"
    tabindex="0"
    @click="onTap"
    @keydown.enter="onTap"
  >
    <div class="flex items-center justify-between gap-2 px-4 pt-3 pb-1">
      <span
        class="text-[11px] font-bold uppercase tracking-wide"
        :class="variant === 'story' ? 'text-pink-300' : 'text-pink-700 dark:text-pink-400'"
      >
        {{ badge }}
      </span>
      <span
        v-if="item.sponsorName"
        class="text-[11px] truncate"
        :class="variant === 'story' ? 'text-white/70' : 'text-neutral-500 dark:text-neutral-400'"
      >
        {{ item.sponsorName }}
      </span>
    </div>
    <div
      v-if="heroUrl"
      class="relative bg-neutral-100 dark:bg-neutral-800"
      :class="variant === 'story' ? 'aspect-[16/9] max-h-36' : 'aspect-[4/5] w-full'"
    >
      <OfflineImg :src="heroUrl" :alt="item.title" class="h-full w-full object-cover" />
    </div>
    <div class="space-y-3 p-4">
      <h3
        class="font-semibold line-clamp-3"
        :class="variant === 'story' ? 'text-sm text-white' : 'text-xl text-neutral-900 dark:text-neutral-100'"
      >
        {{ item.title }}
      </h3>
      <p
        v-if="item.body && variant !== 'story'"
        class="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-4 leading-relaxed"
      >
        {{ item.body }}
      </p>
      <button
        type="button"
        class="inline-flex rounded-xl text-sm font-semibold py-2.5 px-4"
        :class="variant === 'story' ? 'bg-white text-pink-700' : 'bg-pink-700 text-white'"
        @click.stop="onCtaClick"
      >
        {{ ctaLabel }}
      </button>
    </div>
  </article>
</template>
