<script setup lang="ts">
import { computed } from 'vue'

import ContestPinMetrics from './ContestPinMetrics.vue'
import { useI18n } from '../../i18n'
import type { ContestPinRow } from '../../types/contest'

const { t } = useI18n()
const props = defineProps<{ row: ContestPinRow; isYou?: boolean }>()

const trend = computed(() => {
  const prev = props.row.previous_rank
  const rank = props.row.rank
  if (prev == null || prev <= 0) return { kind: 'neutral' as const }
  const delta = prev - rank
  if (delta === 0) return { kind: 'neutral' as const }
  if (delta > 0) return { kind: 'up' as const, n: delta }
  return { kind: 'down' as const, n: -delta }
})

const trendLabel = computed(() => {
  const tr = trend.value
  if (tr.kind === 'neutral') return `— ${t('contest.podium.stable')}`
  if (tr.kind === 'up') return t('contest.podium.upPlaces', { n: tr.n })
  return t('contest.podium.downPlaces', { n: tr.n })
})

const trendPillClass = computed(() => {
  const tr = trend.value
  if (tr.kind === 'neutral') {
    return 'border-neutral-200 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400'
  }
  if (tr.kind === 'up') {
    return 'border-emerald-300/80 dark:border-emerald-700 bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
  }
  return 'border-rose-300/80 dark:border-rose-800 bg-rose-50/90 dark:bg-rose-950/35 text-rose-800 dark:text-rose-300'
})

const medalClass = computed(() => {
  if (props.row.rank === 1) return 'from-amber-300 to-yellow-500 text-amber-950'
  if (props.row.rank === 2) return 'from-slate-200 to-slate-400 text-slate-900'
  if (props.row.rank === 3) return 'from-orange-300 to-amber-700 text-amber-950'
  return 'from-neutral-800 to-neutral-600 text-white dark:from-neutral-200 dark:to-neutral-400 dark:text-neutral-900'
})
</script>

<template>
  <router-link
    :to="`/pin/${encodeURIComponent(row.pin_slug)}`"
    class="group h-full min-h-0 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 overflow-hidden flex flex-col transition hover:shadow-lg hover:-translate-y-0.5 relative w-full max-w-[min(100%,calc(100vw-1.5rem))] sm:max-w-none mx-auto min-w-0 box-border"
    :class="
      isYou
        ? 'ring-2 ring-fuchsia-400 dark:ring-fuchsia-500 border-fuchsia-300 dark:border-fuchsia-600'
        : ''
    "
    @contextmenu.prevent
  >
    <span
      v-if="isYou"
      class="absolute top-2 right-2 z-10 text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-fuchsia-600 text-white"
    >
      {{ t('contest.live.youBadge') }}
    </span>
    <div class="relative aspect-square bg-neutral-100 dark:bg-neutral-800">
      <img
        v-if="row.pin_image_url"
        :src="row.pin_image_url"
        :alt="row.pin_title"
        class="w-full h-full object-cover"
      />
      <div v-else class="w-full h-full flex items-center justify-center text-[11px] font-bold text-neutral-400 p-2 text-center">
        {{ t('contest.row.pinPlaceholder') }}
      </div>
      <div
        class="absolute bottom-2 left-2 w-9 h-9 rounded-full font-black flex items-center justify-center text-sm bg-gradient-to-br shadow-lg"
        :class="medalClass"
      >
        {{ row.rank }}
      </div>
    </div>
    <div class="p-2 min-w-0 flex-1 flex flex-col gap-0.5 min-h-[7rem] sm:min-h-[7.25rem]">
      <div class="min-h-0 flex-1 flex flex-col gap-0.5">
        <p class="text-xs font-bold leading-tight line-clamp-2 text-neutral-900 dark:text-neutral-100">{{ row.pin_title }}</p>
        <p class="text-[10px] text-neutral-500 truncate shrink-0">@{{ row.creator_username }}</p>
      </div>
      <p class="text-[11px] font-black text-pink-700 mt-auto shrink-0 tabular-nums">{{ t('contest.row.points', { points: row.score.toFixed(2) }) }}</p>
      <ContestPinMetrics
        variant="grid"
        neutral-icons
        :likes="row.likes"
        :views="row.views"
        :shares="row.shares"
        :saves="row.saves"
        :comments="row.comments"
      />
      <p
        class="mt-1.5 text-[8px] sm:text-[9px] font-semibold text-center leading-tight rounded-full px-1.5 py-1 border w-full max-w-full"
        :class="trendPillClass"
      >
        {{ trendLabel }}
      </p>
    </div>
  </router-link>
</template>
