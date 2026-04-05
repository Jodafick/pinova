<script setup lang="ts">
import { useAuth } from '../composables/useAuth'

const { isAuthenticated } = useAuth()
</script>

<template>
  <div class="min-h-[70vh] flex flex-col items-center justify-center text-center px-6">
    <div class="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center mb-6">
      <span class="material-symbols-outlined text-5xl text-red-400">explore_off</span>
    </div>
    <h1 class="text-4xl font-bold text-neutral-900 mb-3">404</h1>
    <h2 class="text-xl font-semibold text-neutral-700 mb-2">Page introuvable</h2>
    <p class="text-neutral-500 max-w-md mb-8">
      Oups ! La page que vous cherchez n'existe pas ou a été déplacée.
    </p>
    <div class="flex items-center gap-3">
      <router-link
        :to="isAuthenticated ? '/' : '/login'"
        class="px-6 py-3 rounded-full bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition"
      >
        Retour à l'accueil
      </router-link>
      <router-link
        v-if="isAuthenticated"
        to="/explore"
        class="px-6 py-3 rounded-full bg-neutral-100 text-neutral-800 font-semibold text-sm hover:bg-neutral-200 transition"
      >
        Explorer
      </router-link>
    </div>
  </div>
</template>
