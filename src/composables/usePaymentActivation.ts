import { computed, onUnmounted, ref } from 'vue'
import {
  ACTIVATION_DURATION_MS,
  PROGRESS_TICK_MS,
  INITIAL_PROGRESS,
  MAX_ANIMATED_PROGRESS,
  isTerminalPaymentPhase,
  type PaymentActivationPhase,
} from '@pinova/shared'
import type { CheckoutFlow } from '../utils/checkoutFlow'

export type { PaymentActivationPhase }

export function usePaymentActivation(flow: () => CheckoutFlow) {
  const phase = ref<PaymentActivationPhase>('confirming')
  const progress = ref(0)
  const statusLine = ref('')
  const errorDetail = ref('')
  const activatedPlan = ref<string | null>(null)

  let progressTimer: ReturnType<typeof setInterval> | null = null
  let activationStartedAt = 0

  const isTerminal = computed(() => isTerminalPaymentPhase(phase.value))

  function clearProgressTimer() {
    if (progressTimer) {
      clearInterval(progressTimer)
      progressTimer = null
    }
  }

  function setPhase(next: PaymentActivationPhase) {
    phase.value = next
  }

  function startProgressAnimation(onComplete: () => void) {
    clearProgressTimer()
    activationStartedAt = Date.now()
    progress.value = INITIAL_PROGRESS
    progressTimer = setInterval(() => {
      const elapsed = Date.now() - activationStartedAt
      const ratio = Math.min(1, elapsed / ACTIVATION_DURATION_MS)
      const eased = INITIAL_PROGRESS + ratio * (MAX_ANIMATED_PROGRESS - INITIAL_PROGRESS)
      progress.value = Math.min(MAX_ANIMATED_PROGRESS, Math.round(eased))
      if (elapsed >= ACTIVATION_DURATION_MS) {
        clearProgressTimer()
        progress.value = 100
        onComplete()
      }
    }, PROGRESS_TICK_MS)
  }

  function finishSuccess(planLabel?: string | null) {
    clearProgressTimer()
    progress.value = 100
    if (planLabel) activatedPlan.value = planLabel
    phase.value = 'success'
  }

  function finishPending(message: string) {
    clearProgressTimer()
    progress.value = 100
    errorDetail.value = message
    phase.value = 'pending'
  }

  function finishError(message: string) {
    clearProgressTimer()
    progress.value = 0
    errorDetail.value = message
    phase.value = 'error'
  }

  onUnmounted(() => {
    clearProgressTimer()
  })

  return {
    phase,
    progress,
    statusLine,
    errorDetail,
    activatedPlan,
    isTerminal,
    setPhase,
    startProgressAnimation,
    finishSuccess,
    finishPending,
    finishError,
    clearProgressTimer,
  }
}
