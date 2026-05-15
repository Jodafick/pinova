<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '../../i18n'

const props = withDefaults(
  defineProps<{ remainingMs: number; variant?: 'blocks' | 'compact' | 'referral'; surface?: 'default' | 'hero' }>(),
  { variant: 'blocks', surface: 'default' },
)
const { t } = useI18n()

const parts = computed(() => {
  const total = Math.max(0, Math.floor(props.remainingMs / 1000))
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return { days, hours, minutes, seconds }
})

function pad2(n: number) {
  return String(Math.max(0, n)).padStart(2, '0')
}

const blockSurfaceClass = computed(() =>
  props.surface === 'hero'
    ? 'border-white/18 bg-black/28 text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] dark:border-white/10 dark:bg-black/50'
    : 'border-neutral-200 dark:border-neutral-700 bg-white/80 dark:bg-neutral-950/75 dark:text-neutral-100',
)

const blockLabelClass = computed(() =>
  props.surface === 'hero'
    ? 'text-[9px] sm:text-[10px] uppercase tracking-wide text-pink-100/75 dark:text-pink-100/65 leading-tight'
    : 'text-[9px] sm:text-[10px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400 leading-tight',
)

/** Taille / couleur uniquement — évite `fa-solid` en doublon ; une icône `fa-regular` pour les heures. */
const blockIconTone = computed(() =>
  props.surface === 'hero'
    ? 'text-[15px] sm:text-[18px] leading-none text-pink-100/90 dark:text-pink-100/75 opacity-95'
    : 'text-[15px] sm:text-[18px] leading-none text-neutral-500 dark:text-neutral-400 opacity-90',
)

/** jj:hh:min:s — unités via contest.remain.*Short */
const compactLine = computed(() => {
  const { days, hours, minutes, seconds } = parts.value
  return `${pad2(days)}${t('contest.remain.daysShort')}:${pad2(hours)}${t('contest.remain.hoursShort')}:${pad2(minutes)}${t('contest.remain.minutesShort')}:${pad2(seconds)}${t('contest.remain.secondsShort')}`
})

/** Grille 2×2 pour cartes étroites (ex. hero parrainage) — évite le débordement du variant compact. */
const referralSegments = computed(() => {
  const { days, hours, minutes, seconds } = parts.value
  return [
    { key: 'd', value: String(Math.max(0, days)), unit: t('contest.remain.daysShort') },
    { key: 'h', value: pad2(hours), unit: t('contest.remain.hoursShort') },
    { key: 'm', value: pad2(minutes), unit: t('contest.remain.minutesShort') },
    { key: 's', value: pad2(seconds), unit: t('contest.remain.secondsShort') },
  ] as const
})
</script>

<template>
  <div v-if="variant === 'compact'" class="font-mono font-bold tabular-nums text-lg sm:text-xl tracking-tight text-pink-700 dark:text-pink-400">
    {{ compactLine }}
  </div>
  <div
    v-else-if="variant === 'referral'"
    class="grid grid-cols-2 gap-1.5 w-full min-w-0"
    role="timer"
    :aria-label="compactLine"
  >
    <div
      v-for="seg in referralSegments"
      :key="seg.key"
      class="rounded-lg border border-pink-500/22 dark:border-pink-500/30 bg-gradient-to-b from-pink-500/[0.09] to-pink-500/[0.03] dark:from-pink-400/[0.12] dark:to-pink-400/[0.04] px-1.5 py-1.5 sm:px-2 sm:py-2 text-center min-w-0 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
    >
      <p class="font-mono font-bold tabular-nums text-[0.8125rem] sm:text-[0.9375rem] leading-none text-pink-700 dark:text-pink-400">
        {{ seg.value }}
      </p>
      <p class="text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400 mt-1 leading-none">
        {{ seg.unit }}
      </p>
    </div>
  </div>
  <div v-else class="grid grid-cols-4 gap-1.5 sm:gap-3 w-full min-w-0">
    <div class="rounded-xl border px-1 py-2 sm:p-2.5 text-center min-w-0 flex flex-col items-center gap-0.5 sm:gap-1" :class="blockSurfaceClass">
      <i class="fa-solid fa-calendar-day" :class="blockIconTone" aria-hidden="true" />
      <p class="text-sm sm:text-lg font-bold tabular-nums leading-none">{{ parts.days }}</p>
      <p :class="blockLabelClass">{{ t('contest.countdown.days') }}</p>
    </div>
    <div class="rounded-xl border px-1 py-2 sm:p-2.5 text-center min-w-0 flex flex-col items-center gap-0.5 sm:gap-1" :class="blockSurfaceClass">
      <i class="fa-regular fa-clock" :class="blockIconTone" aria-hidden="true" />
      <p class="text-sm sm:text-lg font-bold tabular-nums leading-none">{{ parts.hours }}</p>
      <p :class="blockLabelClass">{{ t('contest.countdown.hours') }}</p>
    </div>
    <div class="rounded-xl border px-1 py-2 sm:p-2.5 text-center min-w-0 flex flex-col items-center gap-0.5 sm:gap-1" :class="blockSurfaceClass">
      <i class="fa-solid fa-stopwatch" :class="blockIconTone" aria-hidden="true" />
      <p class="text-sm sm:text-lg font-bold tabular-nums leading-none">{{ parts.minutes }}</p>
      <p :class="blockLabelClass">{{ t('contest.countdown.minutes') }}</p>
    </div>
    <div class="rounded-xl border px-1 py-2 sm:p-2.5 text-center min-w-0 flex flex-col items-center gap-0.5 sm:gap-1" :class="blockSurfaceClass">
      <i class="fa-solid fa-bolt" :class="blockIconTone" aria-hidden="true" />
      <p class="text-sm sm:text-lg font-bold tabular-nums leading-none">{{ parts.seconds }}</p>
      <p :class="blockLabelClass">{{ t('contest.countdown.seconds') }}</p>
    </div>
  </div>
</template>
