<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { usePins, mapDjangoPinToFrontend } from '../composables/usePins'
import type { User, Pin } from '../types'
import PinGrid from '../components/PinGrid.vue'
import PinSkeleton from '../components/PinSkeleton.vue'
import StoryViewer from '../components/StoryViewer.vue'
import { useI18n } from '../i18n'
import { useAppModal } from '../composables/useAppModal'
import api from '../api'
import { displayInitials } from '../utils/displayInitials'

const PROFILE_PINS_PAGE_SIZE = 24

const { t, currentLang } = useI18n()
const { showAlert, showPrompt } = useAppModal()

const router = useRouter()
const route = useRoute()
const { currentUser, toggleSavePin, fetchUserProfile, toggleFollow: apiToggleFollow, createBoard, fetchMyBoards, addBoardCollaborator } = useAuth()
const { pins, toggleSave, fetchPins, fetchCreatorStats } = usePins()

const profileUser = ref<User | null>(null)
const loading = ref(true)
const isFollowing = ref(false)
const followingProfilePending = ref(false)
const creatorStatsLoading = ref(false)
const creatorStats = ref<{
  totals?: { pins?: number; likes?: number; saves?: number; comments?: number; views?: number }
} | null>(null)
const showFollowersModal = ref(false)
const showFollowingModal = ref(false)
const relationsLoading = ref(false)
const relationItems = ref<Array<{ username: string; display_name: string; avatar_color: string; avatar?: string | null; is_pro?: boolean }>>([])

const isMyProfile = computed(() => {
  return !route.params.username || (currentUser.value && route.params.username === currentUser.value.username)
})

type Tab = 'created' | 'saved'
const activeTab = ref<Tab>('created')

const profilePins = ref<Pin[]>([])
const profilePinsLoading = ref(false)
const profilePinsLoadingMore = ref(false)
const profilePinsHasMore = ref(true)
const profilePinsNextPage = ref(1)

async function loadProfilePins(username: string, reset: boolean) {
  if (reset) {
    profilePins.value = []
    profilePinsNextPage.value = 1
    profilePinsHasMore.value = true
    profilePinsLoading.value = true
  } else {
    if (!profilePinsHasMore.value || profilePinsLoadingMore.value || profilePinsLoading.value) return
    profilePinsLoadingMore.value = true
  }
  try {
    const page = profilePinsNextPage.value
    const res = await api.get('pins/', {
      params: {
        author: username,
        page,
        page_size: PROFILE_PINS_PAGE_SIZE,
        lang: currentLang.value,
      },
    })
    const batch = (res.data.results || []).map(mapDjangoPinToFrontend)
    profilePins.value.push(...batch)
    const hasMore = !!res.data.next
    profilePinsHasMore.value = hasMore && batch.length > 0
    if (hasMore && batch.length > 0) profilePinsNextPage.value = page + 1
  } catch (err) {
    console.error('Erreur chargement pins du profil:', err)
    if (reset) profilePins.value = []
    profilePinsHasMore.value = false
  } finally {
    profilePinsLoading.value = false
    profilePinsLoadingMore.value = false
  }
}

function loadMoreCreatedPins() {
  const uname = profileUser.value?.username
  if (!uname || activeTab.value !== 'created') return
  void loadProfilePins(uname, false)
}

const savedPinsList = ref<Pin[]>([])
const savedPinsLoading = ref(false)
const savedPinsLoadingMore = ref(false)
const savedPinsHasMore = ref(true)
const savedPinsNextPage = ref(1)
/** False jusqu'à ce que l'utilisateur ouvre l'onglet Enregistrés au moins une fois (session profil). */
const savedPinsEverOpened = ref(false)

async function loadSavedPins(reset: boolean) {
  if (!currentUser.value) return
  if (reset) {
    savedPinsList.value = []
    savedPinsNextPage.value = 1
    savedPinsHasMore.value = true
    savedPinsLoading.value = true
  } else {
    if (!savedPinsHasMore.value || savedPinsLoadingMore.value || savedPinsLoading.value) return
    savedPinsLoadingMore.value = true
  }
  try {
    const page = savedPinsNextPage.value
    const res = await api.get('pins/', {
      params: {
        saved_by_me: '1',
        page,
        page_size: PROFILE_PINS_PAGE_SIZE,
        lang: currentLang.value,
      },
    })
    const batch = (res.data.results || []).map(mapDjangoPinToFrontend)
    savedPinsList.value.push(...batch)
    const hasMore = !!res.data.next
    savedPinsHasMore.value = hasMore && batch.length > 0
    if (hasMore && batch.length > 0) savedPinsNextPage.value = page + 1
  } catch (err) {
    console.error('Erreur chargement pins enregistrés:', err)
    if (reset) savedPinsList.value = []
    savedPinsHasMore.value = false
  } finally {
    savedPinsLoading.value = false
    savedPinsLoadingMore.value = false
  }
}

function loadMoreSavedPins() {
  void loadSavedPins(false)
}

function resetSavedPinsState() {
  savedPinsEverOpened.value = false
  savedPinsList.value = []
  savedPinsNextPage.value = 1
  savedPinsHasMore.value = true
  savedPinsLoading.value = false
  savedPinsLoadingMore.value = false
}

const profileShareQueryParams = computed(() => {
  const s = route.query.share
  return typeof s === 'string' && s ? { share: s } : {}
})

const loadProfile = async () => {
  loading.value = true
  resetSavedPinsState()
  const shareQuery = typeof route.query.share === 'string' ? route.query.share : ''
  const profileShareOpts = shareQuery ? { share: shareQuery } : undefined

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
          previewImages: board.preview_images ?? board.previewImages ?? [],
          shareToken: board.share_token ?? board.shareToken ?? undefined,
        }))
      } catch (err) {
        console.error('Erreur chargement tableaux:', err)
      }
    }
    isFollowing.value = false
  } else {
    profileUser.value = await fetchUserProfile(route.params.username as string, profileShareOpts)
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
  if (!route.params.username && profileUser.value) {
    void loadBoardSuggestions()
  }
  if (currentUser.value) {
    void loadActiveStories()
  } else {
    activeStories.value = []
  }

  const uname = profileUser.value?.username
  if (uname) {
    await loadProfilePins(uname, true)
  } else {
    profilePins.value = []
  }
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
  await nextTick()
  attachInfiniteScroll()
})

watch([() => route.params.username, () => route.query.share], () => {
  activeTab.value = 'created'
  void loadProfile()
})

watch(isMyProfile, (mine) => {
  if (!mine) activeTab.value = 'created'
})

watch(currentLang, () => {
  const uname = profileUser.value?.username
  if (uname) void loadProfilePins(uname, true)
  if (savedPinsEverOpened.value && isMyProfile.value && currentUser.value) void loadSavedPins(true)
})
watch(activeTab, (tab) => {
  if (tab === 'saved' && isMyProfile.value && currentUser.value && !savedPinsEverOpened.value) {
    savedPinsEverOpened.value = true
    void loadSavedPins(true)
  }
})

const showCreateBoard = ref(false)
const newBoardName = ref('')
const newBoardPrivate = ref(false)

const createdPins = computed(() => profilePins.value)

const displayPins = computed(() => {
  return activeTab.value === 'created' ? createdPins.value : savedPinsList.value
})

const showProfileInfiniteSentinel = computed(() => {
  if (displayPins.value.length === 0) return false
  if (activeTab.value === 'created') {
    return profilePinsHasMore.value || profilePinsLoadingMore.value
  }
  if (!isMyProfile.value) return false
  return savedPinsHasMore.value || savedPinsLoadingMore.value
})

const infiniteScrollSentinel = ref<HTMLElement | null>(null)
let infiniteScrollObserver: IntersectionObserver | null = null

function disconnectInfiniteScroll() {
  infiniteScrollObserver?.disconnect()
  infiniteScrollObserver = null
}

function attachInfiniteScroll() {
  disconnectInfiniteScroll()
  const el = infiniteScrollSentinel.value
  if (!el) return
  infiniteScrollObserver = new IntersectionObserver(
    (entries) => {
      if (!entries[0]?.isIntersecting) return
      if (activeTab.value === 'created') {
        if (profilePinsHasMore.value && !profilePinsLoading.value && !profilePinsLoadingMore.value) {
          loadMoreCreatedPins()
        }
      } else if (activeTab.value === 'saved' && isMyProfile.value) {
        if (savedPinsHasMore.value && !savedPinsLoading.value && !savedPinsLoadingMore.value) {
          loadMoreSavedPins()
        }
      }
    },
    { root: null, rootMargin: '280px', threshold: 0 },
  )
  infiniteScrollObserver.observe(el)
}

watch([activeTab, () => displayPins.value.length, profilePinsHasMore, savedPinsHasMore], () => {
  nextTick(() => attachInfiniteScroll())
})

onUnmounted(() => disconnectInfiniteScroll())

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
      await showAlert(boardLimitHint.value, { variant: 'warning' })
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
      previewImages: [],
      shareToken: board.share_token ?? board.shareToken ?? undefined,
    }
    profileUser.value.boards = [nextBoard, ...(profileUser.value.boards ?? [])]
    newBoardName.value = ''
    newBoardPrivate.value = false
    showCreateBoard.value = false
    void loadBoardSuggestions()
  } catch (err) {
    console.error('Erreur création tableau:', err)
  }
}

const handleToggleSave = async (slug: string) => {
  if (!currentUser.value) {
    router.push('/login')
    return
  }
  const pin =
    pins.value.find((p) => p.slug === slug) ||
    profilePins.value.find((p) => p.slug === slug) ||
    savedPinsList.value.find((p) => p.slug === slug)
  if (pin) {
    toggleSavePin(pin.id)
  }
  try {
    const data = await toggleSave(slug)
    const idx = savedPinsList.value.findIndex((p) => p.slug === slug)
    if (idx !== -1 && data && data.status !== 'saved') {
      savedPinsList.value.splice(idx, 1)
    }
    const pp = profilePins.value.find((p) => p.slug === slug)
    if (pp && data) {
      pp.saved = data.status === 'saved'
      if (typeof data.saves_count === 'number') pp.stats.saves = data.saves_count
    }
    const sp = savedPinsList.value.find((p) => p.slug === slug)
    if (sp && data) {
      sp.saved = data.status === 'saved'
      if (typeof data.saves_count === 'number') sp.stats.saves = data.saves_count
    }
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

const openFollowersModal = async () => {
  if (!profileUser.value) return
  showFollowersModal.value = true
  showFollowingModal.value = false
  relationsLoading.value = true
  relationItems.value = []
  try {
    const response = await api.get(`profiles/${profileUser.value.username}/followers/`, {
      params: profileShareQueryParams.value,
    })
    relationItems.value = response.data?.results || []
  } finally {
    relationsLoading.value = false
  }
}

const openFollowingModal = async () => {
  if (!profileUser.value) return
  showFollowingModal.value = true
  showFollowersModal.value = false
  relationsLoading.value = true
  relationItems.value = []
  try {
    const response = await api.get(`profiles/${profileUser.value.username}/following/`, {
      params: profileShareQueryParams.value,
    })
    relationItems.value = response.data?.results || []
  } finally {
    relationsLoading.value = false
  }
}

const handleInviteCollaborator = async (boardId: number) => {
  if (!isMyProfile.value) return
  const plan = currentPlan.value
  if (plan === 'free') {
    await showAlert(t('profile.boards.collabRequiresPlan'), { variant: 'warning' })
    return
  }
  const username = await showPrompt({
    title: t('profile.boards.invitePromptTitle'),
    message: t('profile.boards.invitePromptMessage'),
    placeholder: t('profile.boards.invitePlaceholder'),
  })
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
    await showAlert(err?.response?.data?.error || t('profile.boards.inviteError'), {
      variant: 'danger',
      title: t('modal.errorTitle'),
    })
  }
}

type BoardSuggestions = {
  new_board_hints: Array<{ name: string; topic_slug: string; pin_count_hint: number }>
  existing_boards: Array<{ id: number; name: string; overlap_score: number; pin_count: number }>
}

const boardSuggestions = ref<BoardSuggestions | null>(null)
const activeStories = ref<Pin[]>([])
const storyViewerOpen = ref(false)
const storyViewerInitialIndex = ref(0)

function openStoryViewer(index: number) {
  storyViewerInitialIndex.value = index
  storyViewerOpen.value = true
}

const organizeBoardId = ref<number | null>(null)
const organizePins = ref<
  Array<{ id: number; slug: string; title: string; image: string; position: number; scheduled_publish_at?: string | null }>
>([])
const organizeLoading = ref(false)
const organizeSaving = ref(false)
const dragOrganizeIndex = ref<number | null>(null)

async function loadActiveStories() {
  if (!currentUser.value || !profileUser.value?.username) {
    activeStories.value = []
    return
  }
  try {
    const res = await api.get('pins/active-stories/', { params: { username: profileUser.value.username } })
    activeStories.value = (res.data.pins || []).map(mapDjangoPinToFrontend)
  } catch {
    activeStories.value = []
  }
}

async function loadBoardSuggestions() {
  if (!currentUser.value || route.params.username) return
  try {
    const res = await api.get('boards/suggestions/')
    boardSuggestions.value = res.data
  } catch {
    boardSuggestions.value = null
  }
}

async function openOrganizeBoard(boardId: number) {
  organizeBoardId.value = boardId
  organizeLoading.value = true
  organizePins.value = []
  dragOrganizeIndex.value = null
  try {
    const res = await api.get(`boards/${boardId}/ordered-pins/`)
    organizePins.value = [...(res.data.pins || [])]
  } catch (err) {
    console.error(err)
    organizeBoardId.value = null
  } finally {
    organizeLoading.value = false
  }
}

function closeOrganizeBoard() {
  organizeBoardId.value = null
  organizePins.value = []
}

async function saveBoardOrder() {
  if (!organizeBoardId.value) return
  organizeSaving.value = true
  try {
    await api.post(`boards/${organizeBoardId.value}/reorder-pins/`, {
      pin_ids: organizePins.value.map((p) => p.id),
    })
    closeOrganizeBoard()
    await loadProfile()
  } catch (err: any) {
    await showAlert(err?.response?.data?.error || t('profile.boards.reorderError'), {
      variant: 'danger',
      title: t('modal.errorTitle'),
    })
  } finally {
    organizeSaving.value = false
  }
}

function onOrganizeDragStart(index: number) {
  dragOrganizeIndex.value = index
}

function onOrganizeDragOver(event: DragEvent) {
  event.preventDefault()
}

function onOrganizeDrop(index: number) {
  const from = dragOrganizeIndex.value
  dragOrganizeIndex.value = null
  if (from === null || from === index) return
  const arr = [...organizePins.value]
  const moved = arr.splice(from, 1)[0]
  if (moved === undefined) return
  arr.splice(index, 0, moved)
  organizePins.value = arr
}

function applyBoardSuggestionName(name: string) {
  newBoardName.value = name
  showCreateBoard.value = true
}

function goToBoard(boardId: number) {
  const uname = profileUser.value?.username
  if (!uname) return
  router.push(`/profile/${uname}/board/${boardId}`)
}

async function handleShareProfile() {
  if (!profileUser.value) return
  try {
    if (isMyProfile.value && profileUser.value.privateProfile) {
      const res = await api.post('me/profile-share-token/', {})
      const token = res.data?.share_token
      if (!token) throw new Error('no token')
      const url = `${window.location.origin}/profile/${profileUser.value.username}?share=${encodeURIComponent(token)}`
      await navigator.clipboard.writeText(url)
    } else if (isMyProfile.value) {
      const url = `${window.location.origin}/profile/${profileUser.value.username}`
      await navigator.clipboard.writeText(url)
    } else {
      await navigator.clipboard.writeText(window.location.href)
    }
    await showAlert(t('profile.share.copied'), { variant: 'success' })
  } catch {
    await showAlert(t('profile.share.copyError'), { variant: 'danger', title: t('modal.errorTitle') })
  }
}

async function shareBoardLink(board: { id: number; isPrivate: boolean }) {
  if (!isMyProfile.value || !profileUser.value) return
  try {
    let url = `${window.location.origin}/profile/${profileUser.value.username}/board/${board.id}`
    if (board.isPrivate) {
      const res = await api.post(`boards/${board.id}/share-token/`, {})
      const token = res.data?.share_token
      if (!token) throw new Error('no token')
      url += `?share=${encodeURIComponent(token)}`
    }
    await navigator.clipboard.writeText(url)
    await showAlert(t('profile.share.boardCopied'), { variant: 'success' })
  } catch {
    await showAlert(t('profile.share.copyError'), { variant: 'danger', title: t('modal.errorTitle') })
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
      <button
        v-if="currentUser && activeStories.length > 0"
        type="button"
        class="relative mb-4 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2"
        :aria-label="t('profile.stories.openRing')"
        @click="openStoryViewer(0)"
      >
        <span
          class="absolute -inset-1 rounded-full bg-gradient-to-tr from-pink-500 via-amber-400 to-violet-500 p-[3px]"
          aria-hidden="true"
        />
        <span class="relative flex rounded-full bg-white p-[2px]">
          <span
            class="w-28 h-28 rounded-full flex items-center justify-center text-4xl font-bold text-white shadow-inner overflow-hidden avatar-shadow"
            :class="profileUser.avatarColor"
          >
            <img
              v-if="profileUser.avatarUrl"
              :src="profileUser.avatarUrl"
              class="w-full h-full object-cover"
            />
            <span v-else class="avatar-text">{{ displayInitials(profileUser.displayName) }}</span>
          </span>
        </span>
      </button>
      <div
        v-else
        class="w-28 h-28 rounded-full flex items-center justify-center text-4xl font-bold text-white shadow-lg mb-4 overflow-hidden avatar-shadow"
        :class="profileUser.avatarColor"
      >
        <img v-if="profileUser.avatarUrl" :src="profileUser.avatarUrl" class="w-full h-full object-cover rounded-full" />
        <span v-else class="avatar-text">{{ displayInitials(profileUser.displayName) }}</span>
      </div>

      <h1 class="text-2xl sm:text-3xl font-bold text-neutral-900 mb-1">
        <span v-if="profileUser.subscription?.plan === 'pro'" class="material-symbols-outlined text-amber-500 text-base align-middle mr-1">verified</span>
        {{ profileUser.displayName }}
      </h1>
      <div
        v-if="isMyProfile && currentPlan === 'pro'"
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
        <button class="hover:text-pink-600 transition" @click="openFollowersModal">
          <strong class="text-neutral-900">{{ profileUser.followers }}</strong> {{ t('profile.followers') }}
        </button>
        <span class="w-1 h-1 rounded-full bg-neutral-300"></span>
        <button class="hover:text-pink-600 transition" @click="openFollowingModal">
          <strong class="text-neutral-900">{{ profileUser.following }}</strong> {{ t('profile.following') }}
        </button>
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
          v-if="isMyProfile"
          to="/premium"
          class="px-5 py-2.5 rounded-full bg-amber-50 text-sm font-semibold text-amber-800 hover:bg-amber-100 transition inline-flex items-center gap-1.5"
        >
          <span class="material-symbols-outlined text-base">workspace_premium</span>
          Plan {{ currentPlanLabel }}
        </router-link>
        <button
          type="button"
          class="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center hover:bg-neutral-200 transition"
          :title="t('profile.share.profileTitle')"
          @click="handleShareProfile"
        >
          <span class="material-symbols-outlined text-neutral-600">share</span>
        </button>
      </div>
    </section>

    <section class="mb-10" v-if="boards.length > 0 || isMyProfile">
      <h2 class="text-lg font-semibold text-neutral-900 mb-4">{{ t('profile.boards') }}</h2>

      <div
        v-if="isMyProfile && boardSuggestions && (boardSuggestions.new_board_hints?.length || boardSuggestions.existing_boards?.length)"
        class="mb-4 rounded-2xl border border-neutral-100 bg-white p-4"
      >
        <p class="text-xs font-semibold text-neutral-800 mb-2">{{ t('profile.boards.suggestionsTitle') }}</p>
        <div v-if="boardSuggestions.new_board_hints?.length" class="mb-3">
          <p class="text-[11px] text-neutral-500 mb-1">{{ t('profile.boards.suggestionsNew') }}</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="hint in boardSuggestions.new_board_hints"
              :key="hint.topic_slug + hint.name"
              type="button"
              class="px-3 py-1 rounded-full text-xs bg-pink-50 text-pink-700 border border-pink-100 hover:bg-pink-100"
              @click="applyBoardSuggestionName(hint.name)"
            >
              + {{ hint.name }}
            </button>
          </div>
        </div>
        <div v-if="boardSuggestions.existing_boards?.length">
          <p class="text-[11px] text-neutral-500 mb-1">{{ t('profile.boards.suggestionsExisting') }}</p>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="b in boardSuggestions.existing_boards"
              :key="b.id"
              class="text-xs px-2 py-1 rounded-lg bg-neutral-100 text-neutral-600"
            >
              {{ b.name }} · {{ b.overlap_score }}
            </span>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <div
          v-for="board in boards"
          :key="board.id"
          class="group relative bg-neutral-200 rounded-2xl overflow-hidden aspect-[4/3] cursor-pointer hover:shadow-md transition ring-1 ring-black/5"
          role="button"
          tabindex="0"
          @click="goToBoard(board.id)"
          @keydown.enter.prevent="goToBoard(board.id)"
        >
          <div class="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-px bg-neutral-300">
            <template v-if="board.previewImages && board.previewImages.length">
              <img
                v-for="(src, pi) in board.previewImages.slice(0, 4)"
                :key="pi"
                :src="src"
                alt=""
                class="w-full h-full object-cover bg-neutral-100 min-h-0"
                draggable="false"
                @contextmenu.prevent
              />
            </template>
            <div
              v-else
              class="col-span-2 row-span-2 flex items-center justify-center bg-neutral-100 text-neutral-400"
            >
              <span class="material-symbols-outlined text-4xl">collections</span>
            </div>
          </div>
          <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pointer-events-none"></div>
          <div class="absolute bottom-0 left-0 right-0 p-4 text-white pointer-events-none">
            <p class="font-semibold text-sm drop-shadow-sm">{{ board.name }}</p>
            <p class="text-xs opacity-90">{{ t('explore.pinsCount', { count: board.pinCount }) }}</p>
            <p v-if="board.collaboratorCount" class="text-[11px] opacity-90">
              {{ board.collaboratorCount }} collab.
            </p>
          </div>
          <div v-if="board.isPrivate" class="absolute top-3 right-3 z-10">
            <span class="material-symbols-outlined text-white text-sm drop-shadow">lock</span>
          </div>
          <button
            v-if="isMyProfile"
            type="button"
            class="absolute top-3 right-14 z-10 w-9 h-9 rounded-full bg-white/95 shadow-md flex items-center justify-center text-neutral-700 hover:bg-white"
            :title="t('profile.share.boardTitle')"
            @click.stop="shareBoardLink(board)"
          >
            <span class="material-symbols-outlined text-lg">ios_share</span>
          </button>
          <button
            v-if="isMyProfile"
            type="button"
            class="absolute bottom-3 right-3 z-10 w-9 h-9 rounded-full bg-white/95 shadow-md flex items-center justify-center text-neutral-700 hover:bg-white"
            :title="t('profile.boards.reorganize')"
            @click.stop="openOrganizeBoard(board.id)"
          >
            <span class="material-symbols-outlined text-lg">drag_indicator</span>
          </button>
          <button
            v-if="isMyProfile && currentPlan !== 'free'"
            class="absolute top-3 left-3 px-2 py-1 rounded-full bg-white/90 text-[10px] font-bold text-neutral-700 hover:bg-white z-10"
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

    <!-- Réorganiser pins du board -->
    <div v-if="organizeBoardId !== null" class="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm">
      <div class="bg-white rounded-3xl w-full max-w-lg max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
        <div class="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <h3 class="text-lg font-bold text-neutral-900">{{ t('profile.boards.organizeTitle') }}</h3>
          <button type="button" class="text-neutral-500 hover:text-neutral-800" @click="closeOrganizeBoard">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <p class="text-xs text-neutral-500 px-5 pt-3">{{ t('profile.boards.organizeHint') }}</p>
        <div class="flex-1 overflow-y-auto px-5 py-4 min-h-[120px]">
          <div v-if="organizeLoading" class="text-sm text-neutral-500">{{ t('common.loading') }}</div>
          <ul v-else class="space-y-2">
            <li
              v-for="(p, idx) in organizePins"
              :key="p.id"
              draggable="true"
              class="flex items-center gap-3 p-2 rounded-xl border border-neutral-100 bg-neutral-50 cursor-grab active:cursor-grabbing"
              @dragstart="onOrganizeDragStart(idx)"
              @dragover="onOrganizeDragOver($event)"
              @drop.prevent="onOrganizeDrop(idx)"
            >
              <img :src="p.image" alt="" class="w-12 h-12 rounded-lg object-cover shrink-0 bg-neutral-200" />
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-neutral-900 truncate">{{ p.title }}</p>
                <p v-if="p.scheduled_publish_at" class="text-[10px] text-amber-700">{{ t('pin.scheduledBadge') }}</p>
              </div>
              <span class="material-symbols-outlined text-neutral-400 text-lg shrink-0">drag_indicator</span>
            </li>
          </ul>
        </div>
        <div class="px-5 py-4 border-t border-neutral-100 flex gap-2 justify-end">
          <button type="button" class="px-4 py-2 rounded-full text-sm font-semibold bg-neutral-100 text-neutral-800" @click="closeOrganizeBoard">
            {{ t('profile.boards.organizeClose') }}
          </button>
          <button
            type="button"
            class="px-4 py-2 rounded-full text-sm font-semibold bg-pink-600 text-white disabled:opacity-50"
            :disabled="organizeSaving || organizeLoading || organizePins.length === 0"
            @click="saveBoardOrder"
          >
            {{ organizeSaving ? t('common.loading') : t('profile.boards.organizeSave') }}
          </button>
        </div>
      </div>
    </div>

    <section
      v-if="isMyProfile && currentPlan === 'pro'"
      class="mb-10 bg-white rounded-2xl border border-amber-200 p-5 sm:p-6"
    >
      <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 class="text-lg font-semibold text-neutral-900">{{ t('creator.profileStatsTitle') }}</h2>
        <div class="flex items-center gap-2 flex-wrap justify-end">
          <router-link
            to="/creator"
            class="text-xs font-semibold text-pink-700 hover:text-pink-800 whitespace-nowrap"
          >
            {{ t('creator.openDashboard') }} →
          </router-link>
          <span class="text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-1 rounded-full">PRO</span>
        </div>
      </div>
      <div v-if="creatorStatsLoading" class="text-sm text-neutral-500">{{ t('common.loading') }}</div>
      <div v-else class="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
        <div class="rounded-xl bg-neutral-50 py-3">
          <p class="text-xs text-neutral-500">{{ t('creator.kpiPins') }}</p>
          <p class="text-lg font-bold text-neutral-900">{{ creatorStats?.totals?.pins ?? 0 }}</p>
        </div>
        <div class="rounded-xl bg-neutral-50 py-3">
          <p class="text-xs text-neutral-500">{{ t('creator.kpiViews') }}</p>
          <p class="text-lg font-bold text-neutral-900">{{ creatorStats?.totals?.views ?? 0 }}</p>
        </div>
        <div class="rounded-xl bg-neutral-50 py-3">
          <p class="text-xs text-neutral-500">{{ t('creator.kpiSaves') }}</p>
          <p class="text-lg font-bold text-neutral-900">{{ creatorStats?.totals?.saves ?? 0 }}</p>
        </div>
        <div class="rounded-xl bg-neutral-50 py-3">
          <p class="text-xs text-neutral-500">{{ t('creator.kpiLikes') }}</p>
          <p class="text-lg font-bold text-neutral-900">{{ creatorStats?.totals?.likes ?? 0 }}</p>
        </div>
        <div class="rounded-xl bg-neutral-50 py-3">
          <p class="text-xs text-neutral-500">{{ t('creator.kpiComments') }}</p>
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

    <div v-if="showFollowersModal || showFollowingModal" class="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50">
      <div class="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
        <div class="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <h3 class="font-semibold text-neutral-900">
            {{ showFollowersModal ? t('profile.followers') : t('profile.following') }}
          </h3>
          <button class="text-neutral-500 hover:text-neutral-700" @click="showFollowersModal = false; showFollowingModal = false">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <div class="max-h-96 overflow-y-auto">
          <div v-if="relationsLoading" class="p-6 text-center text-sm text-neutral-500">{{ t('common.loading') }}</div>
          <div v-else-if="relationItems.length === 0" class="p-6 text-center text-sm text-neutral-500">
            {{ t('following.empty') }}
          </div>
          <button
            v-for="item in relationItems"
            :key="item.username"
            class="w-full px-5 py-3 flex items-center gap-3 hover:bg-neutral-50 text-left"
            @click="showFollowersModal = false; showFollowingModal = false; router.push(`/profile/${item.username}`)"
          >
            <div class="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center" :class="item.avatar_color">
              <img v-if="item.avatar" :src="item.avatar" class="w-full h-full object-cover" />
              <span v-else class="text-white text-xs font-bold">{{ item.display_name?.slice(0,1) }}</span>
            </div>
            <div class="min-w-0">
              <p class="text-sm text-neutral-900 truncate flex items-center gap-1">
                <span v-if="item.is_pro" class="material-symbols-outlined text-amber-500 text-sm">verified</span>
                {{ item.display_name }}
              </p>
              <p class="text-xs text-neutral-500">@{{ item.username }}</p>
            </div>
          </button>
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
        v-if="isMyProfile"
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
    <PinSkeleton v-if="((activeTab === 'created' ? profilePinsLoading : savedPinsLoading) && displayPins.length === 0)" />

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
    />

    <div
      v-if="showProfileInfiniteSentinel"
      ref="infiniteScrollSentinel"
      class="flex justify-center items-center py-10 min-h-[64px]"
      aria-hidden="true"
    >
      <span
        v-if="profilePinsLoadingMore || savedPinsLoadingMore"
        class="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"
      />
    </div>

    <StoryViewer
      v-if="currentUser && activeStories.length > 0"
      v-model="storyViewerOpen"
      :pins="activeStories"
      :initial-index="storyViewerInitialIndex"
    />
  </div>
</template>
