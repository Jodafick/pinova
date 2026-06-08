<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ConfettiBurst from './ConfettiBurst.vue'
import { useI18n } from '../i18n'
import type { DiscoveryStreak } from '../composables/useDiscoveryStreak'

const MILESTONES = [7, 30] as const

const props = defineProps<{
  streak: DiscoveryStreak | null
}>()

const { t } = useI18n()
const milestone = ref<number | null>(null)
const celebrated = ref(new Set<number>())

watch(
  () => props.streak?.count,
  (count) => {
    if (!count) return
    for (const m of MILESTONES) {
      if (count === m && !celebrated.value.has(m)) {
        celebrated.value.add(m)
        milestone.value = m
        setTimeout(() => {
          if (milestone.value === m) milestone.value = null
        }, 3200)
      }
    }
  },
  { immediate: true },
)

const headline = computed(() => {
  if (!props.streak) return ''
  if (milestone.value === 7) return t('discovery.streak.milestone7', { count: props.streak.count })
  if (milestone.value === 30) return t('discovery.streak.milestone30', { count: props.streak.count })
  if (props.streak.at_risk) return t('discovery.streak.atRisk', { count: props.streak.count })
  if (props.streak.paused) {
    return t('discovery.streak.paused', { count: props.streak.count, best: props.streak.best })
  }
  return t('discovery.streak.active', { count: props.streak.count })
})

const showConfetti = computed(() => milestone.value === 7 || milestone.value === 30)

/** Masque le bandeau « 1 jour d’exploration » peu explicite ; garde les états utiles. */
const isMeaningfulStreak = computed(() => {
  if (!props.streak) return false
  if (props.streak.at_risk || props.streak.paused) return true
  if (milestone.value) return true
  return props.streak.count >= 7
})
</script>

<template>
  <div
    v-if="isMeaningfulStreak"
    class="relative mx-3 mb-2 overflow-hidden flex items-start gap-2.5 rounded-2xl border px-3.5 py-2.5 transition-shadow"
    :class="
      milestone
        ? 'border-amber-300/90 bg-amber-50/95 dark:border-amber-700/60 dark:bg-amber-950/40 shadow-md animate-pulse'
        : props.streak.at_risk
          ? 'border-orange-300/80 bg-orange-50/90 dark:border-orange-800/50 dark:bg-orange-950/30'
          : 'border-pink-200/80 bg-pink-50/90 dark:border-pink-900/50 dark:bg-pink-950/30'
    "
  >
    <ConfettiBurst :active="showConfetti" />
    <span
      class="material-symbols-outlined text-[20px] shrink-0"
      :class="milestone ? 'text-amber-600' : props.streak.at_risk ? 'text-orange-600' : 'text-pink-700'"
    >
      {{ milestone ? 'emoji_events' : props.streak.at_risk ? 'local_fire_department' : 'explore' }}
    </span>
    <div class="min-w-0 flex-1">
      <p
        class="text-sm font-extrabold"
        :class="
          milestone
            ? 'text-amber-800 dark:text-amber-200'
            : props.streak.at_risk
              ? 'text-orange-800 dark:text-orange-200'
              : 'text-pink-800 dark:text-pink-200'
        "
      >
        {{ headline }}
      </p>
      <p
        v-if="props.streak?.paused || props.streak?.at_risk"
        class="text-[11px] text-pink-900/70 dark:text-pink-100/70 mt-0.5"
      >
        {{ t('discovery.streak.hint') }}
      </p>
    </div>
  </div>
</template>
