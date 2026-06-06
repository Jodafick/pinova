<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from '../i18n'
import { readStashedCheckout, type CheckoutFlow } from '../utils/checkoutFlow'

const route = useRoute()
const { t } = useI18n()
const countdown = ref(3)

onMounted(() => {
  const flow = (route.query.flow as CheckoutFlow) || readStashedCheckout().flow || 'premium'
  const { url } = readStashedCheckout()
  if (!url) return

  const tick = () => {
    countdown.value -= 1
    if (countdown.value <= 0) {
      window.location.href = url
      return
    }
    setTimeout(tick, 1000)
  }
  setTimeout(tick, 1000)
})
</script>

<template>
  <div class="min-h-[70vh] flex items-center justify-center px-4">
    <div class="max-w-md w-full rounded-3xl border app-divider-subtle p-8 text-center space-y-4 shadow-lg">
      <span class="material-symbols-outlined text-5xl text-pink-600">lock</span>
      <h1 class="text-xl font-bold">{{ t('checkout.go.title') }}</h1>
      <p class="text-sm text-neutral-500">{{ t('checkout.go.subtitle') }}</p>
      <p class="text-xs text-neutral-400">{{ t('checkout.go.countdown', { n: countdown }) }}</p>
    </div>
  </div>
</template>
