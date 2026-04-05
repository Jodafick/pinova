<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { usePins } from '../composables/usePins'
import PinGrid from '../components/PinGrid.vue'

const router = useRouter()
const { currentUser, toggleSavePin } = useAuth()
const { pins, toggleSave } = usePins()

type Tab = 'created' | 'saved'
const activeTab = ref<Tab>('created')

const createdPins = computed(() => {
  if (!currentUser.value) return []
  return pins.value.filter((p) => p.user === currentUser.value!.displayName)
})

const savedPins = computed(() => {
  if (!currentUser.value) return []
  return pins.value.filter((p) => currentUser.value!.savedPins.includes(p.id))
})

const displayPins = computed(() => {
  return activeTab.value === 'created' ? createdPins.value : savedPins.value
})

const handleToggleSave = (id: number) => {
  toggleSave(id)
  toggleSavePin(id)
}

const openPin = (id: number) => {
  router.push(`/pin/${id}`)
}
</script>

<template>
  <div v-if="currentUser" class="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
    <!-- Profile header -->
    <section class="flex flex-col items-center text-center mb-10">
      <div
        class="w-28 h-28 rounded-full flex items-center justify-center text-4xl font-bold text-white shadow-lg mb-4"
        :class="currentUser.avatarColor"
      >
        {{ currentUser.displayName[0] }}
      </div>

      <h1 class="text-2xl sm:text-3xl font-bold text-neutral-900 mb-1">
        {{ currentUser.displayName }}
      </h1>
      <p class="text-neutral-500 text-sm mb-3">@{{ currentUser.username }}</p>

      <p v-if="currentUser.bio" class="text-neutral-600 text-sm max-w-md mb-4">
        {{ currentUser.bio }}
      </p>
      <p v-else class="text-neutral-400 text-sm mb-4 italic">
        Aucune bio pour le moment
      </p>

      <div class="flex items-center gap-6 text-sm text-neutral-600 mb-6">
        <span><strong class="text-neutral-900">{{ currentUser.followers }}</strong> abonnés</span>
        <span class="w-1 h-1 rounded-full bg-neutral-300"></span>
        <span><strong class="text-neutral-900">{{ currentUser.following }}</strong> abonnements</span>
        <span class="w-1 h-1 rounded-full bg-neutral-300"></span>
        <span><strong class="text-neutral-900">{{ createdPins.length }}</strong> pins</span>
      </div>

      <div class="flex items-center gap-3">
        <router-link
          to="/settings"
          class="px-5 py-2.5 rounded-full bg-neutral-100 text-sm font-semibold text-neutral-800 hover:bg-neutral-200 transition"
        >
          Modifier le profil
        </router-link>
        <button class="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center hover:bg-neutral-200 transition">
          <span class="material-symbols-outlined text-neutral-600">share</span>
        </button>
      </div>
    </section>

    <!-- Boards section -->
    <section class="mb-10" v-if="currentUser.boards.length > 0">
      <h2 class="text-lg font-semibold text-neutral-900 mb-4">Tableaux</h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <div
          v-for="board in currentUser.boards"
          :key="board.id"
          class="group relative bg-neutral-100 rounded-2xl overflow-hidden aspect-[4/3] cursor-pointer hover:shadow-md transition"
        >
          <div class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
          <div class="absolute bottom-0 left-0 right-0 p-4 text-white">
            <p class="font-semibold text-sm">{{ board.name }}</p>
            <p class="text-xs opacity-80">{{ board.pinCount }} pins</p>
          </div>
          <div v-if="board.isPrivate" class="absolute top-3 right-3">
            <span class="material-symbols-outlined text-white text-sm">lock</span>
          </div>
        </div>

        <!-- Create new board -->
        <button class="bg-neutral-50 border-2 border-dashed border-neutral-200 rounded-2xl aspect-[4/3] flex flex-col items-center justify-center gap-2 text-neutral-500 hover:border-red-300 hover:text-red-500 transition">
          <span class="material-symbols-outlined text-3xl">add</span>
          <span class="text-sm font-medium">Nouveau tableau</span>
        </button>
      </div>
    </section>

    <!-- Tabs -->
    <div class="flex items-center justify-center gap-1 mb-6 border-b border-neutral-100">
      <button
        class="px-6 py-3 text-sm font-semibold transition-colors border-b-2"
        :class="activeTab === 'created'
          ? 'border-neutral-900 text-neutral-900'
          : 'border-transparent text-neutral-500 hover:text-neutral-700'"
        @click="activeTab = 'created'"
      >
        Créés
      </button>
      <button
        class="px-6 py-3 text-sm font-semibold transition-colors border-b-2"
        :class="activeTab === 'saved'
          ? 'border-neutral-900 text-neutral-900'
          : 'border-transparent text-neutral-500 hover:text-neutral-700'"
        @click="activeTab = 'saved'"
      >
        Enregistrés
      </button>
    </div>

    <!-- Pins grid -->
    <div v-if="displayPins.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
      <span class="material-symbols-outlined text-5xl text-neutral-300 mb-3">
        {{ activeTab === 'created' ? 'add_photo_alternate' : 'bookmark_border' }}
      </span>
      <h3 class="text-lg font-semibold text-neutral-700 mb-1">
        {{ activeTab === 'created' ? 'Aucun pin créé' : 'Aucun pin enregistré' }}
      </h3>
      <p class="text-sm text-neutral-500 mb-4">
        {{ activeTab === 'created'
          ? 'Commencez à créer des pins pour les voir apparaître ici.'
          : 'Enregistrez des pins pour les retrouver facilement.' }}
      </p>
      <router-link
        v-if="activeTab === 'created'"
        to="/create"
        class="px-5 py-2.5 rounded-full bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition"
      >
        Créer un pin
      </router-link>
      <router-link
        v-else
        to="/explore"
        class="px-5 py-2.5 rounded-full bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition"
      >
        Explorer
      </router-link>
    </div>

    <PinGrid
      v-else
      :pins="displayPins"
      @toggle-save="handleToggleSave"
      @open-pin="openPin"
      @more="openPin"
    />
  </div>
</template>
