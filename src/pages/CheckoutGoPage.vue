<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from '../i18n'
import CheckoutTrustBadges from '../components/CheckoutTrustBadges.vue'
import { fetchCheckoutSocialProof } from '../lib/fetchCheckoutSocialProof'
import { checkoutSuccessPath, readStashedCheckout, type CheckoutFlow } from '../utils/checkoutFlow'
import PinovaButton from '../components/ui/PinovaButton.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const countdown = ref(3)
const missingUrl = ref(false)
const boostsActivated = ref<number | null>(null)

onMounted(() => {
  void fetchCheckoutSocialProof().then((proof) => {
    if (proof && proof.boostsActivated > 0) boostsActivated.value = proof.boostsActivated
  })

  const { url } = readStashedCheckout()
  if (!url) {
    missingUrl.value = true
    return
  }

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

function goBack() {
  const flow = (route.query.flow as CheckoutFlow) || readStashedCheckout().flow || 'premium'
  void router.replace(checkoutSuccessPath(flow))
}
</script>

<template>
  <div class="min-h-[70vh] flex items-center justify-center px-4">
    <div class="max-w-md w-full rounded-3xl border app-divider-subtle p-8 text-center space-y-4 shadow-lg">
      <template v-if="missingUrl">
        <PinovaIcon name="error" class="text-5xl text-amber-500" />
        <h1 class="text-xl font-bold">{{ t('checkout.go.errorTitle') }}</h1>
        <p class="text-sm text-neutral-500">{{ t('checkout.go.errorSubtitle') }}</p>
        <PinovaButton variant="primary" block @click="goBack">
          {{ t('checkout.go.errorBack') }}
        </PinovaButton>
      </template>
      <template v-else>
        <PinovaIcon name="lock" class="text-5xl text-pink-600" />
        <h1 class="text-xl font-bold">{{ t('checkout.go.title') }}</h1>
        <p class="text-sm text-neutral-500">{{ t('checkout.go.subtitle') }}</p>
        <p
          v-if="boostsActivated != null"
          class="text-xs font-semibold text-emerald-700 dark:text-emerald-400"
        >
          {{ t('checkout.socialProof.boosts', { count: boostsActivated }) }}
        </p>
        <p class="text-xs text-neutral-400">{{ t('checkout.go.countdown', { n: countdown }) }}</p>
        <CheckoutTrustBadges />
      </template>
    </div>
  </div>
</template>
