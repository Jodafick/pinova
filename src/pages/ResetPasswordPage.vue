<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { useI18n } from '../i18n'

const route = useRoute()
const router = useRouter()
const { resetPassword } = useAuth()
const { t } = useI18n()

const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const success = ref(false)
const loading = ref(false)
const showPassword = ref(false)

const handleResetPassword = async () => {
  error.value = ''
  if (password.value !== confirmPassword.value) {
    error.value = t('register.error.passwordMismatch')
    return
  }
  if (password.value.length < 8) {
    error.value = t('register.error.passwordShort')
    return
  }

  loading.value = true
  const result = await resetPassword({
    uid: route.params.uid,
    token: route.params.token,
    new_password: password.value
  })
  loading.value = false

  if (result.success) {
    success.value = true
    setTimeout(() => router.push('/login'), 3000)
  } else {
    error.value = result.error || t('reset.error.invalid')
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-neutral-50 px-6 py-12">
    <div class="w-full max-w-md bg-white p-8 sm:p-10 rounded-[40px] shadow-sm border border-neutral-100">
      <div class="text-center mb-8">
        <h2 class="text-3xl font-extrabold text-neutral-900 mb-2">{{ t('reset.title') }}</h2>
        <p class="text-neutral-500">{{ t('reset.subtitle') }}</p>
      </div>

      <div v-if="success" class="bg-green-50 border border-green-100 rounded-2xl p-6 text-center animate-fade-in">
        <span class="material-symbols-outlined text-green-600 text-4xl mb-3">check_circle</span>
        <h3 class="text-green-800 font-bold mb-1">{{ t('reset.success.title') }}</h3>
        <p class="text-green-700 text-sm">{{ t('reset.success.desc') }}</p>
      </div>

      <form v-else @submit.prevent="handleResetPassword" class="space-y-5">
        <div v-if="error" class="flex items-center gap-2 px-4 py-3 rounded-2xl bg-pink-50 border border-pink-100 text-pink-600 text-sm">
          <span class="material-symbols-outlined text-lg">error</span>
          {{ error }}
        </div>

        <div>
          <label class="block text-sm font-bold text-neutral-700 mb-2 ml-1">{{ t('reset.newPassword') }}</label>
          <div class="relative group">
            <span class="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-400 group-focus-within:text-pink-500 transition-colors">lock</span>
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="••••••••"
              class="w-full pl-12 pr-12 py-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
            />
            <button
              type="button"
              class="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
              @click="showPassword = !showPassword"
            >
              <span class="material-symbols-outlined text-xl">{{ showPassword ? 'visibility_off' : 'visibility' }}</span>
            </button>
          </div>
        </div>

        <div>
          <label class="block text-sm font-bold text-neutral-700 mb-2 ml-1">{{ t('reset.confirmPassword') }}</label>
          <div class="relative group">
            <span class="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-400 group-focus-within:text-pink-500 transition-colors">verified_user</span>
            <input
              v-model="confirmPassword"
              type="password"
              placeholder="••••••••"
              class="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
            />
          </div>
        </div>

        <button
          type="submit"
          class="w-full py-4 rounded-2xl bg-pink-600 text-white font-bold hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-pink-600/20 flex items-center justify-center gap-2"
          :disabled="loading"
        >
          <span v-if="loading" class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          {{ t('reset.submit') }}
        </button>
      </form>
    </div>
  </div>
</template>
