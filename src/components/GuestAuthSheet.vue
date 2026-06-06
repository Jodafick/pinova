<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from '../i18n'
import { useTokenClient } from 'vue3-google-signin'
import { GOOGLE_SIGN_IN_SCOPES } from '../env'
import { useAuth } from '../composables/useAuth'
import { redirectAfterAuth } from '../utils/postAuthRedirect'

const props = defineProps<{
  open: boolean
  intent?: 'like' | 'save' | 'follow' | 'comment' | 'contest' | 'generic'
}>()

const emit = defineEmits<{ (e: 'close'): void }>()

const { t } = useI18n()
const router = useRouter()
const { socialLogin } = useAuth()

const intentKey = () => {
  const i = props.intent || 'generic'
  const k = `guestGate.intent.${i}`
  const translated = t(k)
  return translated !== k ? translated : t('guestGate.intent.generic')
}

const { login: googleLogin, isReady: googleReady } = useTokenClient({
  scope: GOOGLE_SIGN_IN_SCOPES,
  onSuccess: async (response) => {
    const result = await socialLogin('google', response.access_token)
    if (result.success) {
      emit('close')
      redirectAfterAuth(router, { user: result.user })
    }
  },
})

function goLogin() {
  emit('close')
  const redirect = encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/')
  router.push({ name: 'login', query: { redirect } })
}

function goRegister() {
  emit('close')
  router.push({ name: 'register' })
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[230] flex items-end sm:items-center justify-center bg-black/55 p-0 sm:p-4"
      @click.self="emit('close')"
    >
      <div
        class="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-neutral-950 shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <div class="px-5 pt-5 pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div class="flex justify-between items-start gap-3">
            <div>
              <p class="text-[10px] font-bold uppercase tracking-widest text-pink-600">{{ t('guestGate.kicker') }}</p>
              <h2 class="text-lg font-bold text-neutral-900 dark:text-neutral-50">{{ t('guestGate.title') }}</h2>
              <p class="text-sm text-neutral-500 mt-1">{{ intentKey() }}</p>
            </div>
            <button type="button" class="h-9 w-9 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center" @click="emit('close')">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>
        <div class="p-5 space-y-3">
          <button
            type="button"
            class="w-full flex items-center justify-center gap-2 rounded-2xl bg-pink-700 text-white font-bold py-3.5"
            @click="goRegister"
          >
            {{ t('guestGate.ctaRegister') }}
          </button>
          <button
            v-if="googleReady"
            type="button"
            class="w-full flex items-center justify-center gap-2 rounded-2xl border border-neutral-200 dark:border-neutral-700 py-3.5 font-semibold"
            @click="googleLogin"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" class="w-5 h-5" alt="" />
            {{ t('login.googleCta') }}
          </button>
          <button type="button" class="w-full text-sm font-semibold text-pink-700 py-2" @click="goLogin">
            {{ t('guestGate.ctaLogin') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
