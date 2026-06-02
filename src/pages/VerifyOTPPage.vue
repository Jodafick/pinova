<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api'
import { useI18n } from '../i18n'
import { EMAIL_DELIVERY_UNAVAILABLE_CODE, readApiErrorCode } from '../constants/authErrors'
import { useAppModal } from '../composables/useAppModal'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { showAlert } = useAppModal()

const email = ref(route.query.email as string || '')
const otp = ref('')
const error = ref('')
const suggestGoogleForEmail = ref(false)
const loading = ref(false)
const success = ref(false)
let successRedirectTimer: ReturnType<typeof setTimeout> | null = null

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
      successRedirectTimer = setTimeout(() => {
        successRedirectTimer = null
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
  suggestGoogleForEmail.value = false

  try {
    await api.post('resend-otp/', { email: email.value })
    await showAlert(t('otp.resent'), { variant: 'success' })
  } catch (err: any) {
    const body = err.response?.data
    const code = readApiErrorCode(body)
    suggestGoogleForEmail.value = code === EMAIL_DELIVERY_UNAVAILABLE_CODE
    error.value = suggestGoogleForEmail.value
      ? t('auth.emailDeliveryBlocked.message')
      : err.response?.data?.error || t('otp.error.resend')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (!email.value) {
    error.value = t('otp.error.missingEmail')
  }
})

onBeforeUnmount(() => {
  if (successRedirectTimer != null) {
    clearTimeout(successRedirectTimer)
    successRedirectTimer = null
  }
})
</script>

<template>
  <div class="min-h-screen flex items-stretch lg:items-center justify-center bg-transparent dark:bg-transparent px-4 py-6 sm:px-6 sm:py-12">
    <div class="w-full max-w-md lg:bg-white lg:dark:bg-neutral-900 lg:p-8 xl:p-10 lg:rounded-[40px] lg:shadow-sm lg:border lg:border-neutral-100 lg:dark:border-neutral-800">
      <div class="text-center mb-10">
        <div class="w-16 h-16 bg-pink-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <span class="material-symbols-outlined text-pink-700 text-3xl">verified_user</span>
        </div>
        <h2 class="text-3xl font-auth-title font-auth-title--black text-neutral-900 dark:text-neutral-100 mb-2">{{ t('otp.title') }}</h2>
        <p class="text-neutral-500 dark:text-neutral-400">{{ t('otp.subtitle') }} <strong>{{ email }}</strong></p>
      </div>

      <div v-if="success" class="bg-green-50 border border-green-100 text-green-700 p-4 rounded-2xl text-center mb-6">
        <p class="font-bold">{{ t('otp.success.title') }}</p>
        <p class="text-sm mt-1">{{ t('otp.success.desc') }}</p>
      </div>

      <form v-else @submit.prevent="handleVerify" class="space-y-6">
        <div v-if="error" class="flex items-center gap-2 px-4 py-3 rounded-2xl bg-pink-50 border border-pink-100 text-pink-700 text-sm">
          <span class="material-symbols-outlined text-lg">error</span>
          {{ error }}
        </div>

        <div>
          <label class="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2 ml-1">{{ t('otp.label') }}</label>
          <input
            v-model="otp"
            type="text"
            maxlength="6"
            placeholder="000000"
            class="w-full text-center tracking-[0.5em] text-2xl font-bold py-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-pink-700/20 dark:focus:ring-pink-600/20 focus:border-pink-700 dark:border-pink-600 transition-all"
          />
        </div>

        <button
          type="submit"
          class="w-full py-4 rounded-2xl bg-pink-700 dark:bg-pink-600 text-white font-bold hover:bg-pink-800 dark:hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-pink-700/20 flex items-center justify-center gap-2"
          :disabled="loading || !otp || otp.length !== 6"
        >
          <span v-if="loading" class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          {{ loading ? t('otp.submitting') : t('otp.submit') }}
        </button>

        <p class="text-center text-sm text-neutral-500 dark:text-neutral-400">
          {{ t('otp.notReceived') }}
          <button @click="handleResend" type="button" class="text-pink-700 font-bold hover:underline" :disabled="loading">{{ t('otp.resend') }}</button>
        </p>

        <div
          v-if="suggestGoogleForEmail"
          class="mt-6 rounded-2xl border border-pink-100 dark:border-pink-900 bg-pink-50/80 dark:bg-pink-950/40 p-4 text-center text-sm text-neutral-800 dark:text-neutral-200"
        >
          <p class="font-medium">{{ t('auth.emailDeliveryBlocked.googleHint') }}</p>
          <router-link
            to="/login"
            class="mt-3 inline-flex items-center justify-center gap-2 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-2.5 text-sm font-bold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" class="w-5 h-5" alt="" />
            {{ t('login.googleCta') }}
          </router-link>
        </div>
      </form>

      <div class="mt-8 text-center">
        <router-link to="/login" class="text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 text-sm font-medium flex items-center justify-center gap-2">
          <span class="material-symbols-outlined text-lg">arrow_back</span>
          {{ t('otp.back') }}
        </router-link>
      </div>
    </div>
  </div>
</template>
