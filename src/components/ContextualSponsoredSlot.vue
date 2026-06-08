<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import api from '../api/index'
import { mapSponsoredFromApi } from '../composables/usePins'
import type { SponsoredAd } from '../types'
import SponsoredContentCard from './SponsoredContentCard.vue'
import SponsoredNativeStrip from './SponsoredNativeStrip.vue'
import { useAuth } from '../composables/useAuth'
import { useRouter } from 'vue-router'
import { useI18n } from '../i18n'

const props = withDefaults(
  defineProps<{
    placement: 'pin_detail' | 'story'
    topic?: string
    variant?: 'detail' | 'story'
    tone?: 'light' | 'dark'
  }>(),
  { topic: '', variant: 'detail', tone: 'light' },
)

const { t } = useI18n()
const router = useRouter()
const { currentUser, isAuthenticated } = useAuth()

const ad = ref<SponsoredAd | null>(null)
const dismissed = ref(false)
const adsExplainDismissed = ref(false)

const showFreeAdsCta = computed(
  () =>
    isAuthenticated.value &&
    (currentUser.value?.subscription?.plan || 'free') === 'free' &&
    !adsExplainDismissed.value,
)

function goPremium() {
  void router.push({ name: 'premium' })
}

const stripVariant = computed<'detail' | 'story'>(() =>
  props.tone === 'dark' || props.variant === 'story' ? 'story' : 'detail',
)

async function load() {
  dismissed.value = false
  try {
    const res = await api.get<{ ad: Record<string, unknown> | null }>('monetization/contextual-ad/', {
      params: { placement: props.placement, topic: props.topic || undefined },
    })
    const raw = res.data?.ad
    ad.value = raw ? mapSponsoredFromApi(raw) : null
  } catch {
    ad.value = null
  }
}

onMounted(() => void load())
watch(() => [props.placement, props.topic], () => void load())
</script>

<template>
  <div
    v-if="ad && !dismissed"
    class="contextual-sponsored-slot pointer-events-auto"
    @touchstart.stop
    @touchend.stop
    @pointerdown.stop
  >
    <div
      v-if="variant === 'story'"
      class="absolute inset-x-4 bottom-[5.5rem] z-30 max-w-md mx-auto"
    >
      <SponsoredNativeStrip :item="ad" :variant="stripVariant" @dismiss="dismissed = true" />
    </div>
    <div v-else class="space-y-3">
      <SponsoredContentCard :item="ad" variant="detail" :open-in-overlay="false" />
      <button
        type="button"
        class="text-[11px] font-medium text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
        @click="dismissed = true"
      >
        {{ t('common.close') }}
      </button>
      <div v-if="showFreeAdsCta" class="rounded-xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/80 dark:bg-amber-950/20 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
        <p class="text-[11px] text-neutral-600 dark:text-neutral-400 flex-1 min-w-[12rem]">{{ t('ads.free.explain') }}</p>
        <button type="button" class="text-[11px] font-bold text-pink-700 shrink-0" @click="goPremium">{{ t('ads.free.upgradeCta') }}</button>
        <button type="button" class="text-[10px] text-neutral-400" :aria-label="t('common.close')" @click="adsExplainDismissed = true">×</button>
      </div>
    </div>
  </div>
</template>
