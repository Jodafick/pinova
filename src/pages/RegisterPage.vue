<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { useTokenClient } from 'vue3-google-signin'
import { GOOGLE_SIGN_IN_SCOPES } from '../env'
import { useI18n } from '../i18n'
import { EMAIL_DELIVERY_UNAVAILABLE_CODE } from '../constants/authErrors'
import { extractDrfFieldErrors, firstErroredField } from '../utils/apiValidationErrors'

const router = useRouter()
const { register, socialLogin } = useAuth()
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
      Object.entries(extracted).map(([k, v]) => [k, v[0] || '']),
    )
    await focusField(firstErroredField(extracted, FIELD_ORDER))
    error.value = suggestGoogleForEmail.value
      ? t('auth.emailDeliveryBlocked.message')
      : result.error || t('register.error.generic')
    return
  }
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
      router.push('/')
    } else {
      error.value = result.error || t('login.error.google')
    }
  },
  onError: () => {
    error.value = t('login.error.google')
  }
})
</script>

<template>
  <div class="min-h-screen flex bg-white dark:bg-neutral-950">
    <!-- Left side - hero -->
    <div class="hidden lg:flex lg:w-1/2 relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-br from-pink-500/90 via-pink-500/80 to-pink-600/90 z-10"></div>
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
        <h1 class="text-5xl font-auth-title font-auth-title--black leading-tight mb-4">
          {{ t('register.hero.title') }}
        </h1>
        <p class="text-lg text-white/90 max-w-md">
          {{ t('register.hero.desc') }}
        </p>
      </div>
    </div>

    <!-- Right side - form -->
    <div class="flex-1 flex items-center justify-center px-6 py-12 bg-neutral-50/30 dark:bg-neutral-900/30">
      <div class="w-full max-w-lg bg-white dark:bg-neutral-900 p-8 sm:p-10 rounded-[40px] shadow-sm border border-neutral-100 dark:border-neutral-800">
        <!-- Mobile logo -->
        <div class="lg:hidden flex items-center justify-center gap-2 mb-10">
          <div class="w-10 h-10 rounded-full bg-pink-600 flex items-center justify-center overflow-hidden shadow-sm">
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
            class="flex items-center gap-2 px-4 py-3 rounded-2xl bg-pink-50 border border-pink-100 text-pink-600 text-sm animate-shake"
          >
            <span class="material-symbols-outlined text-lg">error</span>
            {{ error }}
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label class="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2 ml-1">{{ t('register.fullName') }}</label>
              <div class="relative group">
                <span class="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-400 group-focus-within:text-pink-500 transition-colors">person</span>
                <input
                  ref="displayNameInput"
                  v-model="displayName"
                  type="text"
                  :placeholder="t('register.fullName.placeholder')"
                  :class="[
                    'w-full pl-12 pr-4 py-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all',
                    fieldErrors.display_name || fieldErrors.username
                      ? 'border-red-400 focus:ring-red-300/20 focus:border-red-500'
                      : 'border-neutral-200 dark:border-neutral-700',
                  ]"
                />
              </div>
              <p v-if="fieldErrors.display_name || fieldErrors.username" class="mt-1 ml-1 text-xs text-red-600">
                {{ fieldErrors.display_name || fieldErrors.username }}
              </p>
            </div>
            <div>
              <label class="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2 ml-1">{{ t('login.email') }}</label>
              <div class="relative group">
                <span class="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-400 group-focus-within:text-pink-500 transition-colors">mail</span>
                <input
                  ref="emailInput"
                  v-model="email"
                  type="email"
                  :placeholder="t('register.email.placeholder')"
                  :class="[
                    'w-full pl-12 pr-4 py-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all',
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
              <span class="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-400 group-focus-within:text-pink-500 transition-colors">lock</span>
              <input
                ref="passwordInput"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                :placeholder="t('register.password.placeholder')"
                :class="[
                  'w-full pl-12 pr-12 py-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all',
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
              <span class="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-400 group-focus-within:text-pink-500 transition-colors">verified_user</span>
              <input
                ref="confirmPasswordInput"
                v-model="confirmPassword"
                type="password"
                :placeholder="t('register.confirmPassword.placeholder')"
                :class="[
                  'w-full pl-12 pr-4 py-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all',
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
                class="peer h-5 w-5 cursor-pointer appearance-none rounded-lg border-2 border-neutral-300 transition-all checked:bg-pink-600 checked:border-pink-600 hover:border-pink-400"
              />
              <span class="absolute text-white opacity-0 peer-checked:opacity-100 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none material-symbols-outlined text-sm font-bold">check</span>
            </div>
            <span class="text-sm text-neutral-500 dark:text-neutral-400 font-medium select-none">
              {{ t('register.acceptTerms.before') }}
              <router-link to="/legal/terms" class="text-pink-600 font-bold hover:underline" tabindex="0" @click.stop>
                {{ t('register.acceptTerms.terms') }}
              </router-link>
              {{ t('register.acceptTerms.middle') }}
              <router-link to="/legal/privacy" class="text-pink-600 font-bold hover:underline" tabindex="0" @click.stop>
                {{ t('register.acceptTerms.privacy') }}
              </router-link>.
            </span>
          </label>

          <button
            type="submit"
            class="w-full py-4 rounded-2xl bg-pink-600 text-white font-bold hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-pink-600/20 flex items-center justify-center gap-2"
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
            @click="googleLogin()"
            class="flex items-center justify-center gap-2 py-3.5 px-8 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all text-sm font-bold text-neutral-700 dark:text-neutral-200 w-full"
            :class="suggestGoogleForEmail ? 'ring-2 ring-pink-400 ring-offset-2' : ''"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" class="w-5 h-5" />
            {{ t('login.googleCta') }}
          </button>
        </div>

        <p class="mt-10 text-center text-sm text-neutral-500 dark:text-neutral-400 font-medium">
          {{ t('register.haveAccount') }}
          <router-link to="/login" class="text-pink-600 font-bold hover:underline">{{ t('register.signIn') }}</router-link>
        </p>
      </div>
    </div>
  </div>
</template>
