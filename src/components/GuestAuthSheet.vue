<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from '../i18n'
import { useTokenClient } from 'vue3-google-signin'
import { GOOGLE_SIGN_IN_SCOPES } from '../config/env'
import { useAuth } from '../composables/useAuth'
import { redirectAfterAuth } from '../utils/postAuthRedirect'
import PinovaButton from './ui/PinovaButton.vue'

const props = defineProps<{
  open: boolean
  intent?: 'like' | 'save' | 'follow' | 'comment' | 'translate' | 'contest' | 'generic'
}>()

const emit = defineEmits<{ (e: 'close'): void }>()

const { t } = useI18n()
const router = useRouter()
const { socialLogin } = useAuth()

const intent = () => props.intent || 'generic'

const titleKey = () => {
  const i = intent()
  const k = `guestGate.title.${i}`
  const translated = t(k)
  return translated !== k ? translated : t('guestGate.title.generic')
}

const intentKey = () => {
  const i = intent()
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
  const redirect = encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/')
  router.push({ name: 'register', query: { redirect } })
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
        data-testid="guest-auth-sheet"
        class="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-neutral-950 shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <div class="px-5 pt-5 pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div class="flex justify-between items-start gap-3">
            <div>
              <p class="text-[10px] font-bold uppercase tracking-widest text-pink-600">{{ t('guestGate.kicker') }}</p>
              <h2 class="text-lg font-bold text-neutral-900 dark:text-neutral-50">{{ titleKey() }}</h2>
              <p class="text-sm text-neutral-500 mt-1">{{ intentKey() }}</p>
              <p class="text-xs font-semibold text-pink-600/90 dark:text-pink-400 mt-2">{{ t('guestGate.socialProof') }}</p>
            </div>
            <button type="button" class="h-9 w-9 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center" @click="emit('close')">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>
        <div class="p-5 space-y-3">
          <PinovaButton
            data-testid="guest-auth-register"
            variant="primary"
            block
            @click="goRegister"
          >
            {{ t('guestGate.ctaRegister') }}
          </PinovaButton>
          <PinovaButton
            v-if="googleReady"
            variant="secondary"
            block
            @click="googleLogin"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" class="w-5 h-5 shrink-0" alt="" />
            {{ t('login.googleCta') }}
          </PinovaButton>
          <PinovaButton variant="ghost" block @click="goLogin">
            {{ t('guestGate.ctaLogin') }}
          </PinovaButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>
