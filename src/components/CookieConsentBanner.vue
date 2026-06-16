<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from '../i18n'
import { hasCookieConsentDecision, persistCookieConsent } from '../lib/cookieConsent'

const { t } = useI18n()
const visible = ref(false)

onMounted(() => {
  visible.value = !hasCookieConsentDecision()
})

async function acceptAll() {
  await persistCookieConsent(true)
  visible.value = false
}

async function acceptNecessaryOnly() {
  await persistCookieConsent(false)
  visible.value = false
}
</script>

<template>
  <div
    v-if="visible"
    class="fotoce-cookie-consent-banner fixed inset-x-0 bottom-0 z-[9999] p-4 pointer-events-none"
    role="dialog"
    aria-live="polite"
    aria-label="Cookie consent"
    data-testid="cookie-consent-banner"
  >
    <div
      class="mx-auto max-w-3xl rounded-2xl border border-neutral-200/80 bg-white/95 dark:bg-neutral-950/95 dark:border-neutral-700 shadow-2xl backdrop-blur-md p-4 sm:p-5 pointer-events-auto"
    >
      <p class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        {{ t('cookies.banner.title') }}
      </p>
      <p class="mt-2 text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
        {{ t('cookies.banner.body') }}
      </p>
      <div class="mt-4 flex flex-col sm:flex-row gap-2 sm:justify-end">
        <button
          type="button"
          class="rounded-xl px-4 py-2 text-sm font-medium border border-neutral-300 dark:border-neutral-600 text-neutral-800 dark:text-neutral-100"
          data-testid="cookie-consent-necessary"
          @click="acceptNecessaryOnly"
        >
          {{ t('cookies.banner.necessaryOnly') }}
        </button>
        <button
          type="button"
          class="rounded-xl px-4 py-2 text-sm font-semibold bg-pink-600 text-white hover:bg-pink-700"
          data-testid="cookie-consent-accept"
          @click="acceptAll"
        >
          {{ t('cookies.banner.acceptAnalytics') }}
        </button>
      </div>
      <p class="mt-3 text-[11px] text-neutral-500">
        <router-link to="/legal/privacy" class="underline">{{ t('cookies.banner.privacyLink') }}</router-link>
      </p>
    </div>
  </div>
</template>
