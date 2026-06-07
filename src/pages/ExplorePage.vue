<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onActivated, onDeactivated, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { feedPinsOnly, usePins } from '../composables/usePins'
import { isFeedPin, type Pin } from '../types'
import { useAuth } from '../composables/useAuth'
import { useI18n } from '../i18n'
import PinDetailOverlayHost from '../components/PinDetailOverlayHost.vue'
import ExploreDiscoverSections from '../components/ExploreDiscoverSections.vue'
import { getAppScrollRoot } from '../utils/appScrollRoot'

const route = useRoute()
const router = useRouter()
const { currentLang } = useI18n()
const { pins, loading, fetchDiscoverPins, toggleSave, hasNextPage, isFetchingNextPage } = usePins()
const { toggleSavePin } = useAuth()

const displayPins = computed(() => pins.value)

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
      void fetchDiscoverPins(false, selectedCategory.value, exploreTextQuery.value)
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

onMounted(async () => {
  startPageActivity()
  await fetchDiscoverPins(true, null, exploreTextQuery.value)
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
  await fetchDiscoverPins(true, topic, exploreTextQuery.value)
})

watch(exploreTextQuery, async () => {
  if (!isPageActive.value) return
  await fetchDiscoverPins(true, selectedCategory.value, exploreTextQuery.value)
})

watch(currentLang, async () => {
  if (!isPageActive.value) return
  await fetchDiscoverPins(true, selectedCategory.value, exploreTextQuery.value)
})

const handleToggleSave = async (slug: string) => {
  const pin = pins.value.find((p): p is Pin => isFeedPin(p) && p.slug === slug)
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
  router.push({ path: route.path, query: { ...route.query, pin: slug } })
}

function clearExploreSearch() {
  router.replace({ path: '/explore', query: {} })
}
</script>

<template>
  <div class="pinova-route-natural-height w-full min-w-0 px-3 sm:px-6 lg:px-10 xl:px-16 py-6 sm:py-8">
    <ExploreDiscoverSections
      v-model:selected-topic="selectedCategory"
      :text-query="exploreTextQuery"
      :pins="displayPins"
      :loading="loading"
      :is-fetching-next-page="isFetchingNextPage"
      :bindings-active="isPageActive"
      @toggle-save="handleToggleSave"
      @open-pin="openPin"
      @clear-search="clearExploreSearch"
    />
    <PinDetailOverlayHost :pins="feedPinsOnly(displayPins)" />
  </div>
</template>
