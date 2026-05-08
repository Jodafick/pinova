<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onActivated, onDeactivated, watch } from 'vue'
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
const { currentUser, toggleSavePin } = useAuth()

const searchQuery = ref('')
const activeTopic = ref<string | null>(null)
const isPageActive = ref(false)
let searchTrackTimer: ReturnType<typeof setTimeout> | null = null

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

function maybeLoadMoreOnScroll() {
  if (!isPageActive.value) return
  const root = document.scrollingElement ?? document.documentElement
  const scrollTop = root.scrollTop
  const scrollHeight = root.scrollHeight
  const clientHeight = root.clientHeight
  if (scrollTop + clientHeight < scrollHeight - 220) return
  if (hasNextPage.value && !isFetchingNextPage.value && !loading.value) {
    void fetchHomeFeed(false, activeTopic.value)
  }
}

function startPageActivity() {
  if (isPageActive.value) return
  isPageActive.value = true
  window.addEventListener('scroll', maybeLoadMoreOnScroll, { passive: true })
}

function stopPageActivity() {
  if (!isPageActive.value) return
  isPageActive.value = false
  window.removeEventListener('scroll', maybeLoadMoreOnScroll)
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
  },
  { flush: 'post' },
)

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
    <!-- Welcome section -->
    <section class="mb-6 sm:mb-8">
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

    <!-- Empty state -->
    <div v-else-if="filteredPins.length === 0" class="flex flex-col items-center justify-center py-20 text-center">
      <span class="material-symbols-outlined text-6xl text-neutral-300 dark:text-neutral-600 mb-4">search_off</span>
      <h2 class="text-xl font-semibold text-neutral-700 dark:text-neutral-200 mb-2">{{ t('home.empty.title') }}</h2>
      <p class="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm">
        {{ t('home.empty.desc') }}
      </p>
    </div>

    <!-- Floating shortcuts mobile -->
    <router-link
      v-if="currentUser?.subscription?.plan === 'plus' || currentUser?.subscription?.plan === 'pro'"
      to="/story/create"
      class="sm:hidden fixed bottom-24 right-6 w-12 h-12 rounded-full bg-white dark:bg-neutral-900 border-2 border-pink-400 dark:border-pink-600 text-pink-600 dark:text-pink-400 flex items-center justify-center shadow-lg hover:bg-pink-50 dark:hover:bg-neutral-800 hover:scale-105 transition-all z-10"
      :aria-label="t('story.standalone.title')"
    >
      <span class="material-symbols-outlined text-2xl">auto_stories</span>
    </router-link>
    <router-link
      to="/create"
      class="sm:hidden fixed bottom-6 right-6 w-14 h-14 rounded-full bg-pink-600 text-white flex items-center justify-center shadow-xl hover:bg-pink-700 hover:scale-105 transition-all z-10"
      :aria-label="t('home.fab.aria')"
    >
      <span class="material-symbols-outlined text-2xl">add</span>
    </router-link>
  </div>
</template>
