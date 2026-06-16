<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { useI18n } from '../i18n'
import PasswordStrengthField from '../components/PasswordStrengthField.vue'
import { allPasswordRulesMet } from '../utils/passwordPolicy'
import FotoceButton from '../components/ui/FotoceButton.vue'

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
const passwordValid = ref(false)

const handleResetPassword = async () => {
  error.value = ''
  if (!allPasswordRulesMet(password.value)) {
    error.value = t('passwordPolicy.checklistTitle')
    return
  }
  if (password.value !== confirmPassword.value) {
    error.value = t('register.error.passwordMismatch')
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
  <div class="fotoce-route-natural-height fotoce-auth-page-shell min-h-0 flex flex-1 flex-col items-stretch justify-center bg-transparent dark:bg-transparent px-4 py-6 sm:px-6 sm:py-12 lg:min-h-screen lg:items-center">
    <div class="w-full max-w-md lg:bg-white lg:dark:bg-neutral-900 lg:p-8 xl:p-10 lg:rounded-[40px] lg:shadow-sm lg:border lg:border-neutral-100 lg:dark:border-neutral-800">
      <div class="text-center mb-8">
        <h2 class="text-3xl font-auth-title font-auth-title--black text-neutral-900 dark:text-neutral-100 mb-2">{{ t('reset.title') }}</h2>
        <p class="text-neutral-500 dark:text-neutral-400">{{ t('reset.subtitle') }}</p>
      </div>

      <div v-if="success" class="bg-green-50 border border-green-100 rounded-2xl p-6 text-center animate-fade-in">
        <FotoceIcon name="check_circle" class="text-green-600 text-4xl mb-3" />
        <h3 class="text-green-800 font-bold mb-1">{{ t('reset.success.title') }}</h3>
        <p class="text-green-700 text-sm">{{ t('reset.success.desc') }}</p>
      </div>

      <form v-else @submit.prevent="handleResetPassword" class="space-y-5">
        <div v-if="error" class="flex items-center gap-2 px-4 py-3 rounded-2xl bg-pink-50 border border-pink-100 text-pink-700 text-sm">
          <FotoceIcon name="error" class="text-lg" />
          {{ error }}
        </div>

        <PasswordStrengthField
          v-model="password"
          v-model:show-password="showPassword"
          :label="t('reset.newPassword')"
          placeholder="••••••••"
          input-id="reset-password"
          @update:valid="passwordValid = $event"
        />

        <div>
          <label class="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2 ml-1">{{ t('reset.confirmPassword') }}</label>
          <div class="relative group">
            <FotoceIcon name="verified_user" class="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-pink-700 transition-colors" />
            <input
              v-model="confirmPassword"
              type="password"
              placeholder="••••••••"
              class="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-pink-700/20 dark:focus:ring-pink-600/20 focus:border-pink-700 dark:border-pink-600 transition-all"
            />
          </div>
        </div>

        <FotoceButton
          type="submit"
          variant="primary"
          size="lg"
          block
          :loading="loading"
          :disabled="loading || !passwordValid || password !== confirmPassword"
        >
          {{ t('reset.submit') }}
        </FotoceButton>
      </form>
    </div>
  </div>
</template>
