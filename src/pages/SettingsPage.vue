<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const router = useRouter()
const { currentUser, updateProfile, logout } = useAuth()

const displayName = ref('')
const username = ref('')
const bio = ref('')
const email = ref('')
const oldPassword = ref('')
const newPassword = ref('')
const confirmNewPassword = ref('')
const avatarFile = ref<File | null>(null)
const avatarPreview = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const saved = ref(false)
const saving = ref(false)
const passwordChanging = ref(false)
const passwordSaved = ref(false)
const passwordError = ref('')

onMounted(() => {
  if (currentUser.value) {
    displayName.value = currentUser.value.displayName
    username.value = currentUser.value.username
    bio.value = currentUser.value.bio
    email.value = currentUser.value.email
    avatarPreview.value = currentUser.value.avatarUrl || null
  }
})

const handleFileChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) {
    avatarFile.value = file
    avatarPreview.value = URL.createObjectURL(file)
  }
}

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleSave = async () => {
  saving.value = true
  try {
    await updateProfile({
      displayName: displayName.value,
      bio: bio.value,
      email: email.value,
      avatar: avatarFile.value || undefined
    })
    saved.value = true
    setTimeout(() => (saved.value = false), 3000)
  } catch (err) {
    console.error('Failed to update profile:', err)
  } finally {
    saving.value = false
  }
}

const handlePasswordChange = async () => {
  passwordError.value = ''
  if (newPassword.value !== confirmNewPassword.value) {
    passwordError.value = 'Les nouveaux mots de passe ne correspondent pas.'
    return
  }
  
  passwordChanging.value = true
  try {
    // dj-rest-auth provides auth/password/change/
    const api = (await import('../api')).default
    await api.post('auth/password/change/', {
      old_password: oldPassword.value,
      new_password1: newPassword.value,
      new_password2: confirmNewPassword.value
    })
    passwordSaved.value = true
    oldPassword.value = ''
    newPassword.value = ''
    confirmNewPassword.value = ''
    setTimeout(() => (passwordSaved.value = false), 3000)
  } catch (err: any) {
    console.error('Failed to change password:', err)
    passwordError.value = err.response?.data?.non_field_errors?.[0] || 'Erreur lors du changement de mot de passe.'
  } finally {
    passwordChanging.value = false
  }
}

const handleLogout = () => {
  logout()
  router.push('/login')
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
    <h1 class="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">Paramètres</h1>
    <p class="text-sm text-neutral-500 mb-8">Gérez votre profil et vos préférences</p>

    <!-- Success message -->
    <div
      v-if="saved"
      class="mb-6 flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm"
    >
      <span class="material-symbols-outlined text-lg">check_circle</span>
      Profil mis à jour avec succès !
    </div>

    <div class="space-y-8">
      <!-- Profile section -->
      <section class="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
        <div class="px-6 py-5 border-b border-neutral-100">
          <h2 class="text-lg font-semibold text-neutral-900">Profil public</h2>
          <p class="text-xs text-neutral-500 mt-0.5">Ces informations sont visibles par les autres utilisateurs</p>
        </div>

        <div class="p-6 space-y-5">
          <!-- Avatar -->
          <div class="flex items-center gap-5">
            <div
              v-if="currentUser"
              class="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white shrink-0 overflow-hidden"
              :class="currentUser.avatarColor"
            >
              <img v-if="avatarPreview" :src="avatarPreview" class="w-full h-full object-cover" />
              <span v-else>{{ displayName[0] || '?' }}</span>
            </div>
            <div>
              <input 
                ref="fileInput"
                type="file" 
                accept="image/*" 
                class="hidden" 
                @change="handleFileChange" 
              />
              <button 
                class="px-4 py-2 rounded-full bg-neutral-100 text-sm font-medium text-neutral-700 hover:bg-neutral-200 transition"
                @click="triggerFileInput"
              >
                Changer la photo
              </button>
              <p class="text-xs text-neutral-400 mt-1">JPG, PNG — max 5 Mo</p>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label class="block text-sm font-medium text-neutral-700 mb-1.5">Nom complet</label>
              <input
                v-model="displayName"
                type="text"
                class="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-neutral-700 mb-1.5">Nom d'utilisateur</label>
              <div class="relative">
                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">@</span>
                <input
                  v-model="username"
                  type="text"
                  class="w-full pl-8 pr-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition"
                />
              </div>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-neutral-700 mb-1.5">Bio</label>
            <textarea
              v-model="bio"
              rows="3"
              placeholder="Parlez un peu de vous..."
              class="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition resize-none placeholder:text-neutral-400"
            />
            <p class="text-xs text-neutral-400 mt-1">{{ bio.length }}/200 caractères</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-neutral-700 mb-1.5">Email</label>
            <input
              v-model="email"
              type="email"
              class="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition"
            />
          </div>

          <div class="flex justify-end">
            <button
              class="px-6 py-2.5 rounded-full bg-pink-600 text-white text-sm font-semibold hover:bg-pink-700 disabled:opacity-50 transition flex items-center gap-2"
              :disabled="saving"
              @click="handleSave"
            >
              <svg v-if="saving" class="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {{ saving ? 'Enregistrement...' : 'Enregistrer les modifications' }}
            </button>
          </div>
        </div>
      </section>

      <!-- Notifications preferences -->
      <section class="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
        <div class="px-6 py-5 border-b border-neutral-100">
          <h2 class="text-lg font-semibold text-neutral-900">Notifications</h2>
          <p class="text-xs text-neutral-500 mt-0.5">Choisissez les notifications que vous souhaitez recevoir</p>
        </div>
        <div class="p-6 space-y-4">
          <label class="flex items-center justify-between py-2 cursor-pointer">
            <div>
              <p class="text-sm font-medium text-neutral-700">Nouveaux abonnés</p>
              <p class="text-xs text-neutral-500">Recevez une notification quand quelqu'un vous suit</p>
            </div>
            <div class="relative">
              <input type="checkbox" checked class="sr-only peer" />
              <div class="w-11 h-6 bg-neutral-200 peer-checked:bg-pink-500 rounded-full transition-colors"></div>
              <div class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
            </div>
          </label>
          <label class="flex items-center justify-between py-2 cursor-pointer">
            <div>
              <p class="text-sm font-medium text-neutral-700">Pins enregistrés</p>
              <p class="text-xs text-neutral-500">Quand quelqu'un enregistre un de vos pins</p>
            </div>
            <div class="relative">
              <input type="checkbox" checked class="sr-only peer" />
              <div class="w-11 h-6 bg-neutral-200 peer-checked:bg-pink-500 rounded-full transition-colors"></div>
              <div class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
            </div>
          </label>
          <label class="flex items-center justify-between py-2 cursor-pointer">
            <div>
              <p class="text-sm font-medium text-neutral-700">Recommandations</p>
              <p class="text-xs text-neutral-500">Idées personnalisées basées sur vos intérêts</p>
            </div>
            <div class="relative">
              <input type="checkbox" class="sr-only peer" />
              <div class="w-11 h-6 bg-neutral-200 peer-checked:bg-pink-500 rounded-full transition-colors"></div>
              <div class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
            </div>
          </label>
        </div>
      </section>

      <!-- Privacy -->
      <section class="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
        <div class="px-6 py-5 border-b border-neutral-100">
          <h2 class="text-lg font-semibold text-neutral-900">Confidentialité</h2>
        </div>
        <div class="p-6 space-y-4">
          <label class="flex items-center justify-between py-2 cursor-pointer">
            <div>
              <p class="text-sm font-medium text-neutral-700">Profil privé</p>
              <p class="text-xs text-neutral-500">Seuls vos abonnés pourront voir vos pins</p>
            </div>
            <div class="relative">
              <input type="checkbox" class="sr-only peer" />
              <div class="w-11 h-6 bg-neutral-200 peer-checked:bg-pink-500 rounded-full transition-colors"></div>
              <div class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
            </div>
          </label>
          <label class="flex items-center justify-between py-2 cursor-pointer">
            <div>
              <p class="text-sm font-medium text-neutral-700">Résultats de recherche</p>
              <p class="text-xs text-neutral-500">Apparaître dans les résultats de recherche</p>
            </div>
            <div class="relative">
              <input type="checkbox" checked class="sr-only peer" />
              <div class="w-11 h-6 bg-neutral-200 peer-checked:bg-pink-500 rounded-full transition-colors"></div>
              <div class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
            </div>
          </label>
        </div>
      </section>

      <!-- Password section -->
      <section class="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
        <div class="px-6 py-5 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-neutral-900">Mot de passe</h2>
            <p class="text-xs text-neutral-500 mt-0.5">Modifiez votre mot de passe pour sécuriser votre compte</p>
          </div>
          <div v-if="passwordSaved" class="text-green-600 flex items-center gap-1 text-xs font-bold animate-fade-in">
            <span class="material-symbols-outlined text-sm">check_circle</span>
            Enregistré
          </div>
        </div>

        <div class="p-6 space-y-5">
          <div v-if="passwordError" class="px-4 py-3 rounded-xl bg-pink-50 border border-pink-100 text-pink-600 text-xs">
            {{ passwordError }}
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label class="block text-sm font-medium text-neutral-700 mb-1.5">Mot de passe actuel</label>
              <input
                v-model="oldPassword"
                type="password"
                placeholder="••••••••"
                class="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-neutral-700 mb-1.5">Nouveau mot de passe</label>
              <input
                v-model="newPassword"
                type="password"
                placeholder="••••••••"
                class="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-neutral-700 mb-1.5">Confirmer</label>
              <input
                v-model="confirmNewPassword"
                type="password"
                placeholder="••••••••"
                class="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition"
              />
            </div>
          </div>

          <div class="flex justify-end">
            <button
              class="px-6 py-2.5 rounded-full bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-800 disabled:opacity-50 transition flex items-center gap-2"
              :disabled="passwordChanging || !oldPassword || !newPassword"
              @click="handlePasswordChange"
            >
              <svg v-if="passwordChanging" class="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {{ passwordChanging ? 'Mise à jour...' : 'Modifier le mot de passe' }}
            </button>
          </div>
        </div>
      </section>

      <!-- Danger zone -->
      <section class="bg-white rounded-2xl border border-pink-100 shadow-sm overflow-hidden">
        <div class="px-6 py-5 border-b border-pink-100">
          <h2 class="text-lg font-semibold text-pink-600">Zone de danger</h2>
        </div>
        <div class="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p class="text-sm font-medium text-neutral-700">Déconnexion</p>
            <p class="text-xs text-neutral-500">Vous serez redirigé vers la page de connexion</p>
          </div>
          <button
            class="px-5 py-2.5 rounded-full border border-pink-200 text-pink-600 text-sm font-semibold hover:bg-pink-50 transition"
            @click="handleLogout"
          >
            Se déconnecter
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
