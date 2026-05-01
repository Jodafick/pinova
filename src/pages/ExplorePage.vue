<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePins } from '../composables/usePins'
import { useAuth } from '../composables/useAuth'
import api from '../api'
import PinGrid from '../components/PinGrid.vue'
import PinSkeleton from '../components/PinSkeleton.vue'
import { useI18n } from '../i18n'

const { t } = useI18n()

const router = useRouter()
const { pins, loading, fetchPins, toggleSave, hasNextPage, isFetchingNextPage } = usePins()
const { toggleSavePin } = useAuth()

type TopicCategory = {
  name: string
  originalName?: string
  pinCount: number
}

const categories = ref<TopicCategory[]>([])
const categoriesLoading = ref(false)
const selectedCategory = ref<string | null>(null)
const categorySearch = ref('')
let categorySearchTimer: ReturnType<typeof setTimeout> | null = null

const categoryIcons: Record<string, string> = {
  'Maison et déco': 'home',
  'Recettes faciles': 'restaurant',
  'Voyages': 'flight',
  'Inspiration design': 'palette',
  'Art & illustration': 'brush',
  'Plantes': 'park',
  'Mode': 'checkroom',
  'Bien-être': 'self_improvement',
  'Photographie': 'photo_camera',
  'DIY & Crafts': 'construction',
}

const categoryColors: Record<string, string> = {
  'Maison et déco': 'from-amber-400 to-orange-500',
  'Recettes faciles': 'from-emerald-400 to-green-600',
  'Voyages': 'from-sky-400 to-blue-600',
  'Inspiration design': 'from-violet-400 to-purple-600',
  'Art & illustration': 'from-pink-400 to-rose-600',
  'Plantes': 'from-lime-400 to-green-500',
  'Mode': 'from-fuchsia-400 to-pink-600',
  'Bien-être': 'from-teal-400 to-cyan-600',
  'Photographie': 'from-slate-400 to-gray-600',
  'DIY & Crafts': 'from-orange-400 to-pink-500',
}

const displayPins = computed(() => pins.value)

const loadCategories = async (query = '') => {
  categoriesLoading.value = true
  try {
    const lang = navigator.language?.split('-')[0] || 'fr'
    const response = await api.get('pins/topics/', { params: { limit: 10, q: query, lang } })
    categories.value = Array.isArray(response.data) ? response.data : []
  } catch (err) {
    console.error('Erreur lors du chargement des categories:', err)
    categories.value = []
  } finally {
    categoriesLoading.value = false
  }
}

const handleScroll = () => {
  const scrollHeight = document.documentElement.scrollHeight
  const scrollTop = document.documentElement.scrollTop
  const clientHeight = document.documentElement.clientHeight

  if (scrollTop + clientHeight >= scrollHeight - 100) {
    if (hasNextPage.value && !isFetchingNextPage.value) {
      fetchPins(false, selectedCategory.value)
    }
  }
}

onMounted(async () => {
  await loadCategories('')
  await fetchPins(true)
  window.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})

const selectCategory = (topic: string) => {
  selectedCategory.value = selectedCategory.value === topic ? null : topic
}

watch(categorySearch, (value) => {
  if (categorySearchTimer) clearTimeout(categorySearchTimer)
  categorySearchTimer = setTimeout(() => {
    void loadCategories(value.trim())
  }, 250)
})

watch(selectedCategory, async (topic) => {
  await fetchPins(true, topic)
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
  <div class="px-3 sm:px-6 lg:px-10 xl:px-16 py-6 sm:py-8">
    <!-- Hero section -->
    <section class="mb-10">
      <h1 class="text-3xl sm:text-4xl font-bold text-neutral-900 mb-2">{{ t('explore.title') }}</h1>
      <p class="text-base text-neutral-500 max-w-lg">
        {{ t('explore.subtitle') }}
      </p>
    </section>

    <!-- Categories grid -->
    <section class="mb-10">
      <div class="flex items-center justify-between gap-3 mb-4">
        <h2 class="text-lg font-semibold text-neutral-900">{{ t('explore.byCategory') }}</h2>
        <div class="w-full max-w-xs">
          <input
            v-model="categorySearch"
            type="text"
            :placeholder="t('explore.categorySearch.placeholder')"
            class="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
        </div>
      </div>
      <div v-if="categoriesLoading" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <div
          v-for="i in 10"
          :key="i"
          class="rounded-2xl h-28 bg-neutral-100 animate-pulse"
        ></div>
      </div>
      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <button
          v-for="category in categories"
          :key="category.originalName || category.name"
          class="relative overflow-hidden rounded-2xl p-5 text-left text-white transition-all hover:scale-[1.02] hover:shadow-lg"
          :class="[
            'bg-gradient-to-br',
            categoryColors[category.name] || 'from-neutral-400 to-neutral-600',
            selectedCategory === (category.originalName || category.name) ? 'ring-2 ring-offset-2 ring-pink-500 scale-[1.02] shadow-lg' : ''
          ]"
          @click="selectCategory(category.originalName || category.name)"
        >
          <span class="material-symbols-outlined text-3xl mb-2 opacity-90">
            {{ categoryIcons[category.name] || 'category' }}
          </span>
          <p class="text-sm font-semibold leading-tight">{{ category.name }}</p>
          <p class="text-xs opacity-80 mt-0.5">
            {{ t('explore.pinsCount', { count: category.pinCount }) }}
          </p>
        </button>
      </div>
    </section>

    <!-- Selected category pins -->
    <section v-if="selectedCategory" class="mb-10">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-neutral-900">{{ selectedCategory }}</h2>
        <button
          class="text-sm text-neutral-500 hover:text-neutral-700 flex items-center gap-1"
          @click="selectedCategory = null"
        >
          <span class="material-symbols-outlined text-base">close</span>
          {{ t('common.close') }}
        </button>
      </div>
      
      <PinSkeleton v-if="loading && displayPins.length === 0" />
      
      <PinGrid
        v-else
        :pins="displayPins"
        @toggle-save="handleToggleSave"
        @open-pin="openPin"
        @more="openPin"
      />
    </section>

    <!-- Trending section -->
    <section v-if="!selectedCategory">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-neutral-900">{{ t('explore.trending') }}</h2>
        <span class="flex items-center gap-1 text-sm text-pink-600 font-medium">
          <span class="material-symbols-outlined text-lg">trending_up</span>
          {{ t('explore.popular') }}
        </span>
      </div>

      <PinSkeleton v-if="loading && displayPins.length === 0" />

      <PinGrid
        v-else
        :pins="displayPins"
        @toggle-save="handleToggleSave"
        @open-pin="openPin"
        @more="openPin"
      />
    </section>

    <!-- Pinterest-like skeleton while fetching next page -->
    <PinSkeleton v-if="isFetchingNextPage" class="mt-6" />
  </div>
</template>
