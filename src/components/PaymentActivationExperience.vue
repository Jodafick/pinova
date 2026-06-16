<script setup lang="ts">
import { computed } from 'vue'
import ConfettiBurst from './ConfettiBurst.vue'
import { useI18n } from '../i18n'
import type { PaymentActivationPhase } from '../composables/usePaymentActivation'
import type { CheckoutFlow } from '../utils/checkoutFlow'
import FotoceButton from './ui/FotoceButton.vue'

const props = defineProps<{
  flow: CheckoutFlow
  phase: PaymentActivationPhase
  progress: number
  statusLine?: string
  errorDetail?: string
  activatedPlan?: string | null
}>()

const emit = defineEmits<{ (e: 'continue'): void; (e: 'retry'): void }>()

const { t } = useI18n()

const iconName = computed(() => {
  if (props.phase === 'error') return 'error'
  if (props.phase === 'pending') return 'schedule'
  if (props.phase === 'success') return 'check_circle'
  if (props.phase === 'payment_confirmed') return 'verified'
  return 'hourglass_top'
})

const iconClass = computed(() => {
  if (props.phase === 'error') return 'text-red-500'
  if (props.phase === 'pending') return 'text-amber-500'
  if (props.phase === 'success' || props.phase === 'payment_confirmed') return 'text-emerald-600'
  return 'text-pink-600'
})

const headline = computed(() => {
  const f = props.flow
  if (props.phase === 'confirming') return t('checkout.activation.headline.confirming')
  if (props.phase === 'payment_confirmed') return t('checkout.activation.headline.paymentConfirmed')
  if (props.phase === 'activating') return t(`checkout.activation.headline.activating.${f}`)
  if (props.phase === 'success') return t(`checkout.activation.headline.success.${f}`)
  if (props.phase === 'pending') return t('checkout.activation.headline.pending')
  return t('checkout.activation.headline.error')
})

const subline = computed(() => {
  if (props.statusLine) return props.statusLine
  const f = props.flow
  if (props.phase === 'confirming') return t('checkout.activation.sub.confirming')
  if (props.phase === 'payment_confirmed') return t(`checkout.activation.sub.paymentConfirmed.${f}`)
  if (props.phase === 'activating') return t('checkout.activation.sub.activating')
  if (props.phase === 'success') return t(`checkout.activation.sub.success.${f}`)
  if (props.phase === 'pending') return props.errorDetail || t('checkout.activation.sub.pending')
  return props.errorDetail || t('checkout.activation.sub.error')
})

const benefitKeys = computed(() => {
  const f = props.flow
  return [
    `checkout.activation.benefit.${f}.1`,
    `checkout.activation.benefit.${f}.2`,
    `checkout.activation.benefit.${f}.3`,
  ]
})

const showProgress = computed(
  () => props.phase === 'activating' || props.phase === 'payment_confirmed',
)

const showBenefits = computed(() => props.phase === 'success')

const showContinue = computed(() => props.phase === 'success')

const showRetry = computed(() => props.phase === 'error' || props.phase === 'pending')
</script>

<template>
  <div class="relative max-w-md w-full rounded-3xl border app-divider-subtle p-6 sm:p-8 text-center space-y-5 shadow-lg bg-white/80 dark:bg-neutral-950/80 backdrop-blur-sm overflow-hidden">
    <ConfettiBurst :active="phase === 'success'" />
    <div
      class="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
      :class="
        phase === 'success'
          ? 'bg-emerald-100 dark:bg-emerald-950/50'
          : phase === 'error'
            ? 'bg-red-100 dark:bg-red-950/40'
            : 'bg-pink-50 dark:bg-pink-950/35'
      "
    >
      <FotoceIcon :name="iconName" class="text-4xl" :class="iconClass" />
    </div>

    <div class="space-y-2">
      <h1 class="text-xl sm:text-2xl font-black text-neutral-900 dark:text-neutral-50">{{ headline }}</h1>
      <p class="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">{{ subline }}</p>
      <p
        v-if="activatedPlan && phase === 'success'"
        class="text-xs font-bold uppercase tracking-wider text-pink-700 dark:text-pink-400"
      >
        {{ t('checkout.activation.planLabel', { plan: activatedPlan }) }}
      </p>
    </div>

    <div v-if="showProgress" class="space-y-2 text-left">
      <div class="h-2.5 w-full rounded-full bg-neutral-200/90 dark:bg-neutral-800 overflow-hidden">
        <div
          class="h-full rounded-full bg-gradient-to-r from-pink-600 to-fuchsia-500 transition-[width] duration-200 ease-out"
          :style="{ width: `${Math.max(4, progress)}%` }"
          role="progressbar"
          :aria-valuenow="progress"
          aria-valuemin="0"
          aria-valuemax="100"
        />
      </div>
      <p class="text-[11px] text-neutral-400 dark:text-neutral-500 text-center">
        {{ t('checkout.activation.progressHint') }}
      </p>
    </div>

    <ul v-if="showBenefits" class="text-left space-y-2 rounded-2xl bg-neutral-50/90 dark:bg-neutral-900/50 p-4 border border-neutral-100 dark:border-neutral-800">
      <li
        v-for="key in benefitKeys"
        :key="key"
        class="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-200"
      >
        <FotoceIcon name="check_circle" class="text-base text-emerald-500 shrink-0 mt-0.5" />
        <span>{{ t(key) }}</span>
      </li>
    </ul>

    <FotoceButton
      v-if="showContinue"
      variant="primary"
      block
      @click="emit('continue')"
    >
      {{ t('checkout.activation.continue') }}
    </FotoceButton>

    <p v-if="phase === 'pending'" class="text-xs text-neutral-500 dark:text-neutral-400">
      {{ t('checkout.activation.sub.pendingEmail') }}
    </p>

    <div v-if="showRetry" class="flex flex-col gap-2">
      <FotoceButton variant="secondary" block @click="emit('retry')">
        {{ t('checkout.activation.retry') }}
      </FotoceButton>
      <FotoceButton variant="ghost" block @click="emit('continue')">
        {{ t('checkout.return.continue') }}
      </FotoceButton>
    </div>

    <p v-if="phase === 'confirming'" class="text-xs text-neutral-400 animate-pulse">
      {{ t('checkout.return.verifying') }}
    </p>
  </div>
</template>
