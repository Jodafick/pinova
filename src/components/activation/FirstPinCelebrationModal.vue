<script setup lang="ts">
import { computed, watch } from 'vue'
import ConfettiBurst from '../ConfettiBurst.vue'
import PinovaModal from '../ui/PinovaModal.vue'
import PinovaButton from '../ui/PinovaButton.vue'
import { useI18n } from '../../i18n'
import { useActivationFunnel } from '../../composables/useActivationFunnel'
import { trackEvent, trackOnce } from '../../lib/analytics'
import { openCreatorSuggestionsAfterCelebration } from '../../composables/useActivationMoments'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [boolean] }>()

const { t } = useI18n()
const { creatorProgress, markFirstPinCelebrationSeen } = useActivationFunnel()

const progressLabel = computed(() =>
  t('activation.celebration.progress', { done: 1, total: creatorProgress.value.total }),
)

const progressWidth = computed(() => {
  const total = creatorProgress.value.total || 3
  return `${Math.round((1 / total) * 100)}%`
})

watch(
  () => props.open,
  (v) => {
    if (!v) return
    trackOnce('first_pin_confetti_shown', { surface: 'web' })
    trackEvent('creator_level_progressed', {
      level: 1,
      percent: creatorProgress.value.percent || 33,
      milestone: 'first_pin_published',
    })
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([12, 40, 18])
      } catch {
        /* ignore */
      }
    }
  },
)

async function onContinue() {
  await markFirstPinCelebrationSeen(['first_pin_published'])
  emit('update:open', false)
  openCreatorSuggestionsAfterCelebration()
}
</script>

<template>
  <PinovaModal
    :open="open"
    presentation="center"
    :show-header="false"
    @update:open="emit('update:open', $event)"
  >
    <div class="relative overflow-hidden rounded-2xl px-1 py-2 text-center space-y-4">
      <ConfettiBurst :active="open" />
      <div
        class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-violet-600 text-white shadow-lg"
        aria-hidden="true"
      >
        <PinovaIcon name="celebration" class="text-4xl" />
      </div>
      <div class="space-y-1">
        <h2 class="text-2xl font-black text-neutral-900 dark:text-neutral-50">
          {{ t('activation.celebration.title') }}
        </h2>
        <p class="text-sm text-neutral-600 dark:text-neutral-300">
          {{ t('activation.celebration.subtitle') }}
        </p>
      </div>
      <span class="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900 ring-1 ring-amber-300/60 dark:bg-amber-950/50 dark:text-amber-200">
        <PinovaIcon name="military_tech" class="text-base shrink-0" aria-hidden="true" />
        {{ t('activation.celebration.badge') }}
      </span>
      <div class="text-left space-y-1.5 px-1">
        <div class="flex items-center justify-between text-[11px] font-semibold text-neutral-600 dark:text-neutral-400">
          <span>{{ t('activation.progress.level1') }}</span>
          <span>{{ progressLabel }}</span>
        </div>
        <div class="h-2 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
          <div
            class="h-full rounded-full bg-gradient-to-r from-pink-500 to-violet-500 transition-all duration-700 ease-out"
            :style="{ width: progressWidth }"
          />
        </div>
      </div>
      <PinovaButton variant="primary" block class="min-h-[48px]" @click="onContinue">
        {{ t('activation.celebration.continue') }}
      </PinovaButton>
    </div>
  </PinovaModal>
</template>
