<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '../i18n'
import type { BoostPack, BoostHistoryRow } from '../composables/usePromoteHub'
import type { Pin } from '../types'
import PinPickerField from './PinPickerField.vue'
import BoostHistoryCards from './BoostHistoryCards.vue'
import OfflineImg from './OfflineImg.vue'

const props = defineProps<{
  packs: BoostPack[]
  myPins: Pin[]
  selectedSlug: string
  selectedPin: Pin | null
  pinsLoading: boolean
  pinsLoadingMore: boolean
  pinsHasMore: boolean
  history: BoostHistoryRow[]
  busy: boolean
  formatDuration: (h: number, t: (k: string, p?: Record<string, string | number>) => string) => string
  formatMoney: (amount: number, iso: string) => string
}>()

const emit = defineEmits<{
  (e: 'update:selectedSlug', slug: string): void
  (e: 'load-more-pins'): void
  (e: 'confirm-boost', packSlug: string): void
  (e: 'boost-again', slug: string): void
}>()

const { t } = useI18n()
const step = ref(0)
const selectedPack = ref('')

const steps = computed(() => [
  t('promote.boost.step.pin'),
  t('promote.boost.step.impact'),
  t('promote.boost.step.launch'),
])

const impactStats = computed(() => [
  { icon: 'trending_up', label: t('promote.boost.stat1') },
  { icon: 'visibility', label: t('promote.boost.stat2') },
  { icon: 'rocket_launch', label: t('promote.boost.stat3') },
])

const pinImageMap = computed(() => {
  const m: Record<string, string> = {}
  for (const p of props.myPins) {
    if (p.imageUrl) m[p.slug] = p.imageUrl
  }
  return m
})

const canNext = computed(() => {
  if (step.value === 0) return !!props.selectedSlug
  if (step.value === 1) return true
  return !!selectedPack.value
})

function next() {
  if (step.value < 2 && canNext.value) step.value++
}

function back() {
  if (step.value > 0) step.value--
}

function pickPack(slug: string) {
  selectedPack.value = slug
}

function launch() {
  if (selectedPack.value) emit('confirm-boost', selectedPack.value)
}

function onBoostAgain(slug: string) {
  emit('update:selectedSlug', slug)
  step.value = 2
  selectedPack.value = props.packs[Math.min(1, props.packs.length - 1)]?.slug ?? props.packs[0]?.slug ?? ''
  emit('boost-again', slug)
}
</script>

<template>
  <div class="boost-wizard space-y-5">
    <div class="flex items-center gap-1">
      <template v-for="(label, i) in steps" :key="label">
        <div class="flex flex-col items-center flex-1 min-w-0">
          <div
            class="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition"
            :class="i <= step ? 'bg-pink-600 text-white shadow-md shadow-pink-500/30' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'"
          >
            <span v-if="i < step" class="material-symbols-outlined text-base">check</span>
            <span v-else>{{ i + 1 }}</span>
          </div>
          <p class="text-[9px] font-semibold mt-1 truncate w-full text-center" :class="i === step ? 'text-pink-700' : 'text-neutral-400'">
            {{ label }}
          </p>
        </div>
        <div v-if="i < steps.length - 1" class="h-0.5 flex-1 mb-4 rounded-full" :class="i < step ? 'bg-pink-400' : 'bg-neutral-200 dark:bg-neutral-700'" />
      </template>
    </div>

    <div v-if="step === 0" class="space-y-4 animate-in fade-in">
      <div class="rounded-2xl bg-gradient-to-br from-amber-50 via-pink-50 to-white dark:from-amber-950/30 dark:via-pink-950/20 dark:to-neutral-900 p-4 border border-pink-100 dark:border-pink-900/40">
        <p class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{{ t('promote.boost.stepPinLead') }}</p>
        <p class="text-xs text-neutral-500 mt-1">{{ t('promote.boost.stepPinSub') }}</p>
      </div>
      <PinPickerField
        :pins="myPins"
        :selected-slug="selectedSlug"
        :loading="pinsLoading"
        :loading-more="pinsLoadingMore"
        :has-more="pinsHasMore"
        @select="emit('update:selectedSlug', $event)"
        @load-more="emit('load-more-pins')"
      />
    </div>

    <div v-else-if="step === 1" class="space-y-4">
      <div v-if="selectedPin" class="relative overflow-hidden rounded-2xl aspect-[16/10] max-h-52 bg-neutral-900">
        <OfflineImg
          v-if="selectedPin.imageUrl"
          :src="selectedPin.imageUrl"
          :alt="selectedPin.title"
          class="w-full h-full object-cover opacity-90"
        />
        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div class="absolute bottom-0 inset-x-0 p-4 text-white">
          <span class="inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold mb-2">
            <span class="material-symbols-outlined text-[12px]">rocket_launch</span>
            {{ t('promote.boost.previewBadge') }}
          </span>
          <p class="font-bold truncate">{{ selectedPin.title }}</p>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-2">
        <div v-for="s in impactStats" :key="s.icon" class="rounded-xl bg-pink-50 dark:bg-pink-950/30 p-3 text-center">
          <span class="material-symbols-outlined text-pink-600 text-xl">{{ s.icon }}</span>
          <p class="text-[10px] font-medium mt-1 leading-tight text-neutral-700 dark:text-neutral-300">{{ s.label }}</p>
        </div>
      </div>
      <ul class="space-y-2 text-sm">
        <li v-for="n in 3" :key="n" class="flex gap-2 text-neutral-600 dark:text-neutral-400">
          <span class="material-symbols-outlined text-pink-500 text-lg shrink-0">auto_awesome</span>
          {{ t(`promote.boost.benefit${n}`) }}
        </li>
      </ul>
    </div>

    <div v-else class="space-y-4">
      <p class="text-sm text-neutral-600 dark:text-neutral-400">{{ t('promote.boost.stepLaunchLead') }}</p>
      <div class="space-y-2">
        <button
          v-for="(p, idx) in packs"
          :key="p.slug"
          type="button"
          class="w-full rounded-2xl border-2 px-4 py-4 text-left transition"
          :class="selectedPack === p.slug
            ? 'border-pink-500 bg-pink-50 dark:bg-pink-950/40 ring-2 ring-pink-200 dark:ring-pink-800'
            : 'border-neutral-200 dark:border-neutral-700 hover:border-pink-300'"
          @click="pickPack(p.slug)"
        >
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <p class="font-bold">{{ p.label }}</p>
                <span v-if="idx === 1" class="text-[9px] uppercase font-bold text-pink-600 bg-pink-100 dark:bg-pink-900/50 px-1.5 py-0.5 rounded">{{ t('promote.sheet.popular') }}</span>
              </div>
              <p class="text-xs text-neutral-500 mt-0.5">{{ formatDuration(p.duration_hours, t) }}</p>
            </div>
            <p class="text-xl font-black text-pink-700">{{ formatMoney(p.amount, p.currency_iso) }}</p>
          </div>
        </button>
      </div>
    </div>

    <div class="flex gap-2">
      <button
        v-if="step > 0"
        type="button"
        class="rounded-xl border app-divider-subtle px-4 py-3 text-sm font-semibold"
        @click="back"
      >
        {{ t('common.back') }}
      </button>
      <button
        v-if="step < 2"
        type="button"
        class="flex-1 rounded-xl bg-pink-700 text-white font-bold py-3 disabled:opacity-40"
        :disabled="!canNext"
        @click="next"
      >
        {{ t('promote.boost.continue') }}
      </button>
      <button
        v-else
        type="button"
        class="flex-1 rounded-xl bg-gradient-to-r from-pink-600 to-amber-500 text-white font-bold py-3.5 shadow-lg shadow-pink-500/25 disabled:opacity-40 flex items-center justify-center gap-2"
        :disabled="busy || !selectedPack"
        @click="launch"
      >
        <span v-if="busy" class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        <span v-else class="material-symbols-outlined">rocket_launch</span>
        {{ busy ? t('pin.boost.busy') : t('promote.boost.launchCta') }}
      </button>
    </div>

    <BoostHistoryCards
      v-if="history.length"
      :rows="history"
      :pin-image-by-slug="pinImageMap"
      @boost-again="onBoostAgain"
    />
  </div>
</template>
