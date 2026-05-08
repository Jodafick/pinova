<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import BillingInvoicesSkeleton from '../components/BillingInvoicesSkeleton.vue'
import BillingReceiptPdfModal from '../components/BillingReceiptPdfModal.vue'
import { useAuth } from '../composables/useAuth'
import { useBillingReceiptPdfModal } from '../composables/useBillingReceiptPdfModal'
import { useI18n } from '../i18n'

const router = useRouter()
const { fetchSubscriptionInvoices, fetchSubscriptionInvoiceReceipt, fetchCurrentUser } = useAuth()
const { t, currentLang } = useI18n()

type InvoiceRow = {
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
}

const billingInvoices = ref<InvoiceRow[]>([])
const loading = ref(false)
const receiptLoadingId = ref<number | null>(null)
const receiptError = ref('')
const { receiptPdfOpen, receiptPdfUrl, closeReceiptPdf, openReceiptPdf } = useBillingReceiptPdfModal()

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

function statusBadgeClasses(status: string) {
  const s = String(status || '').toLowerCase()
  if (s === 'approved' || s === 'completed' || s === 'paid') {
    return 'app-btn app-btn-sm app-btn-secondary border-emerald-300 dark:border-emerald-700/70 text-emerald-700 dark:text-emerald-300'
  }
  if (s === 'pending' || s === 'processing') {
    return 'app-btn app-btn-sm app-btn-secondary border-amber-300 dark:border-amber-700/70 text-amber-700 dark:text-amber-300'
  }
  if (s === 'failed' || s === 'cancelled' || s === 'canceled') {
    return 'app-btn app-btn-sm app-btn-secondary border-rose-300 dark:border-rose-700/70 text-rose-700 dark:text-rose-300'
  }
  return 'app-btn app-btn-sm app-btn-secondary'
}

function formatPlanName(plan: string) {
  const p = String(plan || '').trim()
  if (!p) return '—'
  return p.slice(0, 1).toUpperCase() + p.slice(1).toLowerCase()
}

function formatBillingCycleLabel(cycle: string) {
  const c = String(cycle || '').toLowerCase().trim()
  if (c === 'monthly') return currentLang.value === 'en' ? 'Monthly' : 'Mensuel'
  if (c === 'yearly' || c === 'annual' || c === 'annually') {
    return currentLang.value === 'en' ? 'Yearly' : 'Annuel'
  }
  return cycle || '—'
}

const invoiceCountLabel = computed(() => {
  const n = billingInvoices.value.length
  if (n === 0) return ''
  if (currentLang.value === 'en') {
    return n === 1 ? '1 payment' : `${n} payments`
  }
  return n === 1 ? '1 paiement' : `${n} paiements`
})

async function fetchAndShowReceipt(inv: InvoiceRow) {
  receiptError.value = ''
  receiptLoadingId.value = inv.id
  try {
    const data = await fetchSubscriptionInvoiceReceipt(inv.id)
    const url = data?.invoice_url
    if (url) {
      const idx = billingInvoices.value.findIndex((x) => x.id === inv.id)
      const prev = idx >= 0 ? billingInvoices.value[idx] : undefined
      if (prev) {
        billingInvoices.value[idx] = { ...prev, invoice_url: url }
      }
      openReceiptPdf(url)
    } else {
      receiptError.value = data?.detail
        ? String(data.detail)
        : t('billing.fetchReceiptUnavailable')
    }
  } catch {
    receiptError.value = t('billing.fetchReceiptError')
  } finally {
    receiptLoadingId.value = null
  }
}

function viewReceipt(inv: InvoiceRow) {
  if (inv.invoice_url) {
    openReceiptPdf(inv.invoice_url)
    return
  }
  void fetchAndShowReceipt(inv)
}

onMounted(async () => {
  loading.value = true
  await fetchCurrentUser({ silent: true })
  try {
    billingInvoices.value = (await fetchSubscriptionInvoices()) as InvoiceRow[]
  } catch {
    billingInvoices.value = []
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div
    class="min-h-[70vh] w-full min-w-0 bg-gradient-to-b from-neutral-50 via-white to-[#fdf8fb] dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900 selection:bg-pink-100 selection:text-pink-900"
  >
    <div class="w-full min-w-0 max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-14 pb-16">
      <button
        type="button"
        class="app-btn app-btn-secondary group mb-8 text-sm"
        @click="router.push('/settings')"
      >
        <span class="material-symbols-outlined text-[1.125rem]">
          arrow_back
        </span>
        {{ t('billing.backSettings') }}
      </button>

      <header
        class="relative overflow-hidden rounded-3xl border border-pink-100/80 dark:border-pink-900/40 bg-gradient-to-br from-white via-white to-pink-50/40 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900 px-6 sm:px-10 py-8 sm:py-10 shadow-[0_1px_0_0_rgba(0,0,0,0.04),0_12px_40px_-18px_rgba(225,29,119,0.18)] mb-8"
      >
        <div
          class="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-pink-400/10 blur-2xl"
          aria-hidden="true"
        />
        <div
          class="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-pink-500/5 blur-xl"
          aria-hidden="true"
        />
        <div class="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div class="flex gap-4">
            <div
              class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-pink-600 text-white shadow-md shadow-pink-500/25"
              aria-hidden="true"
            >
              <span class="material-symbols-outlined text-[1.5rem]">receipt_long</span>
            </div>
            <div>
              <p class="text-[11px] font-bold uppercase tracking-[0.12em] text-pink-600">
                {{ t('billing.title') }}
              </p>
              <h1 class="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                {{ t('settings.subscription.billingHistory') }}
              </h1>
              <p class="mt-2 max-w-lg text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
                {{ t('billing.subtitle') }}
              </p>
            </div>
          </div>
          <div
            v-if="!loading && invoiceCountLabel"
            class="shrink-0 self-start rounded-full border border-pink-100 dark:border-pink-900/50 bg-white/90 dark:bg-neutral-900 px-4 py-2 text-center text-xs font-semibold text-pink-800 dark:text-pink-200 shadow-sm"
          >
            {{ invoiceCountLabel }}
          </div>
        </div>
      </header>

      <section
        class="rounded-3xl border border-neutral-100/90 dark:border-neutral-700 bg-white/90 dark:bg-neutral-900/90 p-5 sm:p-8 shadow-[0_1px_0_0_rgba(0,0,0,0.03),0_20px_50px_-24px_rgba(0,0,0,0.12)] backdrop-blur-sm"
      >
        <div v-if="loading" aria-busy="true">
          <span class="sr-only">{{ t('settings.subscription.billingLoading') }}</span>
          <BillingInvoicesSkeleton />
        </div>

        <template v-else>
          <p
            v-if="receiptError"
            class="mb-4 flex items-start gap-2 rounded-2xl border border-rose-100 bg-rose-50/90 px-4 py-3 text-sm text-rose-800"
            role="alert"
          >
            <span class="material-symbols-outlined mt-0.5 text-[1.125rem] text-rose-500">error</span>
            <span>{{ receiptError }}</span>
          </p>

          <div
            v-if="!billingInvoices.length"
            class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900/50 px-6 py-16 text-center"
          >
            <span
              class="material-symbols-outlined mb-4 text-5xl text-neutral-300"
              aria-hidden="true"
            >
              payments
            </span>
            <p class="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{{ t('settings.subscription.billingEmpty') }}</p>
            <p class="mt-2 max-w-xs text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
              {{ t('billing.subtitle') }}
            </p>
          </div>

          <ul v-else class="max-h-[70vh] space-y-3 overflow-y-auto pr-1 [scrollbar-width:thin]">
            <li
              v-for="inv in billingInvoices"
              :key="inv.id"
              class="group rounded-2xl border border-neutral-100 dark:border-neutral-700 bg-gradient-to-b from-white to-neutral-50/40 dark:from-neutral-900 dark:to-neutral-900 p-4 shadow-sm transition hover:border-pink-100/90 dark:hover:border-pink-700/50 hover:shadow-md"
            >
              <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="min-w-0 flex-1 space-y-2">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-sm font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                      {{ formatPlanName(inv.plan) }}
                    </span>
                    <span class="hidden text-neutral-300 sm:inline" aria-hidden="true">·</span>
                    <span class="text-sm text-neutral-600 dark:text-neutral-300">
                      {{ formatBillingCycleLabel(inv.billing_cycle) }}
                    </span>
                    <span class="capitalize" :class="statusBadgeClasses(inv.status)">
                      {{ inv.status }}
                    </span>
                    <span
                      v-if="inv.promo_bundle && inv.promo_bundle !== 'solo'"
                      class="text-[11px] font-medium text-neutral-500"
                    >
                      {{ inv.promo_bundle }}
                    </span>
                  </div>
                  <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                    <span class="inline-flex items-center gap-1">
                      <span class="material-symbols-outlined text-[0.95rem] text-neutral-400">schedule</span>
                      {{ formatInvoiceWhen(inv.created_at) }}
                    </span>
                  </div>
                </div>

                <div class="flex shrink-0 flex-col items-stretch gap-3 sm:items-end sm:text-right">
                  <p class="text-lg font-bold tabular-nums text-neutral-900 dark:text-neutral-100 sm:text-xl">
                    {{ invoiceAmountLabel(inv) }}
                  </p>
                  <div class="flex flex-wrap gap-2 sm:justify-end">
                    <template v-if="inv.status === 'approved'">
                      <button
                        type="button"
                        class="app-btn app-btn-primary app-btn-sm text-xs disabled:pointer-events-none"
                        :disabled="receiptLoadingId === inv.id"
                        @click="viewReceipt(inv)"
                      >
                        <span class="material-symbols-outlined text-[1rem]">description</span>
                        {{
                          receiptLoadingId === inv.id
                            ? t('billing.fetchReceiptBusy')
                            : inv.invoice_url
                              ? t('settings.subscription.openReceipt')
                              : t('billing.fetchReceipt')
                        }}
                      </button>
                    </template>
                    <a
                      v-else-if="inv.checkout_url && inv.status === 'pending'"
                      :href="inv.checkout_url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="app-btn app-btn-secondary app-btn-sm text-xs"
                    >
                      <span class="material-symbols-outlined text-[1rem]">open_in_new</span>
                      {{ t('settings.subscription.openCheckout') }}
                    </a>
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </template>
      </section>

      <BillingReceiptPdfModal
        :open="receiptPdfOpen"
        :url="receiptPdfUrl"
        @close="closeReceiptPdf"
      />
    </div>
  </div>
</template>
