<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePins } from '../composables/usePins'
import { useAuth } from '../composables/useAuth'
import { useDataSaver } from '../composables/useDataSaver'
import api from '../api'
import PinGrid from '../components/PinGrid.vue'
import { useI18n } from '../i18n'
import { fetchHeaderSearch, type HeaderSearchBoard } from '../composables/useHeaderSearch'

const { t, currentLang } = useI18n()

const route = useRoute()
const router = useRouter()
const { pins, loading, fetchDiscoverPins, toggleSave, hasNextPage, isFetchingNextPage } = usePins()
const { toggleSavePin } = useAuth()
const { isLowDataMode } = useDataSaver()

type TopicCategory = {
  name: string
  slug?: string
  originalName?: string
  icon?: string
  color?: string
  /** URL absolue (admin) — masquée en mode économie de données. */
  coverImage?: string | null
  pinCount: number
}

const categories = ref<TopicCategory[]>([])
const categoriesLoading = ref(false)
const selectedCategory = ref<string | null>(null)
const categorySearch = ref('')
const categoryVisibleCount = ref(10)
const categoriesModalOpen = ref(false)
/** Recherche locale dans la modale uniquement — n’actualise pas l’API. */
const modalCategorySearch = ref('')
let categorySearchTimer: ReturnType<typeof setTimeout> | null = null
const pageSearchInput = ref('')
const boards = ref<HeaderSearchBoard[]>([])
const boardsLoading = ref(false)

const displayPins = computed(() => pins.value)

const exploreTextQuery = computed(() => {
  const raw = route.query.q
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null
})

const visibleCategories = computed(() => categories.value.slice(0, categoryVisibleCount.value))
const canShowMoreCategories = computed(() => categories.value.length > categoryVisibleCount.value)

const modalCategoriesFiltered = computed(() => {
  const q = modalCategorySearch.value.trim().toLowerCase()
  const src = categories.value
  if (!q) return src
  return src.filter((c) => {
    const n = `${c.name} ${c.originalName || ''}`.toLowerCase()
    return n.includes(q)
  })
})

function useCategoryCoverUrl(c?: TopicCategory | null): string | null {
  const u = (c?.coverImage || '').trim()
  if (!u || isLowDataMode.value) return null
  return u
}

const loadCategories = async (query = '') => {
  categoriesLoading.value = true
  try {
    const response = await api.get('pins/topics/', { params: { limit: 30, q: query, lang: currentLang.value } })
    categories.value = Array.isArray(response.data) ? response.data : []
  } catch (err) {
    console.error('Erreur lors du chargement des categories:', err)
    categories.value = []
  } finally {
    categoriesLoading.value = false
  }
}

const loadBoards = async (query = '') => {
  boardsLoading.value = true
  try {
    const result = await fetchHeaderSearch(query, 8)
    boards.value = result.boards
  } catch (err) {
    console.error('Erreur lors du chargement des tableaux:', err)
    boards.value = []
  } finally {
    boardsLoading.value = false
  }
}

const handleScroll = () => {
  const root = document.scrollingElement ?? document.documentElement
  const scrollTop = root.scrollTop
  const scrollHeight = root.scrollHeight
  const clientHeight = root.clientHeight

  if (scrollTop + clientHeight >= scrollHeight - 160) {
    if (hasNextPage.value && !isFetchingNextPage.value && !loading.value) {
      void fetchDiscoverPins(false, selectedCategory.value, exploreTextQuery.value)
    }
  }
}

onMounted(async () => {
  pageSearchInput.value = exploreTextQuery.value ?? ''
  await loadCategories('')
  await loadBoards(exploreTextQuery.value ?? '')
  await fetchDiscoverPins(true, null, exploreTextQuery.value)
  window.addEventListener('scroll', handleScroll, { passive: true })
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
  await fetchDiscoverPins(true, topic, exploreTextQuery.value)
})

watch(exploreTextQuery, async () => {
  pageSearchInput.value = exploreTextQuery.value ?? ''
  await loadBoards(exploreTextQuery.value ?? '')
  await fetchDiscoverPins(true, selectedCategory.value, exploreTextQuery.value)
})

watch(currentLang, async () => {
  await loadCategories(categorySearch.value.trim())
  await loadBoards(exploreTextQuery.value ?? '')
  await fetchDiscoverPins(true, selectedCategory.value, exploreTextQuery.value)
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

function clearExploreSearch() {
  pageSearchInput.value = ''
  router.replace({ path: '/explore', query: {} })
}

function submitPageSearch() {
  const q = pageSearchInput.value.trim()
  router.replace(q ? { path: '/explore', query: { q } } : { path: '/explore', query: {} })
}

const boardsSeeAllRoute = computed(() => ({
  name: 'explore-boards',
  ...(exploreTextQuery.value ? { query: { q: exploreTextQuery.value } } : {}),
}))

function openCategoriesModal() {
  modalCategorySearch.value = ''
  categoriesModalOpen.value = true
}
</script>

<template>
  <div class="px-3 sm:px-6 lg:px-10 xl:px-16 py-6 sm:py-8 space-y-9">
    <section class="rounded-3xl border border-neutral-200/80 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/80 backdrop-blur-sm p-5 sm:p-7">
      <h1 class="text-3xl sm:text-4xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">{{ t('explore.title') }}</h1>
      <p class="text-base text-neutral-500 dark:text-neutral-400 max-w-2xl">
        {{ t('explore.subtitle') }}
      </p>
      <div class="mt-5 flex items-center gap-3 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 px-4 py-3">
        <span class="material-symbols-outlined text-lg text-neutral-400 dark:text-neutral-500">search</span>
        <input
          v-model="pageSearchInput"
          type="text"
          :placeholder="t('header.search.placeholder')"
          class="flex-1 bg-transparent text-sm text-neutral-900 dark:text-neutral-100 outline-none"
          @keyup.enter="submitPageSearch"
        />
        <button
          type="button"
          class="px-4 py-1.5 rounded-full bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold transition"
          @click="submitPageSearch"
        >
          {{ t('common.search') }}
        </button>
      </div>
      <div
        v-if="exploreTextQuery"
        class="mt-4 inline-flex flex-wrap items-center gap-2 rounded-full bg-pink-50 dark:bg-pink-950/40 border border-pink-100 dark:border-pink-900/60 px-4 py-2 text-sm text-pink-900 dark:text-pink-200"
      >
        <span class="material-symbols-outlined text-base text-pink-600">search</span>
        <span>{{ t('explore.searchActive', { q: exploreTextQuery }) }}</span>
        <button
          type="button"
          class="ml-1 text-xs font-semibold text-pink-700 hover:underline"
          @click="clearExploreSearch"
        >
          {{ t('explore.clearSearch') }}
        </button>
      </div>
    </section>

    <section>
      <div class="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div class="flex items-center gap-3 flex-wrap min-w-0">
          <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{{ t('explore.byCategory') }}</h2>
          <button
            type="button"
            class="text-sm font-semibold text-pink-600 dark:text-pink-400 hover:underline shrink-0"
            @click="openCategoriesModal"
          >
            {{ t('explore.allCategories') }}
          </button>
        </div>
        <div class="w-full max-w-xs sm:w-auto shrink-0">
          <input
            v-model="categorySearch"
            type="text"
            :placeholder="t('explore.categorySearch.placeholder')"
            class="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
        </div>
      </div>
      <div v-if="categoriesLoading" class="app-skeleton-wave grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <div
          v-for="i in 10"
          :key="i"
          class="rounded-2xl h-28 bg-neutral-100 dark:bg-neutral-800 animate-pulse"
        ></div>
      </div>
      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <button
          v-for="category in visibleCategories"
          :key="category.originalName || category.name"
          class="relative overflow-hidden rounded-2xl p-5 text-left text-white transition-all hover:scale-[1.02] hover:shadow-lg min-h-[7rem]"
          :class="[
            selectedCategory === (category.originalName || category.name) ? 'ring-2 ring-offset-2 ring-pink-500 scale-[1.02] shadow-lg' : ''
          ]"
          @click="selectCategory(category.originalName || category.name)"
        >
          <img
            v-if="useCategoryCoverUrl(category)"
            :src="useCategoryCoverUrl(category) || ''"
            alt=""
            class="absolute inset-0 w-full h-full object-cover pointer-events-none"
            :fetchpriority="isLowDataMode ? 'low' : 'auto'"
          />
          <div
            v-if="useCategoryCoverUrl(category)"
            class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/30 pointer-events-none"
          />
          <div
            v-else
            class="absolute inset-0 pointer-events-none"
            :style="{ background: category.color || '#6B7280' }"
          />
          <div class="relative z-[1]">
            <span class="material-symbols-outlined text-3xl mb-2 opacity-90 block drop-shadow-md">
              {{ category.icon || 'category' }}
            </span>
            <p class="text-sm font-semibold leading-tight drop-shadow">{{ category.name }}</p>
            <p class="text-xs opacity-90 mt-0.5 drop-shadow">
              {{ t('explore.pinsCount', { count: category.pinCount }) }}
            </p>
          </div>
        </button>
      </div>
      <div v-if="canShowMoreCategories" class="mt-4 flex justify-center">
        <button
          type="button"
          class="px-5 py-2 rounded-full border border-pink-300 dark:border-pink-700 text-sm font-semibold text-pink-700 dark:text-pink-300 hover:bg-pink-50 dark:hover:bg-pink-950/30 transition"
          @click="categoryVisibleCount += 10"
        >
          {{ t('explore.showMoreCategories') }}
        </button>
      </div>
    </section>

    <section aria-labelledby="explore-boards-heading">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2
          id="explore-boards-heading"
          class="text-lg font-semibold text-neutral-900 dark:text-neutral-100 min-w-0"
        >
          {{ t('header.search.sectionBoards') }}
        </h2>
        <router-link
          :to="boardsSeeAllRoute"
          class="shrink-0 self-start sm:self-auto inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-extrabold text-pink-700 dark:text-pink-300 bg-pink-50 dark:bg-pink-950/50 border border-pink-200/90 dark:border-pink-700/70 hover:bg-pink-100/90 dark:hover:bg-pink-900/35 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500 min-h-[40px]"
        >
          {{ t('explore.seeAllBoards') }}
          <span class="material-symbols-outlined text-[18px] leading-none" aria-hidden="true">arrow_forward</span>
        </router-link>
      </div>
      <div v-if="boardsLoading" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        <div
          v-for="i in 4"
          :key="i"
          class="rounded-2xl aspect-[4/3] bg-neutral-100 dark:bg-neutral-800 animate-pulse ring-1 ring-black/5 dark:ring-white/10"
        />
      </div>
      <div v-else-if="boards.length" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        <router-link
          v-for="board in boards"
          :key="`explore-board-${board.id}`"
          :to="`/profile/${encodeURIComponent(board.ownerUsername)}/board/${board.id}`"
          class="group relative rounded-2xl overflow-hidden aspect-[4/3] cursor-pointer transition-all duration-200 ring-1 ring-black/5 dark:ring-white/10 shadow-sm hover:shadow-xl hover:ring-pink-500/25 dark:hover:ring-pink-400/30 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500"
        >
          <div class="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-px bg-neutral-300 dark:bg-neutral-600">
            <template v-if="board.previewImages && board.previewImages.length">
              <img
                v-for="(src, pi) in board.previewImages.slice(0, 4)"
                :key="`${board.id}-${pi}`"
                :src="src"
                alt=""
                class="w-full h-full min-h-0 object-cover bg-neutral-100 dark:bg-neutral-800 transition duration-300 group-hover:scale-[1.03]"
              />
            </template>
            <div v-else-if="board.coverImageUrl" class="col-span-2 row-span-2">
              <img
                :src="board.coverImageUrl"
                :alt="board.name"
                class="w-full h-full object-cover bg-neutral-100 dark:bg-neutral-800 transition duration-300 group-hover:scale-[1.02]"
              />
            </div>
            <div
              v-else
              class="col-span-2 row-span-2 flex items-center justify-center bg-gradient-to-br from-pink-100 to-neutral-100 dark:from-pink-950/50 dark:to-neutral-900"
            >
              <span class="material-symbols-outlined text-4xl text-pink-300 dark:text-pink-600 opacity-90">collections</span>
            </div>
          </div>
          <div
            class="absolute inset-0 bg-gradient-to-t from-neutral-900/78 via-neutral-900/14 to-transparent pointer-events-none transition-opacity duration-200 group-hover:from-neutral-900/85"
          />
          <div class="absolute bottom-0 left-0 right-0 p-3 sm:p-4 text-white pointer-events-none">
            <p class="font-semibold text-sm leading-tight drop-shadow-sm line-clamp-2">{{ board.name }}</p>
            <p class="text-[11px] sm:text-xs opacity-92 mt-0.5 truncate">@{{ board.ownerUsername }}</p>
            <p class="text-[11px] font-semibold text-pink-100 dark:text-pink-200/95 mt-1">
              {{ t('header.search.boardPinsCount', { count: board.pinCount }) }}
            </p>
          </div>
        </router-link>
      </div>
    </section>

    <Teleport to="body">
      <div
        v-if="categoriesModalOpen"
        class="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        @click.self="categoriesModalOpen = false"
      >
        <div
          class="w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xl flex flex-col"
          @click.stop
        >
          <div class="flex items-center justify-between gap-3 p-4 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
            <h3 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{{ t('explore.allCategories') }}</h3>
            <button
              type="button"
              class="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
              @click="categoriesModalOpen = false"
            >
              <span class="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
          <div class="p-4 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
            <input
              v-model="modalCategorySearch"
              type="text"
              :placeholder="t('explore.categorySearch.placeholder')"
              class="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>
          <div class="overflow-y-auto p-4 flex-1 min-h-0">
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              <button
                v-for="category in modalCategoriesFiltered"
                :key="`modal-${category.originalName || category.name}`"
                type="button"
                class="relative overflow-hidden rounded-2xl p-4 text-left text-white transition-all hover:scale-[1.02] hover:shadow-lg min-h-[6.5rem]"
                :class="[
                  selectedCategory === (category.originalName || category.name) ? 'ring-2 ring-offset-2 ring-pink-500' : ''
                ]"
                @click="
                  selectCategory(category.originalName || category.name);
                  categoriesModalOpen = false
                "
              >
                <img
                  v-if="useCategoryCoverUrl(category)"
                  :src="useCategoryCoverUrl(category) || ''"
                  alt=""
                  class="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  :fetchpriority="isLowDataMode ? 'low' : 'auto'"
                />
                <div
                  v-if="useCategoryCoverUrl(category)"
                  class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/30 pointer-events-none"
                />
                <div
                  v-else
                  class="absolute inset-0 pointer-events-none"
                  :style="{ background: category.color || '#6B7280' }"
                />
                <div class="relative z-[1]">
                  <span class="material-symbols-outlined text-2xl mb-1 opacity-90 block drop-shadow-md">
                    {{ category.icon || 'category' }}
                  </span>
                  <p class="text-xs font-semibold leading-tight drop-shadow">{{ category.name }}</p>
                  <p class="text-[11px] opacity-90 mt-0.5 drop-shadow">
                    {{ t('explore.pinsCount', { count: category.pinCount }) }}
                  </p>
                </div>
              </button>
            </div>
            <p
              v-if="!categoriesLoading && modalCategoriesFiltered.length === 0"
              class="text-center text-sm text-neutral-500 py-8"
            >
              {{ t('header.search.empty') }}
            </p>
          </div>
        </div>
      </div>
    </Teleport>

    <section v-if="selectedCategory">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{{ selectedCategory }}</h2>
        <button
          class="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 flex items-center gap-1"
          @click="selectedCategory = null"
        >
          <span class="material-symbols-outlined text-base">close</span>
          {{ t('common.close') }}
        </button>
      </div>
      
      <PinGrid
        v-if="displayPins.length > 0 || (loading && displayPins.length === 0) || (isFetchingNextPage && displayPins.length > 0)"
        :pins="displayPins"
        :loading-initial="loading && displayPins.length === 0"
        :loading-more="isFetchingNextPage && displayPins.length > 0"
        @toggle-save="handleToggleSave"
        @open-pin="openPin"
      />
    </section>

    <section v-if="!selectedCategory">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{{ t('explore.trending') }}</h2>
        <span class="flex items-center gap-1 text-sm text-pink-600 font-medium">
          <span class="material-symbols-outlined text-lg">trending_up</span>
          {{ t('explore.popular') }}
        </span>
      </div>

      <PinGrid
        v-if="displayPins.length > 0 || (loading && displayPins.length === 0) || (isFetchingNextPage && displayPins.length > 0)"
        :pins="displayPins"
        :loading-initial="loading && displayPins.length === 0"
        :loading-more="isFetchingNextPage && displayPins.length > 0"
        @toggle-save="handleToggleSave"
        @open-pin="openPin"
      />
    </section>
  </div>
</template>
