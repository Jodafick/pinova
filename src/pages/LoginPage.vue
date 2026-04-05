<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const router = useRouter()
const { login } = useAuth()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const showPassword = ref(false)

const handleLogin = async () => {
  error.value = ''
  if (!email.value || !password.value) {
    error.value = 'Veuillez remplir tous les champs.'
    return
  }
  loading.value = true
  await new Promise((r) => setTimeout(r, 600))
  const result = login(email.value, password.value)
  loading.value = false
  if (!result.success) {
    error.value = result.error || 'Erreur de connexion.'
    return
  }
  router.push('/')
}
</script>

<template>
  <div class="min-h-screen flex bg-white">
    <!-- Left side - hero image -->
    <div class="hidden lg:flex lg:w-1/2 relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-br from-red-500/90 via-pink-500/80 to-orange-400/90 z-10"></div>
      <img
        src="https://images.pexels.com/photos/1266808/pexels-photo-1266808.jpeg?auto=compress&cs=tinysrgb&w=1200"
        alt=""
        class="absolute inset-0 w-full h-full object-cover"
      />
      <div class="relative z-20 flex flex-col justify-center px-16 text-white">
        <div class="flex items-center gap-3 mb-8">
          <div class="w-12 h-12 rounded-full bg-white flex items-center justify-center">
            <span class="text-red-600 font-bold text-2xl">P</span>
          </div>
          <span class="text-3xl font-bold">Pinterest</span>
        </div>
        <h1 class="text-5xl font-bold leading-tight mb-4">
          Trouvez vos<br />prochaines idées
        </h1>
        <p class="text-lg text-white/90 max-w-md">
          Explorez des milliards d'idées dans tous les domaines : décoration, recettes, mode, voyages et bien plus encore.
        </p>
        <div class="mt-10 flex gap-6">
          <div class="text-center">
            <p class="text-3xl font-bold">5M+</p>
            <p class="text-sm text-white/80">Pins partagés</p>
          </div>
          <div class="text-center">
            <p class="text-3xl font-bold">100k+</p>
            <p class="text-sm text-white/80">Créateurs</p>
          </div>
          <div class="text-center">
            <p class="text-3xl font-bold">50+</p>
            <p class="text-sm text-white/80">Catégories</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Right side - login form -->
    <div class="flex-1 flex items-center justify-center px-6 py-12">
      <div class="w-full max-w-md">
        <!-- Mobile logo -->
        <div class="lg:hidden flex items-center justify-center gap-2 mb-10">
          <div class="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center">
            <span class="text-white font-bold text-xl">P</span>
          </div>
          <span class="text-2xl font-bold text-neutral-900">Pinterest</span>
        </div>

        <div class="text-center mb-8">
          <h2 class="text-3xl font-bold text-neutral-900 mb-2">Bon retour parmi nous</h2>
          <p class="text-neutral-500">Connectez-vous pour continuer à explorer</p>
        </div>

        <form @submit.prevent="handleLogin" class="space-y-4">
          <div
            v-if="error"
            class="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm"
          >
            <span class="material-symbols-outlined text-lg">error</span>
            {{ error }}
          </div>

          <div>
            <label class="block text-sm font-medium text-neutral-700 mb-1.5">Email</label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 text-lg">mail</span>
              <input
                v-model="email"
                type="email"
                placeholder="votre@email.com"
                class="w-full pl-11 pr-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
                autocomplete="email"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-neutral-700 mb-1.5">Mot de passe</label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 text-lg">lock</span>
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Votre mot de passe"
                class="w-full pl-11 pr-11 py-3 rounded-xl border border-neutral-200 bg-neutral-50 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
                autocomplete="current-password"
              />
              <button
                type="button"
                class="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                @click="showPassword = !showPassword"
              >
                <span class="material-symbols-outlined text-lg">{{ showPassword ? 'visibility_off' : 'visibility' }}</span>
              </button>
            </div>
          </div>

          <div class="flex items-center justify-between text-sm">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" class="w-4 h-4 rounded border-neutral-300 text-red-600 focus:ring-red-500" />
              <span class="text-neutral-600">Se souvenir de moi</span>
            </label>
            <button type="button" class="text-red-600 hover:text-red-700 font-medium">
              Mot de passe oublié ?
            </button>
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full py-3 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 disabled:opacity-60 transition flex items-center justify-center gap-2"
          >
            <svg v-if="loading" class="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {{ loading ? 'Connexion...' : 'Se connecter' }}
          </button>
        </form>

        <div class="my-6 flex items-center gap-3">
          <div class="flex-1 h-px bg-neutral-200"></div>
          <span class="text-xs text-neutral-400 font-medium">OU</span>
          <div class="flex-1 h-px bg-neutral-200"></div>
        </div>

        <div class="space-y-3">
          <button class="w-full py-3 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition flex items-center justify-center gap-3">
            <svg class="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continuer avec Google
          </button>
          <button class="w-full py-3 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition flex items-center justify-center gap-3">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z"/>
            </svg>
            Continuer avec Facebook
          </button>
        </div>

        <p class="mt-8 text-center text-sm text-neutral-500">
          Pas encore de compte ?
          <router-link to="/register" class="text-red-600 hover:text-red-700 font-semibold">
            S'inscrire
          </router-link>
        </p>

        <p class="mt-6 text-center text-xs text-neutral-400 leading-relaxed">
          En continuant, vous acceptez les
          <a href="#" class="underline">Conditions d'utilisation</a> et la
          <a href="#" class="underline">Politique de confidentialité</a> de Pinterest.
        </p>
      </div>
    </div>
  </div>
</template>
