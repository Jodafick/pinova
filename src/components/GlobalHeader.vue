<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { usePins } from '../composables/usePins'

const route = useRoute()
const router = useRouter()
const { currentUser, isAuthenticated, logout } = useAuth()
const { searchPins } = usePins()

const searchQuery = ref('')
const showUserMenu = ref(false)
const showNotifications = ref(false)
const showSearchResults = ref(false)

const searchResults = computed(() => {
  if (!searchQuery.value.trim()) return []
  return searchPins(searchQuery.value).slice(0, 5)
})

const currentRoute = computed(() => route.name as string)

const userInitials = computed(() => {
  if (!currentUser.value) return '?'
  const parts = currentUser.value.displayName.split(' ')
  return parts.map((p) => p[0]).join('').toUpperCase().slice(0, 2)
})

const navItems = [
  { name: 'home', label: 'Accueil', to: '/' },
  { name: 'explore', label: 'Explorer', to: '/explore' },
  { name: 'create', label: 'Créer', to: '/create' },
]

const notifications = [
  { id: 1, text: 'Clara a enregistré votre pin', time: 'Il y a 2h', read: false, icon: 'bookmark' },
  { id: 2, text: 'Nouveau dans Tendances : Voyages', time: 'Il y a 5h', read: false, icon: 'trending_up' },
  { id: 3, text: 'Léo vous suit maintenant', time: 'Hier', read: true, icon: 'person_add' },
  { id: 4, text: '5 nouvelles idées pour vous', time: 'Il y a 2 jours', read: true, icon: 'lightbulb' },
]

const handleSearch = () => {
  if (searchQuery.value.trim()) {
    showSearchResults.value = false
    router.push('/')
  }
}

const handleLogout = () => {
  showUserMenu.value = false
  logout()
  router.push('/login')
}

const closeDropdowns = () => {
  showUserMenu.value = false
  showNotifications.value = false
  showSearchResults.value = false
}
</script>

<template>
  <header
    class="flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-2 border-b border-neutral-100 bg-white/95 backdrop-blur-md sticky top-0 z-30"
    v-if="isAuthenticated"
  >
    <!-- Click overlay to close dropdowns -->
    <div
      v-if="showUserMenu || showNotifications || showSearchResults"
      class="fixed inset-0 z-20"
      @click="closeDropdowns"
    ></div>

    <!-- Logo -->
    <router-link
      to="/"
      class="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-red-600 text-white hover:bg-red-700 transition shrink-0"
      aria-label="Accueil Pinterest"
    >
      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
      </svg>
    </router-link>

    <!-- Navigation -->
    <nav class="hidden md:flex items-center gap-0.5 ml-1">
      <router-link
        v-for="item in navItems"
        :key="item.name"
        :to="item.to"
        class="px-4 py-2 rounded-full text-sm font-semibold transition-colors"
        :class="currentRoute === item.name
          ? 'bg-neutral-900 text-white'
          : 'text-neutral-700 hover:bg-neutral-100'"
      >
        {{ item.label }}
      </router-link>
    </nav>

    <!-- Search bar -->
    <div class="flex-1 relative min-w-0 z-30">
      <div
        class="flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-all"
        :class="showSearchResults
          ? 'bg-white ring-2 ring-red-500 shadow-lg'
          : 'bg-neutral-100 focus-within:bg-white focus-within:ring-2 focus-within:ring-red-500 focus-within:shadow-lg'"
      >
        <span class="material-symbols-outlined text-lg text-neutral-400">search</span>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Rechercher des idées, des inspirations..."
          class="bg-transparent outline-none flex-1 text-sm"
          @focus="showSearchResults = true"
          @keyup.enter="handleSearch"
        />
        <button
          v-if="searchQuery"
          class="w-6 h-6 rounded-full hover:bg-neutral-100 flex items-center justify-center"
          @click="searchQuery = ''"
        >
          <span class="material-symbols-outlined text-sm text-neutral-400">close</span>
        </button>
      </div>

      <!-- Search dropdown -->
      <div
        v-if="showSearchResults && searchResults.length > 0"
        class="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-neutral-100 overflow-hidden"
      >
        <div class="p-2">
          <p class="px-3 py-1.5 text-xs font-medium text-neutral-400">Résultats</p>
          <router-link
            v-for="pin in searchResults"
            :key="pin.id"
            :to="`/pin/${pin.id}`"
            class="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-neutral-50 transition"
            @click="showSearchResults = false"
          >
            <img :src="pin.imageUrl" :alt="pin.title" class="w-10 h-10 rounded-lg object-cover" />
            <div class="min-w-0">
              <p class="text-sm font-medium text-neutral-800 truncate">{{ pin.title }}</p>
              <p class="text-xs text-neutral-400">{{ pin.topic }}</p>
            </div>
          </router-link>
        </div>
      </div>
    </div>

    <!-- Right icons -->
    <div class="flex items-center gap-0.5 sm:gap-1 shrink-0">
      <!-- Notifications -->
      <div class="relative z-30">
        <button
          class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-neutral-100 text-neutral-600 transition relative"
          @click.stop="showNotifications = !showNotifications; showUserMenu = false"
        >
          <span class="material-symbols-outlined text-xl">notifications</span>
          <span class="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
        </button>

        <!-- Notifications dropdown -->
        <div
          v-if="showNotifications"
          class="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-neutral-100 overflow-hidden"
        >
          <div class="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
            <h3 class="font-semibold text-neutral-900">Notifications</h3>
            <button class="text-xs text-red-600 font-medium hover:underline">Tout marquer comme lu</button>
          </div>
          <div class="max-h-80 overflow-y-auto">
            <div
              v-for="notif in notifications"
              :key="notif.id"
              class="flex items-start gap-3 px-4 py-3 hover:bg-neutral-50 transition cursor-pointer"
              :class="!notif.read ? 'bg-red-50/40' : ''"
            >
              <div class="w-9 h-9 rounded-full bg-neutral-100 flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-lg text-neutral-500">{{ notif.icon }}</span>
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm text-neutral-700">{{ notif.text }}</p>
                <p class="text-xs text-neutral-400 mt-0.5">{{ notif.time }}</p>
              </div>
              <div v-if="!notif.read" class="w-2 h-2 rounded-full bg-red-500 mt-2 shrink-0"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Messages -->
      <button
        class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-neutral-100 text-neutral-600 transition"
        @click="router.push('/')"
      >
        <span class="material-symbols-outlined text-xl">chat_bubble_outline</span>
      </button>

      <!-- User menu -->
      <div class="relative z-30">
        <button
          class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-neutral-100 transition"
          @click.stop="showUserMenu = !showUserMenu; showNotifications = false"
        >
          <div
            class="w-8 h-8 flex items-center justify-center rounded-full text-white text-xs font-bold"
            :class="currentUser?.avatarColor || 'bg-neutral-800'"
          >
            {{ userInitials }}
          </div>
        </button>

        <!-- User dropdown -->
        <div
          v-if="showUserMenu"
          class="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-neutral-100 overflow-hidden"
        >
          <!-- User info -->
          <div class="px-4 py-4 border-b border-neutral-100">
            <p class="font-semibold text-neutral-900 text-sm">{{ currentUser?.displayName }}</p>
            <p class="text-xs text-neutral-500">@{{ currentUser?.username }}</p>
            <p class="text-xs text-neutral-400 mt-0.5">{{ currentUser?.email }}</p>
          </div>

          <div class="py-1">
            <router-link
              to="/profile"
              class="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 transition text-sm text-neutral-700"
              @click="showUserMenu = false"
            >
              <span class="material-symbols-outlined text-lg">person</span>
              Mon profil
            </router-link>
            <router-link
              to="/create"
              class="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 transition text-sm text-neutral-700 md:hidden"
              @click="showUserMenu = false"
            >
              <span class="material-symbols-outlined text-lg">add_circle</span>
              Créer un pin
            </router-link>
            <router-link
              to="/explore"
              class="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 transition text-sm text-neutral-700 md:hidden"
              @click="showUserMenu = false"
            >
              <span class="material-symbols-outlined text-lg">explore</span>
              Explorer
            </router-link>
            <router-link
              to="/settings"
              class="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 transition text-sm text-neutral-700"
              @click="showUserMenu = false"
            >
              <span class="material-symbols-outlined text-lg">settings</span>
              Paramètres
            </router-link>
          </div>

          <div class="border-t border-neutral-100 py-1">
            <button
              class="flex items-center gap-3 px-4 py-2.5 w-full hover:bg-neutral-50 transition text-sm text-red-600"
              @click="handleLogout"
            >
              <span class="material-symbols-outlined text-lg">logout</span>
              Se déconnecter
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
