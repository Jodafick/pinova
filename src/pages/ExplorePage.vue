<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onActivated, onDeactivated, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFotos } from '../composables/useFotos'
import { isFeedFoto, type Foto, type SponsoredAd } from '../types'
import { pushFeedItemOverlay } from '../utils/feedOverlayNavigation'
import { useAuth } from '../composables/useAuth'
import { useI18n } from '../i18n'
import FotoDetailOverlayHost from '../components/FotoDetailOverlayHost.vue'
import ExploreDiscoverSections from '../components/ExploreDiscoverSections.vue'
import { getAppScrollRoot } from '../utils/appScrollRoot'

const route = useRoute()
const router = useRouter()
const { currentLang } = useI18n()
const { fotos, loading, fetchDiscoverFotos, toggleSave, hasNextPage, isFetchingNextPage } = useFotos()
const { toggleSavePin } = useAuth()

const displayPins = computed(() => fotos.value)

const exploreTextQuery = computed(() => {
  const raw = route.query.q
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null
})

const selectedCategory = ref<string | null>(null)
const isPageActive = ref(false)

const handleScroll = () => {
  if (!isPageActive.value) return
  const root = getAppScrollRoot()
  const scrollTop = root.scrollTop
  const scrollHeight = root.scrollHeight
  const clientHeight = root.clientHeight

  if (scrollTop + clientHeight >= scrollHeight - 160) {
    if (hasNextPage.value && !isFetchingNextPage.value && !loading.value) {
      void fetchDiscoverFotos(false, selectedCategory.value, exploreTextQuery.value)
    }
  }
}

let exploreScrollHandler: (() => void) | null = null

function startPageActivity() {
  if (isPageActive.value) return
  isPageActive.value = true
  exploreScrollHandler = () => handleScroll()
  window.addEventListener('scroll', exploreScrollHandler, { passive: true })
  void nextTick(() => {
    document.getElementById('main-content')?.addEventListener('scroll', exploreScrollHandler!, { passive: true })
  })
}

function stopPageActivity() {
  if (!isPageActive.value) return
  isPageActive.value = false
  if (exploreScrollHandler) {
    window.removeEventListener('scroll', exploreScrollHandler)
    document.getElementById('main-content')?.removeEventListener('scroll', exploreScrollHandler)
    exploreScrollHandler = null
  }
}

onMounted(() => {
  startPageActivity()
  void fetchDiscoverFotos(true, null, exploreTextQuery.value)
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

watch(selectedCategory, async (topic) => {
  if (!isPageActive.value) return
  await fetchDiscoverFotos(true, topic, exploreTextQuery.value)
})

watch(exploreTextQuery, async () => {
  if (!isPageActive.value) return
  await fetchDiscoverFotos(true, selectedCategory.value, exploreTextQuery.value)
})

watch(currentLang, async () => {
  if (!isPageActive.value) return
  await fetchDiscoverFotos(true, selectedCategory.value, exploreTextQuery.value)
})

const handleToggleSave = async (slug: string) => {
  const foto = fotos.value.find((p): p is Foto => isFeedFoto(p) && p.slug === slug)
  if (foto) {
    toggleSaveFoto(pin.id)
  }
  try {
    await toggleSave(slug)
  } catch (err) {
    if (foto) {
      toggleSaveFoto(pin.id)
    }
    console.error('Erreur sauvegarde foto', err)
  }
}

const openPin = (slug: string) => {
  router.push({ path: route.path, query: { ...route.query, foto: slug } })
}

const openSponsored = (item: SponsoredAd) => {
  pushFeedItemOverlay(router, item)
}

function clearExploreSearch() {
  router.replace({ path: '/explore', query: {} })
}
</script>

<template>
  <div class="fotoce-route-natural-height w-full min-w-0 px-3 sm:px-6 lg:px-10 xl:px-16 py-6 sm:py-8">
    <ExploreDiscoverSections
      v-model:selected-topic="selectedCategory"
      :text-query="exploreTextQuery"
      :pins="displayPins"
      :loading="loading"
      :is-fetching-next-page="isFetchingNextPage"
      :bindings-active="isPageActive"
      @toggle-save="handleToggleSave"
      @open-pin="openPin"
      @open-sponsored="openSponsored"
      @clear-search="clearExploreSearch"
    />
    <FotoDetailOverlayHost :feed-items="displayPins" />
  </div>
</template>
