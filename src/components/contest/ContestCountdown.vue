<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '../../i18n'

const props = defineProps<{ remainingMs: number }>()
const { t } = useI18n()

const parts = computed(() => {
  const total = Math.max(0, Math.floor(props.remainingMs / 1000))
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return { days, hours, minutes, seconds }
})
</script>

<template>
  <div class="grid grid-cols-4 gap-2 sm:gap-3">
    <div class="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white/80 dark:bg-neutral-900/70 p-2 text-center">
      <p class="text-lg font-bold">{{ parts.days }}</p>
      <p class="text-[10px] uppercase tracking-wide text-neutral-500">{{ t('contest.countdown.days') }}</p>
    </div>
    <div class="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white/80 dark:bg-neutral-900/70 p-2 text-center">
      <p class="text-lg font-bold">{{ parts.hours }}</p>
      <p class="text-[10px] uppercase tracking-wide text-neutral-500">{{ t('contest.countdown.hours') }}</p>
    </div>
    <div class="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white/80 dark:bg-neutral-900/70 p-2 text-center">
      <p class="text-lg font-bold">{{ parts.minutes }}</p>
      <p class="text-[10px] uppercase tracking-wide text-neutral-500">{{ t('contest.countdown.minutes') }}</p>
    </div>
    <div class="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white/80 dark:bg-neutral-900/70 p-2 text-center">
      <p class="text-lg font-bold">{{ parts.seconds }}</p>
      <p class="text-[10px] uppercase tracking-wide text-neutral-500">{{ t('contest.countdown.seconds') }}</p>
    </div>
  </div>
</template>
