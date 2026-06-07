<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth, DEFAULT_AVATAR_COLOR_CLASS } from '../composables/useAuth'
import { usePins } from '../composables/usePins'
import { fetchHeaderSearch, type HeaderSearchUser, type HeaderSearchBoard } from '../composables/useHeaderSearch'
import type { Pin } from '../types'
import { useI18n } from '../i18n'
import api from '../api/index'
import { navigateWebNotificationDeepLink } from '../utils/notificationDeepLink'
import { subscribeUnreadCountFromHeader, subscribeNotificationLive } from '../lib/notificationRefresh'
import AvatarDisc from './AvatarDisc.vue'
import { displayInitials } from '../utils/displayInitials'
import { useAnchoredDropdown } from '../composables/useAnchoredDropdown'
import { usePointerOutsideDismiss } from '../composables/usePointerOutsideDismiss'

const { t, currentLang } = useI18n()

const route = useRoute()
const router = useRouter()
const { currentUser, isAuthenticated, logout } = useAuth()

const PINOVA_HEADER_H_VAR = '--pinova-global-header-h'

const headerShellRef = ref<HTMLElement | null>(null)
const isHomeRouteHeader = computed(() => route.name === 'home' || route.path === '/')
/** Home connectée : slot header pour stories + onglets (uniquement &lt; lg, Teleport). */
const homeHeaderChrome = computed(() => isHomeRouteHeader.value && isAuthenticated.value)

/** Fond vitré permanent (<lg et desktop) : lisibilité + zone stories/onglets home dans la même coque. */
const HEADER_SHELL_GLASS =
  'max-lg:bg-white/85 dark:max-lg:bg-neutral-950/80 max-lg:backdrop-blur-xl max-lg:backdrop-saturate-150 max-lg:border-b max-lg:border-neutral-200/70 dark:max-lg:border-neutral-800/70 max-lg:shadow-[0_8px_24px_-18px_rgba(0,0,0,0.18)] dark:max-lg:shadow-[0_10px_28px_-20px_rgba(0,0,0,0.6)] lg:bg-white/85 dark:lg:bg-neutral-950/80 lg:backdrop-blur-xl lg:backdrop-saturate-150 lg:border-b lg:border-neutral-200/70 dark:lg:border-neutral-800/70 lg:shadow-[0_8px_24px_-18px_rgba(0,0,0,0.18)] dark:lg:shadow-[0_10px_28px_-20px_rgba(0,0,0,0.6)]'

let headerHeightRo: ResizeObserver | null = null

function clearHeaderHeightCssVar() {
  if (typeof document === 'undefined') return
  document.documentElement.style.removeProperty(PINOVA_HEADER_H_VAR)
}

function syncHeaderHeightCssVar() {
  const el = headerShellRef.value
  if (typeof document === 'undefined' || !el) return
  const h = el.getBoundingClientRect().height
  // `max-lg:hidden` sur routes hors home : le header a hauteur 0 — on laisse le fallback App.
  if (!Number.isFinite(h) || h < 12) {
    clearHeaderHeightCssVar()
    return
  }
  document.documentElement.style.setProperty(PINOVA_HEADER_H_VAR, `${Math.ceil(h)}px`)
}
const { trackSearchInteraction } = usePins()

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
const searchBoards = ref<HeaderSearchBoard[]>([])
const searchRecommended = ref<Pin[]>([])
const searchRemoteLoading = ref(false)
let headerSearchDebounce: ReturnType<typeof setTimeout> | null = null

const hasSearchAnyResults = computed(
  () =>
    searchPins.value.length > 0 ||
    searchUsers.value.length > 0 ||
    searchBoards.value.length > 0 ||
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
    searchBoards.value = r.boards
    searchRecommended.value = r.recommendedPins
  } catch {
    searchPins.value = []
    searchUsers.value = []
    searchBoards.value = []
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

/** Lien profil mobile : même résolution que l’ancienne tab bar (évite /profile générique si pseudo connu). */
const profileDirectTo = computed(() =>
  currentUser.value?.username ? `/profile/${encodeURIComponent(currentUser.value.username)}` : '/profile',
)

type NavItem = { name: string; label: string; to: string }

const navMain = computed<NavItem[]>(() => {
  const base: NavItem[] = [{ name: 'home', label: t('nav.home'), to: '/' }]
  if (!isAuthenticated.value) {
    base.push({ name: 'explore', label: t('nav.explore'), to: '/explore' })
    base.push({ name: 'premium', label: t('nav.pricing'), to: '/premium' })
  }
  return base
})

/** Concours, parrainage, suivis — réservé compte connecté. */
const navCommunity = computed<NavItem[]>(() => {
  if (!isAuthenticated.value) return []
  return [
    { name: 'contest-live', label: t('nav.contest'), to: '/contest/live' },
    { name: 'referral-contest-live', label: t('nav.referral'), to: '/referrals/contest' },
    { name: 'following', label: t('nav.following'), to: '/following' },
  ]
})

const navCreateExtras = computed<NavItem[]>(() => {
  if (!isAuthenticated.value) return []
  const out: NavItem[] = [{ name: 'create', label: t('nav.create'), to: '/create' }]
  if (currentPlan.value === 'pro') {
    out.push({ name: 'creator', label: t('nav.creator'), to: '/creator' })
  }
  return out
})

const navFull = computed(() => [...navMain.value, ...navCommunity.value, ...navCreateExtras.value])

const navMoreRef = ref<HTMLDetailsElement | null>(null)

function closeNavMoreMenu() {
  if (navMoreRef.value) navMoreRef.value.open = false
}

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
    const response = await api.get('notifications/', {
      params: { page, page_size: 20, lang: currentLang.value },
    })
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

  const meta =
    notification.metadata && typeof notification.metadata === 'object' ? notification.metadata : null
  navigateWebNotificationDeepLink(
    router,
    {
      metadata: meta,
      pin_slug: notification.pin_slug ?? null,
      pin_id: notification.pin_id ?? null,
      comment_id: notification.comment_id ?? null,
      action_url: notification.action_url ?? null,
      notification_type: notification.notification_type ?? null,
      sender_username: notification.sender_username ?? null,
    },
    'header',
  )
  closeDropdowns()
}

const handleSearch = () => {
  const q = searchQuery.value.trim()
  showSearchResults.value = false
  router.push(q ? { path: '/explore', query: { q } } : { path: '/explore' })
}

const handleLogout = async () => {
  closeDropdowns()
  await logout()
  router.push('/')
}

const handleWorkerMessage = (event: MessageEvent) => {
  const payload = event.data || {}
  if (payload.type !== 'pinova_push_click') return
  const rawMeta = typeof payload.metadata_json === 'string' ? payload.metadata_json.trim() : ''
  let meta: Record<string, unknown> = {}
  if (rawMeta) {
    try {
      const parsed = JSON.parse(rawMeta) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        meta = parsed as Record<string, unknown>
      }
    } catch {
      meta = {}
    }
  }

  const rawId = payload.notification_id
  const nid =
    rawId !== undefined && rawId !== null && rawId !== ''
      ? parseInt(String(rawId), 10)
      : NaN
  if (Number.isFinite(nid) && nid > 0) {
    void api.post(`notifications/${nid}/mark_as_read/`).catch(() => undefined)
  }

  const cidRaw = payload.comment_id
  const comment_id =
    cidRaw !== undefined && cidRaw !== null && String(cidRaw).trim() !== ''
      ? cidRaw
      : undefined

  navigateWebNotificationDeepLink(
    router,
    {
      metadata: meta,
      pin_slug: typeof payload.pin_slug === 'string' ? payload.pin_slug : null,
      pin_id: null,
      comment_id,
      action_url: typeof payload.action_url === 'string' ? payload.action_url : null,
      notification_type: typeof payload.notification_type === 'string' ? payload.notification_type : null,
      sender_username: typeof payload.sender_username === 'string' ? payload.sender_username : null,
    },
    'header',
  )
}

const closeDropdowns = () => {
  showUserMenu.value = false
  showNotifications.value = false
  showSearchResults.value = false
}

function onSearchFocus() {
  showUserMenu.value = false
  showNotifications.value = false
  showSearchResults.value = true
}

function toggleNotificationsPanel() {
  showUserMenu.value = false
  showNotifications.value = !showNotifications.value
}

function toggleUserMenuPanel() {
  showNotifications.value = false
  showUserMenu.value = !showUserMenu.value
}

/** Au-dessus du header global (z-[40]). */
const popoverZIndex = { zIndex: 115 }

let unsubscribeNotifications: (() => void) | null = null
let unsubscribeNotificationLive: (() => void) | null = null

watch(showNotifications, (open) => {
  if (open && isAuthenticated.value) {
    void fetchNotifications(true)
  }
})

watch(currentLang, () => {
  if (showNotifications.value && isAuthenticated.value) {
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
  unsubscribeNotificationLive = subscribeNotificationLive((payload) => {
    if (!isAuthenticated.value || !payload?.id) return
    const exists = notifications.value.some((n) => n.id === payload.id)
    if (exists) return
    notifications.value = [payload, ...notifications.value].slice(0, 40)
  })
  if (typeof window !== 'undefined') {
    window.addEventListener('message', handleWorkerMessage)
  }
  void nextTick(() => {
    syncHeaderHeightCssVar()
    const el = headerShellRef.value
    if (!el || typeof ResizeObserver === 'undefined') return
    headerHeightRo = new ResizeObserver(() => syncHeaderHeightCssVar())
    headerHeightRo.observe(el)
  })
})

onUnmounted(() => {
  headerHeightRo?.disconnect()
  headerHeightRo = null
  clearHeaderHeightCssVar()
  unsubscribeNotifications?.()
  unsubscribeNotifications = null
  unsubscribeNotificationLive?.()
  unsubscribeNotificationLive = null
  if (typeof window !== 'undefined') {
    window.removeEventListener('message', handleWorkerMessage)
  }
})

watch(
  () => [route.fullPath, isAuthenticated.value],
  () => {
    closeDropdowns()
    void nextTick(() => syncHeaderHeightCssVar())
  },
)
</script>

<template>
  <header
    ref="headerShellRef"
    class="app-global-header-shell pinova-app-chrome-safe-pt flex flex-col w-full px-2 sm:px-4 lg:px-5 pb-0 fixed inset-x-0 top-0 z-[40] transition-[background-color,backdrop-filter,border-color,box-shadow] duration-200 ease-out"
    :class="[HEADER_SHELL_GLASS, homeHeaderChrome ? 'max-lg:overflow-hidden max-lg:rounded-b-3xl' : '']"
  >
    <div class="flex w-full min-w-0 items-center gap-1.5 sm:gap-3 lg:gap-4 pb-1.5 sm:pb-2">
    <!-- Logo -->
    <router-link
      to="/"
      class="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-pink-700 dark:bg-pink-600 text-white hover:bg-pink-800 dark:hover:opacity-90 transition shrink-0 overflow-hidden shadow-md shadow-pink-900/15 dark:shadow-black/40 ring-1 ring-black/[0.06] dark:ring-white/15"
      aria-label="Accueil Pinova"
    >
      <img
        src="../assets/logo.png"
        alt="Logo"
        class="w-full h-full object-cover contrast-[1.02] dark:brightness-110 dark:contrast-[1.04] dark:saturate-[1.06]"
      />
    </router-link>

    <!--
      Raccourci Explore retiré sur mobile : la home propose désormais une tab
      « Explorer » native ; sur desktop, l'item reste accessible via la nav ci-dessous.
    -->

    <!-- Navigation desktop : pleine ligne xl+, menu « Plus » lg–xl ; &lt; lg = même barre compacte que mobile. -->
    <nav class="hidden xl:flex items-center gap-0.5 ml-1 shrink-0">
      <router-link
        v-for="item in navFull"
        :key="item.name"
        :to="item.to"
        class="px-3.5 py-2 rounded-full text-sm font-semibold transition-colors relative whitespace-nowrap"
        :class="
          currentRoute === item.name
            ? 'bg-neutral-900 text-white dark:bg-pink-600 dark:text-white'
            : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800'
        "
      >
        {{ item.label }}
      </router-link>

      <div
        v-if="isOffline"
        class="ml-3 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center gap-1 animate-pulse"
      >
        <span class="material-symbols-outlined text-sm">cloud_off</span>
        {{ t('app.offline') }}
      </div>
    </nav>

    <nav class="hidden lg:flex xl:hidden items-center gap-0.5 ml-1 shrink-0">
      <router-link
        v-for="item in navMain"
        :key="item.name"
        :to="item.to"
        class="px-3 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap"
        :class="
          currentRoute === item.name
            ? 'bg-neutral-900 text-white dark:bg-pink-600 dark:text-white'
            : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800'
        "
      >
        {{ item.label }}
      </router-link>

      <details
        v-if="navCommunity.length || navCreateExtras.length"
        ref="navMoreRef"
        class="relative group bg-transparent rounded-full"
        style="background-color: transparent !important;"
      >
        <summary
          class="list-none cursor-pointer rounded-full px-3 py-2 text-sm font-semibold text-neutral-700 dark:text-neutral-200 flex items-center gap-1 [&::-webkit-details-marker]:hidden"
        >
          <span class="material-symbols-outlined text-lg leading-none">apps</span>
          <span class="sr-only lg:not-sr-only">{{ t('header.nav.more') }}</span>
        </summary>
        <div
          class="absolute left-0 top-[calc(100%+6px)] min-w-[12.5rem] py-1.5 rounded-2xl border border-neutral-200/90 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xl z-[120]"
        >
          <router-link
            v-for="item in [...navCommunity, ...navCreateExtras]"
            :key="'more-' + item.name"
            :to="item.to"
            class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-800 dark:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-800/80"
            :class="currentRoute === item.name ? 'bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-600' : ''"
            @click="closeNavMoreMenu"
          >
            {{ item.label }}
          </router-link>
        </div>
      </details>

      <div
        v-if="isOffline"
        class="ml-2 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center gap-1 animate-pulse"
      >
        <span class="material-symbols-outlined text-sm">cloud_off</span>
        {{ t('app.offline') }}
      </div>
    </nav>

    <!--
      Search bar (desktop ≥ lg) : input réel avec dropdown de résultats.
    -->
    <div class="hidden lg:block flex-1 relative min-w-0">
      <div
        ref="searchAnchorRef"
        class="app-input-surface flex items-center gap-1.5 sm:gap-2 rounded-full px-2.5 sm:px-4 py-1.5 sm:py-2 text-sm transition-all overflow-hidden"
        :class="
          showSearchResults
            ? 'shadow-lg'
            : 'focus-within:shadow-lg'
        "
      >
        <span class="material-symbols-outlined text-lg text-neutral-400 dark:text-neutral-500">search</span>
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="t('header.search.placeholder')"
          class="flex-1 text-xs sm:text-sm bg-transparent border-0 shadow-none outline-none focus:ring-0 min-w-0"
          @focus="onSearchFocus"
          @keyup.enter="handleSearch"
        />
        <button
          v-if="searchQuery"
          type="button"
          class="w-6 h-6 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center justify-center"
          @click="searchQuery = ''"
        >
          <span class="material-symbols-outlined text-sm text-neutral-400 dark:text-neutral-500">close</span>
        </button>
      </div>
    </div>

    <!--
      Search bar (mobile / tablette < lg) : faux input qui ouvre la page /search
      dédiée — pas de recherche automatique, l'utilisateur tape puis valide.
      Stylé comme un vrai input pour conserver l'affordance « zone de recherche ».
    -->
    <router-link
      to="/search"
      class="lg:hidden flex-1 min-w-0 flex items-center gap-2 rounded-full bg-neutral-100/90 dark:bg-neutral-800/90 hover:bg-neutral-200/80 dark:hover:bg-neutral-700/80 px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400 transition-colors"
      :aria-label="t('common.search')"
    >
      <span class="material-symbols-outlined text-lg shrink-0">search</span>
      <span class="flex-1 truncate text-xs sm:text-sm">{{ t('header.search.placeholder') }}</span>
    </router-link>

    <Teleport to="body">
      <div
        v-if="showSearchResults"
        ref="searchFloatingRef"
        class="app-floating-panel rounded-2xl overflow-hidden max-h-[min(70vh,28rem)] flex flex-col"
        role="dialog"
        :aria-label="t('header.search.results')"
        :style="{ ...searchFloatingStyles, ...popoverZIndex }"
      >
        <div class="p-2 overflow-y-auto flex-1 min-h-0">
          <div v-if="searchRemoteLoading" class="px-3 py-6 flex justify-center">
            <span class="w-8 h-8 border-2 border-pink-700 dark:border-pink-600 border-t-transparent rounded-full animate-spin" />
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
                class="app-menu-item flex items-center gap-3 px-3 py-2 rounded-xl transition"
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
                  <p class="text-sm font-medium text-neutral-800 dark:text-neutral-100 truncate">{{ pin.title }}</p>
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
                class="app-menu-item flex items-center gap-3 px-3 py-2 rounded-xl transition"
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
                  <p class="text-sm font-medium text-neutral-800 dark:text-neutral-100 truncate">{{ u.displayName }}</p>
                  <p class="text-xs text-neutral-400">@{{ u.username }}</p>
                </div>
              </router-link>
            </template>

            <template v-if="searchBoards.length">
              <p class="px-3 py-1 mt-1 text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
                {{ t('header.search.sectionBoards') }}
              </p>
              <router-link
                v-for="board in searchBoards"
                :key="'b-' + board.id"
                :to="`/profile/${encodeURIComponent(board.ownerUsername)}/board/${board.id}`"
                class="app-menu-item flex items-center gap-3 px-3 py-2 rounded-xl transition"
                @click="showSearchResults = false"
              >
                <div class="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 shrink-0 overflow-hidden">
                  <img
                    v-if="board.coverImageUrl"
                    :src="board.coverImageUrl"
                    :alt="board.name"
                    class="w-full h-full object-cover"
                  />
                  <div
                    v-else
                    class="w-full h-full flex items-center justify-center text-[10px] font-bold text-neutral-400"
                  >
                    Board
                  </div>
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-medium text-neutral-800 dark:text-neutral-100 truncate">{{ board.name }}</p>
                  <p class="text-xs text-neutral-400 truncate">
                    @{{ board.ownerUsername }} · {{ t('header.search.boardPinsCount', { count: board.pinCount }) }}
                  </p>
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
                class="app-menu-item flex items-center gap-3 px-3 py-2 rounded-xl transition"
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
                  <p class="text-sm font-medium text-neutral-800 dark:text-neutral-100 truncate">{{ pin.title }}</p>
                  <p class="text-xs text-pink-700/90">{{ t('header.search.forYouBadge') }}</p>
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
        <div class="border-t border-neutral-200/70 dark:border-neutral-700/80 p-2 shrink-0">
          <button
            type="button"
            class="w-full py-2 text-center text-sm font-semibold text-pink-700 hover:text-pink-800"
            @click="handleSearch"
          >
            {{ t('header.search.openExplore') }}
          </button>
        </div>
      </div>
    </Teleport>

    <!-- Droite : notifications, profil (la recherche mobile occupe la zone centrale). -->
    <div class="flex items-center gap-1 sm:gap-2 shrink-0">
      <template v-if="isAuthenticated">
        <!-- Notifications (mobile) : lien direct vers la page /notifications. -->
        <router-link
          to="/notifications"
          class="lg:hidden relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-600 transition hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          :class="
            currentRoute === 'notifications'
              ? 'bg-pink-50 text-pink-700 ring-1 ring-pink-200 dark:bg-pink-950/40 dark:text-pink-600 dark:ring-pink-800/60'
              : ''
          "
          :aria-label="t('header.notifications')"
        >
          <span class="material-symbols-outlined text-[22px] leading-none">notifications</span>
          <span
            v-if="unreadCount > 0"
            class="absolute top-1 right-1 w-2.5 h-2.5 bg-pink-700 dark:bg-pink-600 rounded-full border-2 border-white dark:border-neutral-900"
          ></span>
        </router-link>

        <!-- Notifications (desktop) : panneau déroulant ancré. -->
        <div ref="notifAnchorRef" class="hidden lg:block">
          <button
            type="button"
            class="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition relative"
            @click.stop="toggleNotificationsPanel()"
          >
            <span class="material-symbols-outlined text-xl">notifications</span>
            <span
              v-if="unreadCount > 0"
              class="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-pink-700 dark:bg-pink-600 rounded-full border-2 border-white dark:border-neutral-900 ring-1 ring-pink-200/70 dark:ring-pink-600/40"
            ></span>
          </button>
        </div>

        <!-- Mobile (&lt; lg) : avatar = lien direct vers le profil. Desktop : menu utilisateur. -->
        <router-link
          v-if="currentUser"
          :to="profileDirectTo"
          class="lg:hidden w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-full transition ring-2 ring-pink-700 dark:ring-pink-600 hover:ring-pink-700 dark:hover:ring-pink-600 hover:scale-[1.02] shadow-md overflow-hidden focus:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-950 focus-visible:ring-pink-700 dark:focus-visible:ring-pink-600"
          :aria-label="t('header.user.myProfile')"
        >
          <AvatarDisc
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
        </router-link>

        <div ref="userAnchorRef" class="hidden lg:block">
          <button
            type="button"
            class="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-full transition ring-2 ring-pink-700 dark:ring-pink-600 hover:ring-pink-700 dark:hover:ring-pink-600 hover:scale-[1.02] shadow-md overflow-hidden focus:outline-none focus:ring-offset-2 focus:ring-offset-white focus:ring-pink-700 dark:focus:ring-pink-600 dark:focus:ring-offset-neutral-950"
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
            class="app-floating-panel w-80 max-w-[calc(100vw-1rem)] rounded-2xl overflow-hidden"
            role="menu"
            :style="{ ...notifFloatingStyles, ...popoverZIndex }"
          >
            <div class="px-4 py-3 border-b border-neutral-200/70 dark:border-neutral-700/80 flex items-center justify-between">
              <h3 class="font-semibold text-neutral-900 dark:text-neutral-100">{{ t('header.notifications') }}</h3>
              <button
                v-if="unreadCount > 0"
                type="button"
                class="text-xs text-pink-700 dark:text-pink-600 font-medium hover:underline"
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
                class="app-menu-item p-4 transition flex items-start gap-3 border-b border-neutral-100/70 dark:border-neutral-700/70 last:border-0 cursor-pointer"
                :class="{ 'bg-blue-50/40 dark:bg-blue-950/25 ring-1 ring-blue-200/45 dark:ring-blue-800/45': !notification.is_read }"
                @click="handleNotificationClick(notification)"
              >
                <AvatarDisc
                  :color="notification.sender_avatar_color || DEFAULT_AVATAR_COLOR_CLASS"
                  frame-class="w-10 h-10 text-[10px] ring-1 ring-neutral-100 dark:ring-neutral-700/80"
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
                  <p class="text-sm text-neutral-800 dark:text-neutral-100 leading-snug">{{ notification.message }}</p>
                  <p class="text-xs text-neutral-400 mt-1">@{{ notification.sender_username }}</p>
                </div>
                <div v-if="!notification.is_read" class="w-2 h-2 rounded-full bg-pink-700 dark:bg-pink-600 mt-2"></div>
              </div>
            </div>
            <div v-if="notifHasMore" class="border-t border-neutral-200/70 dark:border-neutral-700/80 p-2">
              <button
                type="button"
                class="w-full py-2 text-center text-sm font-semibold text-pink-700 hover:text-pink-800 disabled:opacity-50"
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
            class="app-floating-panel w-64 max-w-[calc(100vw-1rem)] rounded-2xl overflow-hidden"
            role="menu"
            :style="{ ...userFloatingStyles, ...popoverZIndex }"
          >
            <div class="px-4 py-4 border-b border-neutral-200/70 dark:border-neutral-700/80 flex gap-3">
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
                class="app-menu-item flex items-center gap-3 px-4 py-2.5 transition text-sm text-neutral-700 dark:text-neutral-200"
                @click="closeDropdowns"
              >
                <span class="material-symbols-outlined text-lg">person</span>
                {{ t('header.user.myProfile') }}
              </router-link>
              <router-link
                to="/settings"
                class="app-menu-item flex items-center gap-3 px-4 py-2.5 transition text-sm text-neutral-700 dark:text-neutral-200"
                @click="closeDropdowns"
              >
                <span class="material-symbols-outlined text-lg">settings</span>
                {{ t('nav.settings') }}
              </router-link>
              <router-link
                v-if="currentUser?.subscription?.hasBillingHistory !== false"
                to="/billing"
                class="app-menu-item flex items-center gap-3 px-4 py-2.5 transition text-sm text-neutral-700 dark:text-neutral-200"
                @click="closeDropdowns"
              >
                <span class="material-symbols-outlined text-lg">receipt_long</span>
                {{ t('nav.billing') }}
              </router-link>
              <router-link
                to="/premium"
                class="flex items-center gap-3 px-4 py-2.5 hover:bg-pink-50 transition text-sm text-pink-700 font-semibold"
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
                        : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
                  "
                >
                  {{ currentPlanLabel }}
                </span>
              </router-link>
            </div>

            <div class="border-t border-neutral-200/70 dark:border-neutral-700/80 py-1">
              <button
                type="button"
                class="app-menu-item flex items-center gap-3 px-4 py-2.5 w-full transition text-sm text-pink-700 dark:text-pink-600"
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
        <div class="flex items-center gap-1 sm:gap-2 shrink-0">
          <!--
            Compact (&lt; lg) : la nav grille n’est pas visible — lien Tarifs +
            une seule CTA inscription (Connexion/Gmail restent dans le hero).
            À partir de lg : « Tarifs » est dans navMain ; ici inscription seulement.
          -->
          <router-link
            to="/premium"
            class="lg:hidden px-2 sm:px-3 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold text-pink-700 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/35 transition whitespace-nowrap"
          >
            {{ t('nav.pricing') }}
          </router-link>
          <router-link
            to="/register"
            class="px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-pink-700 dark:bg-pink-600 text-white text-xs sm:text-sm font-semibold hover:bg-pink-800 dark:hover:opacity-90 transition whitespace-nowrap"
          >
            {{ t('nav.register') }}
          </router-link>
        </div>
      </template>
    </div>
    </div>

    <!-- Home connectée : contenu injecté par `HomePage.vue` (Teleport). -->
    <div id="pinova-header-home-extension" class="w-full min-w-0 shrink-0" />
  </header>
</template>
