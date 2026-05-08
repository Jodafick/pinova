<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '../../i18n'
import type { ContestPinRow } from '../../types/contest'

const { t } = useI18n()
const props = defineProps<{ row: ContestPinRow; isYou?: boolean }>()

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
    class="group h-full min-h-0 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 overflow-hidden flex flex-col transition hover:shadow-lg hover:-translate-y-0.5 relative"
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
    <div class="p-2.5 min-w-0 flex-1 flex flex-col gap-1 min-h-[5.25rem]">
      <div class="min-h-0 flex-1 flex flex-col gap-0.5">
        <p class="text-xs font-bold leading-tight line-clamp-2 text-neutral-900 dark:text-neutral-100">{{ row.pin_title }}</p>
        <p class="text-[10px] text-neutral-500 truncate shrink-0">@{{ row.creator_username }}</p>
      </div>
      <p class="text-xs font-black text-pink-600 mt-auto shrink-0">{{ t('contest.row.points', { points: row.score.toFixed(2) }) }}</p>
    </div>
  </router-link>
</template>
