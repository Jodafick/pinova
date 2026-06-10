<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onActivated, onDeactivated, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePins } from '../composables/usePins'
import { isFeedPin, type Pin, type SponsoredAd } from '../types'
import { pushFeedItemOverlay } from '../utils/feedOverlayNavigation'
import { useAuth, DEFAULT_AVATAR_COLOR_CLASS } from '../composables/useAuth'
import { useAppModal } from '../composables/useAppModal'
import { useTokenClient } from 'vue3-google-signin'
import { GOOGLE_SIGN_IN_SCOPES } from '../config/env'
import { waitForGoogleIdentityServices } from '../composables/waitForGoogleIdentity'
import { useI18n } from '../i18n'
import TopicScroller from '../components/TopicScroller.vue'
import HomeStoriesStrip from '../components/HomeStoriesStrip.vue'
import PinGrid from '../components/PinGrid.vue'
import ExploreDiscoverSections from '../components/ExploreDiscoverSections.vue'
import PinDetailOverlayHost from '../components/PinDetailOverlayHost.vue'
import api from '../api/index'
import AvatarDisc from '../components/AvatarDisc.vue'
import { getAppScrollRoot } from '../utils/appScrollRoot'
import { redirectAfterAuth } from '../utils/postAuthRedirect'
import { trackLandingViewedOnce } from '../composables/useReferralIntent'
import GuestContestTeaser from '../components/GuestContestTeaser.vue'
import DiscoveryStreakBanner from '../components/DiscoveryStreakBanner.vue'
import { useDiscoveryStreak } from '../composables/useDiscoveryStreak'
import { appSoftRefreshTick } from '../utils/appSoftRefresh'
import { recordEngagementMoment } from '../utils/engagementMoments'

type TabKey = 'forYou' | 'explorer' | 'following'

const { t, currentLang } = useI18n()
const router = useRouter()
const route = useRoute()
const { currentUser, isAuthenticated, toggleSavePin, toggleFollow, socialLogin } = useAuth()
const { showAlert } = useAppModal()

/** KeepAlive : vider le Teleport du header quand une autre route est au-dessus. */
const isActiveHomeRoutePath = computed(() => route.name === 'home' || route.path === '/')

/*
 * Trois instances `usePins()` indépendantes : chacune garde son propre `pins`,
 * son curseur de pagination et son cache. On peut donc switcher entre les tabs
 * sans perdre l'état (chargement, scroll, données) et sans refaire la requête
 * tant qu'on n'a pas explicitement demandé un refresh.
 */
const forYouCtx = usePins()
const exploreCtx = usePins()
const followingCtx = usePins()

const TAB_ORDER: TabKey[] = ['forYou', 'explorer', 'following']

const activeTab = ref<TabKey>('forYou')
const loadedOnce = ref<Record<TabKey, boolean>>({ forYou: false, explorer: false, following: false })
const isPageActive = ref(false)
const sentinelGuest = ref<HTMLElement | null>(null)
const sentinelMobForYou = ref<HTMLElement | null>(null)
const sentinelMobExplore = ref<HTMLElement | null>(null)
const sentinelMobFollowing = ref<HTMLElement | null>(null)
const sentinelDeskForYou = ref<HTMLElement | null>(null)
/** ≥ lg : fil desktop « Pour toi » uniquement (pas de carrousel d’onglets). */
const isLgUp = ref(false)
const activeTopic = ref<string | null>(null)
let homeLoadMoreObserver: IntersectionObserver | null = null
let mqLg: MediaQueryList | null = null

/*
 * Carrousel d'onglets style « app native » :
 *  – l'utilisateur peut glisser le doigt horizontalement et le contenu suit
 *    en temps réel (drag-along), puis on snap à la tab voisine au release ;
 *  – l'underline actif glisse en continu vers la tab cible (et suit le doigt
 *    pendant le drag) — exactement comme l'app mobile Pinova / iOS / Material.
 */
/** Largeur de la pilule (équiv. Tailwind `w-11`), centrée sur le libellé mesuré. */
const HOME_TAB_INDICATOR_W_PX = 44

const swipeViewport = ref<HTMLElement | null>(null)
const homeTabBarRef = ref<HTMLElement | null>(null)
const dragOffsetPx = ref(0)
const dragging = ref(false)
const containerWidthPx = ref(0)
const tabBarWidthPx = ref(0)
/** Centres horizontaux (px) de chaque onglet dans `homeTabBarRef`, depuis le bord gauche de la barre. */
const tabCenterXsPx = ref<number[]>([0, 0, 0])
let activePointerId: number | null = null
let dragStartX = 0
let dragStartY = 0
let dragDirection: 'horizontal' | 'vertical' | null = null
let viewportResizeObserver: ResizeObserver | null = null

const SCROLL_NEAR_BOTTOM_PX = 400
/** Seuil de validation du swipe : 22 % de la largeur du viewport. */
const SWIPE_COMMIT_RATIO = 0.22
/** Décalage minimal avant de considérer un geste comme volontaire. */
const SWIPE_LOCK_THRESHOLD_PX = 8

/** Icônes alignées sur `Pinova-Mobile/src/components/FeedTopTabBar.tsx` (sparkles / compass / people). */
const tabs = computed(() => [
  { key: 'forYou' as TabKey, label: t('home.tabs.forYou'), icon: 'auto_awesome' as const },
  { key: 'explorer' as TabKey, label: t('home.tabs.explorer'), icon: 'explore' as const },
  { key: 'following' as TabKey, label: t('home.tabs.following'), icon: 'group' as const },
])

const activeTabIndex = computed(() => Math.max(0, TAB_ORDER.indexOf(activeTab.value)))

/** Position X (px) de la pilule : centrée sur le bouton onglet mesuré + correction de swipe. */
const indicatorBarTranslateX = computed(() => {
  const i = activeTabIndex.value
  const tabW = Math.max(1, tabBarWidthPx.value)
  const swipeW = Math.max(1, containerWidthPx.value)
  const scaledDrag = (dragOffsetPx.value * tabW) / swipeW
  const centers = tabCenterXsPx.value
  const measured = centers[i]
  const fallbackCenter = (tabW * (i + 0.5)) / TAB_ORDER.length
  const c =
    measured !== undefined && Number.isFinite(measured) && measured > 0 ? measured : fallbackCenter
  return c - HOME_TAB_INDICATOR_W_PX / 2 + scaledDrag
})

function measureTabCenters() {
  const bar = homeTabBarRef.value
  if (!bar || typeof window === 'undefined') return
  const buttons = bar.querySelectorAll<HTMLElement>('.home-feed-tab')
  if (buttons.length !== TAB_ORDER.length) return
  const br = bar.getBoundingClientRect()
  const next: number[] = []
  buttons.forEach((btn) => {
    const r = btn.getBoundingClientRect()
    next.push(r.left + r.width / 2 - br.left)
  })
  tabCenterXsPx.value = next
}

function refreshContainerWidth() {
  const s = swipeViewport.value
  if (s) containerWidthPx.value = s.clientWidth || window.innerWidth || 1
  else containerWidthPx.value = typeof window !== 'undefined' ? window.innerWidth : 1

  const t = homeTabBarRef.value
  if (t) tabBarWidthPx.value = t.clientWidth || containerWidthPx.value
  else tabBarWidthPx.value = containerWidthPx.value

  void nextTick(() => measureTabCenters())
}

function resetSwipeState() {
  dragOffsetPx.value = 0
  dragging.value = false
  dragDirection = null
  activePointerId = null
}

function onSwipePointerDown(e: PointerEvent) {
  // Ignore les pointers de molette / boutons droits / scrolls de souris.
  if (e.pointerType === 'mouse' && e.button !== 0) return
  // Empêche un second pointer (multi-touch) de réinitialiser un swipe en cours.
  if (activePointerId !== null) return
  refreshContainerWidth()
  activePointerId = e.pointerId
  dragStartX = e.clientX
  dragStartY = e.clientY
  dragDirection = null
  dragging.value = false
  dragOffsetPx.value = 0
}

function onSwipePointerMove(e: PointerEvent) {
  if (activePointerId !== e.pointerId) return
  const dx = e.clientX - dragStartX
  const dy = e.clientY - dragStartY

  // Verrouillage de direction : si le mouvement est trop vertical, on laisse le scroll natif.
  if (dragDirection === null) {
    const adx = Math.abs(dx)
    const ady = Math.abs(dy)
    if (adx < SWIPE_LOCK_THRESHOLD_PX && ady < SWIPE_LOCK_THRESHOLD_PX) return
    if (adx > ady * 1.2 && adx >= SWIPE_LOCK_THRESHOLD_PX) {
      dragDirection = 'horizontal'
      dragging.value = true
      ;(e.currentTarget as HTMLElement).setPointerCapture?.(activePointerId)
    } else {
      // Mouvement vertical : on abandonne le swipe pour ne pas bloquer le scroll.
      activePointerId = null
      return
    }
  }

  if (dragDirection === 'horizontal') {
    const idx = activeTabIndex.value
    let offset = dx
    // Résistance aux bords (overshoot avec friction, comme iOS).
    if ((idx === 0 && offset > 0) || (idx === TAB_ORDER.length - 1 && offset < 0)) {
      offset = offset * 0.32
    }
    dragOffsetPx.value = offset
  }
}

function onSwipePointerUp(e: PointerEvent) {
  if (activePointerId !== e.pointerId) return
  if (dragDirection === 'horizontal' && dragging.value) {
    const threshold = containerWidthPx.value * SWIPE_COMMIT_RATIO
    const idx = activeTabIndex.value
    if (dragOffsetPx.value < -threshold && idx < TAB_ORDER.length - 1) {
      void setTab(TAB_ORDER[idx + 1])
    } else if (dragOffsetPx.value > threshold && idx > 0) {
      void setTab(TAB_ORDER[idx - 1])
    }
  }
  resetSwipeState()
}

function onSwipePointerCancel(e: PointerEvent) {
  if (activePointerId !== e.pointerId) return
  resetSwipeState()
}

function handleMqChange() {
  isLgUp.value = mqLg?.matches ?? false
  void nextTick(() => {
    refreshContainerWidth()
    const el = homeTabBarRef.value
    if (el && viewportResizeObserver) viewportResizeObserver.observe(el)
  })
}

const activeCtx = computed(() => {
  switch (activeTab.value) {
    case 'forYou':
      return forYouCtx
    case 'explorer':
      return exploreCtx
    case 'following':
      return followingCtx
    default:
      return forYouCtx
  }
})

/** Sur desktop (≥ lg), le fil unique est toujours « Pour toi ». */
const activePins = computed(() => (isLgUp.value ? forYouCtx.pins.value : activeCtx.value.pins.value))
const activeLoading = computed(() => (isLgUp.value ? forYouCtx.loading.value : activeCtx.value.loading.value))
const activeFetchingMore = computed(() =>
  isLgUp.value ? forYouCtx.isFetchingNextPage.value : activeCtx.value.isFetchingNextPage.value,
)
const activeHasNext = computed(() => (isLgUp.value ? forYouCtx.hasNextPage.value : activeCtx.value.hasNextPage.value))
const activeTopics = computed(() => forYouCtx.topics.value)

/* Tableaux dérivés pour PinGrid (réactivité explicite côté template). */
const forYouPinsView = computed(() => forYouCtx.pins.value)
const explorePinsView = computed(() => exploreCtx.pins.value)
const followingPinsView = computed(() => followingCtx.pins.value)

const suggestionsLoading = ref(false)
const suggestions = ref<Array<{ username: string; display_name: string; avatar_color: string; avatar?: string | null; is_pro?: boolean; reason?: string }>>([])

/** Sujet discover (onglet mobile « Explorer ») — aligné sur /explore. */
const exploreSelectedTopic = ref<string | null>(null)
const exploreStreakActive = computed(() => isPageActive.value && activeTab.value === 'explorer')
const { streak: discoveryStreak } = useDiscoveryStreak(exploreStreakActive)

watch(exploreSelectedTopic, async (topic) => {
  if (!isPageActive.value) return
  if (activeTab.value !== 'explorer') return
  await exploreCtx.fetchDiscoverPins(true, topic, null)
})

/** Charge la tab demandée seulement si elle n'a pas encore été chargée pour la session (cache). */
async function ensureLoaded(tab: TabKey) {
  if (loadedOnce.value[tab]) return
  if (tab === 'forYou') {
    await forYouCtx.fetchHomeFeed(true, activeTopic.value)
  } else if (tab === 'explorer') {
    await exploreCtx.fetchDiscoverPins(true, exploreSelectedTopic.value, null)
  } else if (tab === 'following') {
    if (!isAuthenticated.value) {
      loadedOnce.value.following = true
      return
    }
    await followingCtx.fetchFollowingPins(true)
    if (followingCtx.pins.value.length === 0 && suggestions.value.length === 0) {
      void loadFollowSuggestions()
    }
  }
  loadedOnce.value[tab] = true
}

async function loadFollowSuggestions() {
  suggestionsLoading.value = true
  try {
    const response = await api.get('users/follow-suggestions/')
    suggestions.value = response.data?.results || []
  } catch {
    suggestions.value = []
  } finally {
    suggestionsLoading.value = false
  }
}

let homeTabSwitchCount = 0

const tabScrollTops = ref<Record<TabKey, number>>({ forYou: 0, explorer: 0, following: 0 })

function saveActiveTabScroll() {
  if (typeof document === 'undefined') return
  tabScrollTops.value[activeTab.value] = getAppScrollRoot().scrollTop
}

function restoreTabScroll(tab: TabKey) {
  void nextTick(() => {
    const y = tabScrollTops.value[tab] ?? 0
    getAppScrollRoot().scrollTo({ top: y, behavior: 'auto' })
  })
}

async function setTab(tab: TabKey) {
  if (activeTab.value === tab) return
  saveActiveTabScroll()
  activeTab.value = tab
  homeTabSwitchCount += 1
  if (homeTabSwitchCount >= 2) recordEngagementMoment('feed_engaged')
  await ensureLoaded(tab)
  restoreTabScroll(tab)
  void nextTick(() => connectHomeLoadMoreObserver())
}

function tryFetchNextActive() {
  if (!isPageActive.value) return
  if (isLgUp.value) {
    const ctx = forYouCtx
    if (!ctx.hasNextPage.value || ctx.isFetchingNextPage.value || ctx.loading.value) return
    void forYouCtx.fetchHomeFeed(false, activeTopic.value)
    return
  }
  const ctx = activeCtx.value
  if (!ctx.hasNextPage.value || ctx.isFetchingNextPage.value || ctx.loading.value) return
  if (activeTab.value === 'forYou') void forYouCtx.fetchHomeFeed(false, activeTopic.value)
  else if (activeTab.value === 'explorer') void exploreCtx.fetchDiscoverPins(false, exploreSelectedTopic.value, null)
  else if (activeTab.value === 'following') void followingCtx.fetchFollowingPins(false)
}

let loadMoreScrollHandler: (() => void) | null = null

function maybeLoadMoreOnScroll() {
  if (!isPageActive.value) return
  const root = getAppScrollRoot()
  const scrollTop = root.scrollTop
  const scrollHeight = root.scrollHeight
  const clientHeight = root.clientHeight
  if (scrollTop + clientHeight < scrollHeight - SCROLL_NEAR_BOTTOM_PX) return
  tryFetchNextActive()
}

function disconnectHomeLoadMoreObserver() {
  homeLoadMoreObserver?.disconnect()
  homeLoadMoreObserver = null
}

function getLoadMoreSentinelEl(): HTMLElement | null {
  if (!isAuthenticated.value) return sentinelGuest.value
  if (isLgUp.value) return sentinelDeskForYou.value
  switch (activeTab.value) {
    case 'forYou':
      return sentinelMobForYou.value
    case 'explorer':
      return sentinelMobExplore.value
    case 'following':
      return sentinelMobFollowing.value
    default:
      return null
  }
}

function connectHomeLoadMoreObserver() {
  disconnectHomeLoadMoreObserver()
  if (!isPageActive.value) return
  const el = getLoadMoreSentinelEl()
  if (!el) return
  homeLoadMoreObserver = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      tryFetchNextActive()
    },
    {
      root: (() => {
        const r = getAppScrollRoot()
        return r.id === 'main-content' ? r : null
      })(),
      rootMargin: '320px 0px',
      threshold: 0,
    },
  )
  homeLoadMoreObserver.observe(el)
}

function startPageActivity() {
  if (isPageActive.value) return
  isPageActive.value = true
  loadMoreScrollHandler = () => maybeLoadMoreOnScroll()
  window.addEventListener('scroll', loadMoreScrollHandler, { passive: true })
  void nextTick(() => {
    document.getElementById('main-content')?.addEventListener('scroll', loadMoreScrollHandler!, { passive: true })
  })
  void nextTick(() => connectHomeLoadMoreObserver())
}

function stopPageActivity() {
  if (!isPageActive.value) return
  isPageActive.value = false
  if (loadMoreScrollHandler) {
    window.removeEventListener('scroll', loadMoreScrollHandler)
    document.getElementById('main-content')?.removeEventListener('scroll', loadMoreScrollHandler)
    loadMoreScrollHandler = null
  }
  disconnectHomeLoadMoreObserver()
}

onMounted(async () => {
  if (typeof window !== 'undefined') {
    mqLg = window.matchMedia('(min-width: 1024px)')
    handleMqChange()
    mqLg.addEventListener('change', handleMqChange)
    refreshContainerWidth()
    // Observe la largeur du viewport de swipe pour garder l'indicateur calé même
    // après rotation, redimensionnement de fenêtre ou apparition du clavier.
    if (typeof ResizeObserver !== 'undefined') {
      viewportResizeObserver = new ResizeObserver(() => refreshContainerWidth())
      void nextTick(() => {
        if (swipeViewport.value) viewportResizeObserver?.observe(swipeViewport.value)
        if (homeTabBarRef.value) viewportResizeObserver?.observe(homeTabBarRef.value)
      })
    } else {
      window.addEventListener('resize', refreshContainerWidth, { passive: true })
    }
  }
  startPageActivity()
  if (!isAuthenticated.value) {
    trackLandingViewedOnce(route.path || '/')
  }
  void ensureLoaded('forYou')
  void nextTick(() => connectHomeLoadMoreObserver())
})

onActivated(() => {
  startPageActivity()
})

onDeactivated(() => {
  stopPageActivity()
})

onUnmounted(() => {
  mqLg?.removeEventListener('change', handleMqChange)
  viewportResizeObserver?.disconnect()
  viewportResizeObserver = null
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', refreshContainerWidth)
  }
  stopPageActivity()
})

watch(activeTab, () => {
  void nextTick(() => {
    measureTabCenters()
    connectHomeLoadMoreObserver()
  })
})

watch(isLgUp, () => {
  void nextTick(() => {
    refreshContainerWidth()
    connectHomeLoadMoreObserver()
  })
})

watch([isActiveHomeRoutePath, isLgUp], () => {
  void nextTick(() => refreshContainerWidth())
})

watch(
  () => [activePins.value.length, activeHasNext.value, activeFetchingMore.value, activeTopic.value],
  () => {
    if (!isPageActive.value) return
    maybeLoadMoreOnScroll()
    void nextTick(() => connectHomeLoadMoreObserver())
  },
  { flush: 'post' },
)

watch(activeFetchingMore, (busy, wasBusy) => {
  if (!isPageActive.value) return
  if (busy || wasBusy !== true) return
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      maybeLoadMoreOnScroll()
      void nextTick(() => connectHomeLoadMoreObserver())
    })
  })
})

const selectTopic = (topic: string | null) => {
  if (!isPageActive.value) return
  activeTopic.value = topic
  void forYouCtx.fetchHomeFeed(true, topic)
}

watch(currentLang, () => {
  if (!isPageActive.value) return
  exploreSelectedTopic.value = null
  // Recharge la tab active uniquement ; les autres se rechargent à la prochaine visite.
  loadedOnce.value = { forYou: false, explorer: false, following: false }
  void ensureLoaded(activeTab.value)
  void nextTick(() => measureTabCenters())
})

watch(appSoftRefreshTick, () => {
  if (!isPageActive.value) return
  const revalidate = { revalidate: true as const }
  if (activeTab.value === 'forYou') {
    void forYouCtx.fetchHomeFeed(true, activeTopic.value, revalidate)
  } else if (activeTab.value === 'explorer') {
    void exploreCtx.fetchDiscoverPins(true, exploreSelectedTopic.value, null, revalidate)
  } else if (activeTab.value === 'following' && isAuthenticated.value) {
    void followingCtx.fetchFollowingPins(true, revalidate)
  }
})

const handleToggleSaveFor = async (ctx: typeof forYouCtx, slug: string) => {
  const pin = ctx.pins.value.find((p): p is Pin => isFeedPin(p) && p.slug === slug)
  if (pin) {
    toggleSavePin(pin.id)
  }
  try {
    await ctx.toggleSave(slug)
  } catch (err) {
    if (pin) {
      toggleSavePin(pin.id)
    }
    console.error('Erreur sauvegarde pin', err)
  }
}

const followSuggestedUser = async (username: string) => {
  await toggleFollow(username)
  loadedOnce.value.following = false
  await ensureLoaded('following')
}

const openPin = (slug: string) => {
  router.push({ path: route.path, query: { ...route.query, pin: slug } })
}

const openSponsored = (item: SponsoredAd) => {
  pushFeedItemOverlay(router, item)
}

const googleLandingBusy = ref(false)

const { login: googleTokenLogin } = useTokenClient({
  scope: GOOGLE_SIGN_IN_SCOPES,
  onSuccess: async (response) => {
    googleLandingBusy.value = true
    try {
      const result = await socialLogin('google', response.access_token)
      if (result.success) {
        redirectAfterAuth(router, { user: currentUser.value })
      } else if (result.error) {
        await showAlert(result.error, { variant: 'danger', title: t('modal.errorTitle') })
      }
    } finally {
      googleLandingBusy.value = false
    }
  },
  onError: async () => {
    googleLandingBusy.value = false
    await showAlert(t('login.error.google'), { variant: 'danger', title: t('modal.errorTitle') })
  },
})

async function continueWithGoogleFromLanding() {
  const gsiReady = await waitForGoogleIdentityServices()
  if (!gsiReady) {
    await showAlert(t('login.error.googleNotReady'), { variant: 'warning', title: t('modal.errorTitle') })
    return
  }
  await nextTick()
  googleTokenLogin()
}
</script>

<template>
  <div
    class="w-full min-w-0 px-3 sm:px-6 lg:px-10 xl:px-16 pb-4 sm:pb-6 max-lg:pb-2"
    :class="isAuthenticated ? 'pt-0 lg:pt-6' : 'pt-2 sm:pt-3 lg:pt-4'"
  >
    <div class="min-w-0 max-w-6xl max-lg:max-w-none mx-auto max-lg:mx-0 xl:max-w-none xl:mx-0">
    <!-- Connecté : en-tête personnalisé (caché sur mobile en faveur des tabs natives). -->
    <section v-if="isAuthenticated" class="mb-6 sm:mb-8 hidden sm:block">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl sm:text-3xl font-auth-title font-auth-title--black text-neutral-900 dark:text-neutral-50 mb-1">
            {{ currentUser ? t('home.greetingNamed', { name: currentUser.displayName.split(' ')[0] || currentUser.displayName }) : t('home.greeting') + ' !' }}
          </h1>
          <p class="text-sm sm:text-base text-neutral-500 dark:text-neutral-400">
            {{ t('home.subtitle') }}
          </p>
        </div>
        <div class="hidden sm:flex items-center gap-2 shrink-0">
          <router-link
            v-if="currentUser?.subscription?.plan === 'plus' || currentUser?.subscription?.plan === 'pro'"
            to="/story/create"
            class="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-pink-200 dark:border-pink-800 bg-white dark:bg-neutral-900 text-pink-700 dark:text-pink-600 text-sm font-semibold shadow-sm hover:bg-pink-50 dark:hover:bg-neutral-800 transition-all"
          >
            <span class="material-symbols-outlined text-lg">auto_stories</span>
            {{ t('story.standalone.navShort') }}
          </router-link>
          <router-link
            to="/create"
            class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-pink-700 dark:bg-pink-600 text-white text-sm font-semibold shadow-sm hover:bg-pink-800 dark:hover:opacity-90 hover:shadow-md transition-all"
          >
            <span class="material-symbols-outlined text-lg">add</span>
            {{ t('home.createPin') }}
          </router-link>
        </div>
      </div>
    </section>

    <!-- Stories + sujets : desktop (lg+) — hors header, comme avant -->
    <div
      v-if="isAuthenticated"
      class="pinova-sticky-below-global-header hidden lg:flex lg:flex-col lg:items-stretch lg:gap-3 lg:min-h-0 sticky z-[28] -mx-3 sm:-mx-6 lg:-mx-10 xl:-mx-16 mb-4 pinova-header-chrome px-3 sm:px-6 lg:px-10 xl:px-16 py-2 lg:py-2.5"
    >
      <HomeStoriesStrip v-if="currentUser" class="shrink-0 w-full min-w-0" />
      <div class="flex min-h-11 w-full min-w-0 items-center">
        <TopicScroller
          :topics="activeTopics"
          :active-topic="activeTopic"
          :feed-chrome="true"
          @select="selectTopic"
        />
      </div>
    </div>

    <!--
      Connecté · mobile (< lg) : onglets style app (soulignement actif glissant)
      + carrousel horizontal animé (translate) + geste de swipe gauche/droite
      avec drag-along temps réel (pointer events).
    -->
    <template v-if="isAuthenticated">
      <Teleport v-if="isActiveHomeRoutePath && !isLgUp" to="#pinova-header-home-extension">
        <div class="w-full min-w-0">
          <!-- &lt; lg uniquement : stories + onglets dans le header (Teleport). -->
          <div class="flex w-full flex-col gap-0 touch-pan-y select-none">
            <HomeStoriesStrip v-if="currentUser && !isLgUp" :feed-chrome="true" />

            <div class="relative shrink-0 pt-0" role="tablist" :aria-label="t('home.tabs.ariaLabel')">
              <div
                ref="homeTabBarRef"
                class="relative grid grid-cols-3 items-stretch gap-0 px-2 sm:px-3 pb-2 pt-0"
              >
                <button
                  v-for="tab in tabs"
                  :key="tab.key"
                  type="button"
                  role="tab"
                  :aria-selected="activeTab === tab.key"
                  class="home-feed-tab relative flex min-h-[48px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-center transition-[color,transform,opacity] duration-200 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-700 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-pink-600 dark:focus-visible:ring-offset-neutral-950"
                  :class="
                    activeTab === tab.key
                      ? 'text-pink-700 dark:text-pink-600'
                      : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-300'
                  "
                  @click="setTab(tab.key)"
                >
                  <span
                    class="material-symbols-outlined block text-[20px] leading-none transition-colors duration-200"
                    :class="
                      activeTab === tab.key
                        ? 'text-pink-700 dark:text-pink-600'
                        : 'text-neutral-600 dark:text-neutral-500'
                    "
                    style="font-variation-settings: 'FILL' 0, 'wght' 600, 'GRAD' 0, 'opsz' 24"
                    aria-hidden="true"
                  >{{ tab.icon }}</span>
                  <span
                    class="font-auth-title block max-w-full truncate leading-snug transition-[font-size,color] duration-200"
                    :class="
                      activeTab === tab.key
                        ? 'font-auth-title--black text-[15px] sm:text-base text-pink-700 dark:text-pink-600'
                        : 'text-[13px] sm:text-[14px] text-neutral-600 dark:text-neutral-400'
                    "
                  >{{ tab.label }}</span>
                </button>
                <div
                  class="pointer-events-none absolute bottom-0 left-0 right-0 h-[4px] overflow-visible"
                  aria-hidden="true"
                >
                  <div
                    class="absolute left-0 top-0 h-[4px] will-change-transform"
                    :style="{
                      width: `${HOME_TAB_INDICATOR_W_PX}px`,
                      transform: `translate3d(${indicatorBarTranslateX.toFixed(2)}px, 0, 0)`,
                      transition: dragging
                        ? 'none'
                        : 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)',
                    }"
                  >
                    <span
                      class="home-feed-tab-indicator block h-[4px] w-full rounded-full bg-pink-700 dark:bg-pink-600 shadow-[0_0_12px_rgba(219,39,119,0.45)] dark:bg-pink-600 dark:shadow-[0_0_14px_rgba(219,39,119,0.55)]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Teleport>

      <div
        ref="swipeViewport"
        data-pinova-no-edge-back
        class="lg:hidden overflow-x-hidden w-full touch-pan-y select-none"
        @pointerdown="onSwipePointerDown"
        @pointermove="onSwipePointerMove"
        @pointerup="onSwipePointerUp"
        @pointercancel="onSwipePointerCancel"
      >
        <!-- Un seul onglet monté : réduit mémoire DOM (3 feeds → 1). -->
        <div v-if="activeTab === 'forYou'" class="home-tab-panel w-full min-w-0 px-0 pt-3">
            <TopicScroller :topics="activeTopics" :active-topic="activeTopic" @select="selectTopic" />
            <template
              v-if="forYouCtx.pins.value.length > 0 || (forYouCtx.loading.value && forYouCtx.pins.value.length === 0) || (forYouCtx.isFetchingNextPage.value && forYouCtx.pins.value.length > 0)"
            >
              <PinGrid
                class="mt-4 w-full"
                :pins="forYouPinsView"
                :loading-initial="forYouCtx.loading.value && forYouCtx.pins.value.length === 0"
                :loading-more="forYouCtx.isFetchingNextPage.value && forYouCtx.pins.value.length > 0"
                @toggle-save="(slug: string) => handleToggleSaveFor(forYouCtx, slug)"
                @open-pin="openPin"
                @open-sponsored="openSponsored"
              />
            </template>
            <div
              v-else-if="forYouCtx.pins.value.length === 0"
              class="flex flex-col items-center justify-center py-16 text-center"
            >
              <span class="material-symbols-outlined text-5xl text-neutral-300 dark:text-neutral-600 mb-3">search_off</span>
              <h2 class="text-lg font-auth-title font-auth-title--black text-neutral-700 dark:text-neutral-200 mb-1">{{ t('home.empty.title') }}</h2>
              <p class="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm">{{ t('home.empty.desc') }}</p>
            </div>
            <div
              v-if="forYouCtx.hasNextPage.value && (forYouCtx.pins.value.length > 0 || forYouCtx.loading.value || forYouCtx.isFetchingNextPage.value)"
              ref="sentinelMobForYou"
              class="h-8 w-full shrink-0"
              aria-hidden="true"
            />
        </div>

        <div v-else-if="activeTab === 'explorer'" class="home-tab-panel w-full min-w-0 px-0 pt-3">
            <DiscoveryStreakBanner :streak="discoveryStreak" />
            <ExploreDiscoverSections
              v-model:selected-topic="exploreSelectedTopic"
              :text-query="null"
              :pins="explorePinsView"
              :loading="exploreCtx.loading.value"
              :is-fetching-next-page="exploreCtx.isFetchingNextPage.value"
              :bindings-active="isPageActive && activeTab === 'explorer'"
              :show-intro="false"
              @toggle-save="(slug: string) => handleToggleSaveFor(exploreCtx, slug)"
              @open-pin="openPin"
              @open-sponsored="openSponsored"
            />
            <div
              v-if="exploreCtx.hasNextPage.value && (exploreCtx.pins.value.length > 0 || exploreCtx.loading.value || exploreCtx.isFetchingNextPage.value)"
              ref="sentinelMobExplore"
              class="h-8 w-full shrink-0"
              aria-hidden="true"
            />
        </div>

        <div v-else-if="activeTab === 'following'" class="home-tab-panel w-full min-w-0 px-0 pt-3">
            <template
              v-if="followingCtx.pins.value.length > 0 || (followingCtx.loading.value && followingCtx.pins.value.length === 0) || (followingCtx.isFetchingNextPage.value && followingCtx.pins.value.length > 0)"
            >
              <PinGrid
                class="mt-4 w-full"
                :pins="followingPinsView"
                :loading-initial="followingCtx.loading.value && followingCtx.pins.value.length === 0"
                :loading-more="followingCtx.isFetchingNextPage.value && followingCtx.pins.value.length > 0"
                @toggle-save="(slug: string) => handleToggleSaveFor(followingCtx, slug)"
                @open-pin="openPin"
                @open-sponsored="openSponsored"
              />
            </template>
            <div
              v-else-if="followingCtx.pins.value.length === 0"
              class="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-6 sm:p-8 text-center"
            >
              <p class="text-neutral-700 dark:text-neutral-300 mb-4 text-sm">{{ t('following.empty') }}</p>
              <router-link
                to="/explore"
                class="inline-flex items-center px-5 py-2.5 rounded-full bg-pink-700 dark:bg-pink-600 text-white text-sm font-semibold hover:bg-pink-800 dark:hover:opacity-90 transition"
              >
                {{ t('nav.explore') }}
              </router-link>
              <div class="mt-6 text-left max-w-2xl mx-auto">
                <p class="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-3">{{ t('following.suggest') }}</p>
                <div v-if="suggestionsLoading" class="app-skeleton-wave grid grid-cols-1 sm:grid-cols-2 gap-3" aria-hidden="true">
                  <div
                    v-for="s in 4"
                    :key="s"
                    class="border border-neutral-200 dark:border-neutral-700 rounded-xl p-3 flex items-center justify-between gap-3 animate-pulse"
                  >
                    <div class="flex gap-3 min-w-0 flex-1">
                      <div class="w-9 h-9 rounded-full bg-neutral-200 dark:bg-neutral-700 shrink-0" />
                      <div class="space-y-2 flex-1 pt-1 min-w-0">
                        <div class="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-[70%]" />
                        <div class="h-2.5 bg-neutral-100 dark:bg-neutral-800 rounded w-[40%]" />
                      </div>
                    </div>
                    <div class="h-7 w-[4.25rem] rounded-full bg-neutral-200 dark:bg-neutral-700 shrink-0" />
                  </div>
                </div>
                <div v-else-if="suggestions.length === 0" class="text-sm text-neutral-500 dark:text-neutral-400">
                  {{ t('header.notifications.empty') }}
                </div>
                <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    v-for="s in suggestions"
                    :key="s.username"
                    class="border border-neutral-200 dark:border-neutral-700 rounded-xl p-3 flex items-center justify-between gap-3 bg-white/70 dark:bg-neutral-900/60"
                  >
                    <button type="button" class="flex items-center gap-3 min-w-0" @click="router.push(`/profile/${s.username}`)">
                      <AvatarDisc
                        :color="s.avatar_color || DEFAULT_AVATAR_COLOR_CLASS"
                        frame-class="w-9 h-9 text-xs"
                        text-class="text-white"
                        :has-image="!!s.avatar"
                      >
                        <img v-if="s.avatar" :src="s.avatar" class="w-full h-full object-cover" alt="" />
                        <span v-else class="font-bold">{{ s.display_name?.slice(0, 1) }}</span>
                      </AvatarDisc>
                      <div class="min-w-0">
                        <p class="text-sm font-medium text-neutral-800 dark:text-neutral-100 truncate flex items-center gap-1">
                          <span v-if="s.is_pro" class="material-symbols-outlined text-amber-500 text-sm">verified</span>
                          {{ s.display_name }}
                        </p>
                        <p class="text-xs text-neutral-500 dark:text-neutral-400 truncate">@{{ s.username }}</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      class="px-3 py-1.5 rounded-full bg-pink-700 dark:bg-pink-600 text-white text-xs font-semibold hover:bg-pink-800 dark:hover:opacity-90"
                      @click="followSuggestedUser(s.username)"
                    >
                      {{ t('pin.follow') }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div
              v-if="followingCtx.hasNextPage.value && (followingCtx.pins.value.length > 0 || followingCtx.loading.value || followingCtx.isFetchingNextPage.value)"
              ref="sentinelMobFollowing"
              class="h-8 w-full shrink-0"
              aria-hidden="true"
            />
        </div>
      </div>

      <!-- Desktop connecté : fil « Pour toi » (sujets déjà dans la barre sticky ci-dessus) -->
      <div class="hidden lg:block">
        <template
          v-if="forYouCtx.pins.value.length > 0 || (forYouCtx.loading.value && forYouCtx.pins.value.length === 0) || (forYouCtx.isFetchingNextPage.value && forYouCtx.pins.value.length > 0)"
        >
          <PinGrid
            class="mt-4 w-full"
            :pins="forYouPinsView"
            :loading-initial="forYouCtx.loading.value && forYouCtx.pins.value.length === 0"
            :loading-more="forYouCtx.isFetchingNextPage.value && forYouCtx.pins.value.length > 0"
            @toggle-save="(slug: string) => handleToggleSaveFor(forYouCtx, slug)"
            @open-pin="openPin"
            @open-sponsored="openSponsored"
          />
        </template>
        <div
          v-else-if="forYouCtx.pins.value.length === 0"
          class="flex flex-col items-center justify-center py-20 text-center"
        >
          <span class="material-symbols-outlined text-6xl text-neutral-300 dark:text-neutral-600 mb-4">search_off</span>
          <h2 class="text-xl font-auth-title font-auth-title--black text-neutral-700 dark:text-neutral-200 mb-2">{{ t('home.empty.title') }}</h2>
          <p class="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm">{{ t('home.empty.desc') }}</p>
        </div>
        <div
          v-if="forYouCtx.hasNextPage.value && (forYouCtx.pins.value.length > 0 || forYouCtx.loading.value || forYouCtx.isFetchingNextPage.value)"
          ref="sentinelDeskForYou"
          class="h-8 w-full shrink-0"
          aria-hidden="true"
        />
      </div>
    </template>

    <!-- Invité : Feed First — fil immédiat, hero compact, marketing après le contenu -->
    <template v-else>
      <!-- Hero compact : SEO (h1) + CTA principal unique -->
      <section
        class="mb-3 sm:mb-4 rounded-2xl border border-pink-100/80 dark:border-pink-900/35 bg-gradient-to-r from-pink-50/90 via-white to-neutral-50 dark:from-pink-950/30 dark:via-neutral-950 dark:to-neutral-900 px-3 py-3 sm:px-4 sm:py-3.5 shadow-sm"
        :aria-label="t('home.landing.heroAria')"
      >
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0 text-left">
            <h1 class="text-lg sm:text-xl font-auth-title font-auth-title--black text-neutral-900 dark:text-neutral-50 leading-snug">
              {{ t('home.landing.title') }}
            </h1>
            <p class="mt-1 text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed line-clamp-2 sm:max-w-md">
              {{ t('home.landing.subtitle') }}
            </p>
            <p
              data-testid="landing-social-proof"
              class="mt-1.5 text-[11px] sm:text-xs font-medium text-pink-700/90 dark:text-pink-400/90"
            >
              {{ t('home.landing.socialProof') }}
            </p>
          </div>
          <div class="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <button
              type="button"
              class="inline-flex flex-1 sm:flex-none justify-center items-center gap-2 px-4 py-2.5 rounded-full bg-pink-700 dark:bg-pink-600 text-white text-sm font-bold shadow-sm hover:bg-pink-800 dark:hover:opacity-90 transition min-h-[44px] disabled:opacity-60"
              :disabled="googleLandingBusy"
              @click="continueWithGoogleFromLanding"
            >
              <span
                v-if="googleLandingBusy"
                class="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin shrink-0"
                aria-hidden="true"
              />
              <img
                v-else
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                class="w-4 h-4 shrink-0"
                alt=""
              />
              {{ t('home.landing.cta.primary') }}
            </button>
            <router-link
              to="/login"
              class="text-xs font-semibold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 whitespace-nowrap px-1 py-2"
            >
              {{ t('home.landing.cta.login') }}
            </router-link>
          </div>
        </div>
      </section>

      <!-- Fil visible immédiatement -->
      <TopicScroller :topics="activeTopics" :active-topic="activeTopic" @select="selectTopic" />
      <template
        v-if="activePins.length > 0 || (activeLoading && activePins.length === 0) || (activeFetchingMore && activePins.length > 0)"
      >
        <PinGrid
          class="mt-3 sm:mt-4 w-full"
          :pins="activePins"
          :loading-initial="activeLoading && activePins.length === 0"
          :loading-more="activeFetchingMore && activePins.length > 0"
          @toggle-save="(slug: string) => handleToggleSaveFor(forYouCtx, slug)"
          @open-pin="openPin"
          @open-sponsored="openSponsored"
        />
      </template>
      <div v-else-if="activePins.length === 0" class="flex flex-col items-center justify-center py-16 sm:py-20 text-center">
        <span class="material-symbols-outlined text-5xl sm:text-6xl text-neutral-300 dark:text-neutral-600 mb-3 sm:mb-4">search_off</span>
        <h2 class="text-lg sm:text-xl font-auth-title font-auth-title--black text-neutral-700 dark:text-neutral-200 mb-2">{{ t('home.empty.title') }}</h2>
        <p class="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm">
          {{ t('home.empty.desc') }}
        </p>
      </div>
      <div
        v-if="activeHasNext && (activePins.length > 0 || activeLoading || activeFetchingMore)"
        ref="sentinelGuest"
        class="h-8 w-full shrink-0"
        aria-hidden="true"
      />

      <!-- Après le contenu : concours (secondaire) + arguments marketing -->
      <section class="mt-8 sm:mt-10 space-y-6" :aria-label="t('home.landing.whyTitle')">
        <GuestContestTeaser />

        <div class="rounded-2xl border border-neutral-100 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/40 px-4 py-5 sm:px-6 sm:py-6">
          <h2 class="text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 mb-4">
            {{ t('home.landing.whyTitle') }}
          </h2>
          <ul class="grid sm:grid-cols-3 gap-3 text-left text-sm text-neutral-600 dark:text-neutral-300">
            <li class="flex gap-2 rounded-xl bg-white/80 dark:bg-neutral-900/60 border border-neutral-100/80 dark:border-neutral-800 px-3 py-3">
              <span class="material-symbols-outlined text-pink-700 shrink-0 text-[20px]" aria-hidden="true">travel_explore</span>
              <span>{{ t('home.landing.bullet1') }}</span>
            </li>
            <li class="flex gap-2 rounded-xl bg-white/80 dark:bg-neutral-900/60 border border-neutral-100/80 dark:border-neutral-800 px-3 py-3">
              <span class="material-symbols-outlined text-pink-700 shrink-0 text-[20px]" aria-hidden="true">add_photo_alternate</span>
              <span>{{ t('home.landing.bullet2') }}</span>
            </li>
            <li class="flex gap-2 rounded-xl bg-white/80 dark:bg-neutral-900/60 border border-neutral-100/80 dark:border-neutral-800 px-3 py-3">
              <span class="material-symbols-outlined text-pink-700 shrink-0 text-[20px]" aria-hidden="true">dashboard</span>
              <span>{{ t('home.landing.bullet3') }}</span>
            </li>
          </ul>
          <div class="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            <router-link
              to="/register"
              class="inline-flex justify-center items-center gap-2 px-5 py-2.5 rounded-full border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-100 text-sm font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800 transition min-h-[40px]"
            >
              {{ t('home.landing.cta.register') }}
            </router-link>
            <router-link
              to="/explore"
              class="inline-flex justify-center items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium text-pink-700 dark:text-pink-600 hover:underline min-h-[40px]"
            >
              {{ t('home.landing.cta.explore') }}
              <span class="material-symbols-outlined text-base" aria-hidden="true">arrow_forward</span>
            </router-link>
            <router-link
              to="/premium"
              class="text-xs font-semibold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 px-2 py-2"
            >
              {{ t('home.landing.cta.pricing') }}
            </router-link>
          </div>
        </div>
      </section>
    </template>

    <PinDetailOverlayHost :feed-items="activePins" />
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar {
  scrollbar-width: none;
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>

