<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from '../i18n'
import { GOOGLE_CLIENT_ID, GOOGLE_SIGN_IN_SCOPES } from '../env'
import api from '../api'
import {
  buildPwaGoogleSafariUrl,
  isStandaloneDisplayMode,
  PWA_GOOGLE_BRIDGE_KEY,
  PWA_GOOGLE_STATE_KEY,
} from '../utils/pwaGoogleAuth'

const { t } = useI18n()
const loading = ref(false)
const error = ref('')
const success = ref(false)
const copied = ref(false)

const OAUTH_STATE_STORAGE_KEY = 'pwa_google_oauth_state_local'

const bridgeId = ref('')
const pwaState = ref('')
const inStandalone = ref(false)

const safariUrl = computed(() => {
  if (!bridgeId.value || !pwaState.value) return ''
  return buildPwaGoogleSafariUrl(bridgeId.value, pwaState.value)
})

function persistBridgeParams(id: string, state: string) {
  bridgeId.value = id
  pwaState.value = state
  try {
    sessionStorage.setItem(PWA_GOOGLE_BRIDGE_KEY, id)
    sessionStorage.setItem(PWA_GOOGLE_STATE_KEY, state)
    sessionStorage.setItem(OAUTH_STATE_STORAGE_KEY, state)
  } catch {
    /* ignore */
  }
}

async function copySafariLink() {
  if (!safariUrl.value) return
  try {
    await navigator.clipboard.writeText(safariUrl.value)
    copied.value = true
    window.setTimeout(() => {
      copied.value = false
    }, 2500)
  } catch {
    /* ignore */
  }
}

const startGoogleOAuth = () => {
  if (!bridgeId.value || !pwaState.value) {
    error.value = t('login.error.google')
    return
  }
  loading.value = true
  const clientId = GOOGLE_CLIENT_ID
  const redirectUri = encodeURIComponent(window.location.origin + '/auth/pwa/google')
  const scope = encodeURIComponent(GOOGLE_SIGN_IN_SCOPES)
  const state = encodeURIComponent(pwaState.value)
  sessionStorage.setItem(OAUTH_STATE_STORAGE_KEY, pwaState.value)

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}&access_type=online&include_granted_scopes=true&prompt=select_account`

  window.location.href = googleAuthUrl
}

onMounted(() => {
  inStandalone.value = isStandaloneDisplayMode()
  const urlParams = new URLSearchParams(window.location.search)

  const providerError = urlParams.get('error')
  if (providerError) {
    error.value = t('login.error.googleRefused')
    return
  }

  const urlBridge = (urlParams.get('bridge_id') || '').trim()
  const urlState = (urlParams.get('pwa_state') || '').trim()
  if (urlBridge && urlState) {
    persistBridgeParams(urlBridge, urlState)
  } else {
    try {
      const storedBridge = (sessionStorage.getItem(PWA_GOOGLE_BRIDGE_KEY) || '').trim()
      const storedState = (sessionStorage.getItem(PWA_GOOGLE_STATE_KEY) || '').trim()
      if (storedBridge && storedState) persistBridgeParams(storedBridge, storedState)
    } catch {
      /* ignore */
    }
  }

  if (!bridgeId.value || !pwaState.value) {
    error.value = t('pwaGoogle.error.missingBridge')
    return
  }

  const code = urlParams.get('code')
  if (!code) {
    if (!inStandalone.value) {
      startGoogleOAuth()
    }
    return
  }

  const returnedState = urlParams.get('state')
  const expectedState = sessionStorage.getItem(OAUTH_STATE_STORAGE_KEY) || pwaState.value
  if (!returnedState || !expectedState || returnedState !== expectedState) {
    error.value = t('login.error.googleRefused')
    return
  }

  loading.value = true
  window.history.replaceState({}, document.title, window.location.pathname)
  void (async () => {
    try {
      const redirectUri = window.location.origin + '/auth/pwa/google'
      await api.post('auth/pwa/google/session/', {
        code,
        redirect_uri: redirectUri,
        bridge_id: bridgeId.value,
        pwa_state: pwaState.value,
      })
      success.value = true
      loading.value = false
    } catch {
      loading.value = false
      error.value = t('login.error.google')
    }
  })()
})
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-neutral-950 p-6 text-center">
    <div class="mb-8 flex flex-col items-center">
      <div
        class="w-20 h-20 rounded-full bg-pink-700 dark:bg-pink-600 flex items-center justify-center overflow-hidden shadow-lg mb-4"
      >
        <img src="../assets/logo.png" alt="Logo" class="w-full h-full object-cover" />
      </div>
      <span class="text-3xl font-bold text-neutral-900 dark:text-neutral-50 tracking-tight">Pinova</span>
    </div>

    <div v-if="success" class="w-full max-w-md">
      <h1 class="text-2xl font-auth-title font-auth-title--black text-neutral-800 dark:text-neutral-100 mb-2">
        {{ t('pwaGoogle.success.title') }}
      </h1>
      <p class="text-neutral-500 dark:text-neutral-400 mb-6 px-2">{{ t('pwaGoogle.success.desc') }}</p>
      <div class="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-200 text-sm">
        {{ t('pwaGoogle.success.hint') }}
      </div>
    </div>

    <div v-else-if="inStandalone && !loading" class="w-full max-w-md">
      <h1 class="text-2xl font-auth-title font-auth-title--black text-neutral-800 dark:text-neutral-100 mb-2">
        {{ t('pwaGoogle.safari.title') }}
      </h1>
      <p class="text-neutral-500 dark:text-neutral-400 mb-6 px-2">{{ t('pwaGoogle.safari.desc') }}</p>

      <ol class="text-left text-sm text-neutral-600 dark:text-neutral-300 space-y-3 mb-8 px-2">
        <li class="flex gap-2">
          <span class="font-bold text-pink-700 dark:text-pink-500 shrink-0">1.</span>
          <span>{{ t('pwaGoogle.safari.step1') }}</span>
        </li>
        <li class="flex gap-2">
          <span class="font-bold text-pink-700 dark:text-pink-500 shrink-0">2.</span>
          <span>{{ t('pwaGoogle.safari.step2') }}</span>
        </li>
        <li class="flex gap-2">
          <span class="font-bold text-pink-700 dark:text-pink-500 shrink-0">3.</span>
          <span>{{ t('pwaGoogle.safari.step3') }}</span>
        </li>
      </ol>

      <a
        v-if="safariUrl"
        :href="safariUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="w-full flex items-center justify-center gap-3 py-4 px-6 bg-pink-700 dark:bg-pink-600 text-white rounded-2xl font-bold text-lg hover:opacity-90 transition-all shadow-lg active:scale-[0.98] mb-3"
      >
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" class="w-6 h-6" />
        {{ t('pwaGoogle.safari.cta') }}
      </a>

      <button
        type="button"
        class="w-full py-3 text-sm font-semibold text-neutral-600 dark:text-neutral-400 hover:text-pink-700 dark:hover:text-pink-400"
        @click="copySafariLink"
      >
        {{ copied ? t('pwaGoogle.safari.copied') : t('pwaGoogle.safari.copy') }}
      </button>

      <div
        v-if="error"
        class="mt-6 p-4 bg-pink-50 dark:bg-pink-950/30 border border-pink-100 dark:border-pink-900/40 rounded-xl text-pink-700 dark:text-pink-300 text-sm"
      >
        {{ error }}
      </div>
    </div>

    <div v-else class="flex flex-col items-center w-full max-w-sm">
      <div
        class="w-12 h-12 border-4 border-pink-200 border-t-pink-700 dark:border-t-pink-600 rounded-full animate-spin mb-4"
      ></div>
      <h1 class="text-xl font-bold text-neutral-800 dark:text-neutral-100">{{ t('pwaGoogle.redirecting.title') }}</h1>
      <p class="text-neutral-500 dark:text-neutral-400 mt-2">{{ t('pwaGoogle.redirecting.desc') }}</p>
      <div
        v-if="error"
        class="mt-6 p-4 bg-pink-50 dark:bg-pink-950/30 border border-pink-100 dark:border-pink-900/40 rounded-xl text-pink-700 dark:text-pink-300 text-sm w-full"
      >
        {{ error }}
      </div>
    </div>
  </div>
</template>
