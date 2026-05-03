<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePins } from '../composables/usePins'
import { useAuth, DEFAULT_AVATAR_COLOR_CLASS } from '../composables/useAuth'
import PinGrid from '../components/PinGrid.vue'
import AvatarDisc from '../components/AvatarDisc.vue'
import { useI18n } from '../i18n'
import api from '../api'

const { t } = useI18n()
const router = useRouter()
const { toggleSavePin, toggleFollow } = useAuth()
const { pins, loading, isFetchingNextPage, fetchFollowingPins, toggleSave } = usePins()
const followingPins = ref<any[]>([])
const suggestionsLoading = ref(false)
const suggestions = ref<Array<{ username: string; display_name: string; avatar_color: string; avatar?: string | null; is_pro?: boolean; reason?: string }>>([])

const displayPins = computed(() => followingPins.value)

const loadFollowingFeed = async () => {
  await fetchFollowingPins(true)
  followingPins.value = [...pins.value]
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
  const pin = pins.value.find((p) => p.slug === slug)
  if (pin) toggleSavePin(pin.id)
  try {
    await toggleSave(slug)
  } catch (err) {
    if (pin) toggleSavePin(pin.id)
  }
}

const openPin = (slug: string) => {
  router.push(`/pin/${slug}`)
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
  <div class="px-3 sm:px-6 lg:px-10 xl:px-16 py-6 sm:py-8">
    <section class="mb-8">
      <h1 class="text-3xl sm:text-4xl font-bold text-neutral-900 mb-2">{{ t('following.title') }}</h1>
      <p class="text-base text-neutral-500 max-w-lg">{{ t('following.subtitle') }}</p>
    </section>

    <PinGrid
      v-if="displayPins.length > 0 || (loading && displayPins.length === 0) || (isFetchingNextPage && displayPins.length > 0)"
      :pins="displayPins"
      :loading-initial="loading && displayPins.length === 0"
      :loading-more="isFetchingNextPage && displayPins.length > 0"
      @toggle-save="handleToggleSave"
      @open-pin="openPin"
      @pin-deleted="onPinDeletedFromGrid"
    />

    <div v-else-if="displayPins.length === 0" class="rounded-2xl border border-neutral-200 bg-white p-8 text-center">
      <p class="text-neutral-700 mb-3">{{ t('following.empty') }}</p>
      <router-link to="/explore" class="inline-flex items-center px-5 py-2.5 rounded-full bg-pink-600 text-white text-sm font-semibold hover:bg-pink-700 transition">
        {{ t('nav.explore') }}
      </router-link>
      <button class="ml-3 inline-flex items-center px-5 py-2.5 rounded-full bg-neutral-100 text-neutral-800 text-sm font-semibold hover:bg-neutral-200 transition" @click="loadFollowingFeed">
        {{ t('following.suggest') }}
      </button>

      <div class="mt-6 text-left max-w-2xl mx-auto">
        <p class="text-sm font-semibold text-neutral-800 mb-3">{{ t('following.suggest') }}</p>
        <div v-if="suggestionsLoading" class="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-pulse" aria-hidden="true">
          <div
            v-for="s in 4"
            :key="s"
            class="border border-neutral-200 rounded-xl p-3 flex items-center justify-between gap-3"
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
        <div v-else-if="suggestions.length === 0" class="text-sm text-neutral-500">{{ t('header.notifications.empty') }}</div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div v-for="suggestion in suggestions" :key="suggestion.username" class="border border-neutral-200 rounded-xl p-3 flex items-center justify-between gap-3">
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
                <p class="text-sm font-medium text-neutral-800 truncate flex items-center gap-1">
                  <span v-if="suggestion.is_pro" class="material-symbols-outlined text-amber-500 text-sm">verified</span>
                  {{ suggestion.display_name }}
                </p>
                <p class="text-xs text-neutral-500 truncate">@{{ suggestion.username }}</p>
              </div>
            </button>
            <button class="px-3 py-1.5 rounded-full bg-pink-600 text-white text-xs font-semibold hover:bg-pink-700" @click="followSuggestedUser(suggestion.username)">
              {{ t('pin.follow') }}
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>
