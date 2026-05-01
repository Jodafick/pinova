<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePins } from '../composables/usePins'
import { useAuth } from '../composables/useAuth'
import PinGrid from '../components/PinGrid.vue'
import PinSkeleton from '../components/PinSkeleton.vue'
import { useI18n } from '../i18n'

const { t } = useI18n()
const router = useRouter()
const { toggleSavePin } = useAuth()
const { pins, loading, isFetchingNextPage, hasNextPage, fetchFollowingPins, fetchRecommendations, toggleSave } = usePins()

const displayPins = computed(() => pins.value)

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

onMounted(async () => {
  await fetchFollowingPins(true)
})
</script>

<template>
  <div class="px-3 sm:px-6 lg:px-10 xl:px-16 py-6 sm:py-8">
    <section class="mb-8">
      <h1 class="text-3xl sm:text-4xl font-bold text-neutral-900 mb-2">{{ t('following.title') }}</h1>
      <p class="text-base text-neutral-500 max-w-lg">{{ t('following.subtitle') }}</p>
    </section>

    <PinSkeleton v-if="loading && displayPins.length === 0" />

    <div v-else-if="displayPins.length === 0" class="rounded-2xl border border-neutral-200 bg-white p-8 text-center">
      <p class="text-neutral-700 mb-3">{{ t('following.empty') }}</p>
      <router-link to="/explore" class="inline-flex items-center px-5 py-2.5 rounded-full bg-pink-600 text-white text-sm font-semibold hover:bg-pink-700 transition">
        {{ t('nav.explore') }}
      </router-link>
      <button
        class="ml-3 inline-flex items-center px-5 py-2.5 rounded-full bg-neutral-100 text-neutral-800 text-sm font-semibold hover:bg-neutral-200 transition"
        @click="fetchRecommendations(true)"
      >
        {{ t('following.suggest') }}
      </button>
    </div>

    <PinGrid
      v-else
      :pins="displayPins"
      @toggle-save="handleToggleSave"
      @open-pin="openPin"
      @more="openPin"
    />

    <PinSkeleton v-if="isFetchingNextPage || hasNextPage" class="mt-6 hidden" />
  </div>
</template>
