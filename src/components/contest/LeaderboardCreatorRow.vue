<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '../../i18n'
import type { ContestCreatorRow } from '../../types/contest'

const { t } = useI18n()
const props = defineProps<{ row: ContestCreatorRow; index: number }>()
const rankDelta = computed(() => (props.row.previous_rank || props.row.rank) - props.row.rank)
</script>

<template>
  <router-link
    :to="`/profile/${encodeURIComponent(row.creator_username)}`"
    class="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4 flex items-center gap-3 transition hover:shadow-lg"
  >
    <div class="w-10 h-10 rounded-full bg-amber-500/90 text-white font-bold flex items-center justify-center">
      {{ row.rank || index + 1 }}
    </div>
    <div class="min-w-0 flex-1">
      <p class="font-semibold truncate">@{{ row.creator_username }}</p>
      <p class="text-sm font-bold text-pink-600">{{ t('contest.row.points', { points: row.score.toFixed(2) }) }}</p>
    </div>
    <p
      class="text-sm font-semibold"
      :class="rankDelta > 0 ? 'text-emerald-600' : rankDelta < 0 ? 'text-rose-600' : 'text-neutral-500'"
    >
      <template v-if="rankDelta > 0">↑ {{ rankDelta }}</template>
      <template v-else-if="rankDelta < 0">↓ {{ Math.abs(rankDelta) }}</template>
      <template v-else>-</template>
    </p>
  </router-link>
</template>
