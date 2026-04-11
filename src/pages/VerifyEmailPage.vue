<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const error = ref('')
const success = ref(false)

onMounted(async () => {
  const key = route.params.key as string
  try {
    await api.post('auth/registration/verify-email/', { key })
    success.value = true
    setTimeout(() => router.push('/login'), 3000)
  } catch (err: any) {
    console.error('Email verification error:', err)
    error.value = 'Le lien de confirmation est invalide ou a déjà été utilisé.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-neutral-50 px-6 py-12">
    <div class="w-full max-w-md bg-white p-8 sm:p-10 rounded-[40px] shadow-sm border border-neutral-100 text-center">
      <div v-if="loading">
        <div class="w-16 h-16 border-4 border-neutral-100 border-t-pink-600 rounded-full animate-spin mx-auto mb-6"></div>
        <h2 class="text-2xl font-bold text-neutral-900 mb-2">Vérification en cours...</h2>
        <p class="text-neutral-500">Nous confirmons votre adresse email.</p>
      </div>

      <div v-else-if="success" class="animate-fade-in">
        <div class="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-6">
          <span class="material-symbols-outlined text-green-600 text-3xl">verified</span>
        </div>
        <h2 class="text-2xl font-bold text-neutral-900 mb-2">Email confirmé !</h2>
        <p class="text-neutral-500">Merci d'avoir rejoint Pinova. Vous allez être redirigé vers la page de connexion.</p>
        <router-link to="/login" class="inline-block mt-8 px-8 py-3 rounded-full bg-pink-600 text-white font-bold hover:bg-pink-700 transition-all">
          Se connecter maintenant
        </router-link>
      </div>

      <div v-else class="animate-fade-in">
        <div class="w-16 h-16 rounded-full bg-pink-50 flex items-center justify-center mx-auto mb-6">
          <span class="material-symbols-outlined text-pink-600 text-3xl">error_outline</span>
        </div>
        <h2 class="text-2xl font-bold text-neutral-900 mb-2">Oups !</h2>
        <p class="text-neutral-500">{{ error }}</p>
        <router-link to="/login" class="inline-block mt-8 text-neutral-900 font-bold hover:underline">
          Retour à la connexion
        </router-link>
      </div>
    </div>
  </div>
</template>
