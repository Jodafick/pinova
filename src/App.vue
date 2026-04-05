<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from './composables/useAuth'
import GlobalHeader from './components/GlobalHeader.vue'

const route = useRoute()
const { isAuthenticated } = useAuth()

const isAuthPage = computed(() => {
  return route.name === 'login' || route.name === 'register'
})
</script>

<template>
  <div class="min-h-screen flex flex-col bg-neutral-50 text-neutral-900">
    <GlobalHeader v-if="!isAuthPage" />

    <main class="flex-1">
      <router-view v-slot="{ Component }">
        <transition name="page" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <!-- Footer -->
    <footer v-if="isAuthenticated && !isAuthPage" class="border-t border-neutral-100 bg-white py-6 px-6 sm:px-10">
      <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center">
            <svg class="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
            </svg>
          </div>
          <span class="text-sm font-semibold text-neutral-700">Pinterest Clone</span>
        </div>

        <nav class="flex items-center gap-5 text-xs text-neutral-500">
          <router-link to="/" class="hover:text-neutral-700 transition">Accueil</router-link>
          <router-link to="/explore" class="hover:text-neutral-700 transition">Explorer</router-link>
          <router-link to="/profile" class="hover:text-neutral-700 transition">Profil</router-link>
          <router-link to="/settings" class="hover:text-neutral-700 transition">Paramètres</router-link>
        </nav>

        <p class="text-xs text-neutral-400">
          &copy; 2026 Pinterest Clone. Tous droits réservés.
        </p>
      </div>
    </footer>
  </div>
</template>

<style>
.page-enter-active,
.page-leave-active {
  transition: opacity 0.15s ease;
}
.page-enter-from,
.page-leave-to {
  opacity: 0;
}
</style>
