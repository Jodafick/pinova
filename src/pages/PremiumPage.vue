<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from '../i18n'
import { useAuth } from '../composables/useAuth'
import api from '../api'
import { devLog } from '../devLog'

const { t, currentLang } = useI18n()
const router = useRouter()
const { currentUser, isAuthenticated, fetchCurrentUser, startPlusTrial } = useAuth()

const billingCycle = ref<'monthly' | 'yearly'>('monthly')
const seatBundle = ref<'solo' | 'family' | 'team'>('solo')
const checkoutPendingPlan = ref<string | null>(null)
const confirmPending = ref(false)
const paymentInfoMessage = ref('')
const trialPending = ref(false)
const PENDING_TX_STORAGE_KEY = 'pinova_pending_subscription_tx'
type PricingCycle = {
  amount_minor: number
  amount_display: number
  currency_iso: string
  duration_days: number
}
type PlanCatalog = Record<string, Record<string, PricingCycle>>
type SeatBundleKey = 'solo' | 'family' | 'team'

const pricingByBundle = ref<Partial<Record<SeatBundleKey, PlanCatalog>>>({})
const pricingLoading = ref(true)
const annualDiscountPercent = ref(10)

const ZERO_DECIMAL_ISO = new Set(['XOF', 'XAF', 'JPY', 'KRW', 'CLP'])
const seatInviteLimits = ref<{ solo: number; family: number; team: number }>({
  solo: 0,
  family: 5,
  team: 15,
})

const formatCurrency = (amount: number, currencyIso: string) => {
  try {
    const iso = (currencyIso || 'XOF').toUpperCase()
    return new Intl.NumberFormat(currentLang.value || 'fr', {
      style: 'currency',
      currency: iso,
      maximumFractionDigits: ZERO_DECIMAL_ISO.has(iso) ? 0 : 2,
      minimumFractionDigits: ZERO_DECIMAL_ISO.has(iso) ? 0 : undefined,
    }).format(amount)
  } catch (_) {
    return `${amount} ${currencyIso}`
  }
}

const monthlyDisplayFromYearly = (yearlyAmount: number, currencyIso: string) =>
  formatCurrency(yearlyAmount / 12, currencyIso)

const normalizeBundle = (b: unknown): SeatBundleKey => {
  const x = String(b || 'solo').toLowerCase().trim()
  if (x === 'family' || x === 'team') return x
  return 'solo'
}

const pricingCatalog = computed(() => {
  const key = normalizeBundle(seatBundle.value)
  return pricingByBundle.value[key] ?? pricingByBundle.value.solo ?? {}
})

const readCycle = (planId: string, cycle: 'monthly' | 'yearly') =>
  pricingCatalog.value[planId]?.[cycle]

const currentPlanId = computed(() => currentUser.value?.subscription?.plan || 'free')

const isSeatMember = computed(() => !!currentUser.value?.subscription?.isSeatMember)

const ownerActiveBillingCycle = computed((): 'monthly' | 'yearly' | null => {
  const c = currentUser.value?.subscription?.activeBillingCycle
  return c === 'monthly' || c === 'yearly' ? c : null
})

function paidTierFullyMatchesSelection(planId: 'plus' | 'pro'): boolean {
  if (currentPlanId.value !== planId) return false
  if (normalizeBundle(seatBundle.value) !== normalizeBundle(currentUser.value?.subscription?.seatBundle)) {
    return false
  }
  const refCycle = ownerActiveBillingCycle.value
  if (!refCycle) return true
  return billingCycle.value === refCycle
}

function planTierLocked(planId: string): boolean {
  if (planId === 'free') return false
  if (isSeatMember.value) return true
  if (planId === 'plus' || planId === 'pro') return paidTierFullyMatchesSelection(planId)
  return false
}

const showTrialCta = computed(
  () => isAuthenticated.value && (currentUser.value?.subscription?.trialEligible ?? false),
)

const loadPricingCatalog = () => {
  pricingLoading.value = true
  api
    .get('subscription/pricing/')
    .then((response) => {
      const raw = response.data?.pricing_by_bundle as
        | Partial<Record<SeatBundleKey, PlanCatalog>>
        | undefined
      if (raw && typeof raw === 'object') {
        pricingByBundle.value = {
          solo: raw.solo || {},
          family: raw.family || {},
          team: raw.team || {},
        }
      } else {
        pricingByBundle.value = { solo: response.data?.plans || {} }
      }
      const ad = response.data?.annual_discount_percent
      if (typeof ad === 'number' && Number.isFinite(ad) && ad > 0 && ad <= 99) {
        annualDiscountPercent.value = Math.round(ad)
      }
      const sil = response.data?.seat_invite_limits
      if (sil && typeof sil === 'object') {
        const f = Number((sil as { family?: unknown }).family)
        const tm = Number((sil as { team?: unknown }).team)
        const so = Number((sil as { solo?: unknown }).solo)
        seatInviteLimits.value = {
          solo: Number.isFinite(so) ? so : 0,
          family: Number.isFinite(f) ? f : 5,
          team: Number.isFinite(tm) ? tm : 15,
        }
      }
    })
    .catch(() => {
      paymentInfoMessage.value = t('premium.payment.checkoutError')
    })
    .finally(() => {
      pricingLoading.value = false
    })
}

const yearlyDiscountBadge = computed(() =>
  t('premium.cycle.discountBadge', { n: annualDiscountPercent.value }),
)

function yearlySavingsVsMonthly(planId: string): number | null {
  if (planId === 'free') return null
  const m = readCycle(planId, 'monthly')
  const y = readCycle(planId, 'yearly')
  if (!m || !y) return null
  const ifPaidMonthly = Number(m.amount_display) * 12
  const diff = ifPaidMonthly - Number(y.amount_display)
  if (diff < 0.5) return null
  return diff
}

function yearlySavingsText(planId: string, currencyIso: string): string | null {
  const s = yearlySavingsVsMonthly(planId)
  if (s == null) return null
  return t('premium.yearlySavings', { amount: formatCurrency(s, currencyIso) })
}

watch(
  () => currentUser.value?.subscription?.seatBundle,
  (b) => {
    const sub = currentUser.value?.subscription
    if (!sub || sub.plan === 'free' || sub.isSeatMember) return
    seatBundle.value = normalizeBundle(b)
  },
  { immediate: true },
)

watch(
  () => currentUser.value?.subscription?.activeBillingCycle,
  (cycle) => {
    const sub = currentUser.value?.subscription
    if (!sub || sub.plan === 'free' || sub.isSeatMember) return
    if (cycle === 'monthly' || cycle === 'yearly') billingCycle.value = cycle
  },
  { immediate: true },
)

const handleStartTrial = async () => {
  if (!isAuthenticated.value) {
    router.push('/login')
    return
  }
  if (trialPending.value) return
  trialPending.value = true
  paymentInfoMessage.value = ''
  try {
    await startPlusTrial()
    paymentInfoMessage.value = t('premium.trial.started')
  } catch (err: any) {
    paymentInfoMessage.value = err?.response?.data?.error || t('premium.trial.error')
  } finally {
    trialPending.value = false
  }
}

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
    cta: currentPlanId.value === 'free' ? t('premium.plan.free.cta') : t('premium.plan.free.name'),
    tierLocked: false,
    features: [
      { label: t('premium.feature.adsEnabled'), included: true },
      { label: t('premium.feature.partnerAdsEnabled'), included: true },
      { label: t('premium.feature.noTracking'), included: true },
      { label: t('premium.feature.moderationReport'), included: true },
      { label: t('premium.feature.nsfwClientBlur'), included: true },
      { label: t('premium.feature.boardsFreeLimits'), included: true },
      { label: t('premium.feature.privateTagsFree'), included: false },
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
    cta:
      currentPlanId.value === 'plus'
        ? paidTierFullyMatchesSelection('plus')
          ? t('premium.plan.free.cta')
          : t('premium.plan.sameTier.ctaUpdate')
        : t('premium.plan.plus.cta'),
    tierLocked: planTierLocked('plus'),
    features: [
      { label: t('premium.feature.allFree'), included: true },
      { label: t('premium.feature.disableAdsOnly'), included: true },
      { label: t('premium.feature.disablePartnerAds'), included: false },
      { label: t('premium.feature.privateTagsUnlimited'), included: true },
      { label: t('premium.feature.boardsPlusLimits'), included: true },
      { label: t('premium.feature.gifs'), included: true },
      { label: t('premium.feature.collab10'), included: true },
      { label: t('premium.feature.collabInviteFlow'), included: true },
      { label: t('premium.feature.privateBoardLinks'), included: true },
      { label: t('premium.feature.scheduledPublish'), included: true },
      { label: t('premium.feature.aiTranslate'), included: true },
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
    cta:
      currentPlanId.value === 'pro'
        ? paidTierFullyMatchesSelection('pro')
          ? t('premium.plan.free.cta')
          : t('premium.plan.sameTier.ctaUpdate')
        : t('premium.plan.pro.cta'),
    tierLocked: planTierLocked('pro'),
    features: [
      { label: t('premium.feature.allPlus'), included: true },
      { label: t('premium.feature.disableAllAds'), included: true },
      { label: t('premium.feature.collabUnlimited'), included: true },
      { label: t('premium.feature.collabInviteFlow'), included: true },
      { label: t('premium.feature.hd4k'), included: true },
      { label: t('premium.feature.stats'), included: true },
      { label: t('premium.feature.digestEmail'), included: true },
      { label: t('premium.feature.tips'), included: true },
      { label: t('premium.feature.blockchain'), included: true },
      { label: t('premium.feature.supportTickets'), included: true },
      { label: t('premium.feature.support'), included: true },
      { label: t('premium.feature.privateProfileShare'), included: true },
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

const confirmPaymentTransaction = async (
  transactionId: string,
  silent = false,
  callbackStatus?: string,
): Promise<'approved' | 'pending' | 'error'> => {
  if (!transactionId) return 'error'
  if (!silent) {
    confirmPending.value = true
    paymentInfoMessage.value = ''
  }
  try {
    const payload: Record<string, string> = { transaction_id: transactionId }
    if (callbackStatus) {
      payload.callback_status = String(callbackStatus).toLowerCase()
    }
    const response = await api.post('subscription/confirm/', payload)
    if (response.data?.status === 'approved') {
      await fetchCurrentUser({ silent: true })
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

const handlePopupCallbackReturn = async () => {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  const statusValue = String(params.get('status') || '').toLowerCase()
  const transactionId = String(
    params.get('id') || params.get('transaction_id') || params.get('transactionId') || '',
  ).trim()
  if (!statusValue || !transactionId) return

  window.localStorage.setItem(PENDING_TX_STORAGE_KEY, transactionId)
  const confirmStatus = await confirmPaymentTransaction(transactionId, true, statusValue)
  const confirmed = confirmStatus === 'approved'
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage(
      {
        type: 'pinova_payment_callback_url',
        callback_url: window.location.href,
        callback_query: Object.fromEntries(params.entries()),
        status: statusValue,
        confirm_status: confirmStatus,
        confirmed,
        transaction_id: transactionId,
      },
      window.location.origin,
    )
    setTimeout(() => {
      window.close()
    }, 350)
  } else {
    await confirmPendingPayment(transactionId)
  }
}

const handleCheckout = async (planId: string) => {
  if (!isAuthenticated.value) {
    router.push('/login')
    return
  }
  if (isSeatMember.value) {
    paymentInfoMessage.value = t('premium.seatMember.manageNote')
    return
  }
  checkoutPendingPlan.value = planId
  paymentInfoMessage.value = ''
  const popup = openCheckoutPopup()
  try {
    const response = await api.post('subscription/checkout/', {
      plan: planId,
      billing_cycle: billingCycle.value,
      seat_bundle: seatBundle.value,
    })
    const checkoutUrl = response.data?.checkout_url
    const transactionId = response.data?.transaction_id
    if (transactionId && typeof window !== 'undefined') {
      window.localStorage.setItem(PENDING_TX_STORAGE_KEY, String(transactionId))
    }
    if (checkoutUrl) {
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
  if (status === 'approved') return
}

const confirmPendingPaymentFromButton = () => {
  confirmPendingPayment().catch(() => undefined)
}

const handlePaymentMessage = async (event: MessageEvent) => {
  if (typeof window === 'undefined') return
  if (event.origin !== window.location.origin) return
  const payload = event.data || {}
  if (payload.type !== 'pinova_payment_callback_url') return
  const callbackUrl = String(payload.callback_url || '')
  const callbackQuery = payload.callback_query || {}
  const transactionId = String(
    payload.transaction_id || callbackQuery.id || callbackQuery.transaction_id || callbackQuery.transactionId || '',
  ).trim()
  if (!transactionId) return
  devLog('Payment callback received in main window', {
    callbackUrl,
    callbackQuery,
    transactionId,
    confirmStatus: payload.confirm_status,
    confirmed: !!payload.confirmed,
  })
  window.localStorage.setItem(PENDING_TX_STORAGE_KEY, transactionId)
  if (!payload.confirmed) {
    await confirmPendingPayment(transactionId)
  } else {
    window.localStorage.removeItem(PENDING_TX_STORAGE_KEY)
  }
  const remainingTx = window.localStorage.getItem(PENDING_TX_STORAGE_KEY)
  if (!remainingTx) {
    window.location.reload()
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('message', handlePaymentMessage)
  }
  if (isAuthenticated.value) {
    void fetchCurrentUser({ silent: true })
  }
  loadPricingCatalog()
  handlePopupCallbackReturn().catch(() => undefined)
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('message', handlePaymentMessage)
  }
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
      <p class="text-xs text-neutral-500 max-w-2xl mx-auto mt-3">
        {{ t('premium.b2bLine') }}
      </p>

      <div
        v-if="isAuthenticated && isSeatMember"
        class="mt-6 max-w-2xl mx-auto rounded-2xl border border-amber-200 bg-amber-50/95 px-4 py-3 text-sm text-amber-950 leading-snug text-center shadow-sm"
        role="status"
      >
        {{ t('premium.seatMember.manageNote') }}
      </div>

      <!-- Billing toggle -->
      <div
        class="inline-flex items-center bg-neutral-100 rounded-full p-1 mt-8"
        :class="isSeatMember ? 'opacity-60 pointer-events-none' : ''"
      >
        <button
          class="px-5 py-2 rounded-full text-sm font-semibold transition"
          type="button"
          :disabled="isSeatMember"
          :class="billingCycle === 'monthly' ? 'bg-white shadow text-neutral-900' : 'text-neutral-500'"
          @click="billingCycle = 'monthly'"
        >
          {{ t('premium.cycle.monthly') }}
        </button>
        <button
          class="px-5 py-2 rounded-full text-sm font-semibold transition flex items-center gap-2"
          type="button"
          :disabled="isSeatMember"
          :class="billingCycle === 'yearly' ? 'bg-white shadow text-neutral-900' : 'text-neutral-500'"
          @click="billingCycle = 'yearly'"
        >
          {{ t('premium.cycle.yearly') }}
          <span
            v-if="annualDiscountPercent > 0"
            class="text-[10px] uppercase tracking-wide bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold"
          >{{ yearlyDiscountBadge }}</span>
        </button>
      </div>

      <div class="mt-6 space-y-2">
        <p class="text-xs font-semibold text-neutral-600">{{ t('premium.bundle.title') }}</p>
        <div class="inline-flex flex-wrap justify-center gap-2" :class="isSeatMember ? 'opacity-60 pointer-events-none' : ''">
          <button
            type="button"
            class="px-4 py-2 rounded-full text-xs font-semibold border transition"
            :class="seatBundle === 'solo' ? 'border-pink-500 bg-pink-50 text-pink-800' : 'border-neutral-200 text-neutral-600'"
            :disabled="isSeatMember"
            @click="seatBundle = 'solo'"
          >
            {{ t('premium.bundle.solo') }}
          </button>
          <button
            type="button"
            class="px-4 py-2 rounded-full text-xs font-semibold border transition"
            :class="seatBundle === 'family' ? 'border-pink-500 bg-pink-50 text-pink-800' : 'border-neutral-200 text-neutral-600'"
            :disabled="isSeatMember"
            @click="seatBundle = 'family'"
          >
            {{ t('premium.bundle.family') }}
          </button>
          <button
            type="button"
            class="px-4 py-2 rounded-full text-xs font-semibold border transition"
            :class="seatBundle === 'team' ? 'border-pink-500 bg-pink-50 text-pink-800' : 'border-neutral-200 text-neutral-600'"
            :disabled="isSeatMember"
            @click="seatBundle = 'team'"
          >
            {{ t('premium.bundle.team') }}
          </button>
        </div>
        <p class="text-[11px] text-neutral-400 max-w-lg mx-auto leading-relaxed">
          {{
            seatBundle === 'family'
              ? t('premium.bundle.familyDesc', { n: seatInviteLimits.family })
              : seatBundle === 'team'
                ? t('premium.bundle.teamDesc', { n: seatInviteLimits.team })
                : t('premium.bundle.soloDesc')
          }}
        </p>
      </div>

      <div
        v-if="showTrialCta"
        class="mt-10 max-w-lg mx-auto rounded-2xl border border-pink-200 bg-gradient-to-br from-pink-50 to-white p-5 text-left shadow-sm"
      >
        <p class="text-sm font-bold text-neutral-900">{{ t('premium.trial.title') }}</p>
        <p class="text-xs text-neutral-600 mt-1">{{ t('premium.trial.sub') }}</p>
        <button
          type="button"
          class="mt-4 w-full sm:w-auto px-5 py-2.5 rounded-full bg-pink-600 text-white text-xs font-semibold hover:bg-pink-700 disabled:opacity-50"
          :disabled="trialPending"
          @click="handleStartTrial"
        >
          {{ trialPending ? t('premium.trial.busy') : t('premium.trial.cta') }}
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
        <p class="text-xs text-neutral-400 mb-5 min-h-[2.5rem]">
          <template v-if="!pricingLoading && plan.isPriceReady && Number(plan.yearly) > 0 && billingCycle === 'yearly'">
            <span class="block">{{ t('premium.yearlyBilled', { amount: formatCurrency(Number(plan.yearly), String(plan.currencyIso)) }) }}</span>
            <span
              v-if="yearlySavingsText(plan.id, String(plan.currencyIso))"
              class="block text-emerald-700 font-medium mt-0.5"
            >{{ yearlySavingsText(plan.id, String(plan.currencyIso)) }}</span>
          </template>
        </p>

        <button
          class="w-full py-3 rounded-full font-semibold text-sm transition mb-6"
          :class="plan.id === 'plus'
            ? 'bg-pink-600 text-white hover:bg-pink-700'
            : plan.id === 'pro'
              ? 'bg-neutral-900 text-white hover:bg-neutral-800'
              : 'bg-neutral-100 text-neutral-500 cursor-not-allowed'"
          :disabled="pricingLoading || !plan.isPriceReady || plan.tierLocked || checkoutPendingPlan === plan.id"
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
