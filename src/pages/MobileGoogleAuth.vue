<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useTokenClient } from 'vue3-google-signin'

const { socialLogin } = useAuth()
const loading = ref(true)
const error = ref('')

const { login: googleLogin } = useTokenClient({
  onSuccess: async (response) => {
    loading.value = true
    try {
      const result = await socialLogin('google', response.access_token)
      if (result.success && result.access) {
        // Redirection vers une URL que la WebView mobile peut intercepter
        const redirectUrl = `https://${window.location.host}/login-success?access=${result.access}${result.refresh ? `&refresh=${result.refresh}` : ''}`
        window.location.href = redirectUrl
      } else {
        error.value = result.error || 'Erreur de connexion avec Google.'
        loading.value = false
      }
    } catch (err) {
      error.value = 'Une erreur est survenue lors de la communication avec le serveur.'
      loading.value = false
    }
  },
  onError: () => {
    error.value = 'Erreur lors de la connexion avec Google.'
    loading.value = false
  }
})

onMounted(() => {
  // Déclenche automatiquement le flux Google
  googleLogin()
})
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-white p-6 text-center">
    <div v-if="loading" class="flex flex-col items-center">
      <div class="w-12 h-12 border-4 border-pink-200 border-t-pink-600 rounded-full animate-spin mb-4"></div>
      <h1 class="text-xl font-bold text-neutral-800">Connexion Google en cours...</h1>
      <p class="text-neutral-500 mt-2">Veuillez patienter pendant que nous vous connectons à Pinova.</p>
    </div>

    <div v-else-if="error" class="max-w-md">
      <div class="w-16 h-16 bg-pink-50 text-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
        <span class="material-symbols-outlined text-3xl">error</span>
      </div>
      <h1 class="text-xl font-bold text-neutral-800">Erreur de connexion</h1>
      <p class="text-neutral-500 mt-2 mb-6">{{ error }}</p>
      <button 
        @click="() => googleLogin()"
        class="w-full py-3 bg-pink-600 text-white font-bold rounded-xl hover:bg-pink-700 transition-colors"
      >
        Réessayer
      </button>
    </div>
  </div>
</template>
