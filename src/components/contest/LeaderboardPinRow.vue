<script setup lang="ts">
import { computed } from 'vue'
import type { ContestPinRow } from '../../types/contest'

const props = defineProps<{ row: ContestPinRow; index: number }>()

const rankDelta = computed(() => {
  const prev = props.row.previous_rank || props.row.rank
  return prev - props.row.rank
})

const rankClass = computed(() => {
  if (rankDelta.value > 0) return 'text-emerald-600'
  if (rankDelta.value < 0) return 'text-rose-600'
  return 'text-neutral-500'
})

const medalClass = computed(() => {
  if (props.row.rank === 1) return 'from-amber-300 to-yellow-500 text-amber-950 ring-amber-300/70'
  if (props.row.rank === 2) return 'from-slate-200 to-slate-400 text-slate-900 ring-slate-300/80'
  if (props.row.rank === 3) return 'from-orange-300 to-amber-700 text-amber-950 ring-orange-300/80'
  return 'from-neutral-900 to-neutral-700 text-white ring-neutral-700/70 dark:from-neutral-100 dark:to-neutral-300 dark:text-neutral-900'
})

const cardClass = computed(() => {
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
    :to="`/pin/${encodeURIComponent(row.pin_slug)}`"
    class="group rounded-2xl border p-4 flex items-center gap-3 transition hover:shadow-xl hover:-translate-y-0.5"
    :class="cardClass"
  >
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
        class="w-full h-full object-cover"
      />
      <div v-else class="w-full h-full flex items-center justify-center text-[11px] font-bold text-neutral-400">
        Pin
      </div>
    </div>
    <div class="min-w-0 flex-1">
      <p class="font-semibold truncate">{{ row.pin_title }}</p>
      <p class="text-xs text-neutral-500 truncate">@{{ row.creator_username }}</p>
      <p class="text-sm font-black text-pink-600 mt-1">{{ row.score.toFixed(2) }} pts</p>
      <p class="text-[11px] text-neutral-500 mt-0.5">
        Interactions: {{ row.total_interactions ?? 0 }} · Éligibles: {{ row.eligible_interactions ?? 0 }}
      </p>
      <div class="mt-1.5 flex flex-wrap gap-1.5 text-[10px] font-semibold text-neutral-600 dark:text-neutral-300">
        <span class="px-1.5 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800">❤ {{ row.likes ?? 0 }}</span>
        <span class="px-1.5 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800">👁 {{ row.views ?? 0 }}</span>
        <span class="px-1.5 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800">↗ {{ row.shares ?? 0 }}</span>
        <span class="px-1.5 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800">📌 {{ row.saves ?? 0 }}</span>
        <span class="px-1.5 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800">💬 {{ row.comments ?? 0 }}</span>
      </div>
    </div>
    <div class="text-right">
      <p class="text-xs uppercase tracking-wide text-neutral-400">variation</p>
      <p class="text-sm font-semibold" :class="rankClass">
        <template v-if="rankDelta > 0">↑ {{ rankDelta }}</template>
        <template v-else-if="rankDelta < 0">↓ {{ Math.abs(rankDelta) }}</template>
        <template v-else>-</template>
      </p>
    </div>
  </router-link>
</template>
