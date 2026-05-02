<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from './composables/useAuth'
import { usePins } from './composables/usePins'
import { useI18n } from './i18n'
import GlobalHeader from './components/GlobalHeader.vue'
import { devLog } from './devLog'

const route = useRoute()
const { fetchCurrentUser, isAuthenticated, isInitializing, currentUser } = useAuth()
const { fetchPins } = usePins()
const { t, setLang, currentLang, languages } = useI18n()
// Apply current language on app start (sets html lang/dir attributes).
setLang(currentLang.value)

// Google One Tap Sign-in
// Désactivé à la demande de l'utilisateur
/*
watch(isAuthenticated, (newValue) => {
  if (newValue) {
    // Si l'utilisateur vient de se connecter, on s'assure que One Tap ne s'affiche plus
  }
}, { immediate: true })

useOneTap({
  onSuccess: async (response) => {
    if (isAuthenticated.value) return
    
    console.log('✅ Google One Tap success:', response)
    if (response.credential) {
      const result = await socialLogin('google', response.credential)
      if (result.success) {
        console.log('🎉 Successfully logged in via One Tap!')
      }
    }
  },
  onError: (error) => {
    // Ne pas afficher d'erreur si l'utilisateur a simplement fermé la suggestion
    if (!isAuthenticated.value && error?.type !== 'skipped' && error?.type !== 'dismissed') {
      console.error('❌ Google One Tap error:', error)
    }
  },
  disable_auto_select: false, // Suggest automatically
  auto_select: true, // Auto select if only one account
})
*/

onMounted(async () => {
  devLog('🚀 App mounted, initializing...')
  try {
    await Promise.all([
      fetchCurrentUser(),
      fetchPins()
    ])
    const preferred = currentUser.value?.preferredLanguage
    if (preferred && languages.some((lang) => lang.code === preferred)) {
      setLang(preferred as typeof languages[number]['code'])
    }
    devLog('✅ Initialization complete.')
  } catch (err) {
    console.error('❌ Initialization error:', err)
  }
})

const isAuthPage = computed(() => {
  return route.meta.guest === true
})
</script>

<template>
  <div class="min-h-screen flex flex-col bg-neutral-50 text-neutral-900">
    <!-- Full screen loading while initializing -->
    <div v-if="isInitializing" class="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center">
      <div class="w-12 h-12 rounded-full border-4 border-pink-100 border-t-pink-600 animate-spin mb-4"></div>
      <p class="text-neutral-500 font-medium">{{ t('app.loading') }}</p>
    </div>

    <GlobalHeader v-if="!isAuthPage && !isInitializing" />

    <main class="flex-1" v-if="!isInitializing">
      <router-view />
    </main>

    <!-- Footer -->
    <footer v-if="isAuthenticated && !isAuthPage && !isInitializing" class="border-t border-neutral-100 bg-white py-6 px-6 sm:px-10">
      <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded-full bg-pink-600 flex items-center justify-center overflow-hidden">
            <img src="./assets/logo.png" alt="Logo" class="w-full h-full object-cover" />
          </div>
          <span class="text-sm font-semibold text-neutral-700">Pinova</span>
        </div>

        <nav class="flex items-center gap-5 text-xs text-neutral-500">
          <router-link to="/" class="hover:text-neutral-700 transition">{{ t('nav.home') }}</router-link>
          <router-link to="/explore" class="hover:text-neutral-700 transition">{{ t('nav.explore') }}</router-link>
          <router-link to="/profile" class="hover:text-neutral-700 transition">{{ t('nav.profile') }}</router-link>
          <router-link to="/settings" class="hover:text-neutral-700 transition">{{ t('nav.settings') }}</router-link>
        </nav>

        <p class="text-xs text-neutral-400">
          {{ t('app.copyright') }}
        </p>
      </div>
    </footer>
  </div>
</template>
