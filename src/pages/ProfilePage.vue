<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { usePins } from '../composables/usePins'
import type { User } from '../types'
import PinGrid from '../components/PinGrid.vue'
import PinSkeleton from '../components/PinSkeleton.vue'

const router = useRouter()
const route = useRoute()
const { currentUser, toggleSavePin, fetchUserProfile, toggleFollow: apiToggleFollow, createBoard: apiCreateBoard } = useAuth()
const { pins, toggleSave, fetchPins, loading: pinsLoading } = usePins()

const profileUser = ref<User | null>(null)
const loading = ref(true)
const isFollowing = ref(false)
const showCreateBoard = ref(false)
const newBoardName = ref('')
const newBoardPrivate = ref(false)

const handleCreateBoard = async () => {
  if (!newBoardName.value.trim()) return
  try {
    await apiCreateBoard({
      name: newBoardName.value,
      is_private: newBoardPrivate.value
    })
    showCreateBoard.value = false
    newBoardName.value = ''
    newBoardPrivate.value = false
    // Refresh profile to show new board
    await loadProfile()
  } catch (err) {
    console.error('Failed to create board:', err)
  }
}

const isMyProfile = computed(() => {
  return !route.params.id || (currentUser.value && Number(route.params.id) === currentUser.value.id)
})

const loadProfile = async () => {
  loading.value = true
  if (!route.params.id) {
    profileUser.value = currentUser.value
    isFollowing.value = false
  } else {
    profileUser.value = await fetchUserProfile(route.params.id as string)
    isFollowing.value = profileUser.value?.isFollowing || false
  }
  loading.value = false
}

const handleFollow = async () => {
  if (!currentUser.value) {
    router.push('/login')
    return
  }
  if (profileUser.value) {
    const res = await apiToggleFollow(profileUser.value.id)
    isFollowing.value = res.status === 'followed'
    // Refresh stats
    if (profileUser.value) {
      profileUser.value.followers += (isFollowing.value ? 1 : -1)
    }
  }
}

onMounted(async () => {
  await loadProfile()
  if (pins.value.length === 0) fetchPins()
})

watch(() => route.params.id, loadProfile)

type Tab = 'created' | 'saved'
const activeTab = ref<Tab>('created')

const createdPins = computed(() => {
  if (!profileUser.value) return []
  return pins.value.filter((p) => p.user === profileUser.value!.displayName || p.user === profileUser.value!.username)
})

const savedPins = computed(() => {
  if (!profileUser.value) return []
  // Si c'est mon profil, on peut utiliser currentUser.savedPins
  if (isMyProfile.value && currentUser.value) {
    return pins.value.filter((p) => currentUser.value!.savedPins.includes(p.id) || p.saved)
  }
  return pins.value.filter((p) => profileUser.value!.savedPins.includes(p.id))
})

const displayPins = computed(() => {
  return activeTab.value === 'created' ? createdPins.value : savedPins.value
})

const handleToggleSave = (id: number) => {
  if (!currentUser.value) {
    router.push('/login')
    return
  }
  toggleSave(id)
  toggleSavePin(id)
}

const openPin = (id: number) => {
  router.push(`/pin/${id}`)
}
</script>

<template>
  <div v-if="loading" class="flex flex-col items-center justify-center py-20">
    <div class="w-10 h-10 border-4 border-neutral-100 border-t-pink-600 rounded-full animate-spin"></div>
  </div>

  <div v-else-if="profileUser" class="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
    <!-- Profile header -->
    <section class="flex flex-col items-center text-center mb-10">
      <div
        class="w-28 h-28 rounded-full flex items-center justify-center text-4xl font-bold text-white shadow-lg mb-4 overflow-hidden avatar-shadow"
        :class="profileUser.avatarColor"
      >
        <img v-if="profileUser.avatarUrl" :src="profileUser.avatarUrl" class="w-full h-full object-cover rounded-full" />
        <span v-else class="avatar-text">{{ profileUser.displayName[0] }}</span>
      </div>

      <h1 class="text-2xl sm:text-3xl font-bold text-neutral-900 mb-1">
        {{ profileUser.displayName }}
      </h1>
      <p class="text-neutral-500 text-sm mb-3">@{{ profileUser.username }}</p>

      <p v-if="profileUser.bio" class="text-neutral-600 text-sm max-w-md mb-4">
        {{ profileUser.bio }}
      </p>
      <p v-else class="text-neutral-400 text-sm mb-4 italic">
        Aucune bio pour le moment
      </p>

      <div class="flex items-center gap-6 text-sm text-neutral-600 mb-6">
        <span><strong class="text-neutral-900">{{ profileUser.followers }}</strong> abonnés</span>
        <span class="w-1 h-1 rounded-full bg-neutral-300"></span>
        <span><strong class="text-neutral-900">{{ profileUser.following }}</strong> abonnements</span>
        <span class="w-1 h-1 rounded-full bg-neutral-300"></span>
        <span><strong class="text-neutral-900">{{ createdPins.length }}</strong> pins</span>
      </div>

      <div class="flex items-center gap-3">
        <template v-if="isMyProfile">
          <router-link
            to="/settings"
            class="px-5 py-2.5 rounded-full bg-neutral-100 text-sm font-semibold text-neutral-800 hover:bg-neutral-200 transition"
          >
            Modifier le profil
          </router-link>
        </template>
        <template v-else>
          <button
            class="px-6 py-2.5 rounded-full text-sm font-semibold transition"
            :class="isFollowing ? 'bg-neutral-900 text-white hover:bg-neutral-800' : 'bg-pink-600 text-white hover:bg-pink-700'"
            @click="handleFollow"
          >
            {{ isFollowing ? 'Abonné' : "S'abonner" }}
          </button>
        </template>
        <button class="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center hover:bg-neutral-200 transition">
          <span class="material-symbols-outlined text-neutral-600">share</span>
        </button>
      </div>
    </section>

    <!-- Boards section -->
    <section class="mb-10" v-if="profileUser.boards.length > 0 || isMyProfile">
      <h2 class="text-lg font-semibold text-neutral-900 mb-4">Tableaux</h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <div
          v-for="board in profileUser.boards"
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
        <button
          v-if="isMyProfile"
          class="bg-neutral-50 border-2 border-dashed border-neutral-200 rounded-2xl aspect-[4/3] flex flex-col items-center justify-center gap-2 text-neutral-500 hover:border-pink-300 hover:text-pink-500 transition"
          @click="showCreateBoard = true"
        >
          <span class="material-symbols-outlined text-3xl">add</span>
          <span class="text-sm font-medium">Nouveau tableau</span>
        </button>
      </div>
    </section>

    <!-- Create Board Modal -->
    <div v-if="showCreateBoard" class="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm">
      <div class="bg-white rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl">
        <h3 class="text-xl font-bold text-neutral-900 mb-6">Créer un tableau</h3>
        <div class="space-y-5">
          <div>
            <label class="block text-sm font-medium text-neutral-700 mb-2">Nom</label>
            <input
              v-model="newBoardName"
              type="text"
              placeholder='Par exemple : "Idées déco" ou "Recettes"'
              class="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-pink-500 transition"
            />
          </div>
          <div class="flex items-center gap-3">
            <input
              v-model="newBoardPrivate"
              type="checkbox"
              id="is_private"
              class="w-5 h-5 accent-pink-600 rounded cursor-pointer"
            />
            <label for="is_private" class="text-sm text-neutral-700 cursor-pointer">
              Garder ce tableau secret
            </label>
          </div>
          <div class="flex gap-3 pt-4">
            <button
              class="flex-1 px-4 py-2.5 rounded-full bg-neutral-100 text-sm font-bold text-neutral-800 hover:bg-neutral-200 transition"
              @click="showCreateBoard = false"
            >
              Annuler
            </button>
            <button
              class="flex-1 px-4 py-2.5 rounded-full bg-pink-600 text-sm font-bold text-white hover:bg-pink-700 disabled:opacity-50 transition"
              :disabled="!newBoardName.trim()"
              @click="handleCreateBoard"
            >
              Créer
            </button>
          </div>
        </div>
      </div>
    </div>

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
    <PinSkeleton v-if="pinsLoading && displayPins.length === 0" />

    <div v-else-if="displayPins.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
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
        class="px-5 py-2.5 rounded-full bg-pink-600 text-white text-sm font-semibold hover:bg-pink-700 transition"
      >
        Créer un pin
      </router-link>
      <router-link
        v-else
        to="/explore"
        class="px-5 py-2.5 rounded-full bg-pink-600 text-white text-sm font-semibold hover:bg-pink-700 transition"
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
