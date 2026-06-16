<script setup lang="ts">
import { computed } from 'vue'

import ContestPinMetrics from './ContestPinMetrics.vue'
import { useI18n } from '../../i18n'
import type { ContestFotoRow } from '../../types/contest'

const { t } = useI18n()
const props = defineProps<{ row: ContestFotoRow; index: number; isYou?: boolean }>()

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

const trendClass = computed(() => {
  const tr = trend.value
  if (tr.kind === 'neutral') return 'text-neutral-500 dark:text-neutral-400'
  if (tr.kind === 'up') return 'text-emerald-600 dark:text-emerald-400'
  return 'text-rose-600 dark:text-rose-400'
})

const medalClass = computed(() => {
  if (props.row.rank === 1) return 'from-amber-300 to-yellow-500 text-amber-950 ring-amber-300/70'
  if (props.row.rank === 2) return 'from-slate-200 to-slate-400 text-slate-900 ring-slate-300/80'
  if (props.row.rank === 3) return 'from-orange-300 to-amber-700 text-amber-950 ring-orange-300/80'
  return 'from-neutral-900 to-neutral-700 text-white ring-neutral-700/70 dark:from-neutral-100 dark:to-neutral-300 dark:text-neutral-900'
})

const cardClass = computed(() => {
  if (props.isYou) {
    return 'border-fuchsia-400 dark:border-fuchsia-500 ring-2 ring-fuchsia-300/80 dark:ring-fuchsia-600/60 bg-fuchsia-50/80 dark:bg-fuchsia-950/30'
  }
  if (props.row.rank === 1) {
    return 'border-amber-300/80 bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-100 dark:from-amber-900/20 dark:via-yellow-900/10 dark:to-amber-800/20'
  }
  if (props.row.rank === 2) {
    return 'border-slate-300/80 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900/30 dark:to-slate-800/30'
  }
  if (props.row.rank === 3) {
    return 'border-orange-300/80 bg-gradient-to-r from-orange-50 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/20'
  }
  return 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900'
})
</script>

<template>
  <router-link
    :to="`/foto/${encodeURIComponent(row.foto_slug)}`"
    class="group rounded-2xl border p-3 sm:p-4 flex items-center gap-2 sm:gap-3 transition hover:shadow-xl hover:-translate-y-0.5 relative w-full max-w-[min(100%,calc(100vw-1.5rem))] sm:max-w-full mx-auto min-w-0 box-border overflow-hidden"
    :class="cardClass"
    @contextmenu.prevent
  >
    <span
      v-if="isYou"
      class="absolute top-3 right-3 text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full bg-fuchsia-600 text-white shadow"
    >
      {{ t('contest.live.youBadge') }}
    </span>
    <div
      class="w-11 h-11 rounded-full font-black flex items-center justify-center ring-2 bg-gradient-to-br"
      :class="medalClass"
    >
      {{ row.rank || index + 1 }}
    </div>
    <div class="w-14 h-14 rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 shrink-0 border border-neutral-200/70 dark:border-neutral-700/70">
      <img
        v-if="row.pin_image_url"
        :src="row.pin_image_url"
        :alt="row.pin_title"
        class="w-full h-full object-cover pointer-events-none"
        draggable="false"
      />
      <div v-else class="w-full h-full flex items-center justify-center text-[11px] font-bold text-neutral-400">
        {{ t('contest.row.pinPlaceholder') }}
      </div>
    </div>
    <div class="min-w-0 flex-1">
      <p class="font-semibold truncate">{{ row.pin_title }}</p>
      <p class="text-xs text-neutral-500 truncate">@{{ row.creator_username }}</p>
      <p class="text-sm font-black text-pink-700 dark:text-pink-400 mt-1">
        {{ t('contest.row.points', { points: row.score.toFixed(2) }) }}
      </p>
      <ContestPinMetrics
        class="mt-1.5"
        variant="row"
        neutral-icons
        :likes="row.likes"
        :views="row.views"
        :shares="row.shares"
        :saves="row.saves"
        :comments="row.comments"
      />
    </div>
    <div class="text-right shrink-0 min-w-[5.5rem] sm:min-w-[6rem] self-center">
      <p class="text-xs uppercase tracking-wide text-neutral-400">{{ t('contest.row.rankChange') }}</p>
      <p class="text-sm font-semibold leading-tight mt-0.5" :class="trendClass">
        {{ trendLabel }}
      </p>
    </div>
  </router-link>
</template>
