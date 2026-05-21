<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from '../i18n'
import { GOOGLE_CLIENT_ID, GOOGLE_SIGN_IN_SCOPES } from '../env'
import api from '../api'
import { openMobileDeepLink } from '../utils/appDeepLink'

const { t } = useI18n()
const loading = ref(false)
const error = ref('')

const REDIRECT_STORAGE_KEY = 'mobile_redirect_url'
const REFERRAL_STORAGE_KEY = 'mobile_referral_code'
const OAUTH_STATE_STORAGE_KEY = 'mobile_google_oauth_state'
const MOBILE_DEVICE_BINDING_STORAGE_KEY = 'mobile_device_binding_id'
const MOBILE_STATE_STORAGE_KEY = 'mobile_state'

const MOBILE_GOOGLE_OAUTH_PATH = '/auth/mobile/google'
const MOBILE_GOOGLE_CALLBACK_PATH = '/auth/mobile/google/callback'
const MOBILE_GOOGLE_CALLBACK_ROUTE = 'auth/mobile/google/callback'
const DEEP_LINK_WAIT_MS = 3500

function normalizeMobileCallbackPath(pathname: string): string {
  return pathname.replace(/^\/+/, '').replace(/^--\//, '').replace(/\/+$/, '')
}

function nativeCallbackRoute(url: URL): string {
  if (url.protocol === 'pinova:') {
    const host = url.hostname ? `${url.hostname}` : ''
    const path = url.pathname || ''
    return normalizeMobileCallbackPath(`${host}${path}`)
  }
  if (url.protocol === 'exp:') {
    return normalizeMobileCallbackPath(url.pathname || '')
  }
  return ''
}

function isNativeMobileCallback(url: URL): boolean {
  if (url.protocol !== 'pinova:' && url.protocol !== 'exp:') return false
  return nativeCallbackRoute(url) === MOBILE_GOOGLE_CALLBACK_ROUTE
}

function getGoogleOAuthRedirectUri(): string {
  return `${window.location.origin}${MOBILE_GOOGLE_OAUTH_PATH}`
}

function mobileRedirectWithCode(mobileCode: string, mobileState: string) {
  const savedRedirectUrl = sessionStorage.getItem(REDIRECT_STORAGE_KEY)
  const separator = savedRedirectUrl?.includes('?') ? '&' : '?'
  const encodedCode = encodeURIComponent(mobileCode)
  const encodedState = encodeURIComponent(mobileState)
  const fallbackRedirect = import.meta.env.PROD
    ? `pinova://${MOBILE_GOOGLE_CALLBACK_ROUTE}?auth_code=${encodedCode}&mobile_state=${encodedState}`
    : `pinova://login-success?auth_code=${encodedCode}&mobile_state=${encodedState}`

  return savedRedirectUrl
    ? `${savedRedirectUrl}${separator}auth_code=${encodedCode}&mobile_state=${encodedState}`
    : fallbackRedirect
}

function isAllowedMobileRedirect(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    const callbackPath = url.pathname.replace(/\/+$/, '')
    const isVerifiedAppLink =
      url.protocol === 'https:' &&
      url.origin === window.location.origin &&
      callbackPath === MOBILE_GOOGLE_CALLBACK_PATH

    if (isVerifiedAppLink) return true
    if (isNativeMobileCallback(url)) return true

    return false
  } catch {
    return false
  }
}

function normalizeMobileDeviceBinding(rawValue: string | null): string {
  const value = (rawValue || '').trim()
  return value.length <= 128 ? value : ''
}

function clearWebSessionForMobileBridge() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem('pinova_token')
  window.localStorage.removeItem('pinova_refresh_token')
  delete api.defaults.headers.common.Authorization
}

function clearMobileBridgeSessionStorage() {
  sessionStorage.removeItem(REDIRECT_STORAGE_KEY)
  sessionStorage.removeItem(REFERRAL_STORAGE_KEY)
  sessionStorage.removeItem(OAUTH_STATE_STORAGE_KEY)
  sessionStorage.removeItem(MOBILE_DEVICE_BINDING_STORAGE_KEY)
  sessionStorage.removeItem(MOBILE_STATE_STORAGE_KEY)
}

function hasFreshMobileBridgeParams(urlParams: URLSearchParams): boolean {
  const redirectTo = urlParams.get('redirect_to')
  return Boolean(redirectTo && isAllowedMobileRedirect(redirectTo) && urlParams.get('mobile_state'))
}

function saveMobileBridgeParams(urlParams: URLSearchParams) {
  const redirectTo = urlParams.get('redirect_to')
  if (redirectTo && isAllowedMobileRedirect(redirectTo)) {
    sessionStorage.setItem(REDIRECT_STORAGE_KEY, redirectTo)
  }
  const deviceBindingId = normalizeMobileDeviceBinding(urlParams.get('device_binding_id'))
  if (deviceBindingId) {
    sessionStorage.setItem(MOBILE_DEVICE_BINDING_STORAGE_KEY, deviceBindingId)
  }
  const mobileState = urlParams.get('mobile_state') || ''
  if (mobileState) {
    sessionStorage.setItem(MOBILE_STATE_STORAGE_KEY, mobileState)
  }
  const referralCode = urlParams.get('referral_code') || urlParams.get('ref')
  if (referralCode) sessionStorage.setItem(REFERRAL_STORAGE_KEY, referralCode)
}

function bridgeQueryWithoutOAuth(urlParams: URLSearchParams): string {
  const next = new URLSearchParams()
  for (const key of ['redirect_to', 'device_binding_id', 'mobile_state', 'referral_code', 'ref', 'bridge_ts']) {
    const value = urlParams.get(key)
    if (value) next.set(key, value)
  }
  return next.toString()
}

function restartMobileBridge(urlParams: URLSearchParams) {
  const qs = bridgeQueryWithoutOAuth(urlParams)
  window.location.replace(`${MOBILE_GOOGLE_OAUTH_PATH}${qs ? `?${qs}` : ''}`)
}

function randomState(): string {
  const bytes = new Uint8Array(16)
  window.crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function handleGoogleClick() {
  loading.value = true
  error.value = ''
  const clientId = GOOGLE_CLIENT_ID
  const redirectUri = encodeURIComponent(getGoogleOAuthRedirectUri())
  const scope = encodeURIComponent(GOOGLE_SIGN_IN_SCOPES)
  const state = randomState()
  sessionStorage.setItem(OAUTH_STATE_STORAGE_KEY, state)

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${encodeURIComponent(state)}&access_type=online&include_granted_scopes=true&prompt=select_account`

  window.location.href = googleAuthUrl
}

async function processGoogleCallback(code: string) {
  loading.value = true
  error.value = ''
  clearWebSessionForMobileBridge()
  window.history.replaceState({}, document.title, MOBILE_GOOGLE_OAUTH_PATH)

  try {
    const redirectUri = getGoogleOAuthRedirectUri()
    const refCode = sessionStorage.getItem(REFERRAL_STORAGE_KEY) || ''
    const mobileDeviceBindingId = sessionStorage.getItem(MOBILE_DEVICE_BINDING_STORAGE_KEY) || ''
    const mobileState = sessionStorage.getItem(MOBILE_STATE_STORAGE_KEY) || ''
    const res = await api.post<{ code?: string }>('auth/mobile/google/session/', {
      code,
      redirect_uri: redirectUri,
      device_binding_id: mobileDeviceBindingId,
      mobile_state: mobileState,
      ...(refCode ? { referral_code: refCode } : {}),
    })
    const mobileCode = res.data?.code
    if (!mobileCode) throw new Error('missing mobile auth code')
    if (!mobileState) throw new Error('missing mobile state')
    const nextRedirect = mobileRedirectWithCode(mobileCode, mobileState)
    clearMobileBridgeSessionStorage()
    openMobileDeepLink(nextRedirect)

    window.setTimeout(() => {
      loading.value = false
      error.value = t('mobile.error.notInstalled')
    }, DEEP_LINK_WAIT_MS)
  } catch {
    loading.value = false
    error.value = t('login.error.google')
  }
}

onMounted(() => {
  const urlParams = new URLSearchParams(window.location.search)
  const freshBridge = hasFreshMobileBridgeParams(urlParams)
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/'

  if (pathname === MOBILE_GOOGLE_CALLBACK_PATH) {
    if (freshBridge) {
      restartMobileBridge(urlParams)
      return
    }
    if (!urlParams.get('auth_code') && !urlParams.get('code')) {
      error.value = t('mobile.error.notInstalled')
      return
    }
  }

  if (freshBridge) {
    clearMobileBridgeSessionStorage()
    saveMobileBridgeParams(urlParams)
    clearWebSessionForMobileBridge()
  }

  const providerError = urlParams.get('error')
  if (providerError) {
    error.value = t('login.error.googleRefused')
    return
  }

  if (urlParams.get('auth_code')) {
    error.value = t('mobile.error.notInstalled')
    return
  }

  const code = urlParams.get('code')
  if (!code) {
    if (freshBridge) {
      handleGoogleClick()
    }
    return
  }

  const returnedState = urlParams.get('state') || ''
  const expectedState = sessionStorage.getItem(OAUTH_STATE_STORAGE_KEY)
  if (!expectedState || returnedState !== expectedState) {
    if (freshBridge) {
      restartMobileBridge(urlParams)
      return
    }
    error.value = t('login.error.googleRefused')
    return
  }

  void processGoogleCallback(code)
})

</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-white p-6 text-center">
    <!-- Logo Pinova -->
    <div class="mb-10 flex flex-col items-center">
      <div class="w-20 h-20 rounded-full bg-pink-700 dark:bg-pink-600 flex items-center justify-center overflow-hidden shadow-lg mb-4">
        <img src="../assets/logo.png" alt="Logo" class="w-full h-full object-cover" />
      </div>
      <span class="text-3xl font-bold text-neutral-900 tracking-tight">{{ t('mobile.brand') }}</span>
    </div>

    <div v-if="!loading" class="w-full max-w-sm">
      <h1 class="text-2xl font-auth-title font-auth-title--black text-neutral-800 mb-2">{{ t('mobile.title') }}</h1>
      <p class="text-neutral-500 mb-8 px-4">{{ t('mobile.desc') }}</p>

      <button
        @click="handleGoogleClick"
        class="w-full flex items-center justify-center gap-3 py-4 px-6 bg-white border-2 border-neutral-200 rounded-2xl text-neutral-700 font-bold text-lg hover:bg-neutral-50 transition-all shadow-sm active:scale-95"
      >
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" class="w-6 h-6" />
        {{ t('mobile.cta') }}
      </button>

      <div v-if="error" class="mt-6 p-4 bg-pink-50 border border-pink-100 rounded-xl text-pink-700 text-sm">
        {{ error }}
      </div>
    </div>

    <div v-else class="flex flex-col items-center">
      <div class="w-12 h-12 border-4 border-pink-200 border-t-pink-700 dark:border-t-pink-600 rounded-full animate-spin mb-4"></div>
      <h1 class="text-xl font-bold text-neutral-800">{{ t('mobile.redirecting.title') }}</h1>
      <p class="text-neutral-500 mt-2">{{ t('mobile.redirecting.desc') }}</p>
    </div>
  </div>
</template>
