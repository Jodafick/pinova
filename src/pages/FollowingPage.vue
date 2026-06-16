<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFotos } from '../composables/useFotos'
import { isFeedFoto, type Foto, type SponsoredAd } from '../types'
import { pushFeedItemOverlay } from '../utils/feedOverlayNavigation'
import { useAuth, DEFAULT_AVATAR_COLOR_CLASS } from '../composables/useAuth'
import FotoGrid from '../components/FotoGrid.vue'
import FotoDetailOverlayHost from '../components/FotoDetailOverlayHost.vue'
import AvatarDisc from '../components/AvatarDisc.vue'
import { useI18n } from '../i18n'
import api from '../api/index'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const { toggleSavePin, toggleFollow } = useAuth()
const { fotos, loading, isFetchingNextPage, fetchFollowingFotos, toggleSave } = useFotos()
const followingPins = ref<any[]>([])
const suggestionsLoading = ref(false)
const suggestions = ref<Array<{ username: string; display_name: string; avatar_color: string; avatar?: string | null; is_pro?: boolean; reason?: string }>>([])

const displayPins = computed(() => followingPins.value)

const loadFollowingFeed = async () => {
  await fetchFollowingFotos(true)
  followingPins.value = [...fotos.value]
  if (followingPins.value.length === 0) {
    suggestionsLoading.value = true
    try {
      const response = await api.get('users/follow-suggestions/')
      suggestions.value = response.data?.results || []
    } catch {
      suggestions.value = []
    } finally {
      suggestionsLoading.value = false
    }
  } else {
    suggestions.value = []
  }
}

const handleToggleSave = async (slug: string) => {
  const foto = fotos.value.find((p): p is Foto => isFeedFoto(p) && p.slug === slug)
  if (foto) toggleSaveFoto(pin.id)
  try {
    await toggleSave(slug)
  } catch (err) {
    if (foto) toggleSaveFoto(pin.id)
  }
}

const openPin = (slug: string) => {
  router.push({ path: route.path, query: { ...route.query, foto: slug } })
}

const openSponsored = (item: SponsoredAd) => {
  pushFeedItemOverlay(router, item)
}

function onPinDeletedFromGrid(slug: string) {
  followingPins.value = followingPins.value.filter((p) => p.slug !== slug)
}

onMounted(async () => {
  await loadFollowingFeed()
})

onActivated(async () => {
  await loadFollowingFeed()
})

const followSuggestedUser = async (username: string) => {
  await toggleFollow(username)
  await loadFollowingFeed()
}
</script>

<template>
  <div class="w-full min-w-0 px-3 sm:px-6 lg:px-10 xl:px-16 py-6 sm:py-8">
    <section class="mb-8">
      <h1 class="text-3xl sm:text-4xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">{{ t('following.title') }}</h1>
      <p class="text-base text-neutral-500 dark:text-neutral-400 max-w-lg">{{ t('following.subtitle') }}</p>
    </section>

    <FotoGrid
      v-if="displayPins.length > 0 || (loading && displayPins.length === 0) || (isFetchingNextPage && displayPins.length > 0)"
      class="w-full"
      :pins="displayPins"
      :loading-initial="loading && displayPins.length === 0"
      :loading-more="isFetchingNextPage && displayPins.length > 0"
      @toggle-save="handleToggleSave"
      @open-pin="openPin"
      @open-sponsored="openSponsored"
      @pin-deleted="onPinDeletedFromGrid"
    />

    <div v-else-if="displayPins.length === 0" class="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-8 text-center">
      <p class="text-neutral-700 dark:text-neutral-300 mb-3">{{ t('following.empty') }}</p>
      <router-link to="/explore" class="inline-flex items-center px-5 py-2.5 rounded-full bg-pink-700 dark:bg-pink-600 text-white text-sm font-semibold hover:bg-pink-800 dark:hover:opacity-90 transition">
        {{ t('nav.explore') }}
      </router-link>
      <button class="ml-3 inline-flex items-center px-5 py-2.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 text-sm font-semibold hover:bg-neutral-200 dark:hover:bg-neutral-700 transition" @click="loadFollowingFeed">
        {{ t('following.suggest') }}
      </button>

      <div class="mt-6 text-left max-w-2xl mx-auto">
        <p class="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-3">{{ t('following.suggest') }}</p>
        <div v-if="suggestionsLoading" class="app-skeleton-wave w-full min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-3" aria-hidden="true">
          <div
            v-for="s in 4"
            :key="s"
            class="border border-neutral-200 dark:border-neutral-700 rounded-xl p-3 flex items-center justify-between gap-3 animate-pulse"
          >
            <div class="flex gap-3 min-w-0 flex-1">
              <div class="w-9 h-9 rounded-full bg-neutral-200 shrink-0" />
              <div class="space-y-2 flex-1 pt-1 min-w-0">
                <div class="h-3 bg-neutral-200 rounded w-[70%]" />
                <div class="h-2.5 bg-neutral-100 rounded w-[40%]" />
              </div>
            </div>
            <div class="h-7 w-[4.25rem] rounded-full bg-neutral-200 shrink-0" />
          </div>
        </div>
        <div v-else-if="suggestions.length === 0" class="text-sm text-neutral-500 dark:text-neutral-400">{{ t('header.notifications.empty') }}</div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div v-for="suggestion in suggestions" :key="suggestion.username" class="border border-neutral-200 dark:border-neutral-700 rounded-xl p-3 flex items-center justify-between gap-3 bg-white/70 dark:bg-neutral-900/60">
            <button class="flex items-center gap-3 min-w-0" @click="router.push(`/profile/${suggestion.username}`)">
              <AvatarDisc
                :color="suggestion.avatar_color || DEFAULT_AVATAR_COLOR_CLASS"
                frame-class="w-9 h-9 text-xs"
                text-class="text-white"
                :has-image="!!suggestion.avatar"
              >
                <img v-if="suggestion.avatar" :src="suggestion.avatar" class="w-full h-full object-cover" />
                <span v-else class="font-bold">{{ suggestion.display_name?.slice(0, 1) }}</span>
              </AvatarDisc>
              <div class="min-w-0">
                <p class="text-sm font-medium text-neutral-800 dark:text-neutral-100 truncate flex items-center gap-1">
                  <FotoceIcon name="verified" class="text-amber-500 text-sm" />
                  {{ suggestion.display_name }}
                </p>
                <p class="text-xs text-neutral-500 dark:text-neutral-400 truncate">@{{ suggestion.username }}</p>
              </div>
            </button>
            <button class="px-3 py-1.5 rounded-full bg-pink-700 dark:bg-pink-600 text-white text-xs font-semibold hover:bg-pink-800 dark:hover:opacity-90" @click="followSuggestedUser(suggestion.username)">
              {{ t('foto.follow') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <FotoDetailOverlayHost :feed-items="displayPins" />
  </div>
</template>
