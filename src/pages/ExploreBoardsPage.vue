<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from '../i18n'
import { fetchExploreBoardsPage, type HeaderSearchBoard } from '../composables/useHeaderSearch'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

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

const handleScroll = () => {
  const root = document.scrollingElement ?? document.documentElement
  if (root.scrollTop + root.clientHeight >= root.scrollHeight - 200) {
    loadMore()
  }
}

onMounted(() => {
  void loadBoards(true)
  window.addEventListener('scroll', handleScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})

watch(
  () => route.query.q,
  () => {
    void loadBoards(true)
  },
)

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push({ name: 'explore' })
}
</script>

<template>
  <div class="w-full min-w-0 px-3 sm:px-6 lg:px-10 xl:px-16 py-6 sm:py-8 space-y-6">
    <div class="flex flex-wrap items-center gap-3">
      <button
        type="button"
        class="inline-flex items-center gap-1 text-sm font-semibold text-neutral-600 dark:text-neutral-300 hover:text-pink-600 dark:hover:text-pink-400"
        @click="goBack"
      >
        <span class="material-symbols-outlined text-lg">arrow_back</span>
        {{ t('common.back') }}
      </button>
    </div>

    <header class="space-y-1">
      <h1 class="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100">
        {{ t('explore.allBoards') }}
      </h1>
      <p class="text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl">
        {{ t('explore.allBoardsSubtitle') }}
      </p>
      <p
        v-if="searchQ"
        class="text-xs font-medium text-pink-700 dark:text-pink-300 mt-2 inline-flex items-center gap-1 rounded-full bg-pink-50 dark:bg-pink-950/40 px-3 py-1 border border-pink-100 dark:border-pink-900/50"
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

    <div v-else-if="boards.length" class="w-full min-w-0 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      <router-link
        v-for="board in boards"
        :key="`explore-all-board-${board.id}`"
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

    <p v-else class="text-sm text-neutral-500 dark:text-neutral-400 py-12 text-center">{{ t('header.search.empty') }}</p>

    <div v-if="loadingMore" class="flex justify-center py-6">
      <div class="inline-flex items-center gap-2 text-sm text-neutral-500">
        <span class="material-symbols-outlined animate-spin text-lg">progress_activity</span>
        {{ t('common.loading') }}
      </div>
    </div>
  </div>
</template>
