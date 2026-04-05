<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePins } from '../composables/usePins'
import PinGrid from '../components/PinGrid.vue'

const router = useRouter()
const { topics, getTrendingPins, getPinsByTopic, toggleSave } = usePins()

const selectedCategory = ref<string | null>(null)

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
  'DIY & Crafts': 'from-orange-400 to-red-500',
}

const trending = computed(() => getTrendingPins().slice(0, 6))

const displayPins = computed(() => {
  if (selectedCategory.value) {
    return getPinsByTopic(selectedCategory.value)
  }
  return []
})

const selectCategory = (topic: string) => {
  selectedCategory.value = selectedCategory.value === topic ? null : topic
}

const handleToggleSave = (id: number) => {
  toggleSave(id)
}

const openPin = (id: number) => {
  router.push(`/pin/${id}`)
}
</script>

<template>
  <div class="px-3 sm:px-6 lg:px-10 xl:px-16 py-6 sm:py-8">
    <!-- Hero section -->
    <section class="mb-10">
      <h1 class="text-3xl sm:text-4xl font-bold text-neutral-900 mb-2">Explorer</h1>
      <p class="text-base text-neutral-500 max-w-lg">
        Découvrez les tendances du moment et explorez par catégories
      </p>
    </section>

    <!-- Categories grid -->
    <section class="mb-10">
      <h2 class="text-lg font-semibold text-neutral-900 mb-4">Parcourir par catégorie</h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <button
          v-for="topic in topics"
          :key="topic"
          class="relative overflow-hidden rounded-2xl p-5 text-left text-white transition-all hover:scale-[1.02] hover:shadow-lg"
          :class="[
            'bg-gradient-to-br',
            categoryColors[topic] || 'from-neutral-400 to-neutral-600',
            selectedCategory === topic ? 'ring-2 ring-offset-2 ring-red-500 scale-[1.02] shadow-lg' : ''
          ]"
          @click="selectCategory(topic)"
        >
          <span class="material-symbols-outlined text-3xl mb-2 opacity-90">
            {{ categoryIcons[topic] || 'category' }}
          </span>
          <p class="text-sm font-semibold leading-tight">{{ topic }}</p>
          <p class="text-xs opacity-80 mt-0.5">
            {{ getPinsByTopic(topic).length }} pins
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
          Fermer
        </button>
      </div>
      <PinGrid
        :pins="displayPins"
        @toggle-save="handleToggleSave"
        @open-pin="openPin"
        @more="openPin"
      />
    </section>

    <!-- Trending section -->
    <section v-if="!selectedCategory">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-neutral-900">Tendances du moment</h2>
        <span class="flex items-center gap-1 text-sm text-red-600 font-medium">
          <span class="material-symbols-outlined text-lg">trending_up</span>
          Populaire
        </span>
      </div>
      <PinGrid
        :pins="trending"
        @toggle-save="handleToggleSave"
        @open-pin="openPin"
        @more="openPin"
      />
    </section>
  </div>
</template>
