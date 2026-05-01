<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '../i18n'

const { t } = useI18n()

const billingCycle = ref<'monthly' | 'yearly'>('monthly')
const selectedPlan = ref<string | null>('plus')

const plans = computed(() => [
  {
    id: 'free',
    name: t('premium.plan.free.name'),
    tagline: t('premium.plan.free.tagline'),
    monthly: 0,
    yearly: 0,
    badge: null,
    color: 'border-neutral-200',
    cta: t('premium.plan.free.cta'),
    ctaDisabled: true,
    features: [
      { label: t('premium.feature.noAds'), included: true },
      { label: t('premium.feature.noTracking'), included: true },
      { label: t('premium.feature.unlimitedPins'), included: true },
      { label: t('premium.feature.privateTags10'), included: true },
      { label: t('premium.feature.privateBoards3'), included: true },
      { label: t('premium.feature.translate5'), included: true },
      { label: t('premium.feature.gifs'), included: false },
      // { label: t('premium.feature.creatorCredit'), included: false },
      { label: t('premium.feature.collabBoards'), included: false },
    ],
  },
  {
    id: 'plus',
    name: t('premium.plan.plus.name'),
    tagline: t('premium.plan.plus.tagline'),
    monthly: 4.99,
    yearly: 49,
    badge: t('premium.plan.plus.badge'),
    color: 'border-pink-500 ring-4 ring-pink-100',
    cta: t('premium.plan.plus.cta'),
    ctaDisabled: false,
    features: [
      { label: t('premium.feature.allFree'), included: true },
      { label: t('premium.feature.privateTagsUnlimited'), included: true },
      { label: t('premium.feature.privateBoardsUnlimited'), included: true },
      { label: t('premium.feature.gifs'), included: true },
      { label: t('premium.feature.translate30'), included: true },
      // { label: t('premium.feature.creatorCredit'), included: true },
      { label: t('premium.feature.collab10'), included: true },
      { label: t('premium.feature.reverseSearch'), included: true },
      { label: t('premium.feature.hd'), included: false },
    ],
  },
  {
    id: 'pro',
    name: t('premium.plan.pro.name'),
    tagline: t('premium.plan.pro.tagline'),
    monthly: 12.99,
    yearly: 129,
    badge: t('premium.plan.pro.badge'),
    color: 'border-amber-400',
    cta: t('premium.plan.pro.cta'),
    ctaDisabled: false,
    features: [
      { label: t('premium.feature.allPlus'), included: true },
      { label: t('premium.feature.collabUnlimited'), included: true },
      { label: t('premium.feature.hd4k'), included: true },
      { label: t('premium.feature.stats'), included: true },
      { label: t('premium.feature.tips'), included: true },
      { label: t('premium.feature.blockchain'), included: true },
      { label: t('premium.feature.longVideos'), included: true },
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
          <span class="text-4xl font-bold text-neutral-900">
            {{ billingCycle === 'monthly' ? plan.monthly : (plan.yearly / 12).toFixed(2) }}
          </span>
          <span class="text-sm text-neutral-500">{{ t('premium.priceUnit') }}</span>
        </div>
        <p class="text-xs text-neutral-400 mb-5 h-4">
          <template v-if="plan.yearly > 0 && billingCycle === 'yearly'">
            {{ t('premium.yearlyBilled', { amount: plan.yearly }) }}
          </template>
        </p>

        <button
          class="w-full py-3 rounded-full font-semibold text-sm transition mb-6"
          :class="plan.id === 'plus'
            ? 'bg-pink-600 text-white hover:bg-pink-700'
            : plan.id === 'pro'
              ? 'bg-neutral-900 text-white hover:bg-neutral-800'
              : 'bg-neutral-100 text-neutral-500 cursor-not-allowed'"
          :disabled="plan.ctaDisabled"
          @click="selectedPlan = plan.id"
        >
          {{ plan.cta }}
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
            <p class="text-sm font-bold text-neutral-900">{{ t('premium.trust.noAds') }}</p>
            <p class="text-xs text-neutral-500 mt-1">{{ t('premium.trust.noAds.desc') }}</p>
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
