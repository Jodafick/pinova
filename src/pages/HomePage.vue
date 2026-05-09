<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onActivated, onDeactivated, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { usePins } from '../composables/usePins'
import { useAuth } from '../composables/useAuth'
import { useI18n } from '../i18n'
import TopicScroller from '../components/TopicScroller.vue'
import HomeStoriesStrip from '../components/HomeStoriesStrip.vue'
import PinGrid from '../components/PinGrid.vue'

const { t, currentLang } = useI18n()

const router = useRouter()
const { pins, topics, loading, fetchHomeFeed, trackSearchInteraction, toggleSave, hasNextPage, isFetchingNextPage } = usePins()
const { currentUser, isAuthenticated, toggleSavePin } = useAuth()

const searchQuery = ref('')
const activeTopic = ref<string | null>(null)
const isPageActive = ref(false)
const loadMoreSentinelRef = ref<HTMLElement | null>(null)
let searchTrackTimer: ReturnType<typeof setTimeout> | null = null
let homeLoadMoreObserver: IntersectionObserver | null = null

/** Marge basse (px) : alignée sur l’esprit d’Explore (~160) mais un peu plus large pour le fil d’accueil. */
const SCROLL_NEAR_BOTTOM_PX = 400

const filteredPins = computed(() => {
  return pins.value.filter((pin) => {
    const matchesTopic = activeTopic.value ? pin.topic === activeTopic.value : true
    const q = searchQuery.value.trim().toLowerCase()
    const matchesQuery = q
      ? [pin.title, pin.description, pin.user].some((f) =>
          f.toLowerCase().includes(q),
        )
      : true
    return matchesTopic && matchesQuery
  })
})

function tryFetchNextHomePage() {
  if (!isPageActive.value) return
  if (!hasNextPage.value || isFetchingNextPage.value || loading.value) return
  void fetchHomeFeed(false, activeTopic.value)
}

function maybeLoadMoreOnScroll() {
  if (!isPageActive.value) return
  const root = document.scrollingElement ?? document.documentElement
  const scrollTop = root.scrollTop
  const scrollHeight = root.scrollHeight
  const clientHeight = root.clientHeight
  if (scrollTop + clientHeight < scrollHeight - SCROLL_NEAR_BOTTOM_PX) return
  tryFetchNextHomePage()
}

function disconnectHomeLoadMoreObserver() {
  homeLoadMoreObserver?.disconnect()
  homeLoadMoreObserver = null
}

function connectHomeLoadMoreObserver() {
  disconnectHomeLoadMoreObserver()
  if (!isPageActive.value) return
  const el = loadMoreSentinelRef.value
  if (!el) return
  homeLoadMoreObserver = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      tryFetchNextHomePage()
    },
    { root: null, rootMargin: '320px 0px', threshold: 0 },
  )
  homeLoadMoreObserver.observe(el)
}

function startPageActivity() {
  if (isPageActive.value) return
  isPageActive.value = true
  window.addEventListener('scroll', maybeLoadMoreOnScroll, { passive: true })
  void nextTick(() => connectHomeLoadMoreObserver())
}

function stopPageActivity() {
  if (!isPageActive.value) return
  isPageActive.value = false
  window.removeEventListener('scroll', maybeLoadMoreOnScroll)
  disconnectHomeLoadMoreObserver()
}

onMounted(() => {
  startPageActivity()
  void fetchHomeFeed(true, activeTopic.value)
})

onActivated(() => {
  startPageActivity()
})

onDeactivated(() => {
  stopPageActivity()
})

onUnmounted(() => {
  stopPageActivity()
})

watch(
  () => [filteredPins.value.length, hasNextPage.value, isFetchingNextPage.value, activeTopic.value],
  () => {
    if (!isPageActive.value) return
    // Si le viewport est plus grand que le contenu, enchaîner automatiquement les pages.
    maybeLoadMoreOnScroll()
    void nextTick(() => connectHomeLoadMoreObserver())
  },
  { flush: 'post' },
)

// Après une page suivante : le scroll ne se redéclenche pas toujours quand le DOM grandit — re-tester une fois le layout stabilisé.
watch(isFetchingNextPage, (busy, wasBusy) => {
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
  void fetchHomeFeed(true, topic)
}

watch(searchQuery, (value) => {
  if (searchTrackTimer) clearTimeout(searchTrackTimer)
  const query = value.trim()
  if (query.length < 2) return
  searchTrackTimer = setTimeout(() => {
    void trackSearchInteraction(query)
  }, 500)
})

watch(currentLang, () => {
  if (!isPageActive.value) return
  void fetchHomeFeed(true, activeTopic.value)
})

const handleToggleSave = async (slug: string) => {
  const pin = pins.value.find(p => p.slug === slug)
  if (pin) {
    toggleSavePin(pin.id)
  }
  try {
    await toggleSave(slug)
  } catch (err) {
    if (pin) {
      toggleSavePin(pin.id)
    }
    console.error('Erreur sauvegarde pin', err)
  }
}

const openPin = (slug: string) => {
  router.push(`/pin/${slug}`)
}

</script>

<template>
  <div class="w-full min-w-0 px-3 sm:px-6 lg:px-10 xl:px-16 py-4 sm:py-6">
    <div class="min-w-0 max-w-6xl xl:max-w-none mx-auto xl:mx-0">
    <!-- Invité : landing (priorité mobile / premier écran) -->
    <section
      v-if="!isAuthenticated"
      class="mb-8 sm:mb-10 rounded-3xl border border-pink-100/90 dark:border-pink-900/40 bg-gradient-to-br from-pink-50/95 via-white to-neutral-50 dark:from-pink-950/35 dark:via-neutral-950 dark:to-neutral-900 px-4 py-8 sm:px-8 sm:py-10 text-center shadow-sm"
    >
      <h1 class="text-2xl sm:text-3xl md:text-4xl font-auth-title font-auth-title--black text-neutral-900 dark:text-neutral-50 leading-tight">
        {{ t('home.landing.title') }}
      </h1>
      <p class="mt-3 text-sm sm:text-base text-neutral-600 dark:text-neutral-300 max-w-xl mx-auto leading-relaxed">
        {{ t('home.landing.subtitle') }}
      </p>
      <div class="mt-6 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-2.5 sm:gap-3 max-w-md mx-auto">
        <router-link
          to="/register"
          class="inline-flex justify-center items-center gap-2 px-5 py-3 rounded-full bg-pink-600 text-white text-sm font-bold shadow-md hover:bg-pink-700 transition min-h-[44px]"
        >
          {{ t('home.landing.cta.register') }}
        </router-link>
        <router-link
          to="/login"
          class="inline-flex justify-center items-center gap-2 px-5 py-3 rounded-full border border-neutral-200 dark:border-neutral-600 bg-white/90 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-100 text-sm font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800 transition min-h-[44px]"
        >
          {{ t('home.landing.cta.login') }}
        </router-link>
        <router-link
          to="/explore"
          class="inline-flex justify-center items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold text-pink-700 dark:text-pink-300 hover:underline min-h-[44px]"
        >
          {{ t('home.landing.cta.explore') }}
          <span class="material-symbols-outlined text-lg" aria-hidden="true">arrow_forward</span>
        </router-link>
      </div>
      <ul class="mt-8 grid sm:grid-cols-3 gap-3 sm:gap-4 text-left text-sm text-neutral-600 dark:text-neutral-300 max-w-3xl mx-auto">
        <li class="flex gap-2 rounded-2xl bg-white/70 dark:bg-neutral-900/50 border border-neutral-100/80 dark:border-neutral-800 px-3 py-3">
          <span class="material-symbols-outlined text-pink-500 shrink-0" aria-hidden="true">travel_explore</span>
          <span>{{ t('home.landing.bullet1') }}</span>
        </li>
        <li class="flex gap-2 rounded-2xl bg-white/70 dark:bg-neutral-900/50 border border-neutral-100/80 dark:border-neutral-800 px-3 py-3">
          <span class="material-symbols-outlined text-pink-500 shrink-0" aria-hidden="true">add_photo_alternate</span>
          <span>{{ t('home.landing.bullet2') }}</span>
        </li>
        <li class="flex gap-2 rounded-2xl bg-white/70 dark:bg-neutral-900/50 border border-neutral-100/80 dark:border-neutral-800 px-3 py-3 sm:col-span-1">
          <span class="material-symbols-outlined text-pink-500 shrink-0" aria-hidden="true">dashboard</span>
          <span>{{ t('home.landing.bullet3') }}</span>
        </li>
      </ul>
    </section>

    <!-- Connecté : en-tête personnalisé -->
    <section v-else class="mb-6 sm:mb-8">
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
            class="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-pink-200 dark:border-pink-800 bg-white dark:bg-neutral-900 text-pink-700 dark:text-pink-300 text-sm font-semibold shadow-sm hover:bg-pink-50 dark:hover:bg-neutral-800 transition-all"
          >
            <span class="material-symbols-outlined text-lg">auto_stories</span>
            {{ t('story.standalone.navShort') }}
          </router-link>
          <router-link
            to="/create"
            class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-pink-600 text-white text-sm font-semibold shadow-sm hover:bg-pink-700 hover:shadow-md transition-all"
          >
            <span class="material-symbols-outlined text-lg">add</span>
            {{ t('home.createPin') }}
          </router-link>
        </div>
      </div>
    </section>

    <HomeStoriesStrip v-if="currentUser" />

    <p
      v-if="!isAuthenticated"
      class="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-3"
    >
      {{ t('home.landing.previewTitle') }}
    </p>

    <!-- Search bar for home page -->
    <div class="mb-5 sm:hidden">
      <div class="flex items-center gap-2 rounded-full bg-neutral-100 dark:bg-neutral-800 px-4 py-2.5 text-sm focus-within:ring-2 focus-within:ring-pink-500">
        <span class="material-symbols-outlined text-lg text-neutral-400 dark:text-neutral-500">search</span>
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="t('home.search.placeholder')"
          class="bg-transparent outline-none flex-1 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
        />
      </div>
    </div>

    <TopicScroller :topics="topics" :active-topic="activeTopic" @select="selectTopic" />

    <template
      v-if="filteredPins.length > 0 || (loading && filteredPins.length === 0) || (isFetchingNextPage && filteredPins.length > 0)"
    >
      <PinGrid
        class="mt-4 w-full"
        :pins="filteredPins"
        :loading-initial="loading && filteredPins.length === 0"
        :loading-more="isFetchingNextPage && filteredPins.length > 0"
        @toggle-save="handleToggleSave"
        @open-pin="openPin"
      />
    </template>

    <!-- Sentinelle scroll infini (IO + scroll) : déclenche même sans nouvel événement scroll après append DOM. -->
    <div
      v-if="hasNextPage && (filteredPins.length > 0 || loading || isFetchingNextPage)"
      ref="loadMoreSentinelRef"
      class="h-8 w-full shrink-0"
      aria-hidden="true"
    />

    <!-- Empty state -->
    <div v-else-if="filteredPins.length === 0" class="flex flex-col items-center justify-center py-20 text-center">
      <span class="material-symbols-outlined text-6xl text-neutral-300 dark:text-neutral-600 mb-4">search_off</span>
      <h2 class="text-xl font-semibold text-neutral-700 dark:text-neutral-200 mb-2">{{ t('home.empty.title') }}</h2>
      <p class="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm">
        {{ t('home.empty.desc') }}
      </p>
    </div>

    <!-- Floating shortcuts mobile (compte requis) -->
    <router-link
      v-if="currentUser && (currentUser.subscription?.plan === 'plus' || currentUser.subscription?.plan === 'pro')"
      to="/story/create"
      class="sm:hidden fixed bottom-24 right-6 w-12 h-12 rounded-full bg-white dark:bg-neutral-900 border-2 border-pink-400 dark:border-pink-600 text-pink-600 dark:text-pink-400 flex items-center justify-center shadow-lg hover:bg-pink-50 dark:hover:bg-neutral-800 hover:scale-105 transition-all z-10"
      :aria-label="t('story.standalone.title')"
    >
      <span class="material-symbols-outlined text-2xl">auto_stories</span>
    </router-link>
    <router-link
      v-if="currentUser"
      to="/create"
      class="sm:hidden fixed bottom-6 right-6 w-14 h-14 rounded-full bg-pink-600 text-white flex items-center justify-center shadow-xl hover:bg-pink-700 hover:scale-105 transition-all z-10"
      :aria-label="t('home.fab.aria')"
    >
      <span class="material-symbols-outlined text-2xl">add</span>
    </router-link>
    </div>
  </div>
</template>
