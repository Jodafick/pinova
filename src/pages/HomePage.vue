<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePins } from '../composables/usePins'
import { useAuth } from '../composables/useAuth'
import TopicScroller from '../components/TopicScroller.vue'
import PinGrid from '../components/PinGrid.vue'

const router = useRouter()
const { searchPins, topics, toggleSave } = usePins()
const { currentUser, toggleSavePin } = useAuth()

const searchQuery = ref('')
const activeTopic = ref<string | null>(null)

const filteredPins = computed(() => {
  return searchPins(searchQuery.value, activeTopic.value)
})

const selectTopic = (topic: string | null) => {
  activeTopic.value = topic
}

const handleToggleSave = (id: number) => {
  toggleSave(id)
  toggleSavePin(id)
}

const openPin = (id: number) => {
  router.push(`/pin/${id}`)
}

const openMore = (id: number) => {
  router.push(`/pin/${id}`)
}
</script>

<template>
  <div class="px-3 sm:px-6 lg:px-10 xl:px-16 py-4 sm:py-6">
    <!-- Welcome section -->
    <section class="mb-6 sm:mb-8">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl sm:text-3xl font-bold text-neutral-900 mb-1">
            Bonjour{{ currentUser ? ', ' + currentUser.displayName.split(' ')[0] : '' }} !
          </h1>
          <p class="text-sm sm:text-base text-neutral-500">
            Voici des idées inspirées par vos centres d'intérêt
          </p>
        </div>
        <router-link
          to="/create"
          class="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-600 text-white text-sm font-semibold shadow-sm hover:bg-red-700 hover:shadow-md transition-all"
        >
          <span class="material-symbols-outlined text-lg">add</span>
          Créer un pin
        </router-link>
      </div>
    </section>

    <!-- Search bar for home page -->
    <div class="mb-5 sm:hidden">
      <div class="flex items-center gap-2 rounded-full bg-neutral-100 px-4 py-2.5 text-sm focus-within:ring-2 focus-within:ring-red-500">
        <span class="material-symbols-outlined text-lg text-neutral-400">search</span>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Rechercher des idées..."
          class="bg-transparent outline-none flex-1 text-sm"
        />
      </div>
    </div>

    <TopicScroller :topics="topics" :active-topic="activeTopic" @select="selectTopic" />

    <!-- Empty state -->
    <div v-if="filteredPins.length === 0" class="flex flex-col items-center justify-center py-20 text-center">
      <span class="material-symbols-outlined text-6xl text-neutral-300 mb-4">search_off</span>
      <h2 class="text-xl font-semibold text-neutral-700 mb-2">Aucun résultat</h2>
      <p class="text-sm text-neutral-500 max-w-sm">
        Essayez une autre recherche ou explorez d'autres catégories pour trouver de l'inspiration.
      </p>
    </div>

    <PinGrid
      v-else
      :pins="filteredPins"
      @toggle-save="handleToggleSave"
      @open-pin="openPin"
      @more="openMore"
    />

    <!-- Floating create button mobile -->
    <router-link
      to="/create"
      class="sm:hidden fixed bottom-6 right-6 w-14 h-14 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xl hover:bg-red-700 hover:scale-105 transition-all z-10"
      aria-label="Créer un pin"
    >
      <span class="material-symbols-outlined text-2xl">add</span>
    </router-link>
  </div>
</template>
