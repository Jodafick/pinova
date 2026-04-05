<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const router = useRouter()
const { register } = useAuth()

const displayName = ref('')
const username = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const loading = ref(false)
const showPassword = ref(false)
const acceptTerms = ref(false)

const passwordStrength = computed(() => {
  const p = password.value
  if (!p) return { score: 0, label: '', color: '' }
  let score = 0
  if (p.length >= 8) score++
  if (/[A-Z]/.test(p)) score++
  if (/[0-9]/.test(p)) score++
  if (/[^A-Za-z0-9]/.test(p)) score++
  const levels = [
    { label: 'Faible', color: 'bg-red-500' },
    { label: 'Moyen', color: 'bg-orange-500' },
    { label: 'Bon', color: 'bg-yellow-500' },
    { label: 'Fort', color: 'bg-green-500' },
  ]
  return { score, ...levels[Math.min(score, levels.length) - 1] }
})

const handleRegister = async () => {
  error.value = ''
  if (!displayName.value || !username.value || !email.value || !password.value) {
    error.value = 'Veuillez remplir tous les champs obligatoires.'
    return
  }
  if (password.value.length < 6) {
    error.value = 'Le mot de passe doit contenir au moins 6 caractères.'
    return
  }
  if (password.value !== confirmPassword.value) {
    error.value = 'Les mots de passe ne correspondent pas.'
    return
  }
  if (!acceptTerms.value) {
    error.value = "Veuillez accepter les conditions d'utilisation."
    return
  }

  loading.value = true
  await new Promise((r) => setTimeout(r, 800))
  const result = register({
    displayName: displayName.value,
    username: username.value,
    email: email.value,
    password: password.value,
  })
  loading.value = false

  if (!result.success) {
    error.value = result.error || "Erreur lors de l'inscription."
    return
  }
  router.push('/')
}
</script>

<template>
  <div class="min-h-screen flex bg-white">
    <!-- Left side - hero -->
    <div class="hidden lg:flex lg:w-1/2 relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-br from-pink-500/90 via-red-500/80 to-rose-600/90 z-10"></div>
      <img
        src="https://images.pexels.com/photos/1070534/pexels-photo-1070534.jpeg?auto=compress&cs=tinysrgb&w=1200"
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
          Rejoignez la<br />communauté
        </h1>
        <p class="text-lg text-white/90 max-w-md">
          Créez un compte gratuit et commencez à sauvegarder, organiser et partager toutes vos inspirations.
        </p>

        <div class="mt-10 grid grid-cols-2 gap-4 max-w-sm">
          <div class="bg-white/15 backdrop-blur-sm rounded-2xl p-4">
            <span class="material-symbols-outlined text-2xl mb-2">bookmark</span>
            <p class="text-sm font-medium">Sauvegardez vos idées favorites</p>
          </div>
          <div class="bg-white/15 backdrop-blur-sm rounded-2xl p-4">
            <span class="material-symbols-outlined text-2xl mb-2">dashboard</span>
            <p class="text-sm font-medium">Organisez en tableaux</p>
          </div>
          <div class="bg-white/15 backdrop-blur-sm rounded-2xl p-4">
            <span class="material-symbols-outlined text-2xl mb-2">share</span>
            <p class="text-sm font-medium">Partagez avec vos proches</p>
          </div>
          <div class="bg-white/15 backdrop-blur-sm rounded-2xl p-4">
            <span class="material-symbols-outlined text-2xl mb-2">explore</span>
            <p class="text-sm font-medium">Explorez des tendances</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Right side - register form -->
    <div class="flex-1 flex items-center justify-center px-6 py-12 overflow-y-auto">
      <div class="w-full max-w-md">
        <div class="lg:hidden flex items-center justify-center gap-2 mb-8">
          <div class="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center">
            <span class="text-white font-bold text-xl">P</span>
          </div>
          <span class="text-2xl font-bold text-neutral-900">Pinterest</span>
        </div>

        <div class="text-center mb-8">
          <h2 class="text-3xl font-bold text-neutral-900 mb-2">Créer un compte</h2>
          <p class="text-neutral-500">Trouvez vos prochaines grandes idées</p>
        </div>

        <form @submit.prevent="handleRegister" class="space-y-4">
          <div
            v-if="error"
            class="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm"
          >
            <span class="material-symbols-outlined text-lg">error</span>
            {{ error }}
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-neutral-700 mb-1.5">Nom complet *</label>
              <input
                v-model="displayName"
                type="text"
                placeholder="Jean Dupont"
                class="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-neutral-700 mb-1.5">Nom d'utilisateur *</label>
              <input
                v-model="username"
                type="text"
                placeholder="jeandupont"
                class="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-neutral-700 mb-1.5">Email *</label>
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
            <label class="block text-sm font-medium text-neutral-700 mb-1.5">Mot de passe *</label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 text-lg">lock</span>
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Minimum 6 caractères"
                class="w-full pl-11 pr-11 py-3 rounded-xl border border-neutral-200 bg-neutral-50 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
                autocomplete="new-password"
              />
              <button
                type="button"
                class="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                @click="showPassword = !showPassword"
              >
                <span class="material-symbols-outlined text-lg">{{ showPassword ? 'visibility_off' : 'visibility' }}</span>
              </button>
            </div>
            <div v-if="password" class="mt-2 flex items-center gap-2">
              <div class="flex-1 h-1.5 rounded-full bg-neutral-200 overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-300"
                  :class="passwordStrength.color"
                  :style="{ width: (passwordStrength.score / 4) * 100 + '%' }"
                ></div>
              </div>
              <span class="text-xs text-neutral-500">{{ passwordStrength.label }}</span>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-neutral-700 mb-1.5">Confirmer le mot de passe *</label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 text-lg">lock</span>
              <input
                v-model="confirmPassword"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Retapez votre mot de passe"
                class="w-full pl-11 pr-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
                autocomplete="new-password"
              />
            </div>
          </div>

          <label class="flex items-start gap-2.5 cursor-pointer">
            <input
              v-model="acceptTerms"
              type="checkbox"
              class="mt-0.5 w-4 h-4 rounded border-neutral-300 text-red-600 focus:ring-red-500"
            />
            <span class="text-xs text-neutral-500 leading-relaxed">
              J'accepte les <a href="#" class="text-red-600 underline">Conditions d'utilisation</a> et la
              <a href="#" class="text-red-600 underline">Politique de confidentialité</a>
            </span>
          </label>

          <button
            type="submit"
            :disabled="loading"
            class="w-full py-3 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 disabled:opacity-60 transition flex items-center justify-center gap-2"
          >
            <svg v-if="loading" class="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {{ loading ? 'Création du compte...' : 'Créer mon compte' }}
          </button>
        </form>

        <p class="mt-8 text-center text-sm text-neutral-500">
          Déjà un compte ?
          <router-link to="/login" class="text-red-600 hover:text-red-700 font-semibold">
            Se connecter
          </router-link>
        </p>
      </div>
    </div>
  </div>
</template>
