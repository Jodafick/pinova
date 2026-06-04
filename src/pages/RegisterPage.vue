<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { useTokenClient } from 'vue3-google-signin'
import { GOOGLE_SIGN_IN_SCOPES } from '../env'
import { useI18n } from '../i18n'
import { EMAIL_DELIVERY_UNAVAILABLE_CODE } from '../constants/authErrors'
import { clearStoredReferralCode } from '../composables/useReferralIntent'
import { extractDrfFieldErrors, firstErroredField } from '../utils/apiValidationErrors'
import { translatePinovaErrorToken, translatePinovaNonFieldToken } from '../utils/formErrorMessages'
import { waitForGoogleIdentityServices } from '../composables/waitForGoogleIdentity'
import { redirectAfterAuth } from '../utils/postAuthRedirect'

const router = useRouter()
const { register, socialLogin, currentUser } = useAuth()
const { t } = useI18n()

const displayName = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const suggestGoogleForEmail = ref(false)
const loading = ref(false)
const showPassword = ref(false)
const acceptTerms = ref(false)
const fieldErrors = ref<Record<string, string>>({})

const displayNameInput = ref<HTMLInputElement | null>(null)
const emailInput = ref<HTMLInputElement | null>(null)
const passwordInput = ref<HTMLInputElement | null>(null)
const confirmPasswordInput = ref<HTMLInputElement | null>(null)
const termsInput = ref<HTMLInputElement | null>(null)

const FIELD_ORDER = ['display_name', 'username', 'email', 'password1', 'password2'] as const

async function focusField(field: string | null) {
  await nextTick()
  if (field === 'display_name' || field === 'username') {
    displayNameInput.value?.focus()
    return
  }
  if (field === 'email') {
    emailInput.value?.focus()
    return
  }
  if (field === 'password1') {
    passwordInput.value?.focus()
    return
  }
  if (field === 'password2') {
    confirmPasswordInput.value?.focus()
    return
  }
}

const handleRegister = async () => {
  error.value = ''
  fieldErrors.value = {}
  suggestGoogleForEmail.value = false
  if (!displayName.value || !email.value || !password.value) {
    error.value = t('register.error.empty')
    return
  }
  if (password.value.length < 8) {
    error.value = t('register.error.passwordShort')
    return
  }
  if (password.value !== confirmPassword.value) {
    error.value = t('register.error.passwordMismatch')
    return
  }
  if (!acceptTerms.value) {
    error.value = t('register.error.acceptTerms')
    termsInput.value?.focus()
    return
  }

  loading.value = true
  const result = await register({
    displayName: displayName.value,
    email: email.value,
    password: password.value,
  })
  loading.value = false

  if (!result.success) {
    suggestGoogleForEmail.value = result.code === EMAIL_DELIVERY_UNAVAILABLE_CODE
    const maybeRaw = (result as { raw?: unknown }).raw
    const extracted = extractDrfFieldErrors(maybeRaw)
    fieldErrors.value = Object.fromEntries(
      Object.entries(extracted).map(([k, v]) => [k, translatePinovaErrorToken(v[0] || '', t)]),
    )
    await focusField(firstErroredField(extracted, FIELD_ORDER))
    const body = maybeRaw && typeof maybeRaw === 'object' && !Array.isArray(maybeRaw) ? (maybeRaw as Record<string, unknown>) : null
    const nfe = body?.non_field_errors
    const firstNfe =
      Array.isArray(nfe) && typeof nfe[0] === 'string' && nfe[0].trim() ? nfe[0].trim() : ''
    const globalFromApi = firstNfe ? translatePinovaNonFieldToken(firstNfe, t) : ''
    error.value = suggestGoogleForEmail.value
      ? t('auth.emailDeliveryBlocked.message')
      : globalFromApi ||
        (Object.keys(fieldErrors.value).length ? '' : result.error || t('register.error.generic'))
    return
  }
  clearStoredReferralCode()
  // Rediriger vers la page OTP après inscription
  router.push({ name: 'verify-otp', query: { email: email.value } })
}

const { login: googleLogin } = useTokenClient({
  scope: GOOGLE_SIGN_IN_SCOPES,
  onSuccess: async (response) => {
    loading.value = true
    const result = await socialLogin('google', response.access_token)
    loading.value = false
    if (result.success) {
      redirectAfterAuth(router, { user: currentUser.value })
    } else {
      error.value = result.error || t('login.error.google')
    }
  },
  onError: () => {
    error.value = t('login.error.google')
  },
})

async function handleGoogleClick() {
  error.value = ''
  fieldErrors.value = {}
  const gsiReady = await waitForGoogleIdentityServices()
  if (!gsiReady) {
    error.value = t('login.error.googleNotReady')
    return
  }
  await nextTick()
  googleLogin()
}
</script>

<template>
  <div class="min-h-screen flex bg-transparent dark:bg-transparent">
    <!-- Left side - hero -->
    <div class="hidden lg:flex lg:w-1/2 relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-br from-pink-700/90 dark:from-pink-600/90 via-pink-700/80 dark:via-pink-600/80 to-pink-700/90 dark:to-pink-600/90 z-10"></div>
      <img
        src="https://images.pexels.com/photos/1070534/pexels-photo-1070534.jpeg?auto=compress&cs=tinysrgb&w=1200"
        alt=""
        class="absolute inset-0 w-full h-full object-cover"
      />
      <div class="relative z-20 flex flex-col justify-center px-16 text-white">
        <div class="flex items-center gap-3 mb-8">
          <div class="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-lg overflow-hidden">
            <img src="../assets/logo.png" alt="Logo" class="w-full h-full object-cover" />
          </div>
          <span class="text-3xl font-auth-title">Pinova</span>
        </div>
        <h1 class="text-[3.35rem] font-auth-title font-auth-title--black leading-tight mb-4">
          {{ t('register.hero.title') }}
        </h1>
        <p class="text-lg text-white/90 max-w-md">
          {{ t('register.hero.desc') }}
        </p>
      </div>
    </div>

    <!-- Right side - form -->
    <div class="flex-1 flex items-stretch lg:items-center justify-center px-4 py-6 sm:px-6 sm:py-12 lg:bg-neutral-50/30 lg:dark:bg-neutral-900/30">
      <div class="w-full max-w-lg lg:bg-white lg:dark:bg-neutral-900 lg:p-8 xl:p-10 lg:rounded-[40px] lg:shadow-sm lg:border lg:border-neutral-100 lg:dark:border-neutral-800">
        <!-- Mobile logo -->
        <div class="lg:hidden flex items-center justify-center gap-2 mb-10">
          <div class="w-10 h-10 rounded-full bg-pink-700 dark:bg-pink-600 flex items-center justify-center overflow-hidden shadow-sm">
            <img src="../assets/logo.png" alt="Logo" class="w-full h-full object-cover" />
          </div>
          <span class="text-2xl font-auth-title text-neutral-900 dark:text-neutral-100">Pinova</span>
        </div>

        <div class="text-center mb-10">
          <h2 class="text-3xl font-auth-title font-auth-title--black text-neutral-900 dark:text-neutral-100 mb-2">{{ t('register.title') }}</h2>
          <p class="text-neutral-500 dark:text-neutral-400">{{ t('register.subtitle') }}</p>
        </div>

        <form @submit.prevent="handleRegister" class="space-y-5">
          <div
            v-if="error"
            class="flex items-center gap-2 px-4 py-3 rounded-2xl bg-pink-50 border border-pink-100 text-pink-700 text-sm animate-shake"
          >
            <span class="material-symbols-outlined text-lg">error</span>
            {{ error }}
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div class="sm:col-span-2">
              <label class="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2 ml-1">{{ t('register.displayName') }}</label>
              <div class="relative group">
                <span class="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-400 group-focus-within:text-pink-700 transition-colors">person</span>
                <input
                  ref="displayNameInput"
                  v-model="displayName"
                  type="text"
                  autocomplete="nickname"
                  :placeholder="t('register.displayName.placeholder')"
                  :class="[
                    'w-full pl-12 pr-4 py-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-pink-700/20 dark:focus:ring-pink-600/20 focus:border-pink-700 dark:border-pink-600 transition-all',
                    fieldErrors.display_name || fieldErrors.username
                      ? 'border-red-400 focus:ring-red-300/20 focus:border-red-500'
                      : 'border-neutral-200 dark:border-neutral-700',
                  ]"
                />
              </div>
              <p v-if="fieldErrors.display_name || fieldErrors.username" class="mt-1 ml-1 text-xs text-red-600">
                {{ fieldErrors.display_name || fieldErrors.username }}
              </p>
              <p v-else class="mt-1 ml-1 text-xs text-neutral-500 dark:text-neutral-400">{{ t('register.displayNameHint') }}</p>
            </div>
            <div>
              <label class="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2 ml-1">{{ t('login.email') }}</label>
              <div class="relative group">
                <span class="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-400 group-focus-within:text-pink-700 transition-colors">mail</span>
                <input
                  ref="emailInput"
                  v-model="email"
                  type="email"
                  :placeholder="t('register.email.placeholder')"
                  :class="[
                    'w-full pl-12 pr-4 py-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-pink-700/20 dark:focus:ring-pink-600/20 focus:border-pink-700 dark:border-pink-600 transition-all',
                    fieldErrors.email
                      ? 'border-red-400 focus:ring-red-300/20 focus:border-red-500'
                      : 'border-neutral-200 dark:border-neutral-700',
                  ]"
                />
              </div>
              <p v-if="fieldErrors.email" class="mt-1 ml-1 text-xs text-red-600">{{ fieldErrors.email }}</p>
            </div>
          </div>

          <div>
            <label class="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2 ml-1">{{ t('login.password') }}</label>
            <div class="relative group">
              <span class="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-400 group-focus-within:text-pink-700 transition-colors">lock</span>
              <input
                ref="passwordInput"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                :placeholder="t('register.password.placeholder')"
                :class="[
                  'w-full pl-12 pr-12 py-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-pink-700/20 dark:focus:ring-pink-600/20 focus:border-pink-700 dark:border-pink-600 transition-all',
                  fieldErrors.password1
                    ? 'border-red-400 focus:ring-red-300/20 focus:border-red-500'
                    : 'border-neutral-200 dark:border-neutral-700',
                ]"
              />
              <button
                type="button"
                class="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                @click="showPassword = !showPassword"
              >
                <span class="material-symbols-outlined text-xl">{{ showPassword ? 'visibility_off' : 'visibility' }}</span>
              </button>
            </div>
            <p v-if="fieldErrors.password1" class="mt-1 ml-1 text-xs text-red-600">{{ fieldErrors.password1 }}</p>
          </div>

          <div>
            <label class="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2 ml-1">{{ t('register.confirmPassword') }}</label>
            <div class="relative group">
              <span class="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-400 group-focus-within:text-pink-700 transition-colors">verified_user</span>
              <input
                ref="confirmPasswordInput"
                v-model="confirmPassword"
                type="password"
                :placeholder="t('register.confirmPassword.placeholder')"
                :class="[
                  'w-full pl-12 pr-4 py-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-pink-700/20 dark:focus:ring-pink-600/20 focus:border-pink-700 dark:border-pink-600 transition-all',
                  fieldErrors.password2
                    ? 'border-red-400 focus:ring-red-300/20 focus:border-red-500'
                    : 'border-neutral-200 dark:border-neutral-700',
                ]"
              />
            </div>
            <p v-if="fieldErrors.password2" class="mt-1 ml-1 text-xs text-red-600">{{ fieldErrors.password2 }}</p>
          </div>

          <label class="flex items-start gap-3 cursor-pointer group px-1 py-1">
            <div class="relative flex items-center mt-1">
              <input
                ref="termsInput"
                v-model="acceptTerms"
                type="checkbox"
                class="peer h-5 w-5 cursor-pointer appearance-none rounded-lg border-2 border-neutral-300 transition-all checked:bg-pink-700 dark:bg-pink-600 checked:border-pink-700 dark:border-pink-600 hover:border-pink-700"
              />
              <span class="absolute text-white opacity-0 peer-checked:opacity-100 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none material-symbols-outlined text-sm font-bold">check</span>
            </div>
            <span class="text-sm text-neutral-500 dark:text-neutral-400 font-medium select-none">
              {{ t('register.acceptTerms.before') }}
              <router-link to="/legal/terms" class="text-pink-700 font-bold hover:underline" tabindex="0" @click.stop>
                {{ t('register.acceptTerms.terms') }}
              </router-link>
              {{ t('register.acceptTerms.middle') }}
              <router-link to="/legal/privacy" class="text-pink-700 font-bold hover:underline" tabindex="0" @click.stop>
                {{ t('register.acceptTerms.privacy') }}
              </router-link>.
            </span>
          </label>

          <button
            type="submit"
            class="w-full py-4 rounded-2xl bg-pink-700 dark:bg-pink-600 text-white font-bold hover:bg-pink-800 dark:hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-pink-700/20 flex items-center justify-center gap-2"
            :disabled="loading"
          >
            <span v-if="loading" class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            {{ loading ? t('register.submitting') : t('register.submit') }}
          </button>
        </form>

        <div class="my-8 flex items-center gap-4 text-neutral-400 dark:text-neutral-500">
          <div class="flex-1 h-px bg-neutral-200 dark:bg-neutral-700"></div>
          <span class="text-xs font-bold uppercase tracking-wider">{{ t('register.divider') }}</span>
          <div class="flex-1 h-px bg-neutral-200 dark:bg-neutral-700"></div>
        </div>

        <p
          v-if="suggestGoogleForEmail"
          class="mb-4 rounded-2xl border border-pink-100 dark:border-pink-900 bg-pink-50/80 dark:bg-pink-950/40 px-4 py-3 text-center text-sm font-medium text-neutral-800 dark:text-neutral-200"
        >
          {{ t('auth.emailDeliveryBlocked.googleHint') }}
        </p>

        <div class="flex justify-center">
          <button
            type="button"
            @click="handleGoogleClick"
            class="flex items-center justify-center gap-2 py-3.5 px-8 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all text-sm font-bold text-neutral-700 dark:text-neutral-200 w-full"
            :class="suggestGoogleForEmail ? 'ring-2 ring-pink-700 dark:ring-pink-600 ring-offset-2' : ''"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" class="w-5 h-5" />
            {{ t('login.googleCta') }}
          </button>
        </div>

        <p class="mt-10 text-center text-sm text-neutral-500 dark:text-neutral-400 font-medium">
          {{ t('register.haveAccount') }}
          <router-link to="/login" class="text-pink-700 font-bold hover:underline">{{ t('register.signIn') }}</router-link>
        </p>
      </div>
    </div>
  </div>
</template>
