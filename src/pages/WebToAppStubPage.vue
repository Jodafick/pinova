<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from '../i18n'
import { useAuth } from '../composables/useAuth'
import { openNativeAppForRoute } from '../utils/appDeepLink'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { isAuthenticated } = useAuth()

const wantsOpenApp = computed(() =>
  `${route.query.openApp ?? ''}` === '1' || `${route.query.open_app ?? ''}` === '1',
)

function stripOpenAppQuery(): Record<string, string | string[]> {
  const q: Record<string, string | string[]> = {}
  for (const [k, v] of Object.entries(route.query)) {
    if (k === 'openApp' || k === 'open_app') continue
    if (v == null) continue
    if (Array.isArray(v)) {
      const filtered = v.filter((x): x is string => x != null)
      if (filtered.length) q[k] = filtered
    } else {
      q[k] = v
    }
  }
  return q
}

function onOpenNative() {
  openNativeAppForRoute(route)
}

async function onContinueWeb() {
  const next = stripOpenAppQuery()
  const destPath = route.path === '/contest/notifications' ? '/contest/live' : route.path
  await router.replace({
    path: destPath,
    query: Object.keys(next).length ? next : {},
    hash: route.hash || undefined,
  })
}
</script>

<template>
  <div
    class="mx-auto flex min-h-[52vh] max-w-lg flex-col items-center justify-center gap-5 px-6 py-12 text-center"
  >
    <h1 class="text-xl font-bold text-neutral-900 dark:text-white">
      {{ t('nativeApp.manual.title') }}
    </h1>
    <p class="m-0 text-sm leading-snug text-neutral-600 dark:text-neutral-400">
      <template v-if="isAuthenticated && wantsOpenApp">
        {{ t('nativeApp.manual.loggedInNote') }}
      </template>
      <template v-else>
        {{ t('nativeApp.manual.lead') }}
      </template>
    </p>
    <p class="text-xs text-neutral-500 dark:text-neutral-500">
      {{ t('nativeApp.manual.notInstalled') }}
    </p>
    <div class="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
      <button
        type="button"
        class="rounded-xl bg-gradient-to-br from-pink-600 to-pink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-pink-600/25 active:scale-[0.98] dark:shadow-pink-900/40"
        @click="onOpenNative"
      >
        {{ t('nativeApp.manual.openNative') }}
      </button>
      <button
        type="button"
        class="rounded-xl border border-neutral-200 px-5 py-2.5 text-sm font-medium text-neutral-700 transition active:bg-neutral-100 dark:border-white/15 dark:text-neutral-200 dark:active:bg-white/10"
        @click="onContinueWeb"
      >
        {{ t('nativeApp.manual.continueWeb') }}
      </button>
    </div>
  </div>
</template>
