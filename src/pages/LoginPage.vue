<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { useTokenClient } from 'vue3-google-signin'
import { GOOGLE_SIGN_IN_SCOPES } from '../config/env'
import { useI18n } from '../i18n'
import { waitForGoogleIdentityServices } from '../composables/waitForGoogleIdentity'
import { redirectAfterAuth } from '../utils/postAuthRedirect'
import PinovaButton from '../components/ui/PinovaButton.vue'
import PinovaInput from '../components/ui/PinovaInput.vue'

const router = useRouter()
const route = useRoute()
const { login, socialLogin, currentUser } = useAuth()
const { t } = useI18n()

function goAfterLogin() {
  redirectAfterAuth(router, {
    user: currentUser.value,
    redirectQuery: route.query.redirect as string | undefined,
  })
}

const email = ref('')
const password = ref('')
const error = ref('')
const fieldErrors = ref<{ email?: string; password?: string }>({})
const loading = ref(false)
const showPassword = ref(false)

function clearLoginFieldError(which: 'email' | 'password') {
  if (fieldErrors.value[which]) {
    const next = { ...fieldErrors.value }
    delete next[which]
    fieldErrors.value = next
  }
}

const handleLogin = async () => {
  error.value = ''
  fieldErrors.value = {}
  if (!email.value || !password.value) {
    error.value = t('login.error.empty')
    return
  }
  loading.value = true
  const result = await login(email.value, password.value)
  if (!result.success) {
    loading.value = false
    if (result.fieldErrors && Object.keys(result.fieldErrors).length) {
      fieldErrors.value = result.fieldErrors
    }
    error.value = result.error?.trim() ? result.error : ''
    if (!error.value && !fieldErrors.value.email && !fieldErrors.value.password) {
      error.value = t('login.error.generic')
    }
    return
  }
  loading.value = false
  void goAfterLogin()
}

const { login: googleLogin } = useTokenClient({
  scope: GOOGLE_SIGN_IN_SCOPES,
  onSuccess: async (response) => {
    loading.value = true
    const result = await socialLogin('google', response.access_token)
    if (result.success) {
      loading.value = false
      void goAfterLogin()
    } else {
      loading.value = false
      fieldErrors.value = {}
      error.value = result.error || t('login.error.google')
    }
  },
  onError: () => {
    fieldErrors.value = {}
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
  <div class="pinova-route-natural-height pinova-auth-page-shell min-h-0 flex flex-1 flex-col bg-transparent dark:bg-transparent lg:min-h-screen">
    <div class="hidden lg:flex lg:w-1/2 relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-br from-pink-700/90 dark:from-pink-600/90 via-pink-700/80 dark:via-pink-600/80 to-pink-700/90 dark:to-pink-600/90 z-10"></div>
      <img
        src="https://images.pexels.com/photos/1266808/pexels-photo-1266808.jpeg?auto=compress&cs=tinysrgb&w=1200"
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
          {{ t('login.hero.title') }}
        </h1>
        <p class="text-lg text-white/90 max-w-md">
          {{ t('login.hero.desc') }}
        </p>
      </div>
    </div>

    <div class="flex-1 flex items-stretch lg:items-center justify-center px-4 py-6 sm:px-6 sm:py-12 lg:bg-neutral-50/30 lg:dark:bg-neutral-900/30">
      <div class="w-full max-w-md lg:bg-white lg:dark:bg-neutral-900 lg:p-8 xl:p-10 lg:rounded-[40px] lg:shadow-sm lg:border lg:border-neutral-100 lg:dark:border-neutral-800">
        <div class="lg:hidden flex items-center justify-center gap-2 mb-10">
          <div class="w-10 h-10 rounded-full bg-pink-700 dark:bg-pink-600 flex items-center justify-center overflow-hidden shadow-sm">
            <img src="../assets/logo.png" alt="Logo" class="w-full h-full object-cover" />
          </div>
          <span class="text-2xl font-auth-title text-neutral-900 dark:text-neutral-100">Pinova</span>
        </div>

        <div class="text-center mb-10">
          <h2 class="text-[2.125rem] font-auth-title font-auth-title--black text-neutral-900 dark:text-neutral-100 mb-2">{{ t('login.welcome') }}</h2>
          <p class="text-neutral-500 dark:text-neutral-400">{{ t('login.subtitle') }}</p>
        </div>

        <form @submit.prevent="handleLogin" class="space-y-5">
          <div
            v-if="error"
            class="flex items-center gap-2 px-4 py-3 rounded-2xl bg-pink-50 border border-pink-100 text-pink-700 text-sm animate-shake dark:bg-pink-950/30 dark:border-pink-900/40 dark:text-pink-400"
          >
            <PinovaIcon name="error" class="text-lg" />
            {{ error }}
          </div>

          <PinovaInput
            v-model="email"
            :label="t('login.email')"
            :placeholder="t('login.email.placeholder')"
            type="email"
            icon="mail"
            :error="fieldErrors.email"
            @update:model-value="clearLoginFieldError('email')"
          />

          <div>
            <div class="flex items-center justify-between mb-2 ml-1">
              <label class="text-sm font-bold text-neutral-700 dark:text-neutral-300">{{ t('login.password') }}</label>
              <router-link to="/forgot-password" class="text-xs font-bold text-pink-700 hover:text-pink-800 hover:underline">{{ t('login.forgot') }}</router-link>
            </div>
            <PinovaInput
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="••••••••"
              icon="lock"
              :error="fieldErrors.password"
              @update:model-value="clearLoginFieldError('password')"
            >
              <template #suffix>
                <button
                  type="button"
                  class="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                  @click="showPassword = !showPassword"
                >
                  <PinovaIcon :name="showPassword ? 'visibility_off' : 'visibility'" class="text-xl" />
                </button>
              </template>
            </PinovaInput>
          </div>

          <PinovaButton type="submit" variant="primary" size="lg" block :loading="loading">
            {{ loading ? t('login.submitting') : t('login.submit') }}
          </PinovaButton>
        </form>

        <div class="my-8 flex items-center gap-4 text-neutral-400 dark:text-neutral-500">
          <div class="flex-1 h-px bg-neutral-200 dark:bg-neutral-700"></div>
          <span class="text-xs font-bold uppercase tracking-wider">{{ t('login.divider') }}</span>
          <div class="flex-1 h-px bg-neutral-200 dark:bg-neutral-700"></div>
        </div>

        <PinovaButton variant="secondary" block @click="handleGoogleClick">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" class="w-5 h-5 shrink-0" alt="" />
          {{ t('login.googleCta') }}
        </PinovaButton>

        <p class="mt-10 text-center text-sm text-neutral-500 dark:text-neutral-400 font-medium">
          {{ t('login.noAccount') }}
          <router-link to="/register" class="text-pink-700 font-bold hover:underline">{{ t('login.signUp') }}</router-link>
        </p>
      </div>
    </div>
  </div>
</template>
