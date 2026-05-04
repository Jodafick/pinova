<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth, DEFAULT_AVATAR_COLOR_CLASS } from '../composables/useAuth'
import { usePins } from '../composables/usePins'
import { fetchHeaderSearch, type HeaderSearchUser } from '../composables/useHeaderSearch'
import type { Pin } from '../types'
import { useI18n } from '../i18n'
import api from '../api'
import { subscribeUnreadCountFromHeader } from '../notificationRefresh'
import LanguageSwitcher from './LanguageSwitcher.vue'
import AvatarDisc from './AvatarDisc.vue'
import { displayInitials } from '../utils/displayInitials'
import { useAnchoredDropdown } from '../composables/useAnchoredDropdown'
import { usePointerOutsideDismiss } from '../composables/usePointerOutsideDismiss'

type LangSwitcherInstance = ComponentPublicInstance & { close?: () => void }

const { t } = useI18n()

const route = useRoute()
const router = useRouter()
const { currentUser, isAuthenticated, logout } = useAuth()
const { trackSearchInteraction } = usePins()

const langSwitcherRef = ref<LangSwitcherInstance | null>(null)

const searchQuery = ref('')
const showUserMenu = ref(false)
const showNotifications = ref(false)
const showSearchResults = ref(false)
const isOffline = ref(!navigator.onLine)
let searchTrackTimer: ReturnType<typeof setTimeout> | null = null

window.addEventListener('online', () => (isOffline.value = false))
window.addEventListener('offline', () => (isOffline.value = true))

const searchPins = ref<Pin[]>([])
const searchUsers = ref<HeaderSearchUser[]>([])
const searchRecommended = ref<Pin[]>([])
const searchRemoteLoading = ref(false)
let headerSearchDebounce: ReturnType<typeof setTimeout> | null = null

const hasSearchAnyResults = computed(
  () =>
    searchPins.value.length > 0 ||
    searchUsers.value.length > 0 ||
    searchRecommended.value.length > 0,
)

const searchAnchorRef = ref<HTMLElement | null>(null)
const searchFloatingRef = ref<HTMLElement | null>(null)
const { floatingStyles: searchFloatingStyles } = useAnchoredDropdown(searchAnchorRef, searchFloatingRef, {
  open: showSearchResults,
  placement: 'bottom-start',
  strategy: 'fixed',
  matchReferenceWidth: true,
})

const notifAnchorRef = ref<HTMLElement | null>(null)
const notifFloatingRef = ref<HTMLElement | null>(null)
const { floatingStyles: notifFloatingStyles } = useAnchoredDropdown(notifAnchorRef, notifFloatingRef, {
  open: showNotifications,
  placement: 'bottom-end',
  strategy: 'fixed',
})

const userAnchorRef = ref<HTMLElement | null>(null)
const userFloatingRef = ref<HTMLElement | null>(null)
const { floatingStyles: userFloatingStyles } = useAnchoredDropdown(userAnchorRef, userFloatingRef, {
  open: showUserMenu,
  placement: 'bottom-end',
  strategy: 'fixed',
})

async function runHeaderSearch() {
  searchRemoteLoading.value = true
  try {
    const r = await fetchHeaderSearch(searchQuery.value, 8)
    searchPins.value = r.pins
    searchUsers.value = r.users
    searchRecommended.value = r.recommendedPins
  } catch {
    searchPins.value = []
    searchUsers.value = []
    searchRecommended.value = []
  } finally {
    searchRemoteLoading.value = false
  }
}

function scheduleHeaderSearch(delayMs: number) {
  if (headerSearchDebounce) clearTimeout(headerSearchDebounce)
  headerSearchDebounce = setTimeout(() => {
    headerSearchDebounce = null
    void runHeaderSearch()
  }, delayMs)
}

watch(showSearchResults, (open) => {
  if (open) scheduleHeaderSearch(80)
})

watch(searchQuery, () => {
  if (!showSearchResults.value) return
  scheduleHeaderSearch(280)
})

usePointerOutsideDismiss(() => [
  {
    isOpen: showSearchResults,
    getRoots: () => [searchAnchorRef.value, searchFloatingRef.value],
    close: () => {
      showSearchResults.value = false
    },
  },
  {
    isOpen: showNotifications,
    getRoots: () => [notifAnchorRef.value, notifFloatingRef.value],
    close: () => {
      showNotifications.value = false
    },
  },
  {
    isOpen: showUserMenu,
    getRoots: () => [userAnchorRef.value, userFloatingRef.value],
    close: () => {
      showUserMenu.value = false
    },
  },
])

const currentRoute = computed(() => route.name as string)

const userInitials = computed(() => {
  if (!currentUser.value) return '?'
  const name = currentUser.value.displayName || currentUser.value.username
  return displayInitials(name)
})

const currentPlan = computed<'free' | 'plus' | 'pro'>(() => {
  return currentUser.value?.subscription?.plan || 'free'
})
const currentPlanLabel = computed(() => {
  if (currentPlan.value === 'pro') return 'PRO'
  if (currentPlan.value === 'plus') return 'PLUS'
  return 'FREE'
})

const navItems = computed(() => [
  { name: 'home', label: t('nav.home'), to: '/' },
  { name: 'explore', label: t('nav.explore'), to: '/explore' },
  ...(isAuthenticated.value ? [{ name: 'following', label: t('nav.following'), to: '/following' }] : []),
  ...(isAuthenticated.value && currentPlan.value === 'pro'
    ? [{ name: 'creator', label: t('nav.creator'), to: '/creator' }]
    : []),
  { name: 'create', label: t('nav.create'), to: '/create' },
])

watch(searchQuery, (value) => {
  if (searchTrackTimer) clearTimeout(searchTrackTimer)
  const query = value.trim()
  if (query.length < 2 || !isAuthenticated.value) return
  searchTrackTimer = setTimeout(() => {
    void trackSearchInteraction(query)
  }, 500)
})

const notifications = ref<any[]>([])
const notifPage = ref(1)
const notifHasMore = ref(false)
const notifLoadingMore = ref(false)
const unreadCount = ref(0)

const fetchNotifications = async (reset = true) => {
  if (!isAuthenticated.value) return
  const page = reset ? 1 : notifPage.value + 1
  try {
    const response = await api.get('notifications/', { params: { page, page_size: 20 } })
    const data = response.data
    if (Array.isArray(data)) {
      notifications.value = data
      notifHasMore.value = false
      notifPage.value = 1
    } else {
      const chunk = data?.results ?? []
      if (reset) {
        notifications.value = chunk
        notifPage.value = 1
      } else {
        notifications.value = [...notifications.value, ...chunk]
        notifPage.value = page
      }
      notifHasMore.value = !!data?.next
    }
  } catch (err) {
    console.error('Error fetching notifications:', err)
  }
}

const loadMoreNotifications = async () => {
  if (!notifHasMore.value || notifLoadingMore.value) return
  notifLoadingMore.value = true
  try {
    await fetchNotifications(false)
  } finally {
    notifLoadingMore.value = false
  }
}

const markAllAsRead = async () => {
  try {
    await api.post('notifications/mark_all_as_read/')
    notifications.value.forEach((n) => (n.is_read = true))
    unreadCount.value = 0
  } catch (err) {
    console.error('Error marking all as read:', err)
  }
}

const handleNotificationClick = async (notification: any) => {
  if (!notification.is_read) {
    try {
      await api.post(`notifications/${notification.id}/mark_as_read/`)
      notification.is_read = true
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    } catch (err) {
      console.error('Error marking notification as read:', err)
    }
  }

  const meta = notification.metadata && typeof notification.metadata === 'object' ? notification.metadata : {}
  const isStoryPin = Boolean(meta.is_story && notification.pin_slug)

  if (isStoryPin && notification.pin_slug) {
    const query: Record<string, string> = { story: String(notification.pin_slug) }
    if (notification.comment_id) {
      query.commentId = String(notification.comment_id)
    }
    router.push({ path: '/', query })
  } else if (notification.pin_slug) {
    const query: Record<string, string> = {}
    if (notification.comment_id) {
      query.commentId = String(notification.comment_id)
    }
    router.push({ path: `/pin/${notification.pin_slug}`, query })
  } else if (notification.pin_id) {
    router.push('/')
  } else if (notification.action_url) {
    router.push(String(notification.action_url))
  }
  closeDropdowns()
}

const handleSearch = () => {
  const q = searchQuery.value.trim()
  showSearchResults.value = false
  router.push(q ? { path: '/explore', query: { q } } : { path: '/explore' })
}

const handleLogout = () => {
  closeDropdowns()
  logout()
  router.push('/')
}

const handleWorkerMessage = (event: MessageEvent) => {
  const payload = event.data || {}
  if (payload.type === 'pinova_push_click' && payload.action_url) {
    router.push(String(payload.action_url))
  }
}

const closeDropdowns = () => {
  showUserMenu.value = false
  showNotifications.value = false
  showSearchResults.value = false
  langSwitcherRef.value?.close?.()
}

function onLangPopoverOpen(opened: boolean) {
  if (!opened) return
  showUserMenu.value = false
  showNotifications.value = false
  showSearchResults.value = false
}

function onSearchFocus() {
  langSwitcherRef.value?.close?.()
  showUserMenu.value = false
  showNotifications.value = false
  showSearchResults.value = true
}

function toggleNotificationsPanel() {
  langSwitcherRef.value?.close?.()
  showUserMenu.value = false
  showNotifications.value = !showNotifications.value
}

function toggleUserMenuPanel() {
  langSwitcherRef.value?.close?.()
  showNotifications.value = false
  showUserMenu.value = !showUserMenu.value
}

/** Au-dessus du header sticky (z-30). */
const popoverZIndex = { zIndex: 115 }

let unsubscribeNotifications: (() => void) | null = null

watch(showNotifications, (open) => {
  if (open && isAuthenticated.value) {
    void fetchNotifications(true)
  }
})

watch(isAuthenticated, (v) => {
  if (!v) {
    notifications.value = []
    notifHasMore.value = false
    notifPage.value = 1
    unreadCount.value = 0
  }
})

onMounted(() => {
  unsubscribeNotifications = subscribeUnreadCountFromHeader((n) => {
    unreadCount.value = n
  })
  if (typeof window !== 'undefined') {
    window.addEventListener('message', handleWorkerMessage)
  }
})

onUnmounted(() => {
  unsubscribeNotifications?.()
  unsubscribeNotifications = null
  if (typeof window !== 'undefined') {
    window.removeEventListener('message', handleWorkerMessage)
  }
})
</script>

<template>
  <header
    class="flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-2 border-b border-neutral-100 bg-white/95 backdrop-blur-md sticky top-0 z-30"
  >
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
        :class="
          currentRoute === item.name ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-100'
        "
      >
        {{ item.label }}
      </router-link>

      <div
        v-if="isOffline"
        class="ml-4 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center gap-1 animate-pulse"
      >
        <span class="material-symbols-outlined text-sm">cloud_off</span>
        {{ t('app.offline') }}
      </div>
    </nav>

    <!-- Search bar -->
    <div class="flex-1 relative min-w-0">
      <div
        ref="searchAnchorRef"
        class="flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-all overflow-hidden"
        :class="
          showSearchResults
            ? 'bg-white ring-2 ring-pink-500 shadow-lg'
            : 'bg-neutral-100 focus-within:bg-white focus-within:ring-2 focus-within:ring-pink-500 focus-within:shadow-lg'
        "
      >
        <span class="material-symbols-outlined text-lg text-neutral-400">search</span>
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="t('header.search.placeholder')"
          class="bg-transparent outline-none flex-1 text-sm"
          @focus="onSearchFocus"
          @keyup.enter="handleSearch"
        />
        <button
          v-if="searchQuery"
          type="button"
          class="w-6 h-6 rounded-full hover:bg-neutral-100 flex items-center justify-center"
          @click="searchQuery = ''"
        >
          <span class="material-symbols-outlined text-sm text-neutral-400">close</span>
        </button>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="showSearchResults"
        ref="searchFloatingRef"
        class="bg-white rounded-2xl shadow-xl border border-neutral-100 overflow-hidden max-h-[min(70vh,28rem)] flex flex-col"
        role="dialog"
        :aria-label="t('header.search.results')"
        :style="{ ...searchFloatingStyles, ...popoverZIndex }"
      >
        <div class="p-2 overflow-y-auto flex-1 min-h-0">
          <div v-if="searchRemoteLoading" class="px-3 py-6 flex justify-center">
            <span class="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <template v-else>
            <p
              v-if="hasSearchAnyResults"
              class="px-3 py-1.5 text-xs font-medium text-neutral-400"
            >
              {{ t('header.search.results') }}
            </p>

            <template v-if="searchPins.length">
              <p class="px-3 py-1 text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
                {{ t('header.search.sectionPins') }}
              </p>
              <router-link
                v-for="pin in searchPins"
                :key="'p-' + pin.id"
                :to="`/pin/${encodeURIComponent(pin.slug)}`"
                class="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-neutral-50 transition"
                @click="showSearchResults = false"
              >
                <div class="w-10 h-10 rounded-lg bg-neutral-100 shrink-0 overflow-hidden">
                  <img
                    v-if="pin.imageUrl"
                    :src="pin.imageUrl"
                    :alt="pin.title"
                    class="w-full h-full object-cover"
                  />
                  <div
                    v-else
                    class="w-full h-full flex items-center justify-center text-[10px] font-bold text-neutral-400"
                  >
                    Pin
                  </div>
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-medium text-neutral-800 truncate">{{ pin.title }}</p>
                  <p class="text-xs text-neutral-400 truncate">@{{ pin.username }} · {{ pin.topicDisplay || pin.topic }}</p>
                </div>
              </router-link>
            </template>

            <template v-if="searchUsers.length">
              <p class="px-3 py-1 mt-1 text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
                {{ t('header.search.sectionUsers') }}
              </p>
              <router-link
                v-for="u in searchUsers"
                :key="'u-' + u.username"
                :to="`/profile/${encodeURIComponent(u.username)}`"
                class="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-neutral-50 transition"
                @click="showSearchResults = false"
              >
                <AvatarDisc
                  :color="u.avatarColor"
                  frame-class="w-10 h-10 text-xs"
                  text-class="text-white"
                  :has-image="!!u.avatarUrl"
                >
                  <img v-if="u.avatarUrl" :src="u.avatarUrl" alt="" class="w-full h-full object-cover" />
                  <span v-else>{{ displayInitials(u.displayName) }}</span>
                </AvatarDisc>
                <div class="min-w-0">
                  <p class="text-sm font-medium text-neutral-800 truncate">{{ u.displayName }}</p>
                  <p class="text-xs text-neutral-400">@{{ u.username }}</p>
                </div>
              </router-link>
            </template>

            <template v-if="searchRecommended.length">
              <p class="px-3 py-1 mt-1 text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
                {{ t('header.search.sectionForYou') }}
              </p>
              <router-link
                v-for="pin in searchRecommended"
                :key="'r-' + pin.id"
                :to="`/pin/${encodeURIComponent(pin.slug)}`"
                class="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-neutral-50 transition"
                @click="showSearchResults = false"
              >
                <div class="w-10 h-10 rounded-lg bg-neutral-100 shrink-0 overflow-hidden">
                  <img
                    v-if="pin.imageUrl"
                    :src="pin.imageUrl"
                    :alt="pin.title"
                    class="w-full h-full object-cover"
                  />
                  <div
                    v-else
                    class="w-full h-full flex items-center justify-center text-[10px] font-bold text-neutral-400"
                  >
                    Pin
                  </div>
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-medium text-neutral-800 truncate">{{ pin.title }}</p>
                  <p class="text-xs text-pink-600/90">{{ t('header.search.forYouBadge') }}</p>
                </div>
              </router-link>
            </template>

            <p
              v-if="!hasSearchAnyResults && searchQuery.trim().length > 0"
              class="px-3 py-6 text-sm text-neutral-500 text-center"
            >
              {{ t('header.search.empty') }}
            </p>
            <p
              v-if="!hasSearchAnyResults && !searchQuery.trim() && !isAuthenticated"
              class="px-3 py-5 text-sm text-neutral-500 text-center"
            >
              {{ t('header.search.typeToSearch') }}
            </p>
          </template>
        </div>
        <div class="border-t border-neutral-100 p-2 shrink-0">
          <button
            type="button"
            class="w-full py-2 text-center text-sm font-semibold text-pink-600 hover:text-pink-700"
            @click="handleSearch"
          >
            {{ t('header.search.openExplore') }}
          </button>
        </div>
      </div>
    </Teleport>

    <!-- Droite : langue, notifications, profil -->
    <div class="flex items-center gap-1 sm:gap-2 shrink-0">
      <template v-if="isAuthenticated">
        <LanguageSwitcher ref="langSwitcherRef" @popover-open-change="onLangPopoverOpen" />

        <!-- Notifications -->
        <div ref="notifAnchorRef">
          <button
            type="button"
            class="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full hover:bg-neutral-100 text-neutral-600 transition relative"
            @click.stop="toggleNotificationsPanel()"
          >
            <span class="material-symbols-outlined text-xl">notifications</span>
            <span
              v-if="unreadCount > 0"
              class="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-pink-500 rounded-full border-2 border-white"
            ></span>
          </button>
        </div>

        <!-- Photo profil = menu utilisateur -->
        <div ref="userAnchorRef">
          <button
            type="button"
            class="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-full transition ring-2 ring-pink-500 hover:ring-pink-600 hover:scale-[1.02] shadow-md overflow-hidden focus:outline-none focus:ring-offset-2 focus:ring-offset-white focus:ring-pink-500"
            :aria-label="t('header.user.myProfile')"
            aria-haspopup="menu"
            :aria-expanded="showUserMenu"
            @click.stop="toggleUserMenuPanel()"
          >
            <AvatarDisc
              v-if="currentUser"
              :color="currentUser.avatarColor || DEFAULT_AVATAR_COLOR_CLASS"
              frame-class="w-full h-full text-xs sm:text-sm"
              text-class="text-white drop-shadow-sm"
              :has-image="!!currentUser.avatarUrl"
            >
              <img
                v-if="currentUser.avatarUrl"
                :src="currentUser.avatarUrl"
                alt=""
                class="w-full h-full object-cover rounded-full"
              />
              <span v-else>{{ userInitials }}</span>
            </AvatarDisc>
          </button>
        </div>

        <Teleport to="body">
          <div
            v-if="showNotifications"
            ref="notifFloatingRef"
            class="w-80 max-w-[calc(100vw-1rem)] bg-white rounded-2xl shadow-xl border border-neutral-100 overflow-hidden"
            role="menu"
            :style="{ ...notifFloatingStyles, ...popoverZIndex }"
          >
            <div class="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
              <h3 class="font-semibold text-neutral-900">{{ t('header.notifications') }}</h3>
              <button
                v-if="unreadCount > 0"
                type="button"
                class="text-xs text-pink-600 font-medium hover:underline"
                @click="markAllAsRead"
              >
                {{ t('header.notifications.markAllRead') }}
              </button>
            </div>
            <div class="max-h-80 overflow-y-auto">
              <div v-if="notifications.length === 0" class="p-8 text-center text-neutral-400">
                <span class="material-symbols-outlined text-4xl mb-2">notifications_off</span>
                <p class="text-sm">{{ t('header.notifications.empty') }}</p>
              </div>
              <div
                v-for="notification in notifications"
                :key="notification.id"
                class="p-4 hover:bg-neutral-50 transition flex items-start gap-3 border-b border-neutral-50 last:border-0 cursor-pointer"
                :class="{ 'bg-blue-50/30': !notification.is_read }"
                @click="handleNotificationClick(notification)"
              >
                <AvatarDisc
                  :color="notification.sender_avatar_color || DEFAULT_AVATAR_COLOR_CLASS"
                  frame-class="w-10 h-10 text-[10px] ring-1 ring-neutral-100"
                  text-class="text-white leading-none"
                  :has-image="!!notification.sender_avatar_url"
                >
                  <img
                    v-if="notification.sender_avatar_url"
                    :src="notification.sender_avatar_url"
                    alt=""
                    class="w-full h-full object-cover"
                  />
                  <span v-else>{{ displayInitials(notification.sender_username) }}</span>
                </AvatarDisc>
                <div class="flex-1">
                  <p
                    v-if="notification.title"
                    class="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 mb-0.5"
                  >
                    {{ notification.title }}
                  </p>
                  <p class="text-sm text-neutral-800 leading-snug">{{ notification.message }}</p>
                  <p class="text-xs text-neutral-400 mt-1">@{{ notification.sender_username }}</p>
                </div>
                <div v-if="!notification.is_read" class="w-2 h-2 rounded-full bg-pink-600 mt-2"></div>
              </div>
            </div>
            <div v-if="notifHasMore" class="border-t border-neutral-100 p-2">
              <button
                type="button"
                class="w-full py-2 text-center text-sm font-semibold text-pink-600 hover:text-pink-700 disabled:opacity-50"
                :disabled="notifLoadingMore"
                @click="loadMoreNotifications"
              >
                {{ t('header.notifications.loadMore') }}
              </button>
            </div>
          </div>
        </Teleport>

        <Teleport to="body">
          <div
            v-if="showUserMenu"
            ref="userFloatingRef"
            class="w-64 max-w-[calc(100vw-1rem)] bg-white rounded-2xl shadow-xl border border-neutral-100 overflow-hidden"
            role="menu"
            :style="{ ...userFloatingStyles, ...popoverZIndex }"
          >
            <div class="px-4 py-4 border-b border-neutral-100 flex gap-3">
              <AvatarDisc
                v-if="currentUser"
                :color="currentUser.avatarColor || DEFAULT_AVATAR_COLOR_CLASS"
                frame-class="w-12 h-12 text-sm ring-2 ring-pink-100"
                text-class="text-white"
                :has-image="!!currentUser.avatarUrl"
              >
                <img
                  v-if="currentUser.avatarUrl"
                  :src="currentUser.avatarUrl"
                  alt=""
                  class="w-full h-full object-cover"
                />
                <span v-else>{{ userInitials }}</span>
              </AvatarDisc>
              <div class="min-w-0 flex-1">
                <p class="font-semibold text-neutral-900 text-sm flex items-center gap-1.5">
                  <span
                    v-if="currentPlan === 'pro'"
                    class="material-symbols-outlined text-amber-500 text-base shrink-0"
                  >
                    verified
                  </span>
                  <span class="truncate">{{ currentUser?.displayName }}</span>
                </p>
                <p class="text-xs text-neutral-500 truncate">@{{ currentUser?.username }}</p>
                <p class="text-xs text-neutral-400 mt-0.5 truncate">{{ currentUser?.email }}</p>
              </div>
            </div>

            <div class="py-1">
              <router-link
                :to="`/profile/${currentUser?.username}`"
                class="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 transition text-sm text-neutral-700"
                @click="closeDropdowns"
              >
                <span class="material-symbols-outlined text-lg">person</span>
                {{ t('header.user.myProfile') }}
              </router-link>
              <router-link
                v-if="currentPlan === 'plus' || currentPlan === 'pro'"
                to="/story/create"
                class="flex items-center gap-3 px-4 py-2.5 hover:bg-pink-50 transition text-sm text-pink-700 md:hidden font-medium"
                @click="showUserMenu = false"
              >
                <span class="material-symbols-outlined text-lg">auto_stories</span>
                {{ t('story.standalone.navShort') }}
              </router-link>
              <router-link
                to="/create"
                class="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 transition text-sm text-neutral-700 md:hidden"
                @click="showUserMenu = false"
              >
                <span class="material-symbols-outlined text-lg">add_circle</span>
                {{ t('header.user.createPin') }}
              </router-link>
              <router-link
                to="/explore"
                class="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 transition text-sm text-neutral-700 md:hidden"
                @click="showUserMenu = false"
              >
                <span class="material-symbols-outlined text-lg">explore</span>
                {{ t('nav.explore') }}
              </router-link>
              <router-link
                to="/following"
                class="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 transition text-sm text-neutral-700 md:hidden"
                @click="showUserMenu = false"
              >
                <span class="material-symbols-outlined text-lg">groups</span>
                {{ t('nav.following') }}
              </router-link>
              <router-link
                v-if="currentPlan === 'pro'"
                to="/creator"
                class="flex items-center gap-3 px-4 py-2.5 hover:bg-amber-50 transition text-sm text-amber-900 font-medium md:hidden"
                @click="showUserMenu = false"
              >
                <span class="material-symbols-outlined text-lg">insights</span>
                {{ t('nav.creator') }}
              </router-link>
              <router-link
                to="/settings"
                class="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 transition text-sm text-neutral-700"
                @click="closeDropdowns"
              >
                <span class="material-symbols-outlined text-lg">settings</span>
                {{ t('nav.settings') }}
              </router-link>
              <router-link
                to="/billing"
                class="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 transition text-sm text-neutral-700"
                @click="closeDropdowns"
              >
                <span class="material-symbols-outlined text-lg">receipt_long</span>
                {{ t('nav.billing') }}
              </router-link>
              <router-link
                to="/premium"
                class="flex items-center gap-3 px-4 py-2.5 hover:bg-pink-50 transition text-sm text-pink-600 font-semibold"
                @click="showUserMenu = false"
              >
                <span class="material-symbols-outlined text-lg">workspace_premium</span>
                {{ t('nav.premium') }}
                <span
                  class="ml-auto text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold"
                  :class="
                    currentPlan === 'pro'
                      ? 'bg-amber-100 text-amber-700'
                      : currentPlan === 'plus'
                        ? 'bg-pink-100 text-pink-700'
                        : 'bg-neutral-100 text-neutral-600'
                  "
                >
                  {{ currentPlanLabel }}
                </span>
              </router-link>
            </div>

            <div class="border-t border-neutral-100 py-1">
              <button
                type="button"
                class="flex items-center gap-3 px-4 py-2.5 w-full hover:bg-neutral-50 transition text-sm text-pink-600"
                @click="handleLogout"
              >
                <span class="material-symbols-outlined text-lg">logout</span>
                {{ t('nav.logout') }}
              </button>
            </div>
          </div>
        </Teleport>
      </template>

      <template v-else>
        <LanguageSwitcher ref="langSwitcherRef" @popover-open-change="onLangPopoverOpen" />
        <div class="flex items-center gap-2">
          <router-link
            to="/login"
            class="px-4 py-2 rounded-full text-sm font-semibold text-neutral-700 hover:bg-neutral-100 transition"
          >
            {{ t('nav.login') }}
          </router-link>
          <router-link
            to="/register"
            class="px-4 py-2 rounded-full bg-pink-600 text-white text-sm font-semibold hover:bg-pink-700 transition"
          >
            {{ t('nav.register') }}
          </router-link>
        </div>
      </template>
    </div>
  </header>
</template>
