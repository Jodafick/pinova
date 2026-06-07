<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api/index'
import { useI18n } from '../i18n'
import { EMAIL_DELIVERY_UNAVAILABLE_CODE, readApiErrorCode } from '../constants/authErrors'
import { useAppModal } from '../composables/useAppModal'
import { useAuth } from '../composables/useAuth'
import { redirectAfterAuth } from '../utils/postAuthRedirect'
import { trackEvent } from '../lib/analytics'
import PinovaButton from '../components/ui/PinovaButton.vue'

type OtpApiMeta = {
  attempts_remaining?: number
  retry_after_seconds?: number
  code?: string
}

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { showAlert } = useAppModal()
const { applyAuthSession } = useAuth()

const email = ref(route.query.email as string || '')
const otp = ref('')
const error = ref('')
const suggestGoogleForEmail = ref(false)
const loading = ref(false)
const success = ref(false)
const attemptsRemaining = ref<number | null>(null)
const locked = ref(false)
const lockoutSeconds = ref(0)
const resendSeconds = ref(0)
let successRedirectTimer: ReturnType<typeof setTimeout> | null = null
let countdownTimer: ReturnType<typeof setInterval> | null = null

const RESEND_COOLDOWN_DEFAULT = 60

const lockoutMinutes = computed(() => Math.max(1, Math.ceil(lockoutSeconds.value / 60)))
const canSubmit = computed(
  () => !loading.value && !locked.value && !!otp.value && otp.value.length === 6,
)
const canResend = computed(() => !loading.value && !locked.value && resendSeconds.value <= 0)

function parseOtpMeta(body: unknown): OtpApiMeta {
  if (!body || typeof body !== 'object') return {}
  return body as OtpApiMeta
}

function applyLockout(seconds: number) {
  locked.value = true
  lockoutSeconds.value = Math.max(1, seconds)
  attemptsRemaining.value = 0
}

function startCountdowns(initialLockout = 0, initialResend = RESEND_COOLDOWN_DEFAULT) {
  if (initialLockout > 0) applyLockout(initialLockout)
  resendSeconds.value = Math.max(0, initialResend)
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = setInterval(() => {
    if (lockoutSeconds.value > 0) {
      lockoutSeconds.value -= 1
      if (lockoutSeconds.value <= 0) locked.value = false
    }
    if (resendSeconds.value > 0) resendSeconds.value -= 1
  }, 1000)
}

function applyVerifyError(body: unknown, fallback: string) {
  const meta = parseOtpMeta(body)
  const code = readApiErrorCode(body) || meta.code
  if (code === 'pinova_otp_locked' && meta.retry_after_seconds) {
    applyLockout(meta.retry_after_seconds)
  } else if (typeof meta.attempts_remaining === 'number') {
    attemptsRemaining.value = meta.attempts_remaining
  }
  const errObj = body as { error?: string } | null
  error.value = errObj?.error || fallback
}

const handleVerify = async () => {
  if (locked.value) return
  if (!otp.value || otp.value.length !== 6) {
    error.value = t('otp.error.length')
    return
  }

  loading.value = true
  error.value = ''

  try {
    const response = await api.post('verify-otp/', {
      email: email.value,
      otp: otp.value,
    })

    if (response.status === 200) {
      success.value = true
      trackEvent('otp_verified')
      attemptsRemaining.value = null
      locked.value = false
      const data = response.data as { access?: string; refresh?: string }
      const user = await applyAuthSession({ access: data.access, refresh: data.refresh })
      successRedirectTimer = setTimeout(() => {
        successRedirectTimer = null
        redirectAfterAuth(router, { user })
      }, 1200)
    }
  } catch (err: any) {
    console.error('OTP Verification error:', err)
    applyVerifyError(err.response?.data, t('otp.error.invalid'))
  } finally {
    loading.value = false
  }
}

const handleResend = async () => {
  if (!email.value || !canResend.value) return

  loading.value = true
  error.value = ''
  suggestGoogleForEmail.value = false

  try {
    const response = await api.post('resend-otp/', { email: email.value })
    const cooldown = Number(response.data?.resend_cooldown_seconds) || RESEND_COOLDOWN_DEFAULT
    resendSeconds.value = cooldown
    await showAlert(t('otp.resent'), { variant: 'success' })
  } catch (err: any) {
    const body = err.response?.data
    const code = readApiErrorCode(body)
    suggestGoogleForEmail.value = code === EMAIL_DELIVERY_UNAVAILABLE_CODE
    if (code === 'pinova_otp_resend_cooldown' && body?.retry_after_seconds) {
      resendSeconds.value = Number(body.retry_after_seconds) || RESEND_COOLDOWN_DEFAULT
      error.value = t('otp.resend.wait')
    } else {
      error.value = suggestGoogleForEmail.value
        ? t('auth.emailDeliveryBlocked.message')
        : body?.error || t('otp.error.resend')
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (!email.value) {
    error.value = t('otp.error.missingEmail')
  }
  startCountdowns(0, 0)
})

onBeforeUnmount(() => {
  if (successRedirectTimer != null) clearTimeout(successRedirectTimer)
  if (countdownTimer) clearInterval(countdownTimer)
})
</script>

<template>
  <div class="pinova-route-natural-height pinova-auth-page-shell min-h-0 flex flex-1 flex-col items-stretch justify-center bg-transparent dark:bg-transparent px-4 py-6 sm:px-6 sm:py-12 lg:min-h-screen lg:items-center">
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

      <div
        v-else-if="locked"
        class="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center dark:border-amber-900 dark:bg-amber-950/40"
      >
        <p class="font-bold text-amber-900 dark:text-amber-200">{{ t('otp.locked.title') }}</p>
        <p class="text-sm mt-2 text-amber-800 dark:text-amber-300">
          {{ t('otp.locked.desc', { minutes: lockoutMinutes, seconds: lockoutSeconds }) }}
        </p>
        <router-link to="/contact" class="mt-4 inline-block text-sm font-bold text-pink-700 hover:underline">
          {{ t('otp.locked.support') }}
        </router-link>
      </div>

      <form v-if="!success && !locked" @submit.prevent="handleVerify" class="space-y-6">
        <div v-if="error" class="flex items-center gap-2 px-4 py-3 rounded-2xl bg-pink-50 border border-pink-100 text-pink-700 text-sm">
          <span class="material-symbols-outlined text-lg">error</span>
          {{ error }}
        </div>

        <p
          v-if="attemptsRemaining !== null && attemptsRemaining >= 0"
          class="text-sm font-semibold text-neutral-600 dark:text-neutral-400 px-1"
        >
          {{ t('otp.attemptsRemaining', { count: attemptsRemaining }) }}
        </p>

        <div>
          <label class="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2 ml-1">{{ t('otp.label') }}</label>
          <input
            v-model="otp"
            type="text"
            maxlength="6"
            inputmode="numeric"
            data-testid="otp-input"
            placeholder="000000"
            class="w-full text-center tracking-[0.5em] text-2xl font-bold py-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-pink-700/20 dark:focus:ring-pink-600/20 focus:border-pink-700 dark:border-pink-600 transition-all"
          />
        </div>

        <PinovaButton
          type="submit"
          data-testid="otp-submit"
          variant="primary"
          size="lg"
          block
          :loading="loading"
          :disabled="!canSubmit"
        >
          {{ loading ? t('otp.submitting') : t('otp.submit') }}
        </PinovaButton>

        <p class="text-center text-sm text-neutral-500 dark:text-neutral-400">
          {{ t('otp.notReceived') }}
          <button
            @click="handleResend"
            type="button"
            class="text-pink-700 font-bold hover:underline disabled:opacity-50 disabled:no-underline"
            :disabled="!canResend"
          >
            {{ resendSeconds > 0 ? t('otp.resend.in', { seconds: resendSeconds }) : t('otp.resend') }}
          </button>
        </p>

        <div
          v-if="suggestGoogleForEmail"
          class="mt-6 rounded-2xl border border-pink-100 dark:border-pink-900 bg-pink-50/80 dark:bg-pink-950/40 p-4 text-center text-sm text-neutral-800 dark:text-neutral-200"
        >
          <p class="font-medium">{{ t('auth.emailDeliveryBlocked.googleHint') }}</p>
          <PinovaButton variant="secondary" block to="/login" class="mt-3">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" class="w-5 h-5 shrink-0" alt="" />
            {{ t('login.googleCta') }}
          </PinovaButton>
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
