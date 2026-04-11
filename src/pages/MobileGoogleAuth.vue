<script setup lang="ts">
import { ref, onMounted } from 'vue'

const loading = ref(false)
const error = ref('')

onMounted(() => {
  // Sauvegarde de l'URL de redirection mobile si présente dans les paramètres
  const urlParams = new URLSearchParams(window.location.search)
  const redirectTo = urlParams.get('redirect_to')
  if (redirectTo) {
    sessionStorage.setItem('mobile_redirect_url', redirectTo)
  }

  // Check if we are returning from Google OAuth redirect
  const hash = window.location.hash
  if (hash) {
      const params = new URLSearchParams(hash.substring(1))
      const accessToken = params.get('access_token')
      if (accessToken) {
        loading.value = true
        
        // Récupération de l'URL de redirection (Expo Go ou Schéma personnalisé)
        const savedRedirectUrl = sessionStorage.getItem('mobile_redirect_url')
        let redirectUrl = ''
        
        if (savedRedirectUrl) {
          // Si on a une URL d'Expo (ex: exp://192.168.../--/login-success)
          // On ajoute le token Google à cette URL
          const separator = savedRedirectUrl.includes('?') ? '&' : '?'
          redirectUrl = `${savedRedirectUrl}${separator}google_token=${accessToken}`
        } else {
          // Fallback sur le schéma par défaut pour les builds de production
          redirectUrl = `pinova://login-success?google_token=${accessToken}`
        }

        window.location.href = redirectUrl
        
        // Message de secours si la redirection ne se lance pas
        setTimeout(() => {
          loading.value = false
          error.value = "Si l'application ne s'ouvre pas, assurez-vous qu'elle est installée."
        }, 4000)
      }
    }
})

const handleGoogleClick = () => {
  loading.value = true
  // Google OAuth URL for Implicit Flow (Redirect)
  const clientId = '274683910451-u52eib3lr7t5qehu23bhnafn85ovaub3.apps.googleusercontent.com'
  const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname)
  const scope = encodeURIComponent('email profile openid')
  const responseType = 'token'
  
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=${responseType}&scope=${scope}`
  
  window.location.href = googleAuthUrl
}
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-white p-6 text-center">
    <!-- Logo Pinova -->
    <div class="mb-10 flex flex-col items-center">
      <div class="w-20 h-20 rounded-full bg-pink-600 flex items-center justify-center overflow-hidden shadow-lg mb-4">
        <img src="../assets/logo.png" alt="Logo" class="w-full h-full object-cover" />
      </div>
      <span class="text-3xl font-bold text-neutral-900 tracking-tight">Pinova Mobile</span>
    </div>

    <div v-if="!loading" class="w-full max-w-sm">
      <h1 class="text-2xl font-bold text-neutral-800 mb-2">Connexion Google</h1>
      <p class="text-neutral-500 mb-8 px-4">Connectez-vous pour synchroniser vos idées avec votre application mobile.</p>
      
      <button 
        @click="handleGoogleClick"
        class="w-full flex items-center justify-center gap-3 py-4 px-6 bg-white border-2 border-neutral-200 rounded-2xl text-neutral-700 font-bold text-lg hover:bg-neutral-50 transition-all shadow-sm active:scale-95"
      >
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" class="w-6 h-6" />
        Continuer avec Google
      </button>

      <div v-if="error" class="mt-6 p-4 bg-pink-50 border border-pink-100 rounded-xl text-pink-600 text-sm">
        {{ error }}
      </div>
    </div>

    <div v-else class="flex flex-col items-center">
      <div class="w-12 h-12 border-4 border-pink-200 border-t-pink-600 rounded-full animate-spin mb-4"></div>
      <h1 class="text-xl font-bold text-neutral-800">Redirection...</h1>
      <p class="text-neutral-500 mt-2">Veuillez patienter pendant que nous vous renvoyons vers l'application.</p>
    </div>
  </div>
</template>
