<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api'
import { useI18n } from '../i18n'
import { useAppModal } from '../composables/useAppModal'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { showAlert } = useAppModal()

const email = ref(route.query.email as string || '')
const otp = ref('')
const error = ref('')
const loading = ref(false)
const success = ref(false)

const handleVerify = async () => {
  if (!otp.value || otp.value.length !== 6) {
    error.value = t('otp.error.length')
    return
  }

  loading.value = true
  error.value = ''

  try {
    const response = await api.post('verify-otp/', {
      email: email.value,
      otp: otp.value
    })

    if (response.status === 200) {
      success.value = true
      setTimeout(() => {
        router.push('/login')
      }, 3000)
    }
  } catch (err: any) {
    console.error('OTP Verification error:', err)
    error.value = err.response?.data?.error || t('otp.error.invalid')
  } finally {
    loading.value = false
  }
}

const handleResend = async () => {
  if (!email.value) return

  loading.value = true
  error.value = ''

  try {
    await api.post('resend-otp/', { email: email.value })
    await showAlert(t('otp.resent'), { variant: 'success' })
  } catch (err: any) {
    error.value = err.response?.data?.error || t('otp.error.resend')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (!email.value) {
    error.value = t('otp.error.missingEmail')
  }
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-neutral-50 px-6 py-12">
    <div class="w-full max-w-md bg-white p-10 rounded-[40px] shadow-sm border border-neutral-100">
      <div class="text-center mb-10">
        <div class="w-16 h-16 bg-pink-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <span class="material-symbols-outlined text-pink-600 text-3xl">verified_user</span>
        </div>
        <h2 class="text-3xl font-extrabold text-neutral-900 mb-2">{{ t('otp.title') }}</h2>
        <p class="text-neutral-500">{{ t('otp.subtitle') }} <strong>{{ email }}</strong></p>
      </div>

      <div v-if="success" class="bg-green-50 border border-green-100 text-green-700 p-4 rounded-2xl text-center mb-6">
        <p class="font-bold">{{ t('otp.success.title') }}</p>
        <p class="text-sm mt-1">{{ t('otp.success.desc') }}</p>
      </div>

      <form v-else @submit.prevent="handleVerify" class="space-y-6">
        <div v-if="error" class="flex items-center gap-2 px-4 py-3 rounded-2xl bg-pink-50 border border-pink-100 text-pink-600 text-sm">
          <span class="material-symbols-outlined text-lg">error</span>
          {{ error }}
        </div>

        <div>
          <label class="block text-sm font-bold text-neutral-700 mb-2 ml-1">{{ t('otp.label') }}</label>
          <input
            v-model="otp"
            type="text"
            maxlength="6"
            placeholder="000000"
            class="w-full text-center tracking-[0.5em] text-2xl font-bold py-4 rounded-2xl bg-neutral-50 border border-neutral-200 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
          />
        </div>

        <button
          type="submit"
          class="w-full py-4 rounded-2xl bg-pink-600 text-white font-bold hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-pink-600/20 flex items-center justify-center gap-2"
          :disabled="loading || !otp || otp.length !== 6"
        >
          <span v-if="loading" class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          {{ loading ? t('otp.submitting') : t('otp.submit') }}
        </button>

        <p class="text-center text-sm text-neutral-500">
          {{ t('otp.notReceived') }}
          <button @click="handleResend" type="button" class="text-pink-600 font-bold hover:underline" :disabled="loading">{{ t('otp.resend') }}</button>
        </p>
      </form>

      <div class="mt-8 text-center">
        <router-link to="/login" class="text-neutral-500 hover:text-neutral-900 text-sm font-medium flex items-center justify-center gap-2">
          <span class="material-symbols-outlined text-lg">arrow_back</span>
          {{ t('otp.back') }}
        </router-link>
      </div>
    </div>
  </div>
</template>
