<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api'
import { useI18n } from '../i18n'
import { clearStashedCheckout, checkoutSuccessPath, type CheckoutFlow } from '../utils/checkoutFlow'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const flow = computed(() => (String(route.query.flow || 'premium') as CheckoutFlow))
const status = ref<'loading' | 'success' | 'pending'>('loading')

const titleKey = computed(() => `checkout.return.${flow.value}.title`)
const descKey = computed(() => `checkout.return.${flow.value}.desc`)

onMounted(async () => {
  const tx = String(route.query.transaction_id || route.query.id || '').trim()
  const cbStatus = String(route.query.status || route.query.callback_status || '').trim().toLowerCase()

  if (flow.value === 'premium' && tx) {
    try {
      await api.post('subscription/confirm/', {
        transaction_id: tx,
        callback_status: cbStatus || undefined,
      })
      status.value = 'success'
    } catch {
      status.value = cbStatus === 'approved' || cbStatus === 'completed' ? 'success' : 'pending'
    }
  } else {
    status.value = cbStatus === 'canceled' || cbStatus === 'failed' ? 'pending' : 'success'
  }
  clearStashedCheckout()
})

function continueApp() {
  void router.replace(checkoutSuccessPath(flow.value))
}
</script>

<template>
  <div class="min-h-[70vh] flex items-center justify-center px-4 pb-16">
    <div class="max-w-md w-full rounded-3xl border app-divider-subtle p-8 text-center space-y-5 shadow-lg">
      <span
        class="material-symbols-outlined text-5xl"
        :class="status === 'success' ? 'text-emerald-600' : 'text-amber-500'"
      >
        {{ status === 'loading' ? 'hourglass_top' : status === 'success' ? 'celebration' : 'schedule' }}
      </span>
      <h1 class="text-2xl font-black">{{ t(titleKey) }}</h1>
      <p class="text-sm text-neutral-500">{{ t(descKey) }}</p>
      <p v-if="status === 'loading'" class="text-xs text-neutral-400">{{ t('checkout.return.verifying') }}</p>
      <button
        v-else
        type="button"
        class="w-full rounded-2xl bg-pink-700 text-white font-bold py-3.5"
        @click="continueApp"
      >
        {{ t('checkout.return.continue') }}
      </button>
    </div>
  </div>
</template>
