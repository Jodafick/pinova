<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useI18n } from '../i18n'

const { forgotPassword } = useAuth()
const { t } = useI18n()
const email = ref('')
const error = ref('')
const success = ref(false)
const loading = ref(false)

const handleForgotPassword = async () => {
  error.value = ''
  if (!email.value) {
    error.value = t('forgot.error.empty')
    return
  }
  loading.value = true
  const result = await forgotPassword(email.value)
  loading.value = false
  if (result.success) {
    success.value = true
  } else {
    error.value = result.error || t('forgot.error.generic')
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-neutral-50 px-6 py-12">
    <div class="w-full max-w-md bg-white p-8 sm:p-10 rounded-[40px] shadow-sm border border-neutral-100">
      <div class="text-center mb-8">
        <div class="w-16 h-16 rounded-full bg-pink-50 flex items-center justify-center mx-auto mb-6">
          <span class="material-symbols-outlined text-pink-600 text-3xl">lock_reset</span>
        </div>
        <h2 class="text-3xl font-extrabold text-neutral-900 mb-2">{{ t('forgot.title') }}</h2>
        <p class="text-neutral-500">{{ t('forgot.subtitle') }}</p>
      </div>

      <div v-if="success" class="bg-green-50 border border-green-100 rounded-2xl p-6 text-center animate-fade-in">
        <span class="material-symbols-outlined text-green-600 text-4xl mb-3">mark_email_read</span>
        <h3 class="text-green-800 font-bold mb-1">{{ t('forgot.success.title') }}</h3>
        <p class="text-green-700 text-sm">{{ t('forgot.success.desc') }}</p>
        <router-link to="/login" class="inline-block mt-6 text-green-800 font-bold hover:underline">{{ t('forgot.success.back') }}</router-link>
      </div>

      <form v-else @submit.prevent="handleForgotPassword" class="space-y-6">
        <div v-if="error" class="flex items-center gap-2 px-4 py-3 rounded-2xl bg-pink-50 border border-pink-100 text-pink-600 text-sm">
          <span class="material-symbols-outlined text-lg">error</span>
          {{ error }}
        </div>

        <div>
          <label class="block text-sm font-bold text-neutral-700 mb-2 ml-1">{{ t('login.email') }}</label>
          <div class="relative group">
            <span class="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-400 group-focus-within:text-pink-500 transition-colors">mail</span>
            <input
              v-model="email"
              type="email"
              :placeholder="t('login.email.placeholder')"
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
          {{ t('forgot.submit') }}
        </button>

        <p class="text-center">
          <router-link to="/login" class="text-sm font-bold text-neutral-500 hover:text-neutral-700">{{ t('forgot.cancel') }}</router-link>
        </p>
      </form>
    </div>
  </div>
</template>
