<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from '../i18n'
import { fetchExploreBoardsPage, type HeaderSearchBoard } from '../composables/useHeaderSearch'

const { t } = useI18n()
const route = useRoute()

const boards = ref<HeaderSearchBoard[]>([])
const page = ref(1)
const hasNext = ref(false)
const loading = ref(true)
const loadingMore = ref(false)
const error = ref<string | null>(null)

const searchQ = computed(() => {
  const raw = route.query.q
  return typeof raw === 'string' && raw.trim() ? raw.trim() : ''
})

async function loadBoards(reset: boolean) {
  if (reset) {
    page.value = 1
    boards.value = []
    hasNext.value = false
  }
  if (reset) loading.value = true
  else loadingMore.value = true
  error.value = null
  try {
    const res = await fetchExploreBoardsPage({
      q: searchQ.value,
      page: page.value,
      pageSize: 24,
    })
    boards.value = reset ? res.results : [...boards.value, ...res.results]
    hasNext.value = !!res.next && res.results.length > 0
  } catch (e) {
    console.error(e)
    error.value = t('explore.boardsLoadError')
    if (reset) boards.value = []
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

function loadMore() {
  if (!hasNext.value || loadingMore.value || loading.value) return
  page.value += 1
  void loadBoards(false)
}

const loadMoreSentinelRef = ref<HTMLElement | null>(null)
let loadMoreObserver: IntersectionObserver | null = null

function setupLoadMoreObserver() {
  loadMoreObserver?.disconnect()
  const el = loadMoreSentinelRef.value
  if (!el || typeof IntersectionObserver === 'undefined') return
  loadMoreObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) loadMore()
    },
    { root: null, rootMargin: '240px 0px', threshold: 0 },
  )
  loadMoreObserver.observe(el)
}

onMounted(() => {
  void loadBoards(true)
})

watch(loading, async (isLoading) => {
  if (!isLoading) {
    await nextTick()
    setupLoadMoreObserver()
  } else {
    loadMoreObserver?.disconnect()
  }
})

onUnmounted(() => {
  loadMoreObserver?.disconnect()
  loadMoreObserver = null
})

watch(
  () => route.query.q,
  () => {
    void loadBoards(true)
  },
)
</script>

<template>
  <div class="w-full min-w-0 px-3 sm:px-6 lg:px-10 xl:px-16 py-6 sm:py-8 space-y-6">
    <header class="space-y-1">
      <h1 class="max-lg:hidden text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100">
        {{ t('explore.allBoards') }}
      </h1>
      <p class="text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl">
        {{ t('explore.allBoardsSubtitle') }}
      </p>
      <p
        v-if="searchQ"
        class="text-xs font-medium text-pink-700 dark:text-pink-600 mt-2 inline-flex items-center gap-1 rounded-full bg-pink-50 dark:bg-pink-950/40 px-3 py-1 border border-pink-100 dark:border-pink-900/50"
      >
        <span class="material-symbols-outlined text-sm">search</span>
        {{ searchQ }}
      </p>
    </header>

    <p v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>

    <div v-if="loading" class="app-skeleton-wave w-full min-w-0 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      <div
        v-for="i in 8"
        :key="i"
        class="rounded-2xl aspect-[4/3] bg-neutral-100 dark:bg-neutral-800 animate-pulse ring-1 ring-black/5 dark:ring-white/10"
      />
    </div>

    <template v-if="!loading">
      <div v-if="boards.length" class="w-full min-w-0 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        <router-link
          v-for="board in boards"
          :key="`explore-all-board-${board.id}`"
          :to="`/profile/${encodeURIComponent(board.ownerUsername)}/board/${board.id}`"
          class="group relative rounded-2xl overflow-hidden aspect-[4/3] cursor-pointer transition-all duration-200 ring-1 ring-black/5 dark:ring-white/10 shadow-sm hover:shadow-xl hover:ring-pink-700/25 dark:hover:ring-pink-700/30 dark:hover:ring-pink-600/30 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-700 dark:outline-pink-600"
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
              <span class="material-symbols-outlined text-4xl text-pink-700 dark:text-pink-600 opacity-90">collections</span>
            </div>
          </div>
          <div
            class="absolute inset-0 bg-gradient-to-t from-neutral-900/78 via-neutral-900/14 to-transparent pointer-events-none transition-opacity duration-200 group-hover:from-neutral-900/85"
          />
          <div class="absolute bottom-0 left-0 right-0 p-3 sm:p-4 text-white pointer-events-none">
            <p class="font-semibold text-sm leading-tight drop-shadow-sm line-clamp-2">{{ board.name }}</p>
            <p class="text-[11px] sm:text-xs opacity-92 mt-0.5 truncate">@{{ board.ownerUsername }}</p>
            <p class="text-[11px] font-semibold text-pink-700 dark:text-pink-600/95 mt-1">
              {{ t('header.search.boardPinsCount', { count: board.pinCount }) }}
            </p>
          </div>
        </router-link>

        <template v-if="loadingMore">
          <div
            v-for="i in 6"
            :key="`explore-boards-more-skel-${i}`"
            class="rounded-2xl aspect-[4/3] bg-neutral-100 dark:bg-neutral-800 animate-pulse ring-1 ring-black/5 dark:ring-white/10"
          />
        </template>
      </div>

      <div
        v-else-if="loadingMore"
        class="app-skeleton-wave w-full min-w-0 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4"
      >
        <div
          v-for="i in 8"
          :key="`explore-boards-empty-more-skel-${i}`"
          class="rounded-2xl aspect-[4/3] bg-neutral-100 dark:bg-neutral-800 animate-pulse ring-1 ring-black/5 dark:ring-white/10"
        />
      </div>

      <p v-else class="text-sm text-neutral-500 dark:text-neutral-400 py-12 text-center">{{ t('header.search.empty') }}</p>

      <div ref="loadMoreSentinelRef" class="h-8 w-full shrink-0" aria-hidden="true" />
    </template>
  </div>
</template>
