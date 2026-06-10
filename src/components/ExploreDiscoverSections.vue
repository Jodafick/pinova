<script setup lang="ts">
/**
 * Bloc « catégories + tableaux + grille discover » partagé entre /explore
 * et l’onglet mobile « Explorer » sur la home (même logique, même disposition).
 */
import { ref, computed, watch, onMounted, onActivated } from 'vue'
import type { FeedItem, SponsoredAd } from '../types'
import api from '../api/index'
import PinGrid from './PinGrid.vue'
import PinovaModal from './ui/PinovaModal.vue'
import { useI18n } from '../i18n'
import { useDataSaver } from '../composables/useDataSaver'
import { fetchExploreBoardsPage, fetchHeaderSearch, type HeaderSearchBoard } from '../composables/useHeaderSearch'

const { t, currentLang } = useI18n()
const { isLowDataMode } = useDataSaver()

type TopicCategory = {
  name: string
  slug?: string
  originalName?: string
  icon?: string
  color?: string
  coverImage?: string | null
  pinCount: number
}

const props = withDefaults(
  defineProps<{
    /** Sujet discover actif (sync bidirectionnel avec le parent). */
    selectedTopic: string | null
    /** Filtre texte (?q=) — null en home embarquée. */
    textQuery?: string | null
    pins: FeedItem[]
    loading: boolean
    isFetchingNextPage: boolean
    /** Affiche le bloc titre / sous-titre / badge recherche (page /explore). */
    showIntro?: boolean
    /** Si false, les watchers API (recherche catégories, etc.) sont suspendus. */
    bindingsActive?: boolean
  }>(),
  {
    textQuery: null,
    showIntro: true,
    bindingsActive: true,
  },
)

const emit = defineEmits<{
  'update:selectedTopic': [value: string | null]
  'toggle-save': [slug: string]
  'open-pin': [slug: string]
  'open-sponsored': [item: SponsoredAd]
  'clear-search': []
}>()

/** Nombre de catégories affichées dans le bandeau horizontal ; le reste passe par le sheet. */
const EXPLORE_CATEGORY_STRIP_MAX = 10

const categories = ref<TopicCategory[]>([])
const categoriesLoading = ref(false)
const categoriesModalOpen = ref(false)
const modalCategorySearch = ref('')
const boards = ref<HeaderSearchBoard[]>([])
const boardsLoading = ref(false)

const visibleCategories = computed(() => categories.value.slice(0, EXPLORE_CATEGORY_STRIP_MAX))
const canShowMoreCategories = computed(() => categories.value.length > EXPLORE_CATEGORY_STRIP_MAX)

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
    const trimmed = query.trim()
    if (trimmed) {
      const result = await fetchHeaderSearch(trimmed, 8)
      boards.value = result.boards
    } else {
      const result = await fetchExploreBoardsPage({ page: 1, pageSize: 8 })
      boards.value = result.results
    }
  } catch (err) {
    console.error('Erreur lors du chargement des tableaux:', err)
    boards.value = []
  } finally {
    boardsLoading.value = false
  }
}

async function reloadDiscoverMeta() {
  await loadCategories('')
  await loadBoards(props.textQuery ?? '')
}

const boardsSeeAllRoute = computed(() => ({
  name: 'explore-boards',
  ...(props.textQuery ? { query: { q: props.textQuery } } : {}),
}))

function selectCategory(topic: string) {
  const next = props.selectedTopic === topic ? null : topic
  emit('update:selectedTopic', next)
}

function openCategoriesModal() {
  modalCategorySearch.value = ''
  categoriesModalOpen.value = true
}

watch(categoriesModalOpen, (open) => {
  if (!open) modalCategorySearch.value = ''
})

watch(
  () => props.textQuery,
  async () => {
    if (!props.bindingsActive) return
    await loadBoards(props.textQuery ?? '')
  },
)

watch(
  () => props.bindingsActive,
  (active, wasActive) => {
    if (!active || wasActive) return
    void reloadDiscoverMeta()
  },
)

watch(currentLang, async () => {
  if (!props.bindingsActive) return
  await reloadDiscoverMeta()
})

onMounted(async () => {
  await reloadDiscoverMeta()
})

onActivated(() => {
  void reloadDiscoverMeta()
})

function onToggleSave(slug: string) {
  emit('toggle-save', slug)
}

function onOpenPin(slug: string) {
  emit('open-pin', slug)
}

function onOpenSponsored(item: SponsoredAd) {
  emit('open-sponsored', item)
}
</script>

<template>
  <div class="explore-discover-sections w-full min-w-0 space-y-6 sm:space-y-9">
    <section
      v-if="showIntro"
      class="rounded-3xl border border-neutral-200/80 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/80 backdrop-blur-sm p-5 sm:p-7"
    >
      <h1 class="text-3xl sm:text-4xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">{{ t('explore.title') }}</h1>
      <p class="text-base text-neutral-500 dark:text-neutral-400 max-w-2xl">
        {{ t('explore.subtitle') }}
      </p>
      <div
        v-if="textQuery"
        class="mt-4 inline-flex flex-wrap items-center gap-2 rounded-full bg-pink-50 dark:bg-pink-950/40 border border-pink-100 dark:border-pink-900/60 px-4 py-2 text-sm text-pink-700 dark:text-pink-600"
      >
        <PinovaIcon name="search" class="text-base text-pink-700" />
        <span>{{ t('explore.searchActive', { q: textQuery }) }}</span>
        <button type="button" class="ml-1 text-xs font-semibold text-pink-700 hover:underline" @click="emit('clear-search')">
          {{ t('explore.clearSearch') }}
        </button>
      </div>
    </section>

    <section>
      <div class="flex items-center justify-between gap-3 mb-4 min-w-0">
        <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100 min-w-0 truncate pr-2">
          {{ t('explore.byCategory') }}
        </h2>
        <button
          type="button"
          class="shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs sm:text-sm font-extrabold text-pink-700 dark:text-pink-600 bg-pink-50 dark:bg-pink-950/50 border border-pink-200/90 dark:border-pink-700/70 shadow-sm shadow-pink-900/5 hover:bg-pink-100/90 dark:hover:bg-pink-900/35 active:scale-[0.98] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-700 dark:outline-pink-600"
          @click="openCategoriesModal"
        >
          <PinovaIcon name="apps" class="text-[18px] leading-none text-pink-700 dark:text-pink-600" />
          {{ t('explore.allCategories') }}
          <PinovaIcon name="expand_more" class="text-[18px] leading-none opacity-80" />
        </button>
      </div>
      <div v-if="categoriesLoading" class="flex items-center gap-3 overflow-x-auto pb-1 pt-0.5 no-scrollbar touch-pan-x">
        <div
          v-for="i in 8"
          :key="i"
          class="shrink-0 w-[10.25rem] sm:w-40 h-[7rem] rounded-2xl bg-[#f3f4f6] dark:bg-[#141418] animate-pulse ring-1 ring-black/5 dark:ring-white/10"
        />
      </div>
      <div
        v-else-if="!categories.length"
        class="rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-700 px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400"
      >
        {{ t('explore.categoriesEmpty') }}
      </div>
      <div
        v-else
        class="flex items-center gap-3 overflow-x-auto pb-1 pt-0.5 no-scrollbar snap-x snap-mandatory scroll-pl-0.5 scroll-pr-1 touch-pan-x"
      >
        <button
          v-for="category in visibleCategories"
          :key="category.originalName || category.name"
          type="button"
          class="snap-start shrink-0 w-[10.25rem] sm:w-40 min-h-[7rem] relative overflow-hidden rounded-2xl p-4 text-left text-white transition-all active:scale-[0.98]"
          :class="[
            selectedTopic === (category.originalName || category.name)
              ? 'ring-2 ring-pink-700 dark:ring-pink-600 ring-offset-2 ring-offset-white dark:ring-offset-[#07070a] shadow-lg'
              : 'ring-1 ring-black/10 dark:ring-white/10',
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
          <div v-else class="absolute inset-0 pointer-events-none" :style="{ background: category.color || '#6B7280' }" />
          <div class="relative z-[1]">
            <PinovaIcon :name="category.icon || 'category'" class="text-2xl mb-1.5 opacity-90 block drop-shadow-md" />
            <p class="text-xs font-semibold leading-tight drop-shadow line-clamp-2">{{ category.name }}</p>
            <p class="text-[11px] opacity-90 mt-0.5 drop-shadow">
              {{ t('explore.pinsCount', { count: category.pinCount }) }}
            </p>
          </div>
        </button>
        <button
          v-if="canShowMoreCategories"
          type="button"
          class="snap-start shrink-0 w-[10.25rem] sm:w-40 min-h-[7rem] flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-pink-200/90 dark:border-pink-700/70 bg-gradient-to-br from-pink-50 to-white dark:from-pink-950/40 dark:to-neutral-900/80 text-pink-700 dark:text-pink-600 text-xs font-bold px-2 text-center shadow-sm shadow-pink-900/10 hover:from-pink-100 hover:to-pink-50/80 dark:hover:from-pink-900/50 dark:hover:to-neutral-900 transition active:scale-[0.98] ring-1 ring-pink-100/80 dark:ring-pink-800/40"
          @click="openCategoriesModal"
        >
          <PinovaIcon name="grid_view" class="text-2xl text-pink-700 dark:text-pink-600" />
          {{ t('explore.showMoreCategories') }}
        </button>
      </div>
    </section>

    <section aria-labelledby="explore-boards-heading">
      <div class="flex items-center justify-between gap-3 mb-3 flex-nowrap min-w-0">
        <h2 id="explore-boards-heading" class="text-lg font-semibold text-neutral-900 dark:text-neutral-100 min-w-0 truncate">
          {{ t('header.search.sectionBoards') }}
        </h2>
        <router-link
          :to="boardsSeeAllRoute"
          class="shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs sm:text-sm font-extrabold text-pink-700 dark:text-pink-600 bg-pink-50 dark:bg-pink-950/50 border border-pink-200/90 dark:border-pink-700/70 hover:bg-pink-100/90 dark:hover:bg-pink-900/35 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-700 dark:outline-pink-600"
        >
          {{ t('explore.seeAllBoards') }}
          <PinovaIcon name="arrow_forward" class="text-[18px] leading-none" />
        </router-link>
      </div>
      <div v-if="boardsLoading" class="flex items-center gap-3 sm:gap-4 overflow-x-auto pb-1 pt-0.5 no-scrollbar touch-pan-x">
        <div
          v-for="i in 6"
          :key="i"
          class="shrink-0 w-44 aspect-[4/3] rounded-2xl bg-[#f3f4f6] dark:bg-[#141418] animate-pulse ring-1 ring-black/5 dark:ring-white/10"
        />
      </div>
      <div
        v-else-if="boards.length"
        class="flex items-center gap-3 sm:gap-4 overflow-x-auto pb-1 pt-0.5 no-scrollbar snap-x snap-mandatory scroll-pl-0.5 scroll-pr-1 touch-pan-x"
      >
        <router-link
          v-for="board in boards"
          :key="`explore-board-${board.id}`"
          :to="`/profile/${encodeURIComponent(board.ownerUsername)}/board/${board.id}`"
          class="snap-start group relative shrink-0 w-44 aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 ring-1 ring-black/5 dark:ring-white/10 shadow-sm hover:shadow-xl hover:ring-pink-700/25 dark:hover:ring-pink-700/30 dark:hover:ring-pink-600/30 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-700 dark:outline-pink-600"
        >
          <div class="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-px bg-neutral-300 dark:bg-neutral-600">
            <template v-if="board.previewImages && board.previewImages.length">
              <img
                v-for="(src, pi) in board.previewImages.slice(0, 4)"
                :key="`${board.id}-${pi}`"
                :src="src"
                alt=""
                class="w-full h-full min-h-0 object-cover bg-[#f3f4f6] dark:bg-[#101014] transition duration-300 group-hover:scale-[1.03]"
              />
            </template>
            <div v-else-if="board.coverImageUrl" class="col-span-2 row-span-2">
              <img
                :src="board.coverImageUrl"
                :alt="board.name"
                class="w-full h-full object-cover bg-[#f3f4f6] dark:bg-[#101014] transition duration-300 group-hover:scale-[1.02]"
              />
            </div>
            <div
              v-else
              class="col-span-2 row-span-2 flex items-center justify-center bg-gradient-to-br from-pink-100 to-neutral-100 dark:from-pink-950/50 dark:to-[#0a0a0c]"
            >
              <PinovaIcon name="collections" class="text-4xl text-pink-700 dark:text-pink-600 opacity-90" />
            </div>
          </div>
          <div
            class="absolute inset-0 bg-gradient-to-t from-neutral-900/78 via-neutral-900/14 to-transparent pointer-events-none transition-opacity duration-200 group-hover:from-neutral-900/85"
          />
          <div class="absolute bottom-0 left-0 right-0 p-2.5 sm:p-3 text-white pointer-events-none">
            <p class="font-semibold text-xs sm:text-sm leading-tight drop-shadow-sm line-clamp-2">{{ board.name }}</p>
            <p class="text-[10px] sm:text-[11px] opacity-92 mt-0.5 truncate">@{{ board.ownerUsername }}</p>
            <p class="text-[10px] font-semibold text-pink-700 dark:text-pink-600/95 mt-0.5">
              {{ t('header.search.boardPinsCount', { count: board.pinCount }) }}
            </p>
          </div>
        </router-link>
      </div>
      <p
        v-else
        class="rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-700 px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400"
      >
        {{ t('explore.boardsEmpty') }}
      </p>
    </section>

    <PinovaModal
      v-model:open="categoriesModalOpen"
      presentation="tallSheet"
      presentation-lg="center"
      :title="t('explore.allCategories')"
      :max-width="560"
    >
      <template #headerEnd>
        <button
          type="button"
          class="inline-flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 hover:bg-black/[0.06] dark:text-neutral-300 dark:hover:bg-white/[0.08] transition"
          :aria-label="t('common.close')"
          @click="categoriesModalOpen = false"
        >
          <PinovaIcon name="close" class="text-[22px] leading-none" />
        </button>
      </template>
      <div class="-mx-2 sm:mx-0">
        <div class="sticky top-0 z-[1] -mx-1 px-1 pb-3 pt-0 bg-[var(--glass-fill)]/95 dark:bg-[var(--glass-fill)]/95 backdrop-blur-md">
          <input
            v-model="modalCategorySearch"
            type="search"
            autocomplete="off"
            :placeholder="t('explore.categorySearch.placeholder')"
            class="w-full px-3 py-2.5 rounded-xl border border-neutral-200/90 dark:border-neutral-700 bg-white/90 dark:bg-neutral-900/90 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-pink-700 dark:focus:ring-pink-600"
          />
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 pb-2">
          <button
            v-for="category in modalCategoriesFiltered"
            :key="`modal-${category.originalName || category.name}`"
            type="button"
            class="relative overflow-hidden rounded-2xl p-4 text-left text-white transition-all active:scale-[0.98] min-h-[6.5rem]"
            :class="[
              selectedTopic === (category.originalName || category.name)
                ? 'ring-2 ring-offset-2 ring-pink-700 dark:ring-pink-600 dark:ring-offset-[#07070a] shadow-lg'
                : 'ring-1 ring-black/10 dark:ring-white/10',
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
            <div v-else class="absolute inset-0 pointer-events-none" :style="{ background: category.color || '#6B7280' }" />
            <div class="relative z-[1]">
              <PinovaIcon :name="category.icon || 'category'" class="text-2xl mb-1 opacity-90 block drop-shadow-md" />
              <p class="text-xs font-semibold leading-tight drop-shadow">{{ category.name }}</p>
              <p class="text-[11px] opacity-90 mt-0.5 drop-shadow">
                {{ t('explore.pinsCount', { count: category.pinCount }) }}
              </p>
            </div>
          </button>
        </div>
        <p v-if="!categoriesLoading && modalCategoriesFiltered.length === 0" class="text-center text-sm text-neutral-500 py-8">
          {{ t('header.search.empty') }}
        </p>
      </div>
    </PinovaModal>

    <section v-if="selectedTopic">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{{ selectedTopic }}</h2>
        <button
          type="button"
          class="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 flex items-center gap-1"
          @click="emit('update:selectedTopic', null)"
        >
          <PinovaIcon name="close" class="text-base" />
          {{ t('common.close') }}
        </button>
      </div>

      <PinGrid
        v-if="pins.length > 0 || (loading && pins.length === 0) || (isFetchingNextPage && pins.length > 0)"
        class="w-full"
        :pins="pins"
        :loading-initial="loading && pins.length === 0"
        :loading-more="isFetchingNextPage && pins.length > 0"
        @toggle-save="onToggleSave"
        @open-pin="onOpenPin"
        @open-sponsored="onOpenSponsored"
      />
      <div
        v-else-if="!loading"
        class="flex flex-col items-center justify-center py-16 text-center"
      >
        <PinovaIcon name="search_off" class="text-5xl text-neutral-300 dark:text-neutral-600 mb-3" />
        <h2 class="text-lg font-semibold text-neutral-700 dark:text-neutral-200 mb-1">{{ t('home.empty.title') }}</h2>
        <p class="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm">{{ t('home.empty.desc') }}</p>
      </div>
    </section>

    <section v-if="!selectedTopic">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{{ t('explore.trending') }}</h2>
        <PinovaIcon :name="t('explore.popular')" class="flex items-center gap-1 text-sm text-pink-700 font-medium" />
      </div>

      <PinGrid
        v-if="pins.length > 0 || (loading && pins.length === 0) || (isFetchingNextPage && pins.length > 0)"
        class="w-full"
        :pins="pins"
        :loading-initial="loading && pins.length === 0"
        :loading-more="isFetchingNextPage && pins.length > 0"
        @toggle-save="onToggleSave"
        @open-pin="onOpenPin"
        @open-sponsored="onOpenSponsored"
      />
      <div
        v-else-if="!loading"
        class="flex flex-col items-center justify-center py-16 text-center"
      >
        <PinovaIcon name="search_off" class="text-5xl text-neutral-300 dark:text-neutral-600 mb-3" />
        <h2 class="text-lg font-semibold text-neutral-700 dark:text-neutral-200 mb-1">{{ t('home.empty.title') }}</h2>
        <p class="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm">{{ t('home.empty.desc') }}</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
