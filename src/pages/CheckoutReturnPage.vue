<script setup lang="ts">

import { computed, onMounted, watch } from 'vue'

import { useRoute, useRouter } from 'vue-router'

import api from '../api/index'

import { useAuth } from '../composables/useAuth'

import { usePaymentActivation } from '../composables/usePaymentActivation'

import PaymentActivationExperience from '../components/PaymentActivationExperience.vue'

import {

  clearStashedCheckout,

  checkoutFunnelProps,

  checkoutSuccessPath,

  PENDING_SUBSCRIPTION_TX_KEY,

  type CheckoutFlow,

} from '../utils/checkoutFlow'

import { trackEvent } from '../lib/analytics'
import { buildCheckoutSuccessClientProps } from '@pinova/shared'
import { requestCheckoutPendingRecap } from '../lib/requestCheckoutPendingRecap'



const route = useRoute()

const router = useRouter()

const { fetchCurrentUser, currentUser } = useAuth()



const flow = computed(() => (String(route.query.flow || 'premium') as CheckoutFlow))



const {

  phase,

  progress,

  statusLine,

  errorDetail,

  activatedPlan,

  setPhase,

  startProgressAnimation,

  finishSuccess,

  finishPending,

  finishError,

} = usePaymentActivation(() => flow.value)



function readTransactionId(): string {

  const fromQuery = String(route.query.transaction_id || route.query.id || '').trim()

  if (fromQuery) return fromQuery

  if (typeof window === 'undefined') return ''

  return window.localStorage.getItem(PENDING_SUBSCRIPTION_TX_KEY) || ''

}



function isCanceledOrFailed(status: string): boolean {

  return status === 'canceled' || status === 'cancelled' || status === 'failed' || status === 'declined'

}



async function pollPremiumActivation(maxMs = 10_000): Promise<boolean> {

  const started = Date.now()

  while (Date.now() - started < maxMs) {

    await fetchCurrentUser({ silent: true, force: true })

    const plan = currentUser.value?.subscription?.plan

    if (plan && plan !== 'free') return true

    await new Promise((r) => setTimeout(r, 1500))

  }

  await fetchCurrentUser({ silent: true, force: true })

  const plan = currentUser.value?.subscription?.plan

  return !!(plan && plan !== 'free')

}



async function confirmPremiumTransaction(tx: string, cbStatus: string): Promise<'approved' | 'pending' | 'error'> {

  if (typeof window !== 'undefined') {

    window.localStorage.setItem(PENDING_SUBSCRIPTION_TX_KEY, tx)

  }

  try {

    const response = await api.post('subscription/confirm/', {

      transaction_id: tx,

      callback_status: cbStatus || undefined,

    })

    if (response.data?.status === 'approved') {

      if (typeof window !== 'undefined') {

        window.localStorage.removeItem(PENDING_SUBSCRIPTION_TX_KEY)

      }

      activatedPlan.value = String(response.data?.plan || 'plus').toUpperCase()

      return 'approved'

    }

    return 'pending'

  } catch (err: unknown) {

    const ax = err as { response?: { data?: { error?: string } } }

    const msg = ax.response?.data?.error

    if (msg) errorDetail.value = msg

    if (cbStatus === 'approved' || cbStatus === 'completed') {

      return 'approved'

    }

    return 'error'

  }

}



async function runPremiumFlow(tx: string, cbStatus: string) {

  if (isCanceledOrFailed(cbStatus)) {

    finishError('')

    return

  }

  if (!tx) {

    finishPending('')

    return

  }



  const confirmResult = await confirmPremiumTransaction(tx, cbStatus)

  if (confirmResult === 'error') {

    finishError(errorDetail.value)

    return

  }

  if (confirmResult === 'pending') {

    finishPending('')

    return

  }



  setPhase('payment_confirmed')

  await new Promise((r) => setTimeout(r, 600))

  setPhase('activating')



  const [activated] = await Promise.all([
    pollPremiumActivation(),
    new Promise<void>((resolve) => startProgressAnimation(() => resolve())),
  ])

  if (activated) {
    trackEvent(
      'checkout_success',
      buildCheckoutSuccessClientProps(flow.value, checkoutFunnelProps(flow.value), 'web'),
    )
    finishSuccess(activatedPlan.value)
  } else {
    finishPending('')
  }

}



async function runSimplePaidFlow(cbStatus: string) {

  if (isCanceledOrFailed(cbStatus)) {

    finishError('')

    return

  }



  setPhase('payment_confirmed')

  await new Promise((r) => setTimeout(r, 500))

  setPhase('activating')



  await new Promise<void>((resolve) => {

    startProgressAnimation(() => resolve())

  })



  finishSuccess(null)
  trackEvent(
    'checkout_success',
    buildCheckoutSuccessClientProps(flow.value, checkoutFunnelProps(flow.value), 'web'),
  )
}



async function runActivation() {

  const tx = readTransactionId()

  const cbStatus = String(route.query.status || route.query.callback_status || '').trim().toLowerCase()



  if (flow.value === 'premium') {

    await runPremiumFlow(tx, cbStatus)

  } else {

    await runSimplePaidFlow(cbStatus)

  }

  clearStashedCheckout()

}



watch(phase, (p) => {
  if (p === 'pending') {
    void requestCheckoutPendingRecap(flow.value, readTransactionId())
  }
})

onMounted(() => {
  trackEvent('checkout_returned', { flow: flow.value })
  void runActivation()
})



function continueApp() {

  void router.replace(checkoutSuccessPath(flow.value))

}



function retryActivation() {

  phase.value = 'confirming'

  progress.value = 0

  errorDetail.value = ''

  void runActivation()

}

</script>



<template>

  <div class="min-h-[70vh] flex items-center justify-center px-4 pb-16">

    <PaymentActivationExperience

      :flow="flow"

      :phase="phase"

      :progress="progress"

      :status-line="statusLine"

      :error-detail="errorDetail"

      :activated-plan="activatedPlan"

      @continue="continueApp"

      @retry="retryActivation"

    />

  </div>

</template>


