<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from '../i18n'
import { useAuth } from '../composables/useAuth'
import {
  dismissNativeAppSuggest,
  openNativeAppForRoute,
  shouldOfferNativeAppOneTimeBanner,
} from '../utils/appDeepLink'

const props = defineProps<{ appReady: boolean }>()

const route = useRoute()
const { t } = useI18n()
const { isAuthenticated } = useAuth()

const open = ref(false)
const DELAY_MS = 2000
let timer: ReturnType<typeof setTimeout> | null = null

function clearTimer() {
  if (timer != null) {
    clearTimeout(timer)
    timer = null
  }
}

function scheduleShow() {
  clearTimer()
  open.value = false
  if (!props.appReady) return
  /** Connecté au web : on ne propose pas « ouvrir l’app » (compte mobile souvent différent). */
  if (isAuthenticated.value) return
  if (route.meta.guest === true) return
  if (!shouldOfferNativeAppOneTimeBanner()) return
  timer = window.setTimeout(() => {
    timer = null
    if (route.meta.guest === true) return
    if (isAuthenticated.value) return
    if (!shouldOfferNativeAppOneTimeBanner()) return
    open.value = true
  }, DELAY_MS)
}

watch(
  () => [props.appReady, route.fullPath, isAuthenticated.value] as const,
  () => {
    scheduleShow()
  },
  { immediate: true },
)

onUnmounted(() => {
  clearTimer()
})

function onOpen() {
  openNativeAppForRoute(route)
  dismissNativeAppSuggest()
  open.value = false
}

function onDismiss() {
  dismissNativeAppSuggest()
  open.value = false
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="pointer-events-none fixed inset-x-0 bottom-0 z-[58] flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] max-lg:pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
      role="region"
      aria-label="Pinova app"
    >
      <div
        class="pointer-events-auto flex w-full max-w-md flex-col gap-2.5 rounded-2xl border border-neutral-200/90 bg-white/95 px-3.5 py-3 shadow-lg shadow-black/10 backdrop-blur-md dark:border-white/12 dark:bg-neutral-900/95 dark:shadow-black/45 sm:flex-row sm:items-center sm:justify-between"
      >
        <p class="m-0 text-[14px] leading-snug text-neutral-800 dark:text-neutral-100 sm:flex-1">
          {{ t('nativeApp.suggest.lead') }}
        </p>
        <div class="flex shrink-0 items-center gap-2 sm:justify-end">
          <button
            type="button"
            class="rounded-xl px-3 py-2 text-[13px] font-medium text-neutral-600 transition active:opacity-70 dark:text-neutral-400"
            @click="onDismiss"
          >
            {{ t('nativeApp.suggest.dismiss') }}
          </button>
          <button
            type="button"
            class="rounded-xl bg-gradient-to-br from-pink-600 to-pink-500 px-3.5 py-2 text-[13px] font-semibold text-white shadow-md shadow-pink-600/25 transition active:scale-[0.98] dark:shadow-pink-900/40"
            @click="onOpen"
          >
            {{ t('nativeApp.suggest.open') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
