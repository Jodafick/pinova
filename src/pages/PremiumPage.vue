<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from '../i18n'
import { useAuth } from '../composables/useAuth'
import api from '../api'

const { t, currentLang } = useI18n()
const router = useRouter()
const { currentUser, isAuthenticated, fetchCurrentUser } = useAuth()

const billingCycle = ref<'monthly' | 'yearly'>('monthly')
const selectedPlan = ref<string | null>('plus')
const checkoutPendingPlan = ref<string | null>(null)
const confirmPending = ref(false)
const paymentInfoMessage = ref('')
const pricingLoading = ref(true)
const PENDING_TX_STORAGE_KEY = 'pinova_pending_subscription_tx'
const AUTO_CONFIRM_INTERVAL_MS = 4000
const AUTO_CONFIRM_MAX_ATTEMPTS = 45
let autoConfirmTimer: number | null = null
let autoConfirmAttempts = 0
type PricingCycle = {
  amount_minor: number
  amount_display: number
  currency_iso: string
  duration_days: number
}
const pricingCatalog = ref<Record<string, Record<string, PricingCycle>>>({})

const formatCurrency = (amount: number, currencyIso: string) => {
  try {
    return new Intl.NumberFormat(currentLang.value || 'fr', {
      style: 'currency',
      currency: currencyIso,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch (_) {
    return `${amount} ${currencyIso}`
  }
}

const monthlyDisplayFromYearly = (yearlyAmount: number, currencyIso: string) =>
  formatCurrency(yearlyAmount / 12, currencyIso)

const readCycle = (planId: string, cycle: 'monthly' | 'yearly') =>
  pricingCatalog.value[planId]?.[cycle]

const openCheckoutPopup = () => {
  if (typeof window === 'undefined') return null
  const width = 520
  const height = 760
  const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2)
  const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2)
  return window.open(
    'about:blank',
    'pinova_fedapay_checkout',
    `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`,
  )
}

const plans = computed(() => [
  {
    id: 'free',
    name: t('premium.plan.free.name'),
    tagline: t('premium.plan.free.tagline'),
    monthly: readCycle('free', 'monthly')?.amount_display ?? null,
    yearly: readCycle('free', 'yearly')?.amount_display ?? null,
    currencyIso: readCycle('free', 'monthly')?.currency_iso || readCycle('free', 'yearly')?.currency_iso || null,
    isPriceReady: !!(readCycle('free', 'monthly') && readCycle('free', 'yearly')),
    badge: null,
    color: 'border-neutral-200',
    cta: t('premium.plan.free.cta'),
    ctaDisabled: true,
    features: [
      { label: t('premium.feature.adsEnabled'), included: true },
      { label: t('premium.feature.partnerAdsEnabled'), included: true },
      { label: t('premium.feature.noTracking'), included: true },
      { label: t('premium.feature.unlimitedPins'), included: true },
      { label: t('premium.feature.privateTagsFree'), included: false },
      { label: t('premium.feature.boardsFreeLimits'), included: true },
      { label: t('premium.feature.gifs'), included: false },
      { label: t('premium.feature.collabBoards'), included: false },
      { label: t('premium.feature.download'), included: false },
    ],
  },
  {
    id: 'plus',
    name: t('premium.plan.plus.name'),
    tagline: t('premium.plan.plus.tagline'),
    monthly: readCycle('plus', 'monthly')?.amount_display ?? null,
    yearly: readCycle('plus', 'yearly')?.amount_display ?? null,
    currencyIso: readCycle('plus', 'monthly')?.currency_iso || readCycle('plus', 'yearly')?.currency_iso || null,
    isPriceReady: !!(readCycle('plus', 'monthly') && readCycle('plus', 'yearly')),
    badge: t('premium.plan.plus.badge'),
    color: 'border-pink-500 ring-4 ring-pink-100',
    cta: t('premium.plan.plus.cta'),
    ctaDisabled: false,
    features: [
      { label: t('premium.feature.allFree'), included: true },
      { label: t('premium.feature.disableAdsOnly'), included: true },
      { label: t('premium.feature.disablePartnerAds'), included: false },
      { label: t('premium.feature.privateTagsUnlimited'), included: true },
      { label: t('premium.feature.boardsPlusLimits'), included: true },
      { label: t('premium.feature.gifs'), included: true },
      { label: t('premium.feature.collab10'), included: true },
      // { label: t('premium.feature.reverseSearch'), included: true },
      { label: t('premium.feature.download'), included: true },
    ],
  },
  {
    id: 'pro',
    name: t('premium.plan.pro.name'),
    tagline: t('premium.plan.pro.tagline'),
    monthly: readCycle('pro', 'monthly')?.amount_display ?? null,
    yearly: readCycle('pro', 'yearly')?.amount_display ?? null,
    currencyIso: readCycle('pro', 'monthly')?.currency_iso || readCycle('pro', 'yearly')?.currency_iso || null,
    isPriceReady: !!(readCycle('pro', 'monthly') && readCycle('pro', 'yearly')),
    badge: t('premium.plan.pro.badge'),
    color: 'border-amber-400',
    cta: t('premium.plan.pro.cta'),
    ctaDisabled: false,
    features: [
      { label: t('premium.feature.allPlus'), included: true },
      { label: t('premium.feature.disableAllAds'), included: true },
      { label: t('premium.feature.collabUnlimited'), included: true },
      { label: t('premium.feature.hd4k'), included: true },
      { label: t('premium.feature.stats'), included: true },
      { label: t('premium.feature.tips'), included: true },
      { label: t('premium.feature.blockchain'), included: true },
      { label: t('premium.feature.support'), included: true },
      { label: t('premium.feature.badge'), included: true },
    ],
  },
])

const faqs = computed(() => [
  { q: t('premium.faq.q1'), a: t('premium.faq.a1') },
  { q: t('premium.faq.q2'), a: t('premium.faq.a2') },
  { q: t('premium.faq.q3'), a: t('premium.faq.a3') },
  { q: t('premium.faq.q4'), a: t('premium.faq.a4') },
])

const clearAutoConfirmTimer = () => {
  if (typeof window === 'undefined') return
  if (autoConfirmTimer !== null) {
    window.clearInterval(autoConfirmTimer)
    autoConfirmTimer = null
  }
  autoConfirmAttempts = 0
}

const confirmPaymentTransaction = async (transactionId: string, silent = false): Promise<'approved' | 'pending' | 'error'> => {
  if (!transactionId) return 'error'
  if (!silent) {
    confirmPending.value = true
    paymentInfoMessage.value = ''
  }
  try {
    const response = await api.post('subscription/confirm/', { transaction_id: transactionId })
    if (response.data?.status === 'approved') {
      await fetchCurrentUser()
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(PENDING_TX_STORAGE_KEY)
      }
      paymentInfoMessage.value = t('premium.payment.success', { plan: String(response.data?.plan || '').toUpperCase() })
      return 'approved'
    }
    if (!silent) {
      paymentInfoMessage.value = t('premium.payment.pending')
    }
    return 'pending'
  } catch (err: any) {
    if (!silent) {
      paymentInfoMessage.value = err?.response?.data?.error || t('premium.payment.confirmError')
    }
    return 'error'
  } finally {
    if (!silent) {
      confirmPending.value = false
    }
  }
}

const startAutoConfirmWatcher = (transactionId: string, popup: Window | null) => {
  if (typeof window === 'undefined') return
  clearAutoConfirmTimer()
  if (!transactionId) return
  autoConfirmTimer = window.setInterval(async () => {
    if (confirmPending.value) return
    autoConfirmAttempts += 1
    const status = await confirmPaymentTransaction(transactionId, true)
    if (status === 'approved') {
      clearAutoConfirmTimer()
      return
    }
    if (autoConfirmAttempts >= AUTO_CONFIRM_MAX_ATTEMPTS) {
      clearAutoConfirmTimer()
      if (popup?.closed) {
        paymentInfoMessage.value = t('premium.payment.pending')
      }
    }
  }, AUTO_CONFIRM_INTERVAL_MS)
}

const handlePopupCallbackReturn = async () => {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  const statusValue = String(params.get('status') || '').toLowerCase()
  const transactionId = String(
    params.get('id') || params.get('transaction_id') || params.get('transactionId') || '',
  ).trim()
  if (!statusValue || !transactionId) return

  window.localStorage.setItem(PENDING_TX_STORAGE_KEY, transactionId)
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage(
      { type: 'pinova_payment_callback', status: statusValue, transaction_id: transactionId },
      window.location.origin,
    )
    setTimeout(() => {
      window.close()
    }, 250)
  } else {
    await confirmPendingPayment(transactionId)
  }
}

const handleCheckout = async (planId: string) => {
  if (!isAuthenticated.value) {
    router.push('/login')
    return
  }
  checkoutPendingPlan.value = planId
  paymentInfoMessage.value = ''
  const popup = openCheckoutPopup()
  try {
    const response = await api.post('subscription/checkout/', {
      plan: planId,
      billing_cycle: billingCycle.value,
    })
    const checkoutUrl = response.data?.checkout_url
    const transactionId = response.data?.transaction_id
    if (transactionId && typeof window !== 'undefined') {
      window.localStorage.setItem(PENDING_TX_STORAGE_KEY, String(transactionId))
    }
    if (checkoutUrl) {
      startAutoConfirmWatcher(String(transactionId || ''), popup)
      if (popup && !popup.closed) {
        popup.location.href = checkoutUrl
        popup.focus()
      } else {
        window.open(checkoutUrl, '_blank', 'noopener,noreferrer')
      }
      return
    }
    if (popup && !popup.closed) popup.close()
    paymentInfoMessage.value = t('premium.payment.checkoutError')
  } catch (err: any) {
    if (popup && !popup.closed) popup.close()
    paymentInfoMessage.value = err?.response?.data?.error || t('premium.payment.checkoutError')
  } finally {
    checkoutPendingPlan.value = null
  }
}

const confirmPendingPayment = async (transactionIdOverride?: string) => {
  if (typeof window === 'undefined') return
  const transactionId = transactionIdOverride || window.localStorage.getItem(PENDING_TX_STORAGE_KEY)
  if (!transactionId) {
    paymentInfoMessage.value = t('premium.payment.noPending')
    return
  }
  const status = await confirmPaymentTransaction(transactionId, false)
  if (status === 'approved') {
    clearAutoConfirmTimer()
  }
}

const confirmPendingPaymentFromButton = () => {
  confirmPendingPayment().catch(() => undefined)
}

const handlePaymentMessage = async (event: MessageEvent) => {
  if (typeof window === 'undefined') return
  if (event.origin !== window.location.origin) return
  const payload = event.data || {}
  if (payload.type !== 'pinova_payment_callback') return
  const transactionId = String(payload.transaction_id || '').trim()
  if (!transactionId) return
  clearAutoConfirmTimer()
  window.localStorage.setItem(PENDING_TX_STORAGE_KEY, transactionId)
  await confirmPendingPayment(transactionId)
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('message', handlePaymentMessage)
  }
  api.get('subscription/pricing/')
    .then((response) => {
      pricingCatalog.value = response.data?.plans || {}
    })
    .catch(() => {
      paymentInfoMessage.value = t('premium.payment.checkoutError')
    })
    .finally(() => {
      pricingLoading.value = false
    })
  if (currentUser.value?.subscription?.plan) {
    selectedPlan.value = currentUser.value.subscription.plan
  }
  handlePopupCallbackReturn().catch(() => undefined)
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('message', handlePaymentMessage)
  }
  clearAutoConfirmTimer()
})
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
    <!-- Hero -->
    <div class="text-center mb-12">
      <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-50 text-pink-600 text-xs font-semibold mb-4">
        <span class="material-symbols-outlined text-sm">block</span>
        {{ t('premium.adFree') }}
      </div>
      <h1 class="text-4xl sm:text-5xl font-bold text-neutral-900 mb-3">
        {{ t('premium.title') }} <span class="text-pink-600">{{ t('premium.titleHighlight') }}</span>
      </h1>
      <p class="text-base sm:text-lg text-neutral-500 max-w-2xl mx-auto">
        {{ t('premium.tagline') }}
      </p>

      <!-- Billing toggle -->
      <div class="inline-flex items-center bg-neutral-100 rounded-full p-1 mt-8">
        <button
          class="px-5 py-2 rounded-full text-sm font-semibold transition"
          :class="billingCycle === 'monthly' ? 'bg-white shadow text-neutral-900' : 'text-neutral-500'"
          @click="billingCycle = 'monthly'"
        >
          {{ t('premium.cycle.monthly') }}
        </button>
        <button
          class="px-5 py-2 rounded-full text-sm font-semibold transition flex items-center gap-2"
          :class="billingCycle === 'yearly' ? 'bg-white shadow text-neutral-900' : 'text-neutral-500'"
          @click="billingCycle = 'yearly'"
        >
          {{ t('premium.cycle.yearly') }}
          <span class="text-[10px] uppercase tracking-wide bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">{{ t('premium.cycle.discount') }}</span>
        </button>
      </div>
    </div>

    <!-- Plans -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
      <div
        v-for="plan in plans"
        :key="plan.id"
        class="bg-white rounded-3xl border-2 p-6 relative transition-all"
        :class="plan.color"
      >
        <!-- Badge -->
        <div
          v-if="plan.badge"
          class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider"
          :class="plan.id === 'plus' ? 'bg-pink-600 text-white' : 'bg-amber-500 text-white'"
        >
          {{ plan.badge }}
        </div>

        <h3 class="text-xl font-bold text-neutral-900">{{ plan.name }}</h3>
        <p class="text-sm text-neutral-500 mt-1 mb-5">{{ plan.tagline }}</p>

        <div class="flex items-baseline gap-1 mb-1">
          <template v-if="pricingLoading || !plan.isPriceReady">
            <span class="inline-block h-10 w-full rounded-xl bg-neutral-200 animate-pulse"></span>
          </template>
          <template v-else>
            <span class="text-4xl font-bold text-neutral-900">
              {{ billingCycle === 'monthly' ? formatCurrency(Number(plan.monthly), String(plan.currencyIso)) : monthlyDisplayFromYearly(Number(plan.yearly), String(plan.currencyIso)) }}
            </span>
            <span class="text-sm text-neutral-500">{{ t('premium.priceUnit') }}</span>
          </template>
        </div>
        <p class="text-xs text-neutral-400 mb-5 h-4">
          <template v-if="!pricingLoading && plan.isPriceReady && Number(plan.yearly) > 0 && billingCycle === 'yearly'">
            {{ t('premium.yearlyBilled', { amount: formatCurrency(Number(plan.yearly), String(plan.currencyIso)) }) }}
          </template>
        </p>

        <button
          class="w-full py-3 rounded-full font-semibold text-sm transition mb-6"
          :class="plan.id === 'plus'
            ? 'bg-pink-600 text-white hover:bg-pink-700'
            : plan.id === 'pro'
              ? 'bg-neutral-900 text-white hover:bg-neutral-800'
              : 'bg-neutral-100 text-neutral-500 cursor-not-allowed'"
          :disabled="pricingLoading || !plan.isPriceReady || plan.ctaDisabled || checkoutPendingPlan === plan.id"
          @click="handleCheckout(plan.id)"
        >
          <span v-if="checkoutPendingPlan === plan.id" class="w-4 h-4 inline-block border-2 border-current border-t-transparent rounded-full animate-spin"></span>
          <span v-else>{{ plan.cta }}</span>
        </button>

        <ul class="space-y-2.5">
          <li
            v-for="(feature, i) in plan.features"
            :key="i"
            class="flex items-start gap-2 text-sm"
            :class="feature.included ? 'text-neutral-700' : 'text-neutral-300'"
          >
            <span
              class="material-symbols-outlined text-base mt-0.5 shrink-0"
              :class="feature.included ? 'text-emerald-500' : 'text-neutral-300'"
            >{{ feature.included ? 'check_circle' : 'cancel' }}</span>
            <span>{{ feature.label }}</span>
          </li>
        </ul>
      </div>
    </div>

    <!-- Trust banner -->
    <div class="bg-gradient-to-br from-emerald-50 via-white to-blue-50 border border-emerald-100 rounded-3xl p-6 sm:p-10 mb-16">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-emerald-600">block</span>
          </div>
          <div>
            <p class="text-sm font-bold text-neutral-900">{{ t('premium.trust.planLimits') }}</p>
            <p class="text-xs text-neutral-500 mt-1">{{ t('premium.trust.planLimits.desc') }}</p>
          </div>
        </div>
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-blue-600">shield</span>
          </div>
          <div>
            <p class="text-sm font-bold text-neutral-900">{{ t('premium.trust.noTracking') }}</p>
            <p class="text-xs text-neutral-500 mt-1">{{ t('premium.trust.noTracking.desc') }}</p>
          </div>
        </div>
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-pink-600">favorite</span>
          </div>
          <div>
            <p class="text-sm font-bold text-neutral-900">{{ t('premium.trust.creators') }}</p>
            <p class="text-xs text-neutral-500 mt-1">{{ t('premium.trust.creators.desc') }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- FAQ -->
    <div>
      <div class="max-w-2xl mx-auto mb-6 flex items-center justify-between gap-3">
        <button
          class="px-4 py-2 rounded-full bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50"
          :disabled="confirmPending"
          @click="confirmPendingPaymentFromButton"
        >
          {{ confirmPending ? t('premium.payment.checking') : t('premium.payment.confirmCta') }}
        </button>
        <p v-if="paymentInfoMessage" class="text-xs text-neutral-600">{{ paymentInfoMessage }}</p>
      </div>
      <h2 class="text-2xl font-bold text-neutral-900 mb-6 text-center">{{ t('premium.faq.title') }}</h2>
      <div class="max-w-2xl mx-auto space-y-3">
        <details
          v-for="(faq, i) in faqs"
          :key="i"
          class="bg-white rounded-2xl border border-neutral-100 group"
        >
          <summary class="px-5 py-4 cursor-pointer flex items-center justify-between text-sm font-semibold text-neutral-900">
            {{ faq.q }}
            <span class="material-symbols-outlined text-neutral-400 group-open:rotate-180 transition-transform">expand_more</span>
          </summary>
          <div class="px-5 pb-4 text-sm text-neutral-600 leading-relaxed">
            {{ faq.a }}
          </div>
        </details>
      </div>
    </div>
  </div>
</template>
