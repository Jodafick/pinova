<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api/index'
import { useI18n } from '../i18n'
import { useAppModal } from '../composables/useAppModal'
import { openCheckoutFlow } from '../utils/checkoutFlow'
import { trackEvent } from '../lib/analytics'

const props = defineProps<{
  open: boolean
  recipientUsername: string
  pinSlug?: string
}>()
const emit = defineEmits<{ (e: 'close'): void }>()

const router = useRouter()
const { t } = useI18n()
const { showAlert } = useAppModal()

type TipConfig = {
  commission_percent: number
  min_tip_amount: number
  max_tip_amount: number
  currency_iso: string
  preset_amounts: number[]
}

const config = ref<TipConfig | null>(null)
const selectedAmount = ref<number | null>(null)
const customAmount = ref('')
const message = ref('')
const busy = ref(false)

const effectiveAmount = computed(() => {
  if (selectedAmount.value != null) return selectedAmount.value
  const n = parseInt(customAmount.value, 10)
  return Number.isFinite(n) && n > 0 ? n : null
})

const splitPreview = computed(() => {
  const amt = effectiveAmount.value
  const pct = config.value?.commission_percent ?? 10
  if (!amt) return null
  const commission = Math.max(amt > 0 && pct > 0 ? 1 : 0, Math.floor((amt * pct) / 100))
  const capped = commission > amt ? amt : commission
  return { commission: capped, net: amt - capped, pct }
})

onMounted(async () => {
  try {
    const res = await api.get<TipConfig>('monetization/tips/config/')
    config.value = res.data
    if (res.data.preset_amounts?.length) selectedAmount.value = res.data.preset_amounts[1] ?? res.data.preset_amounts[0]
  } catch {
    config.value = null
  }
})

watch(
  () => props.open,
  (v) => {
    if (!v) {
      message.value = ''
      customAmount.value = ''
    }
  },
)

function pickPreset(amount: number) {
  selectedAmount.value = amount
  customAmount.value = ''
}

function onCustomInput() {
  selectedAmount.value = null
}

async function submitTip() {
  const amount = effectiveAmount.value
  if (!amount || !props.recipientUsername) return
  busy.value = true
  try {
    const res = await api.post('monetization/tips/checkout/', {
      recipient_username: props.recipientUsername,
      amount,
      pin_slug: props.pinSlug || undefined,
      message: message.value.trim() || undefined,
    })
    const data = res.data as { checkout_url?: string; status?: string; sandbox?: boolean }
    if (data.checkout_url) {
      trackEvent('tip_sent', {
        recipient_username: props.recipientUsername,
        amount,
        checkout: true,
      })
      openCheckoutFlow(router, 'tip', data.checkout_url)
      return
    }
    if (data.status === 'approved') {
      trackEvent('tip_sent', {
        recipient_username: props.recipientUsername,
        amount,
        checkout: false,
      })
      await showAlert(t('tip.success'), { variant: 'success' })
      emit('close')
      return
    }
    await showAlert(t('tip.error'), { variant: 'danger' })
  } catch (err: unknown) {
    const msg =
      (err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('tip.error')
    await showAlert(msg, { variant: 'danger' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <Teleport to="body">
  <div
    v-if="open"
    class="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]"
    @click.self="emit('close')"
  >
    <div class="w-full max-w-md rounded-2xl app-card p-5 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
      <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        {{ t('tip.title', { user: recipientUsername }) }}
      </h2>
      <p class="text-sm text-neutral-500">{{ t('tip.desc') }}</p>
      <p v-if="config" class="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 rounded-lg px-3 py-2">
        {{ t('tip.commissionNote', { percent: config.commission_percent }) }}
      </p>
      <div v-if="config" class="flex flex-wrap gap-2">
        <button
          v-for="a in config.preset_amounts"
          :key="a"
          type="button"
          class="px-3 py-2 rounded-full text-sm font-semibold border transition-colors"
          :class="
            selectedAmount === a
              ? 'bg-pink-700 text-white border-pink-700'
              : 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800'
          "
          @click="pickPreset(a)"
        >
          {{ a }} {{ config.currency_iso }}
        </button>
      </div>
      <div>
        <label class="block text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-1">{{ t('tip.customAmount') }}</label>
        <input
          v-model="customAmount"
          type="number"
          min="1"
          class="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
          :placeholder="config ? String(config.min_tip_amount) : '500'"
          @input="onCustomInput"
        />
      </div>
      <div v-if="splitPreview && config" class="text-xs text-neutral-500 space-y-0.5">
        <p>{{ t('tip.creatorReceives', { amount: splitPreview.net, currency: config.currency_iso }) }}</p>
        <p>{{ t('tip.platformFee', { amount: splitPreview.commission, currency: config.currency_iso }) }}</p>
      </div>
      <div>
        <label class="block text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-1">{{ t('tip.message') }}</label>
        <textarea
          v-model="message"
          rows="2"
          maxlength="280"
          class="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm resize-none"
          :placeholder="t('tip.messagePlaceholder')"
        />
      </div>
      <button
        type="button"
        class="w-full py-3 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-white font-bold text-sm disabled:opacity-50"
        :disabled="busy || !effectiveAmount"
        @click="submitTip"
      >
        {{ busy ? t('tip.processing') : t('tip.submit') }}
      </button>
      <button type="button" class="w-full text-sm text-neutral-500 py-2" @click="emit('close')">
        {{ t('modal.cancel') }}
      </button>
    </div>
  </div>
  </Teleport>
</template>
