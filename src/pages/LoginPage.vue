<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { useTokenClient } from 'vue3-google-signin'
import { GOOGLE_SIGN_IN_SCOPES } from '../env'
import { useI18n } from '../i18n'

const router = useRouter()
const route = useRoute()
const { login, socialLogin } = useAuth()
const { t } = useI18n()

function goAfterLogin() {
  const raw = route.query.redirect
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const path = decodeURIComponent(raw.trim())
      if (path.startsWith('/') && !path.startsWith('//')) {
        void router.push(path)
        return
      }
    } catch {
      /* ignore */
    }
  }
  void router.push('/')
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
  
  // login() attend `GET me/` (force) avant de retourner success
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
  }
})
</script>

<template>
  <div class="min-h-screen flex bg-transparent dark:bg-transparent">
    <!-- Left side - hero image -->
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
        <h1 class="text-5xl font-auth-title font-auth-title--black leading-tight mb-4">
          {{ t('login.hero.title') }}
        </h1>
        <p class="text-lg text-white/90 max-w-md">
          {{ t('login.hero.desc') }}
        </p>
      </div>
    </div>

    <!-- Right side - login form -->
    <div class="flex-1 flex items-center justify-center px-6 py-12 bg-neutral-50/30 dark:bg-neutral-900/30">
      <div class="w-full max-w-md bg-white dark:bg-neutral-900 p-8 sm:p-10 rounded-[40px] shadow-sm border border-neutral-100 dark:border-neutral-800">
        <!-- Mobile logo -->
        <div class="lg:hidden flex items-center justify-center gap-2 mb-10">
          <div class="w-10 h-10 rounded-full bg-pink-700 dark:bg-pink-600 flex items-center justify-center overflow-hidden shadow-sm">
            <img src="../assets/logo.png" alt="Logo" class="w-full h-full object-cover" />
          </div>
          <span class="text-2xl font-auth-title text-neutral-900 dark:text-neutral-100">Pinova</span>
        </div>

        <div class="text-center mb-10">
          <h2 class="text-3xl font-auth-title font-auth-title--black text-neutral-900 dark:text-neutral-100 mb-2">{{ t('login.welcome') }}</h2>
          <p class="text-neutral-500 dark:text-neutral-400">{{ t('login.subtitle') }}</p>
        </div>

        <form @submit.prevent="handleLogin" class="space-y-5">
          <div
            v-if="error"
            class="flex items-center gap-2 px-4 py-3 rounded-2xl bg-pink-50 border border-pink-100 text-pink-700 text-sm animate-shake"
          >
            <span class="material-symbols-outlined text-lg">error</span>
            {{ error }}
          </div>

          <div>
            <label class="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2 ml-1">{{ t('login.email') }}</label>
            <div class="relative group">
              <span class="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-400 group-focus-within:text-pink-700 transition-colors">mail</span>
              <input
                v-model="email"
                type="email"
                :placeholder="t('login.email.placeholder')"
                :class="[
                  'w-full pl-12 pr-4 py-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 transition-all',
                  fieldErrors.email
                    ? 'border-red-400 focus:ring-red-300/20 focus:border-red-500 dark:focus:border-red-500'
                    : 'border-neutral-200 dark:border-neutral-700 focus:ring-pink-700/20 dark:focus:ring-pink-600/20 focus:border-pink-700 dark:focus:border-pink-600',
                ]"
                @input="clearLoginFieldError('email')"
              />
            </div>
            <p v-if="fieldErrors.email" class="mt-1 ml-1 text-xs font-semibold text-pink-700 dark:text-pink-600">{{ fieldErrors.email }}</p>
          </div>

          <div>
            <div class="flex items-center justify-between mb-2 ml-1">
              <label class="text-sm font-bold text-neutral-700 dark:text-neutral-300">{{ t('login.password') }}</label>
              <router-link to="/forgot-password" class="text-xs font-bold text-pink-700 hover:text-pink-800 hover:underline">{{ t('login.forgot') }}</router-link>
            </div>
            <div class="relative group">
              <span class="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-400 group-focus-within:text-pink-700 transition-colors">lock</span>
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="••••••••"
                :class="[
                  'w-full pl-12 pr-12 py-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 transition-all',
                  fieldErrors.password
                    ? 'border-red-400 focus:ring-red-300/20 focus:border-red-500 dark:focus:border-red-500'
                    : 'border-neutral-200 dark:border-neutral-700 focus:ring-pink-700/20 dark:focus:ring-pink-600/20 focus:border-pink-700 dark:focus:border-pink-600',
                ]"
                @input="clearLoginFieldError('password')"
              />
              <button
                type="button"
                class="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                @click="showPassword = !showPassword"
              >
                <span class="material-symbols-outlined text-xl">{{ showPassword ? 'visibility_off' : 'visibility' }}</span>
              </button>
            </div>
            <p v-if="fieldErrors.password" class="mt-1 ml-1 text-xs font-semibold text-pink-700 dark:text-pink-600">{{ fieldErrors.password }}</p>
          </div>

          <button
            type="submit"
            class="w-full py-4 rounded-2xl bg-pink-700 dark:bg-pink-600 text-white font-bold hover:bg-pink-800 dark:hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-pink-700/20 flex items-center justify-center gap-2"
            :disabled="loading"
          >
            <span v-if="loading" class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            {{ loading ? t('login.submitting') : t('login.submit') }}
          </button>
        </form>

        <div class="my-8 flex items-center gap-4 text-neutral-400 dark:text-neutral-500">
          <div class="flex-1 h-px bg-neutral-200 dark:bg-neutral-700"></div>
          <span class="text-xs font-bold uppercase tracking-wider">{{ t('login.divider') }}</span>
          <div class="flex-1 h-px bg-neutral-200 dark:bg-neutral-700"></div>
        </div>

        <div class="flex justify-center">
          <button
            type="button"
            @click="googleLogin()"
            class="flex items-center justify-center gap-2 py-3.5 px-8 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all text-sm font-bold text-neutral-700 dark:text-neutral-200 w-full"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" class="w-5 h-5" />
            {{ t('login.googleCta') }}
          </button>
        </div>

        <p class="mt-10 text-center text-sm text-neutral-500 dark:text-neutral-400 font-medium">
          {{ t('login.noAccount') }}
          <router-link to="/register" class="text-pink-700 font-bold hover:underline">{{ t('login.signUp') }}</router-link>
        </p>
      </div>
    </div>
  </div>
</template>
