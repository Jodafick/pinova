<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '../i18n'
import { useAuth } from '../composables/useAuth'
import type { BoostPack } from '../composables/usePromoteHub'
import type { FotoPromo } from '../types'
import {
  countTargetingFilters,
  type CampaignTargeting,
} from '../composables/useCampaignTargeting'
import MediaDropZone from './MediaDropZone.vue'
import CampaignTargetingModal from './CampaignTargetingModal.vue'
import SponsoredContentCard from './SponsoredContentCard.vue'
import { CAMPAIGN_PRESETS } from '../data/campaignPresets'

const props = defineProps<{
  packs: BoostPack[]
  headline: string
  body: string
  ctaUrl: string
  ctaLabel: string
  packageSlug: string
  targeting: CampaignTargeting
  mediaPreviewUrl: string
  mediaType: 'image' | 'video'
  mediaFileName: string
  busy: boolean
  formatMoney: (amount: number, iso: string) => string
}>()

const emit = defineEmits<{
  (e: 'update:headline', v: string): void
  (e: 'update:body', v: string): void
  (e: 'update:ctaUrl', v: string): void
  (e: 'update:ctaLabel', v: string): void
  (e: 'update:packageSlug', v: string): void
  (e: 'update:targeting', v: CampaignTargeting): void
  (e: 'media', payload: { file: File | null; previewUrl: string; mediaType: 'image' | 'video'; fileName: string }): void
  (e: 'submit'): void
}>()

const { t } = useI18n()
const { currentUser } = useAuth()
const targetingOpen = ref(false)
const showAdvanced = ref(false)

const targetingCount = computed(() => countTargetingFilters(props.targeting))

const campaignPreview = computed((): FotoPromo | null => {
  if (!props.headline.trim()) return null
  return {
    feedType: 'foto_promo',
    id: 'preview',
    campaignId: 0,
    title: props.headline.trim(),
    body: props.body.trim(),
    sponsorName: currentUser.value?.username ? `@${currentUser.value.username}` : '',
    username: currentUser.value?.username ?? '',
    imageUrl: props.mediaPreviewUrl,
    mediaUrl: props.mediaPreviewUrl,
    mediaType: props.mediaType,
    ctaLabel: props.ctaLabel.trim() || t('feed.partnerAd.ctaDefault'),
    ctaUrl: props.ctaUrl.trim(),
  }
})

const progress = computed(() => {
  let n = 0
  if (props.headline.trim()) n++
  if (props.ctaUrl.trim()) n++
  if (props.mediaPreviewUrl) n++
  if (props.packageSlug) n++
  return Math.round((n / 4) * 100)
})

function onMedia(payload: { file: File | null; previewUrl: string; mediaType: 'image' | 'video' }) {
  emit('media', { ...payload, fileName: payload.file?.name ?? '' })
}

function applyPreset(preset: (typeof CAMPAIGN_PRESETS)[number]) {
  emit('update:headline', t(preset.headlineKey))
  emit('update:body', t(preset.bodyKey))
  emit('update:ctaLabel', t(preset.ctaLabelKey))
}
</script>

<template>
  <div class="campaign-composer space-y-5 w-full min-w-0 overflow-hidden">
    <div class="rounded-2xl overflow-hidden border app-divider-subtle">
      <div class="h-1.5 bg-neutral-100 dark:bg-neutral-800">
        <div class="h-full bg-gradient-to-r from-pink-500 to-amber-400 transition-all duration-500" :style="{ width: `${progress}%` }" />
      </div>
      <p class="px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
        {{ t('promote.campaigns.progress', { n: progress }) }}
      </p>
    </div>

    <div class="flex flex-wrap gap-2">
      <span class="text-[10px] font-bold uppercase tracking-wide text-neutral-500 w-full">{{ t('promote.campaigns.presets') }}</span>
      <button
        v-for="preset in CAMPAIGN_PRESETS"
        :key="preset.id"
        type="button"
        class="rounded-full border app-divider-subtle px-3 py-1.5 text-xs font-semibold text-pink-700 hover:bg-pink-50 dark:hover:bg-pink-950/30"
        @click="applyPreset(preset)"
      >
        {{ t(`promote.campaigns.preset.${preset.id}.label`) }}
      </button>
    </div>
    <p class="text-[10px] text-neutral-400">{{ t('promote.campaigns.draftHint') }}</p>

    <MediaDropZone
      :preview-url="mediaPreviewUrl"
      :media-type="mediaType"
      :file-name="mediaFileName"
      @file="onMedia"
    />

    <div class="space-y-3">
      <label class="block">
        <span class="text-xs font-semibold text-neutral-600 dark:text-neutral-400">{{ t('promote.campaigns.headlineRequired') }}</span>
        <input
          :value="headline"
          class="mt-1 w-full rounded-xl border app-divider-subtle px-3 py-3 text-sm font-medium"
          :placeholder="t('promote.campaigns.headlinePlaceholder')"
          @input="emit('update:headline', ($event.target as HTMLInputElement).value)"
        />
      </label>

      <label class="block">
        <span class="text-xs font-semibold text-neutral-600 dark:text-neutral-400">{{ t('promote.campaigns.ctaUrl') }}</span>
        <input
          :value="ctaUrl"
          type="url"
          class="mt-1 w-full rounded-xl border app-divider-subtle px-3 py-3 text-sm"
          placeholder="https://"
          @input="emit('update:ctaUrl', ($event.target as HTMLInputElement).value)"
        />
      </label>

      <button
        type="button"
        class="text-xs font-semibold text-pink-700 flex items-center gap-1"
        @click="showAdvanced = !showAdvanced"
      >
        <FotoceIcon :name="showAdvanced ? 'expand_less' : 'expand_more'" class="text-base" />
        {{ t('promote.campaigns.moreOptions') }}
      </button>

      <div v-if="showAdvanced" class="space-y-3 pl-1 border-l-2 border-pink-200 dark:border-pink-800 ml-1 pl-3">
        <textarea
          :value="body"
          rows="2"
          class="w-full rounded-xl border app-divider-subtle px-3 py-2.5 text-sm"
          :placeholder="t('promote.campaigns.body')"
          @input="emit('update:body', ($event.target as HTMLTextAreaElement).value)"
        />
        <input
          :value="ctaLabel"
          class="w-full rounded-xl border app-divider-subtle px-3 py-2.5 text-sm"
          :placeholder="t('promote.campaigns.ctaLabel')"
          @input="emit('update:ctaLabel', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition"
        :class="targetingCount ? 'border-pink-500 bg-pink-50 text-pink-800 dark:bg-pink-950/40' : 'border-neutral-200 dark:border-neutral-700'"
        @click="targetingOpen = true"
      >
        <FotoceIcon name="target" class="text-base" />
        {{ t('promote.targeting.open') }}
        <span v-if="targetingCount" class="rounded-full bg-pink-600 text-white text-[9px] px-1.5 py-0.5 min-w-[1.25rem]">{{ targetingCount }}</span>
      </button>
    </div>

    <div>
      <p class="text-xs font-semibold text-neutral-500 mb-2">{{ t('promote.campaigns.package') }}</p>
      <div class="flex gap-2 overflow-x-auto pb-1 snap-x">
        <button
          v-for="p in packs"
          :key="p.slug"
          type="button"
          class="snap-start shrink-0 rounded-2xl border-2 px-4 py-3 text-left min-w-[8.5rem] transition"
          :class="packageSlug === p.slug ? 'border-pink-500 bg-pink-50 dark:bg-pink-950/30' : 'border-neutral-200 dark:border-neutral-700'"
          @click="emit('update:packageSlug', p.slug)"
        >
          <p class="text-sm font-bold">{{ p.label }}</p>
          <p class="text-xs text-pink-700 font-semibold mt-0.5">{{ formatMoney(p.amount, p.currency_iso) }}</p>
        </button>
      </div>
    </div>

    <div v-if="campaignPreview" class="space-y-2 w-full min-w-0 overflow-hidden">
      <p class="text-xs font-semibold text-neutral-500">{{ t('promote.campaigns.preview') }}</p>
      <div class="w-full min-w-0 max-w-full overflow-hidden">
        <SponsoredContentCard :item="campaignPreview" variant="feed" />
      </div>
    </div>

    <button
      type="button"
      class="w-full rounded-2xl bg-gradient-to-r from-pink-600 to-rose-600 text-white font-bold py-4 shadow-lg shadow-pink-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
      :disabled="busy || !headline.trim() || !ctaUrl.trim()"
      @click="emit('submit')"
    >
      <span v-if="busy" class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
      <FotoceIcon v-else name="campaign" />
      {{ busy ? t('common.loading') : t('promote.campaigns.publishFun') }}
    </button>

    <CampaignTargetingModal
      :open="targetingOpen"
      :model-value="targeting"
      @update:model-value="emit('update:targeting', $event)"
      @close="targetingOpen = false"
    />
  </div>
</template>
