<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { usePins } from '../composables/usePins'
import type { User } from '../types'
import PinGrid from '../components/PinGrid.vue'
import PinSkeleton from '../components/PinSkeleton.vue'
import { useI18n } from '../i18n'

const { t } = useI18n()

const router = useRouter()
const route = useRoute()
const { currentUser, toggleSavePin, fetchUserProfile, toggleFollow: apiToggleFollow, createBoard, fetchMyBoards, addBoardCollaborator } = useAuth()
const { pins, toggleSave, fetchPins, fetchCreatorStats, loading: pinsLoading } = usePins()

const profileUser = ref<User | null>(null)
const loading = ref(true)
const isFollowing = ref(false)
const followingProfilePending = ref(false)
const creatorStatsLoading = ref(false)
const creatorStats = ref<{
  totals?: { pins?: number; likes?: number; saves?: number; comments?: number; views?: number }
} | null>(null)

const isMyProfile = computed(() => {
  return !route.params.username || (currentUser.value && route.params.username === currentUser.value.username)
})

const loadProfile = async () => {
  loading.value = true
  if (!route.params.username) {
    profileUser.value = currentUser.value
    if (profileUser.value) {
      try {
        const myBoards = await fetchMyBoards()
        profileUser.value.boards = myBoards.map((board: any) => ({
          id: board.id,
          name: board.name,
          pinCount: board.pin_count ?? board.pinCount ?? 0,
          isPrivate: board.is_private ?? board.isPrivate ?? false,
          collaboratorCount: board.collaborator_count ?? board.collaboratorCount ?? 0,
        }))
      } catch (err) {
        console.error('Erreur chargement tableaux:', err)
      }
    }
    isFollowing.value = false
  } else {
    profileUser.value = await fetchUserProfile(route.params.username as string)
    isFollowing.value = profileUser.value?.isFollowing || false
  }
  if (isMyProfile.value && currentPlan.value === 'pro') {
    creatorStatsLoading.value = true
    try {
      creatorStats.value = await fetchCreatorStats()
    } catch (err) {
      console.error('Erreur chargement statistiques créateur:', err)
      creatorStats.value = null
    } finally {
      creatorStatsLoading.value = false
    }
  } else {
    creatorStats.value = null
  }
  loading.value = false
}

const handleFollow = async () => {
  if (!currentUser.value) {
    router.push('/login')
    return
  }
  if (profileUser.value) {
    const previous = isFollowing.value
    isFollowing.value = !previous
    profileUser.value.followers += (isFollowing.value ? 1 : -1)
    followingProfilePending.value = true
    try {
      const res = await apiToggleFollow(profileUser.value.username)
      isFollowing.value = res.status === 'followed'
    } catch (err) {
      isFollowing.value = previous
      profileUser.value.followers += (isFollowing.value ? 1 : -1)
      console.error('Erreur follow profil', err)
    } finally {
      followingProfilePending.value = false
    }
  }
}

onMounted(async () => {
  await loadProfile()
  if (pins.value.length === 0) fetchPins()
})

watch(() => route.params.username, loadProfile)

type Tab = 'created' | 'saved'
const activeTab = ref<Tab>('created')
const showCreateBoard = ref(false)
const newBoardName = ref('')
const newBoardPrivate = ref(false)

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

const boards = computed(() => profileUser.value?.boards ?? [])
const currentPlan = computed<'free' | 'plus' | 'pro'>(() => {
  return profileUser.value?.subscription?.plan || 'free'
})
const currentPlanLabel = computed(() => {
  const plan = currentPlan.value
  if (plan === 'pro') return 'PRO'
  if (plan === 'plus') return 'PLUS'
  return 'FREE'
})
const boardLimits = computed(() => {
  if (currentPlan.value === 'pro') return { private: Number.POSITIVE_INFINITY, public: Number.POSITIVE_INFINITY }
  if (currentPlan.value === 'plus') return { private: 10, public: Number.POSITIVE_INFINITY }
  return { private: 3, public: 10 }
})
const privateBoardsCount = computed(() => boards.value.filter((board) => board.isPrivate).length)
const publicBoardsCount = computed(() => boards.value.filter((board) => !board.isPrivate).length)
const isPrivateLimitReached = computed(() => privateBoardsCount.value >= boardLimits.value.private)
const isPublicLimitReached = computed(() => publicBoardsCount.value >= boardLimits.value.public)
const canCreateSelectedBoardType = computed(() => {
  return newBoardPrivate.value ? !isPrivateLimitReached.value : !isPublicLimitReached.value
})
const boardLimitHint = computed(() => {
  if (newBoardPrivate.value && isPrivateLimitReached.value) {
    return t('profile.boards.modal.limitPrivate', { count: boardLimits.value.private })
  }
  if (!newBoardPrivate.value && isPublicLimitReached.value) {
    return t('profile.boards.modal.limitPublic', { count: boardLimits.value.public })
  }
  return ''
})
const canSubmitBoardCreation = computed(() => !!newBoardName.value.trim() && canCreateSelectedBoardType.value)

const handleCreateBoard = async () => {
  if (!profileUser.value || !newBoardName.value.trim()) return
  if (!canCreateSelectedBoardType.value) {
    if (boardLimitHint.value) {
      window.alert(boardLimitHint.value)
    }
    return
  }
  try {
    const board = await createBoard({
      name: newBoardName.value.trim(),
      isPrivate: newBoardPrivate.value,
    })
    const nextBoard = {
      id: board.id,
      name: board.name,
      pinCount: board.pin_count ?? board.pinCount ?? 0,
      isPrivate: board.is_private ?? board.isPrivate ?? false,
      collaboratorCount: board.collaborator_count ?? board.collaboratorCount ?? 0,
    }
    profileUser.value.boards = [nextBoard, ...(profileUser.value.boards ?? [])]
    newBoardName.value = ''
    newBoardPrivate.value = false
    showCreateBoard.value = false
  } catch (err) {
    console.error('Erreur création tableau:', err)
  }
}

const handleToggleSave = async (slug: string) => {
  if (!currentUser.value) {
    router.push('/login')
    return
  }
  const pin = pins.value.find(p => p.slug === slug)
  if (pin) {
    toggleSavePin(pin.id)
  }
  try {
    await toggleSave(slug)
  } catch (err) {
    if (pin) {
      toggleSavePin(pin.id)
    }
    console.error('Erreur sauvegarde pin', err)
  }
}

const openPin = (slug: string) => {
  router.push(`/pin/${slug}`)
}

const handleInviteCollaborator = async (boardId: number) => {
  if (!isMyProfile.value) return
  const plan = currentPlan.value
  if (plan === 'free') {
    window.alert('Les boards collaboratifs nécessitent Plus ou Pro.')
    return
  }
  const username = window.prompt('Nom utilisateur à inviter :')?.trim()
  if (!username) return
  try {
    await addBoardCollaborator(boardId, username)
    const targetBoard = profileUser.value?.boards?.find((board) => board.id === boardId)
    if (targetBoard && profileUser.value?.boards) {
      targetBoard.collaboratorCount = (targetBoard.collaboratorCount || 0) + 1
      profileUser.value.boards = [...profileUser.value.boards]
    }
  } catch (err: any) {
    console.error('Erreur invitation collaborateur:', err)
    window.alert(err?.response?.data?.error || 'Impossible d\'ajouter ce collaborateur.')
  }
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
      <div
        v-if="currentPlan === 'pro'"
        class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold mb-2"
      >
        <span class="material-symbols-outlined text-sm">verified</span>
        Badge Créateur certifié
      </div>
      <p class="text-neutral-500 text-sm mb-3">@{{ profileUser.username }}</p>

      <p v-if="profileUser.bio" class="text-neutral-600 text-sm max-w-md mb-4">
        {{ profileUser.bio }}
      </p>
      <p v-else class="text-neutral-400 text-sm mb-4 italic">
        {{ t('profile.noBio') }}
      </p>

      <div class="flex items-center gap-6 text-sm text-neutral-600 mb-6">
        <span><strong class="text-neutral-900">{{ profileUser.followers }}</strong> {{ t('profile.followers') }}</span>
        <span class="w-1 h-1 rounded-full bg-neutral-300"></span>
        <span><strong class="text-neutral-900">{{ profileUser.following }}</strong> {{ t('profile.following') }}</span>
        <span class="w-1 h-1 rounded-full bg-neutral-300"></span>
        <span><strong class="text-neutral-900">{{ createdPins.length }}</strong> {{ t('profile.pinsCount') }}</span>
      </div>

      <div class="flex items-center gap-3">
        <template v-if="isMyProfile">
          <router-link
            to="/settings"
            class="px-5 py-2.5 rounded-full bg-neutral-100 text-sm font-semibold text-neutral-800 hover:bg-neutral-200 transition"
          >
            {{ t('profile.editProfile') }}
          </router-link>
        </template>
        <template v-else>
          <button
            class="px-6 py-2.5 rounded-full text-sm font-semibold transition"
            :class="isFollowing ? 'bg-neutral-900 text-white hover:bg-neutral-800' : 'bg-pink-600 text-white hover:bg-pink-700'"
            :disabled="followingProfilePending"
            @click="handleFollow"
          >
            <span v-if="followingProfilePending" class="w-4 h-4 inline-block border-2 border-current border-t-transparent rounded-full animate-spin"></span>
            <span v-else>{{ isFollowing ? t('pin.following') : t('pin.follow') }}</span>
          </button>
        </template>
        <router-link
          to="/premium"
          class="px-5 py-2.5 rounded-full bg-amber-50 text-sm font-semibold text-amber-800 hover:bg-amber-100 transition inline-flex items-center gap-1.5"
        >
          <span class="material-symbols-outlined text-base">workspace_premium</span>
          Plan {{ currentPlanLabel }}
        </router-link>
        <button class="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center hover:bg-neutral-200 transition">
          <span class="material-symbols-outlined text-neutral-600">share</span>
        </button>
      </div>
    </section>

    <!-- Boards section -->
    <section class="mb-10" v-if="boards.length > 0 || isMyProfile">
      <h2 class="text-lg font-semibold text-neutral-900 mb-4">{{ t('profile.boards') }}</h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <div
          v-for="board in boards"
          :key="board.id"
          class="group relative bg-neutral-100 rounded-2xl overflow-hidden aspect-[4/3] cursor-pointer hover:shadow-md transition"
        >
          <div class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
          <div class="absolute bottom-0 left-0 right-0 p-4 text-white">
            <p class="font-semibold text-sm">{{ board.name }}</p>
            <p class="text-xs opacity-80">{{ t('explore.pinsCount', { count: board.pinCount }) }}</p>
            <p v-if="board.collaboratorCount" class="text-[11px] opacity-80">
              {{ board.collaboratorCount }} collab.
            </p>
          </div>
          <div v-if="board.isPrivate" class="absolute top-3 right-3">
            <span class="material-symbols-outlined text-white text-sm">lock</span>
          </div>
          <button
            v-if="isMyProfile && currentPlan !== 'free'"
            class="absolute top-3 left-3 px-2 py-1 rounded-full bg-white/90 text-[10px] font-bold text-neutral-700 hover:bg-white"
            @click.stop="handleInviteCollaborator(board.id)"
          >
            + Collab
          </button>
        </div>

        <!-- Create new board -->
        <button
          v-if="isMyProfile"
          class="bg-neutral-50 border-2 border-dashed border-neutral-200 rounded-2xl aspect-[4/3] flex flex-col items-center justify-center gap-2 text-neutral-500 hover:border-pink-300 hover:text-pink-500 transition"
          @click="showCreateBoard = true"
        >
          <span class="material-symbols-outlined text-3xl">add</span>
          <span class="text-sm font-medium">{{ t('profile.boards.new') }}</span>
        </button>
      </div>
    </section>

    <section
      v-if="isMyProfile && currentPlan === 'pro'"
      class="mb-10 bg-white rounded-2xl border border-amber-200 p-5 sm:p-6"
    >
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-neutral-900">Statistiques avancées</h2>
        <span class="text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-1 rounded-full">PRO</span>
      </div>
      <div v-if="creatorStatsLoading" class="text-sm text-neutral-500">{{ t('common.loading') }}</div>
      <div v-else class="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
        <div class="rounded-xl bg-neutral-50 py-3">
          <p class="text-xs text-neutral-500">Pins</p>
          <p class="text-lg font-bold text-neutral-900">{{ creatorStats?.totals?.pins ?? 0 }}</p>
        </div>
        <div class="rounded-xl bg-neutral-50 py-3">
          <p class="text-xs text-neutral-500">Vues</p>
          <p class="text-lg font-bold text-neutral-900">{{ creatorStats?.totals?.views ?? 0 }}</p>
        </div>
        <div class="rounded-xl bg-neutral-50 py-3">
          <p class="text-xs text-neutral-500">Saves</p>
          <p class="text-lg font-bold text-neutral-900">{{ creatorStats?.totals?.saves ?? 0 }}</p>
        </div>
        <div class="rounded-xl bg-neutral-50 py-3">
          <p class="text-xs text-neutral-500">Likes</p>
          <p class="text-lg font-bold text-neutral-900">{{ creatorStats?.totals?.likes ?? 0 }}</p>
        </div>
        <div class="rounded-xl bg-neutral-50 py-3">
          <p class="text-xs text-neutral-500">Commentaires</p>
          <p class="text-lg font-bold text-neutral-900">{{ creatorStats?.totals?.comments ?? 0 }}</p>
        </div>
      </div>
    </section>

    <!-- Create Board Modal -->
    <div v-if="showCreateBoard" class="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm">
      <div class="bg-white rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl">
        <h3 class="text-xl font-bold text-neutral-900 mb-6">{{ t('profile.boards.modal.title') }}</h3>
        <div class="space-y-5">
          <div>
            <label class="block text-sm font-medium text-neutral-700 mb-2">{{ t('profile.boards.modal.name') }}</label>
            <input
              v-model="newBoardName"
              type="text"
              :placeholder="t('profile.boards.modal.namePlaceholder')"
              class="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-pink-500 transition"
            />
          </div>
          <div class="flex items-center gap-3">
            <input
              v-model="newBoardPrivate"
              type="checkbox"
              id="is_private"
              class="w-5 h-5 accent-pink-600 rounded cursor-pointer"
              :disabled="isPrivateLimitReached"
            />
            <label for="is_private" class="text-sm text-neutral-700 cursor-pointer">
              {{ t('profile.boards.modal.private') }}
            </label>
          </div>
          <p v-if="boardLimitHint" class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {{ boardLimitHint }}
          </p>
          <div class="flex gap-3 pt-4">
            <button
              class="flex-1 px-4 py-2.5 rounded-full bg-neutral-100 text-sm font-bold text-neutral-800 hover:bg-neutral-200 transition"
              @click="showCreateBoard = false"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              class="flex-1 px-4 py-2.5 rounded-full bg-pink-600 text-sm font-bold text-white hover:bg-pink-700 disabled:opacity-50 transition"
              :disabled="!canSubmitBoardCreation"
              @click="handleCreateBoard"
            >
              {{ t('profile.boards.modal.create') }}
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
        {{ t('profile.tab.created') }}
      </button>
      <button
        class="px-6 py-3 text-sm font-semibold transition-colors border-b-2"
        :class="activeTab === 'saved'
          ? 'border-neutral-900 text-neutral-900'
          : 'border-transparent text-neutral-500 hover:text-neutral-700'"
        @click="activeTab = 'saved'"
      >
        {{ t('profile.tab.saved') }}
      </button>
    </div>

    <!-- Pins grid -->
    <PinSkeleton v-if="pinsLoading && displayPins.length === 0" />

    <div v-else-if="displayPins.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
      <span class="material-symbols-outlined text-5xl text-neutral-300 mb-3">
        {{ activeTab === 'created' ? 'add_photo_alternate' : 'bookmark_border' }}
      </span>
      <h3 class="text-lg font-semibold text-neutral-700 mb-1">
        {{ activeTab === 'created' ? t('profile.empty.created.title') : t('profile.empty.saved.title') }}
      </h3>
      <p class="text-sm text-neutral-500 mb-4">
        {{ activeTab === 'created' ? t('profile.empty.created.desc') : t('profile.empty.saved.desc') }}
      </p>
      <router-link
        v-if="activeTab === 'created'"
        to="/create"
        class="px-5 py-2.5 rounded-full bg-pink-600 text-white text-sm font-semibold hover:bg-pink-700 transition"
      >
        {{ t('home.createPin') }}
      </router-link>
      <router-link
        v-else
        to="/explore"
        class="px-5 py-2.5 rounded-full bg-pink-600 text-white text-sm font-semibold hover:bg-pink-700 transition"
      >
        {{ t('nav.explore') }}
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
