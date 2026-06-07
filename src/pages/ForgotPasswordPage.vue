<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useI18n } from '../i18n'
import PinovaButton from '../components/ui/PinovaButton.vue'
import PinovaInput from '../components/ui/PinovaInput.vue'

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
  <div class="min-h-screen flex items-stretch lg:items-center justify-center bg-transparent dark:bg-transparent px-4 py-6 sm:px-6 sm:py-12">
    <div class="w-full max-w-md lg:bg-white lg:dark:bg-neutral-900 lg:p-8 xl:p-10 lg:rounded-[40px] lg:shadow-sm lg:border lg:border-neutral-100 lg:dark:border-neutral-800">
      <div class="text-center mb-8">
        <div class="w-16 h-16 rounded-full bg-pink-50 flex items-center justify-center mx-auto mb-6">
          <span class="material-symbols-outlined text-pink-700 text-3xl">lock_reset</span>
        </div>
        <h2 class="text-3xl font-auth-title font-auth-title--black text-neutral-900 dark:text-neutral-100 mb-2">{{ t('forgot.title') }}</h2>
        <p class="text-neutral-500 dark:text-neutral-400">{{ t('forgot.subtitle') }}</p>
      </div>

      <div v-if="success" class="bg-green-50 border border-green-100 rounded-2xl p-6 text-center animate-fade-in">
        <span class="material-symbols-outlined text-green-600 text-4xl mb-3">mark_email_read</span>
        <h3 class="text-green-800 font-bold mb-1">{{ t('forgot.success.title') }}</h3>
        <p class="text-green-700 text-sm">{{ t('forgot.success.desc') }}</p>
        <router-link to="/login" class="inline-block mt-6 text-green-800 font-bold hover:underline">{{ t('forgot.success.back') }}</router-link>
      </div>

      <form v-else @submit.prevent="handleForgotPassword" class="space-y-6">
        <div v-if="error" class="flex items-center gap-2 px-4 py-3 rounded-2xl bg-pink-50 border border-pink-100 text-pink-700 text-sm">
          <span class="material-symbols-outlined text-lg">error</span>
          {{ error }}
        </div>

        <PinovaInput
          v-model="email"
          :label="t('login.email')"
          :placeholder="t('login.email.placeholder')"
          type="email"
          icon="mail"
        />

        <PinovaButton type="submit" variant="primary" size="lg" block :loading="loading">
          {{ t('forgot.submit') }}
        </PinovaButton>

        <p class="text-center">
          <router-link to="/login" class="text-sm font-bold text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">{{ t('forgot.cancel') }}</router-link>
        </p>
      </form>
    </div>
  </div>
</template>
