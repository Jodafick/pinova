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
</script>

<template>
  <router-link
    :to="`/pin/${encodeURIComponent(row.pin_slug)}`"
    class="group rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4 flex items-center gap-3 transition hover:shadow-lg hover:-translate-y-0.5"
  >
    <div class="w-10 h-10 rounded-full bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-bold flex items-center justify-center">
      {{ row.rank || index + 1 }}
    </div>
    <div class="min-w-0 flex-1">
      <p class="font-semibold truncate">{{ row.pin_title }}</p>
      <p class="text-xs text-neutral-500 truncate">@{{ row.creator_username }}</p>
      <p class="text-sm font-bold text-pink-600 mt-1">{{ row.score.toFixed(2) }} pts</p>
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
