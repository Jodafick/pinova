<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { shouldShowWelcomeCreateTutorial } from '@pinova/shared'
import { useI18n } from '../../i18n'
import { useAuth } from '../../composables/useAuth'
import { useActivationFunnel } from '../../composables/useActivationFunnel'
import { trackEvent, trackOnce } from '../../lib/analytics'
import PinovaButton from '../ui/PinovaButton.vue'

const props = defineProps<{
  welcomeQuery: boolean
}>()

const { t } = useI18n()
const { currentUser } = useAuth()
const { funnelState, markWelcomeTutorial } = useActivationFunnel()

const open = ref(false)
const step = ref(0)

const STEPS = ['intro', 'media', 'text', 'rules', 'publish'] as const

const canShow = computed(() => {
  if (!props.welcomeQuery) return false
  const pins = currentUser.value?.pinsCount ?? 0
  return shouldShowWelcomeCreateTutorial(funnelState.value, pins)
})

watch(
  canShow,
  (v) => {
    open.value = v
    if (v) {
      step.value = 0
      trackOnce('first_pin_started', { source: 'welcome_coach' })
    }
  },
  { immediate: true },
)

onMounted(() => {
  if (canShow.value) trackEvent('first_pin_started', { source: 'welcome_coach_mount' })
})

function dismiss() {
  open.value = false
  void markWelcomeTutorial('dismissed')
}

function finish() {
  open.value = false
  void markWelcomeTutorial('completed')
}

function next() {
  if (step.value >= STEPS.length - 1) {
    finish()
    return
  }
  step.value += 1
}

const stepKey = computed(() => STEPS[step.value] ?? STEPS[0])

const highlightTarget = computed(() => {
  if (stepKey.value === 'media') return '[data-welcome-coach="media"]'
  if (stepKey.value === 'text') return '[data-welcome-coach="title"]'
  if (stepKey.value === 'publish') return '[data-welcome-coach="publish"]'
  return null
})

watch(highlightTarget, (sel) => {
  if (!sel || typeof document === 'undefined') return
  const el = document.querySelector(sel)
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[var(--pinova-z-modal,120)] flex items-end sm:items-center justify-center p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
      role="dialog"
      aria-modal="true"
      :aria-label="t('activation.welcome.title')"
    >
      <div class="absolute inset-0 bg-black/45 backdrop-blur-[2px]" @click="dismiss" />
      <div
        class="relative w-full max-w-md rounded-3xl border border-white/20 bg-white dark:bg-neutral-950 shadow-2xl p-5 sm:p-6 space-y-4"
      >
        <p class="text-[11px] font-bold uppercase tracking-widest text-pink-600 dark:text-pink-400">
          {{ t('activation.welcome.kicker') }}
        </p>
        <h2 class="text-lg font-black text-neutral-900 dark:text-neutral-50 leading-snug">
          {{ t(`activation.welcome.step.${stepKey}.title`) }}
        </h2>
        <p class="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
          {{ t(`activation.welcome.step.${stepKey}.body`) }}
        </p>
        <div class="flex items-center justify-between gap-2 text-[11px] text-neutral-500">
          <span>{{ step + 1 }} / {{ STEPS.length }}</span>
          <button type="button" class="font-semibold hover:text-neutral-800 dark:hover:text-neutral-200" @click="dismiss">
            {{ t('activation.welcome.skip') }}
          </button>
        </div>
        <div class="flex gap-2">
          <PinovaButton variant="secondary" class="flex-1" @click="dismiss">
            {{ t('activation.welcome.later') }}
          </PinovaButton>
          <PinovaButton variant="primary" class="flex-1" @click="next">
            {{
              stepKey === 'publish'
                ? t('activation.welcome.ctaPublish')
                : t('activation.welcome.next')
            }}
          </PinovaButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>
