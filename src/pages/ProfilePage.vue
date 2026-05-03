<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth, DEFAULT_AVATAR_COLOR_CLASS } from '../composables/useAuth'
import { usePins, mapDjangoPinToFrontend, isAlreadyReportedError } from '../composables/usePins'
import type { User, Pin } from '../types'
import PinGrid from '../components/PinGrid.vue'
import ProfileHeaderSkeleton from '../components/ProfileHeaderSkeleton.vue'
import UserListSkeleton from '../components/UserListSkeleton.vue'
import CreatorStatsSkeleton from '../components/CreatorStatsSkeleton.vue'
import StoryViewer from '../components/StoryViewer.vue'
import StoryRingCover from '../components/StoryRingCover.vue'
import AvatarDisc from '../components/AvatarDisc.vue'
import UserSearchPickModal from '../components/UserSearchPickModal.vue'
import ReportContentModal from '../components/ReportContentModal.vue'
import { useI18n } from '../i18n'
import { useAppModal } from '../composables/useAppModal'
import api from '../api'
import { displayInitials } from '../utils/displayInitials'
import { shareUrlWithFallback } from '../utils/shareFallback'
import {
  PIN_MEDIA_ANTI_LEAK_CLASS,
  pinMediaAntiLeakImgBindings,
} from '../composables/mediaAntiLeak'
import { useAnchoredDropdown } from '../composables/useAnchoredDropdown'
import { usePointerOutsideDismiss } from '../composables/usePointerOutsideDismiss'
import {
  initialStoryIndexForUser,
  isStoryRingAllCaughtUp,
  upsertStoryRingSession,
} from '../utils/storyRingProgress'
import type { StorySessionEndPayload } from '../utils/storyRingProgress'

const PROFILE_PINS_PAGE_SIZE = 24

const { t, currentLang } = useI18n()
const { showAlert, showPrompt, showConfirm } = useAppModal()

const router = useRouter()
const route = useRoute()
const {
  currentUser,
  toggleSavePin,
  fetchUserProfile,
  fetchCurrentUser,
  toggleFollow: apiToggleFollow,
  createBoard,
  fetchMyBoards,
  addBoardCollaborator,
  fetchPendingBoardInvitations,
  acceptBoardInvitation,
  declineBoardInvitation,
} = useAuth()
const { pins, toggleSave, fetchPins, fetchCreatorStats, reportProfile, blockUser } = usePins()

const profileUser = ref<User | null>(null)
const loading = ref(true)
/** Dernier code HTTP si le chargement `profiles/:user/` a échoué (ex. 403, 404). */
const profileHttpStatus = ref<number | undefined>(undefined)
/** Profil masqué par blocage mutuel (API `user_blocked`). */
const profileLoadBlocked = ref(false)
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

const profileUnavailableTitle = computed(() => {
  if (profileLoadBlocked.value) return t('profile.blocked.title')
  const s = profileHttpStatus.value
  if (s === 404) return t('profile.unavailable.notFoundTitle')
  if (s === 403) return t('profile.unavailable.privateTitle')
  return t('profile.unavailable.genericTitle')
})

const profileUnavailableDesc = computed(() => {
  if (profileLoadBlocked.value) return t('profile.blocked.desc')
  const s = profileHttpStatus.value
  if (s === 404) return t('profile.unavailable.notFoundDesc')
  if (s === 403) return t('profile.unavailable.privateDesc')
  return t('profile.unavailable.genericDesc')
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

type BoardInviteRow = {
  id: number
  board_id: number
  board_name: string
  owner_username: string
  invited_by_username: string
}

const pendingBoardInvites = ref<BoardInviteRow[]>([])
const pendingInvitesLoading = ref(false)
const profileBoardsLoading = ref(false)
const collaboratorInviteOpen = ref(false)
const collaboratorInviteBoardId = ref<number | null>(null)

async function loadPendingBoardInvites() {
  if (!currentUser.value || route.params.username) {
    pendingBoardInvites.value = []
    return
  }
  pendingInvitesLoading.value = true
  try {
    const rows = await fetchPendingBoardInvitations()
    pendingBoardInvites.value = Array.isArray(rows) ? rows : []
  } catch {
    pendingBoardInvites.value = []
  } finally {
    pendingInvitesLoading.value = false
  }
}

async function handleAcceptBoardInvite(inv: BoardInviteRow) {
  try {
    await acceptBoardInvitation(inv.id)
    pendingBoardInvites.value = pendingBoardInvites.value.filter((x) => x.id !== inv.id)
    await loadProfile()
  } catch (err: any) {
    await showAlert(err?.response?.data?.error || t('profile.boards.inviteError'), {
      variant: 'danger',
      title: t('modal.errorTitle'),
    })
  }
}

async function handleDeclineBoardInvite(inv: BoardInviteRow) {
  try {
    await declineBoardInvitation(inv.id)
    pendingBoardInvites.value = pendingBoardInvites.value.filter((x) => x.id !== inv.id)
  } catch (err: any) {
    await showAlert(err?.response?.data?.error || t('profile.boards.inviteError'), {
      variant: 'danger',
      title: t('modal.errorTitle'),
    })
  }
}

const loadProfile = async () => {
  loading.value = true
  resetSavedPinsState()
  profileBoardsLoading.value = false
  const shareQuery = typeof route.query.share === 'string' ? route.query.share : ''
  const profileShareOpts = shareQuery ? { share: shareQuery } : undefined

  profileHttpStatus.value = undefined
  profileLoadBlocked.value = false

  if (!route.params.username) {
    if (!currentUser.value) {
      profileUser.value = null
      loading.value = false
      void router.replace({ name: 'login', query: { redirect: '/profile' } })
      return
    }
    profileUser.value = currentUser.value
    profileBoardsLoading.value = true
    try {
      const myBoards = await fetchMyBoards()
      profileUser.value.boards = myBoards.map((board: any) => ({
        id: board.id,
        name: board.name,
        pinCount: board.pin_count ?? board.pinCount ?? 0,
        isPrivate: board.is_private ?? board.isPrivate ?? false,
        isOwner: board.is_owner !== false,
        ownerUsername:
          board.owner_username ?? board.ownerUsername ?? profileUser.value?.username,
        collaboratorCount: board.collaborator_count ?? board.collaboratorCount ?? 0,
        previewImages: board.preview_images ?? board.previewImages ?? [],
        shareToken: board.share_token ?? board.shareToken ?? undefined,
      }))
    } catch (err) {
      console.error('Erreur chargement tableaux:', err)
    } finally {
      profileBoardsLoading.value = false
    }
    isFollowing.value = false
  } else {
    const result = await fetchUserProfile(route.params.username as string, profileShareOpts)
    profileUser.value = result.user
    profileHttpStatus.value = result.httpStatus
    profileLoadBlocked.value = !!result.blocked
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
    void loadPendingBoardInvites()
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

const reportProfileOpen = ref(false)
const reportProfileSubmitting = ref(false)
const blockProfilePending = ref(false)

const profileMoreMenuOpen = ref(false)
const profileMoreMenuTriggerRef = ref<HTMLElement | null>(null)
const profileMoreMenuPanelRef = ref<HTMLElement | null>(null)
const { floatingStyles: profileMoreMenuFloatingStyles } = useAnchoredDropdown(
  profileMoreMenuTriggerRef,
  profileMoreMenuPanelRef,
  {
    open: profileMoreMenuOpen,
    placement: 'bottom-end',
    strategy: 'fixed',
    offsetPx: 8,
  },
)
usePointerOutsideDismiss(() => [
  {
    isOpen: profileMoreMenuOpen,
    getRoots: () => [profileMoreMenuTriggerRef.value, profileMoreMenuPanelRef.value],
    close: () => {
      profileMoreMenuOpen.value = false
    },
  },
])

const isTargetBlocked = computed(() => {
  const u = profileUser.value?.username
  if (!u || !currentUser.value?.blockedUsernames?.length) return false
  return currentUser.value.blockedUsernames.includes(u)
})

async function handleSubmitProfileReport(payload: { category: string; details: string }) {
  const u = profileUser.value?.username
  if (!u) return
  reportProfileSubmitting.value = true
  try {
    await reportProfile(u, payload)
    reportProfileOpen.value = false
    if (profileUser.value) {
      profileUser.value = { ...profileUser.value, viewerHasReportedProfile: true }
    }
    await showAlert(t('moderation.reportSent'), { variant: 'success' })
  } catch (e) {
    if (isAlreadyReportedError(e)) {
      if (profileUser.value) {
        profileUser.value = { ...profileUser.value, viewerHasReportedProfile: true }
      }
      await showAlert(t('moderation.reportAlready'), { variant: 'info' })
    } else {
      await showAlert(t('moderation.reportError'), { variant: 'danger', title: t('modal.errorTitle') })
    }
  } finally {
    reportProfileSubmitting.value = false
  }
}

async function handleBlockProfile() {
  profileMoreMenuOpen.value = false
  const u = profileUser.value?.username
  if (!u || !currentUser.value) return
  const ok = await showConfirm({
    title: t('profile.block.confirmTitle'),
    message: t('profile.block.confirmBody'),
    variant: 'danger',
  })
  if (!ok) return
  blockProfilePending.value = true
  try {
    await blockUser(u)
    await fetchCurrentUser({ silent: true })
    await showAlert(t('profile.block.done'), { variant: 'success' })
    void router.push('/')
  } catch {
    await showAlert(t('profile.block.error'), { variant: 'danger', title: t('modal.errorTitle') })
  } finally {
    blockProfilePending.value = false
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

/** Total créations visibles pour le visiteur (API `pins_count`), avec repli prudent. */
const profilePinsTotalDisplay = computed(() => {
  const n = profileUser.value?.pinsCount
  if (typeof n === 'number') return { n, pending: false }
  if (loading.value || !profileUser.value) return { n: null, pending: true }
  if (profilePinsLoading.value) return { n: null, pending: true }
  return { n: profilePins.value.length, pending: false }
})

const displayPins = computed(() => {
  return activeTab.value === 'created' ? createdPins.value : savedPinsList.value
})

const profileGridLoadingInitial = computed(() => {
  if (displayPins.value.length > 0) return false
  return activeTab.value === 'created' ? profilePinsLoading.value : savedPinsLoading.value
})

const profileGridLoadingMore = computed(
  () => profilePinsLoadingMore.value || savedPinsLoadingMore.value,
)

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
const privateBoardsCount = computed(() => boards.value.filter((board) => board.isPrivate && board.isOwner !== false).length)
const publicBoardsCount = computed(() => boards.value.filter((board) => !board.isPrivate && board.isOwner !== false).length)
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
      isOwner: true,
      ownerUsername: profileUser.value.username,
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

function onPinDeletedFromGrid(slug: string) {
  profilePins.value = profilePins.value.filter((p) => p.slug !== slug)
  savedPinsList.value = savedPinsList.value.filter((p) => p.slug !== slug)
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
  collaboratorInviteBoardId.value = boardId
  collaboratorInviteOpen.value = true
}

async function submitBoardCollaboratorInvite(usernameRaw: string) {
  const boardId = collaboratorInviteBoardId.value
  const username = usernameRaw.trim()
  if (!boardId || !username) return
  try {
    const result = await addBoardCollaborator(boardId, username)
    collaboratorInviteBoardId.value = null
    if ((result as { status?: string })?.status === 'invited') {
      await showAlert(t('profile.boards.inviteSent'), { variant: 'success' })
    } else {
      const targetBoard = profileUser.value?.boards?.find((board) => board.id === boardId)
      if (targetBoard && profileUser.value?.boards) {
        targetBoard.collaboratorCount = (targetBoard.collaboratorCount || 0) + 1
        profileUser.value.boards = [...profileUser.value.boards]
      }
    }
  } catch (err: unknown) {
    console.error('Erreur invitation collaborateur:', err)
    const ax = err as { response?: { data?: { error?: string } } }
    await showAlert(ax.response?.data?.error || t('profile.boards.inviteError'), {
      variant: 'danger',
      title: t('modal.errorTitle'),
    })
  }
}

function onCollaboratorInvitePick(username: string) {
  void submitBoardCollaboratorInvite(username)
}

type BoardSuggestions = {
  new_board_hints: Array<{ name: string; topic_slug: string; pin_count_hint: number }>
  existing_boards: Array<{ id: number; name: string; overlap_score: number; pin_count: number }>
}

const boardSuggestions = ref<BoardSuggestions | null>(null)
const activeStories = ref<Pin[]>([])
const storyViewerOpen = ref(false)
const storyViewerInitialIndex = ref(0)
const profileStoryProgressTick = ref(0)

const profileStoryRingAllCaughtUp = computed(() => {
  void profileStoryProgressTick.value
  const u = profileUser.value?.username
  const list = activeStories.value
  if (!u || !list.length) return false
  return isStoryRingAllCaughtUp(u, list)
})

function onProfileStorySessionEnd(payload: StorySessionEndPayload) {
  upsertStoryRingSession(payload)
  profileStoryProgressTick.value++
}

/** Dernier segment story (liste API chronologique) : vignette vidéo ou image plutôt que l’avatar. */
const profileStoryRingCoverUrl = computed(() => {
  const list = activeStories.value
  if (!list.length) return ''
  const last = list[list.length - 1]
  if (!last) return ''
  const img = (last.imageUrl || '').trim()
  if (img) return img
  return (last.storyVideoUrl || '').trim()
})

function openStoryViewer() {
  const u = profileUser.value?.username
  const list = activeStories.value
  if (!u || !list.length) return
  storyViewerInitialIndex.value = initialStoryIndexForUser(u, list)
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

function goToBoard(board: NonNullable<User['boards']>[number]) {
  const uname = board.ownerUsername || profileUser.value?.username
  if (!uname) return
  router.push(`/profile/${uname}/board/${board.id}`)
}

async function handleShareProfile() {
  if (!profileUser.value) return
  try {
    let url: string
    if (isMyProfile.value && profileUser.value.privateProfile) {
      const res = await api.post('me/profile-share-token/', {})
      const token = res.data?.share_token
      if (!token) throw new Error('no token')
      url = `${window.location.origin}/profile/${profileUser.value.username}?share=${encodeURIComponent(token)}`
    } else if (isMyProfile.value) {
      url = `${window.location.origin}/profile/${profileUser.value.username}`
    } else {
      url = window.location.href
    }
    const title = `${profileUser.value.displayName} — Pinova`
    const text = (profileUser.value.bio || '').slice(0, 220)
    await shareUrlWithFallback(
      { showAlert, showPrompt },
      {
        url,
        title,
        text,
        copiedMessage: t('profile.share.copied'),
        copyErrorMessage: t('profile.share.copyError'),
        copyErrorTitle: t('modal.errorTitle'),
        manualTitle: t('pin.share.manualTitle'),
        manualBody: t('pin.share.manualBody'),
      },
    )
  } catch {
    await showAlert(t('profile.share.copyError'), { variant: 'danger', title: t('modal.errorTitle') })
  }
}

async function shareBoardLink(board: NonNullable<User['boards']>[number]) {
  if (!isMyProfile.value || !profileUser.value) return
  const ownerU = board.ownerUsername || profileUser.value.username
  try {
    let url = `${window.location.origin}/profile/${ownerU}/board/${board.id}`
    if (board.isPrivate) {
      const res = await api.post(`boards/${board.id}/share-token/`, {})
      const token = res.data?.share_token
      if (!token) throw new Error('no token')
      url += `?share=${encodeURIComponent(token)}`
    }
    await shareUrlWithFallback(
      { showAlert, showPrompt },
      {
        url,
        title: `${board.name} — Pinova`,
        text: `@${ownerU}`,
        copiedMessage: t('profile.share.boardCopied'),
        copyErrorMessage: t('profile.share.copyError'),
        copyErrorTitle: t('modal.errorTitle'),
        manualTitle: t('pin.share.manualTitle'),
        manualBody: t('pin.share.manualBody'),
      },
    )
  } catch {
    await showAlert(t('profile.share.copyError'), { variant: 'danger', title: t('modal.errorTitle') })
  }
}
</script>

<template>
  <div v-if="loading" class="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
    <ProfileHeaderSkeleton />
    <PinGrid class="mt-4" :pins="[]" loading-initial />
  </div>

  <div v-else-if="profileUser" class="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
    <!-- Profile header -->
    <section class="flex flex-col items-center text-center mb-10">
      <button
        v-if="currentUser && activeStories.length > 0"
        type="button"
        class="relative mb-4 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2"
        :aria-label="t('profile.stories.openRing')"
        @click="openStoryViewer()"
      >
        <span
          v-if="!profileStoryRingAllCaughtUp"
          class="absolute -inset-1 rounded-full bg-gradient-to-tr from-pink-500 via-amber-400 to-violet-500 p-[3px]"
          aria-hidden="true"
        />
        <span
          v-else
          class="absolute -inset-1 rounded-full bg-neutral-300 p-[3px]"
          aria-hidden="true"
        />
        <span class="relative flex rounded-full bg-white p-[2px]">
          <span class="w-28 h-28 rounded-full overflow-hidden shadow-inner avatar-shadow shrink-0 block">
            <StoryRingCover
              :cover-url="profileStoryRingCoverUrl"
              :display-name="profileUser.displayName"
              :username="profileUser.username"
              :avatar-url="profileUser.avatarUrl ?? ''"
              :avatar-color="profileUser.avatarColor"
            />
          </span>
        </span>
      </button>
      <AvatarDisc
        v-else
        :color="profileUser.avatarColor"
        frame-class="w-28 h-28 text-4xl shadow-lg mb-4"
        text-class="text-white"
        :has-image="!!profileUser.avatarUrl"
      >
        <img v-if="profileUser.avatarUrl" :src="profileUser.avatarUrl" class="w-full h-full object-cover rounded-full" />
        <span v-else class="avatar-text">{{ displayInitials(profileUser.displayName) }}</span>
      </AvatarDisc>

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
        <span class="inline-flex items-center gap-1">
          <strong v-if="!profilePinsTotalDisplay.pending" class="text-neutral-900">{{ profilePinsTotalDisplay.n }}</strong>
          <span
            v-else
            class="inline-block h-5 w-8 rounded-md bg-neutral-200 animate-pulse"
            aria-hidden="true"
          />
          {{ t('profile.pinsCount') }}
        </span>
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
        <div v-if="currentUser && !isMyProfile && profileUser" class="relative flex items-center">
          <button
            ref="profileMoreMenuTriggerRef"
            type="button"
            class="w-9 h-9 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition"
            :aria-expanded="profileMoreMenuOpen"
            :aria-label="t('profile.moreAriaLabel')"
            @click.stop="profileMoreMenuOpen = !profileMoreMenuOpen"
          >
            <span class="material-symbols-outlined text-[22px]">more_horiz</span>
          </button>
        </div>
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

      <div
        v-if="isMyProfile && (pendingInvitesLoading || pendingBoardInvites.length > 0)"
        class="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4"
      >
        <p class="text-sm font-semibold text-neutral-900 mb-3">{{ t('profile.boards.pendingInvitesTitle') }}</p>
        <div v-if="pendingInvitesLoading" class="pt-1">
          <UserListSkeleton :rows="4" :divided="false" />
        </div>
        <ul v-else class="space-y-2">
          <li
            v-for="inv in pendingBoardInvites"
            :key="inv.id"
            class="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white border border-neutral-100 px-3 py-2"
          >
            <div class="min-w-0">
              <p class="text-sm font-medium text-neutral-900 truncate">{{ inv.board_name }}</p>
              <p class="text-[11px] text-neutral-500">@{{ inv.owner_username }}</p>
            </div>
            <div class="flex gap-2 shrink-0">
              <button
                type="button"
                class="px-3 py-1.5 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-800"
                @click="handleDeclineBoardInvite(inv)"
              >
                {{ t('profile.boards.declineInvite') }}
              </button>
              <button
                type="button"
                class="px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-600 text-white"
                @click="handleAcceptBoardInvite(inv)"
              >
                {{ t('profile.boards.acceptInvite') }}
              </button>
            </div>
          </li>
        </ul>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" v-if="profileBoardsLoading && isMyProfile">
        <div
          v-for="i in 4"
          :key="'bsk-' + i"
          class="rounded-2xl aspect-[4/3] bg-neutral-200 animate-pulse"
          aria-hidden="true"
        />
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" v-else>
        <div
          v-for="board in boards"
          :key="board.id"
          class="group relative bg-neutral-200 rounded-2xl overflow-hidden aspect-[4/3] cursor-pointer hover:shadow-md transition ring-1 ring-black/5"
          role="button"
          tabindex="0"
          @click="goToBoard(board)"
          @keydown.enter.prevent="goToBoard(board)"
        >
          <div class="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-px bg-neutral-300">
            <template v-if="board.previewImages && board.previewImages.length">
              <img
                v-for="(src, pi) in board.previewImages.slice(0, 4)"
                :key="pi"
                :src="src"
                alt=""
                :class="[PIN_MEDIA_ANTI_LEAK_CLASS, 'w-full h-full object-cover bg-neutral-100 min-h-0']"
                v-bind="pinMediaAntiLeakImgBindings()"
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
          <div v-if="board.isOwner === false" class="absolute top-3 left-3 z-10 px-2 py-1 rounded-full bg-emerald-600/95 text-[10px] font-bold text-white pointer-events-none">
            {{ t('profile.boards.sharedBadge') }}
          </div>
          <div
            v-if="isMyProfile && board.isOwner !== false"
            class="absolute top-3 right-3 z-10 flex items-center gap-1 pointer-events-auto"
          >
            <span
              v-if="board.isPrivate"
              class="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white shadow-md"
              :title="t('board.private')"
            >
              <span class="material-symbols-outlined text-base">lock</span>
            </span>
            <button
              type="button"
              class="w-9 h-9 rounded-full bg-white/95 shadow-md flex items-center justify-center text-neutral-700 hover:bg-white"
              :title="t('profile.share.boardTitle')"
              @click.stop="shareBoardLink(board)"
            >
              <span class="material-symbols-outlined text-lg">ios_share</span>
            </button>
          </div>
          <button
            v-if="isMyProfile && board.isOwner !== false"
            type="button"
            class="absolute bottom-3 right-3 z-10 w-9 h-9 rounded-full bg-white/95 shadow-md flex items-center justify-center text-neutral-700 hover:bg-white"
            :title="t('profile.boards.reorganize')"
            @click.stop="openOrganizeBoard(board.id)"
          >
            <span class="material-symbols-outlined text-lg">drag_indicator</span>
          </button>
          <button
            v-if="isMyProfile && currentPlan !== 'free' && board.isOwner !== false"
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
          <div v-if="organizeLoading">
            <UserListSkeleton :rows="6" thumb="rounded" :divided="false" />
          </div>
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
      <CreatorStatsSkeleton v-if="creatorStatsLoading" />
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
          <template v-if="relationsLoading">
            <UserListSkeleton :rows="10" />
          </template>
          <template v-else>
            <div v-if="relationItems.length === 0" class="p-6 text-center text-sm text-neutral-500">
              {{ t('following.empty') }}
            </div>
            <button
              v-for="item in relationItems"
              :key="item.username"
              class="w-full px-5 py-3 flex items-center gap-3 hover:bg-neutral-50 text-left"
              @click="showFollowersModal = false; showFollowingModal = false; router.push(`/profile/${item.username}`)"
            >
              <AvatarDisc
                :color="item.avatar_color || DEFAULT_AVATAR_COLOR_CLASS"
                frame-class="w-9 h-9 text-xs"
                text-class="text-white"
                :has-image="!!item.avatar"
              >
                <img v-if="item.avatar" :src="item.avatar" class="w-full h-full object-cover" />
                <span v-else class="avatar-text">{{ displayInitials(item.display_name) }}</span>
              </AvatarDisc>
              <div class="min-w-0">
                <p class="text-sm text-neutral-900 truncate flex items-center gap-1">
                  <span v-if="item.is_pro" class="material-symbols-outlined text-amber-500 text-sm">verified</span>
                  {{ item.display_name }}
                </p>
                <p class="text-xs text-neutral-500">@{{ item.username }}</p>
              </div>
            </button>
          </template>
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
    <PinGrid
      v-if="displayPins.length > 0 || profileGridLoadingInitial"
      :pins="displayPins"
      :loading-initial="profileGridLoadingInitial"
      :loading-more="profileGridLoadingMore"
      @toggle-save="handleToggleSave"
      @open-pin="openPin"
      @pin-deleted="onPinDeletedFromGrid"
    />

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

    <div
      v-if="showProfileInfiniteSentinel"
      ref="infiniteScrollSentinel"
      class="w-full py-6 min-h-[40px]"
      aria-hidden="true"
    />

    <StoryViewer
      v-if="currentUser && activeStories.length > 0"
      v-model="storyViewerOpen"
      :pins="activeStories"
      :initial-index="storyViewerInitialIndex"
      @session-end="onProfileStorySessionEnd"
    />

    <Teleport to="body">
      <div
        v-if="profileMoreMenuOpen && profileUser"
        ref="profileMoreMenuPanelRef"
        role="menu"
        class="fixed z-[120] w-[min(220px,calc(100vw-1rem))] rounded-xl border border-neutral-200 bg-white shadow-xl py-1"
        :style="profileMoreMenuFloatingStyles"
        @pointerdown.stop
      >
        <button
          v-if="!profileUser.viewerHasReportedProfile"
          type="button"
          role="menuitem"
          class="w-full px-3 py-2.5 text-left text-sm text-neutral-700 hover:bg-neutral-50"
          @click="profileMoreMenuOpen = false; reportProfileOpen = true"
        >
          {{ t('profile.moreReport') }}
        </button>
        <div v-else class="px-3 py-2 text-xs text-neutral-500">
          {{ t('profile.moreAlreadyReported') }}
        </div>
        <button
          v-if="!isTargetBlocked"
          type="button"
          role="menuitem"
          class="w-full px-3 py-2.5 text-left text-sm text-neutral-700 hover:bg-neutral-50"
          :disabled="blockProfilePending"
          @click="handleBlockProfile"
        >
          {{ t('profile.moreBlock') }}
        </button>
      </div>
    </Teleport>

    <UserSearchPickModal
      v-model="collaboratorInviteOpen"
      :title="t('profile.boards.invitePromptTitle')"
      :message="t('profile.boards.inviteSearchMessage')"
      :input-placeholder="t('profile.boards.invitePlaceholder')"
      @pick="onCollaboratorInvitePick"
    />

    <ReportContentModal
      v-model="reportProfileOpen"
      :context-label="profileUser ? `@${profileUser.username} · ${profileUser.displayName}` : ''"
      @submit="handleSubmitProfileReport"
    />
  </div>

  <div v-else class="max-w-md mx-auto px-6 py-20 text-center space-y-4">
    <span class="material-symbols-outlined text-6xl text-neutral-300">person_off</span>
    <h1 class="text-xl font-bold text-neutral-900">{{ profileUnavailableTitle }}</h1>
    <p class="text-sm text-neutral-600 leading-relaxed">{{ profileUnavailableDesc }}</p>
    <div class="flex flex-wrap items-center justify-center gap-3 pt-2">
      <router-link
        to="/"
        class="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-pink-600 text-white text-sm font-semibold hover:bg-pink-700 transition"
      >
        {{ t('profile.unavailable.goHome') }}
      </router-link>
      <router-link
        v-if="route.params.username"
        :to="{ name: 'login', query: { redirect: route.fullPath } }"
        class="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-neutral-100 text-neutral-800 text-sm font-semibold hover:bg-neutral-200 transition"
      >
        {{ t('profile.unavailable.goLogin') }}
      </router-link>
    </div>
  </div>
</template>
