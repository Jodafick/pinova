<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { usePins } from '../composables/usePins'
import api from '../api'

const route = useRoute()
const router = useRouter()
const { currentUser, isAuthenticated, logout } = useAuth()
const { pins } = usePins()

const searchQuery = ref('')
const showUserMenu = ref(false)
const showNotifications = ref(false)
const showSearchResults = ref(false)
const isOffline = ref(!navigator.onLine)

window.addEventListener('online', () => (isOffline.value = false))
window.addEventListener('offline', () => (isOffline.value = true))

const searchResults = computed(() => {
  if (!searchQuery.value.trim()) return []
  const q = searchQuery.value.toLowerCase()
  return pins.value.filter(p => p.title.toLowerCase().includes(q)).slice(0, 5)
})

const currentRoute = computed(() => route.name as string)

const userInitials = computed(() => {
  if (!currentUser.value) return '?'
  const name = currentUser.value.displayName || currentUser.value.username
  return name.slice(0, 2).toUpperCase()
})

const navItems = [
  { name: 'home', label: 'Accueil', to: '/' },
  { name: 'explore', label: 'Explorer', to: '/explore' },
  { name: 'create', label: 'Créer', to: '/create' },
]

const notifications = ref<any[]>([])

const fetchNotifications = async () => {
  if (!isAuthenticated.value) return
  try {
    const response = await api.get('notifications/')
    notifications.value = response.data.results || response.data
  } catch (err) {
    console.error('Error fetching notifications:', err)
  }
}

const markAllAsRead = async () => {
  try {
    await api.post('notifications/mark_all_as_read/')
    notifications.value.forEach(n => n.is_read = true)
  } catch (err) {
    console.error('Error marking all as read:', err)
  }
}

const handleNotificationClick = async (notification: any) => {
  if (!notification.is_read) {
    try {
      await api.post(`notifications/${notification.id}/mark_as_read/`)
      notification.is_read = true
    } catch (err) {
      console.error('Error marking notification as read:', err)
    }
  }
  if (notification.pin_id) {
    router.push(`/pin/${notification.pin_id}`)
  }
  closeDropdowns()
}

onMounted(() => {
  fetchNotifications()
})

const handleSearch = () => {
  if (searchQuery.value.trim()) {
    showSearchResults.value = false
    router.push('/')
  }
}

const handleLogout = () => {
  closeDropdowns()
  logout()
  router.push('/')
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
      class="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-pink-600 text-white hover:bg-pink-700 transition shrink-0 overflow-hidden"
      aria-label="Accueil Pinova"
    >
      <img src="../assets/logo.png" alt="Logo" class="w-full h-full object-cover" />
    </router-link>

    <!-- Navigation -->
    <nav class="hidden md:flex items-center gap-0.5 ml-1">
      <router-link
        v-for="item in navItems"
        :key="item.name"
        :to="item.to"
        class="px-4 py-2 rounded-full text-sm font-semibold transition-colors relative"
        :class="currentRoute === item.name
          ? 'bg-neutral-900 text-white'
          : 'text-neutral-700 hover:bg-neutral-100'"
      >
        {{ item.label }}
      </router-link>
      
      <!-- Offline Badge -->
      <div 
        v-if="isOffline"
        class="ml-4 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center gap-1 animate-pulse"
      >
        <span class="material-symbols-outlined text-sm">cloud_off</span>
        MODE HORS LIGNE
      </div>
    </nav>

    <!-- Search bar -->
    <div class="flex-1 relative min-w-0 z-30">
      <div
        class="flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-all overflow-hidden"
        :class="showSearchResults
          ? 'bg-white ring-2 ring-pink-500 shadow-lg'
          : 'bg-neutral-100 focus-within:bg-white focus-within:ring-2 focus-within:ring-pink-500 focus-within:shadow-lg'"
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

    <!-- Right icons / Actions -->
    <div class="flex items-center gap-0.5 sm:gap-1 shrink-0">
      <template v-if="isAuthenticated">
        <!-- Notifications -->
        <div class="relative z-30">
          <button
            class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-neutral-100 text-neutral-600 transition relative"
            @click.stop="showNotifications = !showNotifications; showUserMenu = false"
          >
            <span class="material-symbols-outlined text-xl">notifications</span>
            <span v-if="notifications.some(n => !n.is_read)" class="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-pink-500 rounded-full border-2 border-white"></span>
          </button>

          <!-- Notifications dropdown -->
          <div
            v-if="showNotifications"
            class="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-neutral-100 overflow-hidden"
          >
            <div class="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
              <h3 class="font-semibold text-neutral-900">Notifications</h3>
              <button
                v-if="notifications.some(n => !n.is_read)"
                class="text-xs text-pink-600 font-medium hover:underline"
                @click="markAllAsRead"
              >
                Tout marquer comme lu
              </button>
            </div>
            <div class="max-h-80 overflow-y-auto">
              <div v-if="notifications.length === 0" class="p-8 text-center text-neutral-400">
                <span class="material-symbols-outlined text-4xl mb-2">notifications_off</span>
                <p class="text-sm">Aucune notification</p>
              </div>
              <div
                v-for="notification in notifications"
                :key="notification.id"
                class="p-4 hover:bg-neutral-50 transition flex items-start gap-3 border-b border-neutral-50 last:border-0 cursor-pointer"
                :class="{ 'bg-blue-50/30': !notification.is_read }"
                @click="handleNotificationClick(notification)"
              >
                <div class="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center shrink-0">
                  <span class="material-symbols-outlined text-neutral-600">
                    {{ 
                      notification.notification_type === 'follow' ? 'person_add' : 
                      notification.notification_type === 'welcome' ? 'celebration' : 
                      'bookmark' 
                    }}
                  </span>
                </div>
                <div class="flex-1">
                  <p class="text-sm text-neutral-800 leading-snug">{{ notification.message }}</p>
                  <p class="text-xs text-neutral-400 mt-1">@{{ notification.sender_username }}</p>
                </div>
                <div v-if="!notification.is_read" class="w-2 h-2 rounded-full bg-pink-600 mt-2"></div>
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
              class="w-8 h-8 flex items-center justify-center rounded-full text-white text-xs font-bold overflow-hidden avatar-shadow"
              :class="currentUser?.avatarColor || 'bg-neutral-800'"
            >
              <img v-if="currentUser?.avatarUrl" :src="currentUser.avatarUrl" class="w-full h-full object-cover rounded-full" />
              <span v-else class="avatar-text">{{ userInitials }}</span>
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
                :to="`/profile/${currentUser?.username}`"
                class="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 transition text-sm text-neutral-700"
                @click="closeDropdowns"
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
                class="flex items-center gap-3 px-4 py-2.5 w-full hover:bg-neutral-50 transition text-sm text-pink-600"
                @click="handleLogout"
              >
                <span class="material-symbols-outlined text-lg">logout</span>
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      </template>
      
      <template v-else>
        <div class="flex items-center gap-2">
          <router-link
            to="/login"
            class="px-4 py-2 rounded-full text-sm font-semibold text-neutral-700 hover:bg-neutral-100 transition"
          >
            Connexion
          </router-link>
          <router-link
            to="/register"
            class="px-4 py-2 rounded-full bg-pink-600 text-white text-sm font-semibold hover:bg-pink-700 transition"
          >
            S'inscrire
          </router-link>
        </div>
      </template>
    </div>
  </header>
</template>
