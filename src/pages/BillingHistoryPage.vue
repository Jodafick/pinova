<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { useI18n } from '../i18n'

const router = useRouter()
const { fetchSubscriptionInvoices, fetchCurrentUser } = useAuth()
const { t, currentLang } = useI18n()

const billingInvoices = ref<
  {
    id: number
    fedapay_transaction_id: string
    created_at: string
    plan: string
    billing_cycle: string
    amount_display: number
    currency_iso: string
    promo_bundle?: string
    status: string
    checkout_url?: string
    invoice_url?: string
  }[]
>([])
const loading = ref(false)

const formatInvoiceWhen = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  try {
    return new Intl.DateTimeFormat(currentLang.value || 'fr', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
  } catch {
    return d.toLocaleString()
  }
}

const invoiceAmountLabel = (row: { amount_display: number; currency_iso: string }) => {
  try {
    return new Intl.NumberFormat(currentLang.value || 'fr', {
      style: 'currency',
      currency: row.currency_iso,
      maximumFractionDigits: 2,
    }).format(Number(row.amount_display))
  } catch {
    return `${row.amount_display} ${row.currency_iso}`
  }
}

onMounted(async () => {
  loading.value = true
  await fetchCurrentUser({ silent: true })
  try {
    billingInvoices.value = await fetchSubscriptionInvoices()
  } catch {
    billingInvoices.value = []
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
    <button
      type="button"
      class="mb-6 flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900 transition"
      @click="router.push('/settings')"
    >
      <span class="material-symbols-outlined text-lg">arrow_back</span>
      {{ t('billing.backSettings') }}
    </button>

    <h1 class="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">{{ t('billing.title') }}</h1>
    <p class="text-sm text-neutral-500 mb-8">{{ t('billing.subtitle') }}</p>

    <div class="rounded-2xl border border-neutral-100 bg-white shadow-sm p-6">
      <p class="text-xs font-semibold text-neutral-800 mb-3">{{ t('settings.subscription.billingHistory') }}</p>
      <p v-if="loading" class="text-xs text-neutral-400">{{ t('settings.subscription.billingLoading') }}</p>
      <div v-else-if="!billingInvoices.length" class="text-xs text-neutral-400">
        {{ t('settings.subscription.billingEmpty') }}
      </div>
      <ul v-else class="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
        <li
          v-for="inv in billingInvoices"
          :key="inv.id"
          class="rounded-xl border border-neutral-200 px-3 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
        >
          <div>
            <p class="text-xs font-semibold text-neutral-800">
              {{ inv.plan.toUpperCase() }} · {{ inv.billing_cycle }} · {{ invoiceAmountLabel(inv) }}
            </p>
            <p class="text-[11px] text-neutral-500">
              {{ formatInvoiceWhen(inv.created_at) }} · {{ inv.status }}
              <span v-if="inv.promo_bundle && inv.promo_bundle !== 'solo'"> · {{ inv.promo_bundle }}</span>
            </p>
          </div>
          <div class="flex flex-wrap gap-2 shrink-0">
            <a
              v-if="inv.invoice_url"
              :href="inv.invoice_url"
              target="_blank"
              rel="noopener noreferrer"
              class="text-[11px] font-semibold text-pink-600 hover:underline"
            >
              {{ t('settings.subscription.openReceipt') }}
            </a>
            <a
              v-else-if="inv.checkout_url && inv.status === 'pending'"
              :href="inv.checkout_url"
              target="_blank"
              rel="noopener noreferrer"
              class="text-[11px] font-semibold text-neutral-700 hover:underline"
            >
              {{ t('settings.subscription.openCheckout') }}
            </a>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
