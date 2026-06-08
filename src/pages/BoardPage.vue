<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import PinovaModal from '../components/ui/PinovaModal.vue'
import PinovaButton from '../components/ui/PinovaButton.vue'
import { useRoute, useRouter } from 'vue-router'
import PinGrid from '../components/PinGrid.vue'
import PinDetailOverlayHost from '../components/PinDetailOverlayHost.vue'
import BoardHeaderSkeleton from '../components/BoardHeaderSkeleton.vue'
import UserListSkeleton from '../components/UserListSkeleton.vue'
import api from '../api/index'
import { mapDjangoPinToFrontend, usePins } from '../composables/usePins'
import {
  boardDetailCacheKey,
  getCachedBoardDetail,
  setCachedBoardDetail,
  type BoardDetailSnapshot,
} from '../lib/cache/entityClientCache'
import { useAuth } from '../composables/useAuth'
import { useGuestAuthGate } from '../composables/useGuestAuthGate'
import type { Pin, SponsoredAd } from '../types'
import { pushFeedItemOverlay } from '../utils/feedOverlayNavigation'
import { useI18n } from '../i18n'
import { useAppModal } from '../composables/useAppModal'
import { shareUrlWithFallback } from '../utils/shareFallback'
import { formatDrfErrorMessages } from '../utils/apiValidationErrors'
import {
  mobileBoardMoreButtonRef,
  setMobileBoardMoreTrailing,
  setMobileHeaderTitle,
} from '../composables/mobileHeaderContext'

import UserSearchPickModal from '../components/UserSearchPickModal.vue'
import { useAnchoredDropdown } from '../composables/useAnchoredDropdown'
import { usePointerOutsideDismiss } from '../composables/usePointerOutsideDismiss'

const { t } = useI18n()
const { showAlert, showPrompt, showConfirm } = useAppModal()
const route = useRoute()
const router = useRouter()
const { toggleSave } = usePins()
const { currentUser, updateBoard, deleteBoard, addBoardCollaborator, fetchCurrentUser } = useAuth()
const { promptGuest } = useGuestAuthGate()

const currentPlan = computed<'free' | 'plus' | 'pro'>(() => {
  const p = currentUser.value?.subscription?.plan
  if (p === 'plus' || p === 'pro') return p
  return 'free'
})

const boardActionsOpen = ref(false)
const boardActionsTriggerRef = ref<HTMLElement | null>(null)
const boardActionsPanelRef = ref<HTMLElement | null>(null)
const isViewportLg = ref(false)
let viewportMqlCleanup: (() => void) | null = null

/** Menu ancré au bouton page (desktop) ; mobile : panneau fixe sous le header. */
const boardActionsAnchorOpen = computed(() => boardActionsOpen.value && isViewportLg.value)

const { floatingStyles: boardActionsFloatingStyles } = useAnchoredDropdown(
  boardActionsTriggerRef,
  boardActionsPanelRef,
  {
    open: boardActionsAnchorOpen,
    placement: 'bottom-end',
    strategy: 'fixed',
    offsetPx: 8,
  },
)

const boardActionsMenuMobileStyle = computed(() => {
  if (isViewportLg.value) return {} as Record<string, string>
  const top = 'calc(3.5rem + env(safe-area-inset-top, 0px) + 6px)'
  return {
    position: 'fixed',
    top,
    right: '12px',
    zIndex: '120',
  } as Record<string, string>
})

usePointerOutsideDismiss(() => [
  {
    isOpen: boardActionsOpen,
    getRoots: () =>
      [boardActionsTriggerRef.value, boardActionsPanelRef.value, mobileBoardMoreButtonRef.value].filter(
        (n): n is HTMLElement => n instanceof HTMLElement,
      ),
    close: () => {
      boardActionsOpen.value = false
    },
  },
])

const collaboratorInviteOpen = ref(false)
const boardInviteDisambiguation = ref<Array<{ username: string; display_name: string }>>([])

watch(collaboratorInviteOpen, (open) => {
  if (!open) boardInviteDisambiguation.value = []
})

const boardId = computed(() => Number(route.params.boardId))
const routeOwnerUsername = computed(() => String(route.params.username || '').trim())
const loading = ref(true)
const loadError = ref<'not_found' | 'generic' | null>(null)
const boardName = ref('')
const ownerUsername = ref('')
const boardPins = ref<Pin[]>([])
const viewerCanManage = ref(false)
const boardIsPrivate = ref(false)
const boardIsOwner = ref(false)
const boardDescription = ref('')

const boardEditOpen = ref(false)
const boardEditSaving = ref(false)
const editBoardName = ref('')
const editBoardDescription = ref('')
const editBoardPrivate = ref(false)

const boardDeletePending = ref(false)

const boardEditCanTogglePrivate = computed(() => viewerCanManage.value && boardIsOwner.value)
const organizeModalOpen = ref(false)
const organizePins = ref<
  Array<{ id: number; slug: string; title: string; image: string; position: number; scheduled_publish_at?: string | null }>
>([])
const organizeLoading = ref(false)
const organizeSaving = ref(false)
const dragOrganizeIndex = ref<number | null>(null)

/** Tactile : glisser-réordonner uniquement depuis la poignée (DnD HTML5 peu fiable au doigt). */
const organizeTouchDragging = ref(false)
const organizeTouchFrom = ref<number | null>(null)

const showOrganizeButton = computed(() => viewerCanManage.value && !!currentUser.value)

function snapshotBoardState(): BoardDetailSnapshot {
  return {
    boardName: boardName.value,
    ownerUsername: ownerUsername.value,
    boardDescription: boardDescription.value,
    viewerCanManage: viewerCanManage.value,
    boardIsPrivate: boardIsPrivate.value,
    boardIsOwner: boardIsOwner.value,
    boardPins: boardPins.value,
  }
}

function persistBoardClientCache() {
  if (!Number.isFinite(boardId.value) || boardId.value < 1) return
  if (loadError.value !== null) return
  const shareParam = typeof route.query.share === 'string' ? route.query.share : ''
  setCachedBoardDetail(boardDetailCacheKey(boardId.value, shareParam), snapshotBoardState())
}

async function loadBoard() {
  if (!Number.isFinite(boardId.value) || boardId.value < 1) {
    loadError.value = 'not_found'
    boardName.value = ''
    ownerUsername.value = ''
    loading.value = false
    return
  }
  const shareParam = typeof route.query.share === 'string' ? route.query.share : ''
  const cacheKey = boardDetailCacheKey(boardId.value, shareParam)
  const pathOwner = routeOwnerUsername.value
  const cached = getCachedBoardDetail(cacheKey)
  if (cached) {
    boardName.value = cached.boardName
    ownerUsername.value = cached.ownerUsername || pathOwner
    viewerCanManage.value = cached.viewerCanManage
    boardIsPrivate.value = cached.boardIsPrivate
    boardIsOwner.value = cached.boardIsOwner
    boardDescription.value = cached.boardDescription
    boardPins.value = cached.boardPins
    loadError.value = null
    loading.value = false
    return
  }

  loading.value = true
  loadError.value = null
  ownerUsername.value = pathOwner
  boardName.value = ''
  boardPins.value = []
  viewerCanManage.value = false
  boardIsPrivate.value = false
  boardIsOwner.value = false
  boardDescription.value = ''
  try {
    const res = await api.get(`boards/${boardId.value}/`, shareParam ? { params: { share: shareParam } } : {})
    boardName.value = res.data.name || ''
    ownerUsername.value = res.data.owner_username || pathOwner
    viewerCanManage.value = !!(res.data.viewer_can_manage ?? res.data.viewerCanManage)
    boardIsPrivate.value = !!(res.data.is_private ?? res.data.isPrivate)
    boardIsOwner.value = !!(res.data.is_owner ?? res.data.isOwner)
    boardDescription.value = String(res.data.description ?? '')
    boardPins.value = (res.data.pins || []).map(mapDjangoPinToFrontend)
    persistBoardClientCache()
  } catch (e: unknown) {
    const status = (e as { response?: { status?: number } })?.response?.status
    loadError.value = status === 404 ? 'not_found' : 'generic'
    boardName.value = ''
    ownerUsername.value = pathOwner
    boardPins.value = []
    viewerCanManage.value = false
    boardIsPrivate.value = false
    boardIsOwner.value = false
    boardDescription.value = ''
  } finally {
    loading.value = false
  }
}

function openPin(slug: string) {
  router.push({ path: route.path, query: { ...route.query, pin: slug } })
}

function openSponsored(item: SponsoredAd) {
  pushFeedItemOverlay(router, item)
}

async function onToggleSave(slug: string) {
  if (!currentUser.value) {
    promptGuest('save', { resourceId: slug })
    return
  }
  try {
    await toggleSave(slug)
  } catch {
    /* erreur déjà loguée dans usePins */
  }
}

function onPinDeletedFromGrid(slug: string) {
  boardPins.value = boardPins.value.filter((p) => p.slug !== slug)
  organizePins.value = organizePins.value.filter((p) => p.slug !== slug)
  persistBoardClientCache()
}

async function openOrganize() {
  if (!viewerCanManage.value || !currentUser.value) return
  organizeTouchDragging.value = false
  organizeTouchFrom.value = null
  organizeModalOpen.value = true
  organizeLoading.value = true
  organizePins.value = []
  dragOrganizeIndex.value = null
  try {
    const res = await api.get(`boards/${boardId.value}/ordered-pins/`)
    organizePins.value = [...(res.data.pins || [])]
  } catch {
    organizeModalOpen.value = false
  } finally {
    organizeLoading.value = false
  }
}

function closeOrganize() {
  organizeModalOpen.value = false
}

watch(organizeModalOpen, (open) => {
  if (!open) {
    organizeTouchDragging.value = false
    organizeTouchFrom.value = null
    organizePins.value = []
  }
})

/** Aligne boardPins sur l’ordre du modal après succès POST (sans refetch). */
function reorderBoardPinsFromOrganizeModal() {
  const orderIds = organizePins.value.map((p) => p.id)
  if (orderIds.length === 0) return
  const byId = new Map(boardPins.value.map((p) => [p.id, p]))
  const ordered: Pin[] = []
  for (const id of orderIds) {
    const pin = byId.get(id)
    if (pin) ordered.push(pin)
  }
  for (const pin of boardPins.value) {
    if (!orderIds.includes(pin.id)) ordered.push(pin)
  }
  boardPins.value = ordered
  persistBoardClientCache()
}

async function saveBoardOrder() {
  if (!boardId.value) return
  organizeSaving.value = true
  try {
    await api.post(`boards/${boardId.value}/reorder-pins/`, {
      pin_ids: organizePins.value.map((p) => p.id),
    })
    reorderBoardPinsFromOrganizeModal()
    closeOrganize()
  } catch (err: any) {
    await showAlert(err?.response?.data?.error || t('board.organizeError'), {
      variant: 'danger',
      title: t('modal.errorTitle'),
    })
  } finally {
    organizeSaving.value = false
  }
}

async function openInviteCollaboratorFromBoard() {
  boardActionsOpen.value = false
  if (!boardIsOwner.value || !currentUser.value) return
  if (currentPlan.value === 'free') {
    await showAlert(t('profile.boards.collabRequiresPlan'), { variant: 'warning' })
    return
  }
  collaboratorInviteOpen.value = true
}

async function submitBoardInvitePick(usernameRaw: string) {
  const id = boardId.value
  const username = usernameRaw.trim()
  if (!id || !username) return
  try {
    const result = await addBoardCollaborator(id, username)
    collaboratorInviteOpen.value = false
    boardInviteDisambiguation.value = []
    if ((result as { status?: string })?.status === 'invited') {
      await showAlert(t('profile.boards.inviteSent'), { variant: 'success' })
    }
  } catch (err: unknown) {
    const ax = err as {
      response?: {
        data?: {
          code?: string
          candidates?: Array<{ username: string; display_name: string }>
          error?: string
        }
      }
    }
    const d = ax.response?.data
    if (d?.code === 'ambiguous_display_name' && Array.isArray(d.candidates) && d.candidates.length) {
      boardInviteDisambiguation.value = d.candidates
      return
    }
    await showAlert(d?.error || t('profile.boards.inviteError'), {
      variant: 'danger',
      title: t('modal.errorTitle'),
    })
  }
}

function onBoardInvitePick(username: string) {
  void submitBoardInvitePick(username)
}

async function shareThisBoardFromMenu() {
  boardActionsOpen.value = false
  await shareThisBoard()
}

function openOrganizeFromMenu() {
  boardActionsOpen.value = false
  void openOrganize()
}

function openBoardEditorFromMenu() {
  boardActionsOpen.value = false
  openBoardEditor()
}

async function confirmDeleteBoardFromMenu() {
  boardActionsOpen.value = false
  await confirmDeleteBoard()
}

function endOrganizeTouchDragFromRow(e: PointerEvent) {
  const el = e.currentTarget
  if (el instanceof HTMLElement) {
    try {
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
    } catch {
      /* */
    }
  }
  organizeTouchDragging.value = false
  organizeTouchFrom.value = null
}

function reorderOrganizePinRows(from: number, to: number) {
  if (from === to) return
  const arr = [...organizePins.value]
  const moved = arr.splice(from, 1)[0]
  if (moved === undefined) return
  arr.splice(to, 0, moved)
  organizePins.value = arr
}

/** Poignée : au tactile, démarrage immédiat du glisser (DnD HTML5 peu fiable au doigt). */
function onOrganizeHandlePointerDown(e: PointerEvent, idx: number) {
  if (e.pointerType === 'mouse') return
  organizeTouchDragging.value = true
  organizeTouchFrom.value = idx
  const row = (e.currentTarget as HTMLElement | null)?.closest?.('[data-organize-index]') ?? null
  if (row instanceof HTMLElement) {
    try {
      row.setPointerCapture(e.pointerId)
    } catch {
      /* */
    }
  }
}

function onOrganizeRowPointerMove(e: PointerEvent) {
  if (!organizeTouchDragging.value || organizeTouchFrom.value === null) return
  if (e.cancelable) e.preventDefault()
  const el = document.elementFromPoint(e.clientX, e.clientY)
  const row = el?.closest('[data-organize-index]') as HTMLElement | null
  const raw = row?.dataset.organizeIndex
  if (raw === undefined) return
  const to = Number.parseInt(raw, 10)
  if (!Number.isFinite(to)) return
  const from = organizeTouchFrom.value
  if (from === to) return
  reorderOrganizePinRows(from, to)
  organizeTouchFrom.value = to
}

function onOrganizeRowPointerUp(e: PointerEvent) {
  if (organizeTouchDragging.value) {
    endOrganizeTouchDragFromRow(e)
  }
}

function onOrganizeDragStart(index: number, event: DragEvent) {
  dragOrganizeIndex.value = index
  /* Requis par Firefox / Safari pour autoriser le drop sur une autre ligne. */
  try {
    event.dataTransfer?.setData('text/plain', `pinova-organize:${index}`)
    event.dataTransfer?.setData('application/x-pinova-board-organize', String(index))
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  } catch {
    /* certains navigateurs restreignent setData hors geste utilisateur */
  }
}

function onOrganizeDragEnd() {
  dragOrganizeIndex.value = null
}

function onOrganizeDragOver(event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}

function onOrganizeDrop(index: number) {
  const from = dragOrganizeIndex.value
  dragOrganizeIndex.value = null
  if (from === null || from === index) return
  reorderOrganizePinRows(from, index)
}

async function shareThisBoard() {
  const owner = ownerUsername.value
  if (!owner || !boardId.value) return
  try {
    let url = `${window.location.origin}/profile/${owner}/board/${boardId.value}`
    if (boardIsPrivate.value && viewerCanManage.value) {
      const res = await api.post(`boards/${boardId.value}/share-token/`, {})
      const token = res.data?.share_token
      if (!token) throw new Error('no token')
      url += `?share=${encodeURIComponent(token)}`
    } else if (boardIsPrivate.value) {
      url = window.location.href.split('#')[0] ?? window.location.href
    }
    await shareUrlWithFallback(
      { showAlert, showPrompt },
      {
        url,
        title: `${boardName.value.trim() || 'Pinova'} — Pinova`,
        text: `@${owner}`,
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

function openBoardEditor() {
  if (!viewerCanManage.value) return
  editBoardName.value = boardName.value
  editBoardDescription.value = boardDescription.value
  editBoardPrivate.value = boardIsPrivate.value
  boardEditOpen.value = true
}

function closeBoardEditor() {
  boardEditOpen.value = false
}

async function submitBoardMeta() {
  if (!boardId.value || !viewerCanManage.value) return
  boardEditSaving.value = true
  try {
    const payload: { name?: string; description?: string; isPrivate?: boolean } = {
      name: editBoardName.value.trim(),
      description: editBoardDescription.value.trim(),
    }
    if (!payload.name) {
      await showAlert(t('board.nameRequired'), { variant: 'warning', title: t('modal.errorTitle') })
      return
    }
    if (boardEditCanTogglePrivate.value) {
      payload.isPrivate = editBoardPrivate.value
    }
    await updateBoard(boardId.value, payload)
    boardName.value = payload.name
    boardDescription.value = payload.description ?? ''
    if (boardEditCanTogglePrivate.value) {
      boardIsPrivate.value = !!payload.isPrivate
    }
    boardEditOpen.value = false
    persistBoardClientCache()
    /* Snapshot /me en localStorage : nom/visibilité du board peut influer
       sur les compteurs publics/privés et le résumé profil. */
    void fetchCurrentUser({ force: true, silent: true })
  } catch (err: unknown) {
    const ax = err as { response?: { data?: Record<string, unknown> | string } }
    const data = ax.response?.data
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      await showAlert(
        formatDrfErrorMessages(data as Record<string, unknown>).slice(0, 6).join('\n') || t('board.organizeError'),
        { variant: 'danger', title: t('modal.errorTitle') },
      )
    } else {
      await showAlert(typeof data === 'string' ? data : t('board.organizeError'), {
        variant: 'danger',
        title: t('modal.errorTitle'),
      })
    }
  } finally {
    boardEditSaving.value = false
  }
}

async function confirmDeleteBoard() {
  if (!boardIsOwner.value || !boardId.value) return
  const ok = await showConfirm({
    title: t('board.deleteConfirmTitle'),
    message: t('board.deleteConfirmBody'),
    variant: 'danger',
  })
  if (!ok) return
  boardDeletePending.value = true
  try {
    await deleteBoard(boardId.value)
    /* Compteurs boards de /me doivent décroître immédiatement (header, profil). */
    void fetchCurrentUser({ force: true, silent: true })
    const owner = ownerUsername.value.trim()
    router.replace(owner ? `/profile/${owner}` : '/')
  } catch {
    await showAlert(t('board.deleteError'), { variant: 'danger', title: t('modal.errorTitle') })
  } finally {
    boardDeletePending.value = false
  }
}

watch([boardId, () => route.query.share], () => {
  void loadBoard()
}, { immediate: true })

watch(
  () => boardName.value,
  (n) => {
    setMobileHeaderTitle(n?.trim() || null)
  },
  { immediate: true },
)

watch(
  [loading, loadError],
  () => {
    if (loading.value || loadError.value !== null) {
      setMobileBoardMoreTrailing(null)
      boardActionsOpen.value = false
      return
    }
    setMobileBoardMoreTrailing({
      ariaLabel: t('pin.ownerMenu.more'),
      onClick: () => {
        boardActionsOpen.value = !boardActionsOpen.value
      },
    })
  },
  { immediate: true },
)

onMounted(() => {
  if (typeof window === 'undefined') return
  const mql = window.matchMedia('(min-width: 1024px)')
  isViewportLg.value = mql.matches
  const fn = () => {
    isViewportLg.value = mql.matches
  }
  mql.addEventListener('change', fn)
  viewportMqlCleanup = () => mql.removeEventListener('change', fn)
})

onUnmounted(() => {
  viewportMqlCleanup?.()
  viewportMqlCleanup = null
  organizeTouchDragging.value = false
  organizeTouchFrom.value = null
  setMobileHeaderTitle(null)
  setMobileBoardMoreTrailing(null)
  boardActionsOpen.value = false
})
</script>

<template>
  <div class="w-full min-w-0 max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
    <PinovaButton
      variant="secondary"
      class="group mb-8 hidden text-sm lg:inline-flex"
      @click="router.back()"
    >
      <span class="material-symbols-outlined text-lg">arrow_back</span>
      {{ t('common.back') }}
    </PinovaButton>

    <div v-if="loading" class="app-skeleton-wave w-full min-w-0">
      <template v-if="routeOwnerUsername && !boardName">
        <div class="mb-8 flex flex-wrap items-start justify-between gap-3 w-full min-w-0">
          <div class="min-w-0 flex-1 pr-2">
            <div class="h-8 sm:h-9 w-48 sm:w-64 rounded-lg bg-neutral-200/80 dark:bg-neutral-700/80 animate-pulse mb-2" />
            <router-link
              :to="`/profile/${routeOwnerUsername}`"
              class="text-sm text-pink-700 hover:underline mt-1 inline-block"
            >
              @{{ routeOwnerUsername }}
            </router-link>
            <p class="text-sm app-text-muted mt-2">{{ t('board.pinCount', { count: boardPins.length }) }}</p>
          </div>
        </div>
      </template>
      <BoardHeaderSkeleton v-else />
      <PinGrid class="mt-2 sm:mt-6 w-full" :pins="boardPins" :loading-initial="boardPins.length === 0" />
    </div>

    <div v-else-if="loadError === 'not_found'" class="w-full min-w-0 text-center py-16 text-neutral-600 dark:text-neutral-400">
      {{ t('board.notFound') }}
    </div>

    <div v-else-if="loadError === 'generic'" class="w-full min-w-0 text-center py-16 text-neutral-600 dark:text-neutral-400">
      {{ t('board.loadError') }}
    </div>

    <template v-else>
      <div class="mb-8 flex flex-wrap items-start justify-between gap-3 w-full min-w-0">
        <div class="min-w-0 flex-1 pr-2">
          <h1 class="text-2xl sm:text-3xl font-auth-title font-auth-title--black text-neutral-900 dark:text-neutral-100">{{ boardName }}</h1>
          <router-link
            v-if="ownerUsername"
            :to="`/profile/${ownerUsername}`"
            class="text-sm text-pink-700 hover:underline mt-1 inline-block"
          >
            @{{ ownerUsername }}
          </router-link>
          <p class="text-sm app-text-muted mt-2">{{ t('board.pinCount', { count: boardPins.length }) }}</p>
        </div>
        <button
          type="button"
          ref="boardActionsTriggerRef"
          class="hidden lg:inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-neutral-200/90 bg-white/90 text-neutral-700 shadow-sm transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900/90 dark:text-neutral-200 dark:hover:bg-neutral-800"
          :aria-expanded="boardActionsOpen"
          aria-haspopup="menu"
          :aria-label="t('pin.ownerMenu.more')"
          @click="boardActionsOpen = !boardActionsOpen"
        >
          <span class="material-symbols-outlined text-[22px]">more_vert</span>
        </button>
      </div>

      <PinGrid
        v-if="boardPins.length"
        class="w-full"
        :pins="boardPins"
        @open-pin="openPin"
        @open-sponsored="openSponsored"
        @toggle-save="onToggleSave"
        @pin-deleted="onPinDeletedFromGrid"
      />
      <p v-else class="app-text-muted text-center py-16">{{ t('board.empty') }}</p>
    </template>

    <Teleport to="body">
      <div
        v-if="boardActionsOpen"
        ref="boardActionsPanelRef"
        role="menu"
        class="lux-dropdown-panel"
        :style="{ ...(isViewportLg ? boardActionsFloatingStyles : boardActionsMenuMobileStyle), zIndex: 120 }"
        @pointerdown.stop
      >
        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-neutral-800 dark:text-neutral-100 hover:bg-pink-50/60 dark:hover:bg-white/[0.06] transition-colors"
          @click="shareThisBoardFromMenu"
        >
          <span class="material-symbols-outlined text-lg text-neutral-500 dark:text-neutral-400" aria-hidden="true">share</span>
          {{ t('board.share') }}
        </button>
        <button
          v-if="viewerCanManage"
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-neutral-800 dark:text-neutral-100 hover:bg-pink-50/60 dark:hover:bg-white/[0.06] transition-colors"
          @click="openBoardEditorFromMenu"
        >
          <span class="material-symbols-outlined text-lg text-neutral-500 dark:text-neutral-400" aria-hidden="true">edit</span>
          {{ t('board.editBoard') }}
        </button>
        <button
          v-if="showOrganizeButton"
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-neutral-800 dark:text-neutral-100 hover:bg-pink-50/60 dark:hover:bg-white/[0.06] transition-colors"
          @click="openOrganizeFromMenu"
        >
          <span class="material-symbols-outlined text-lg text-neutral-500 dark:text-neutral-400" aria-hidden="true">drag_indicator</span>
          {{ t('board.organizePins') }}
        </button>
        <button
          v-if="boardIsOwner && currentPlan !== 'free'"
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-neutral-800 dark:text-neutral-100 hover:bg-pink-50/60 dark:hover:bg-white/[0.06] transition-colors"
          @click="openInviteCollaboratorFromBoard"
        >
          <span class="material-symbols-outlined text-lg text-neutral-500 dark:text-neutral-400" aria-hidden="true">person_add</span>
          {{ t('profile.boards.invitePromptTitle') }}
        </button>
        <button
          v-if="boardIsOwner"
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-red-700 dark:text-red-400 hover:bg-red-50/90 dark:hover:bg-red-950/35 transition-colors disabled:opacity-50"
          :disabled="boardDeletePending"
          @click="confirmDeleteBoardFromMenu"
        >
          <span v-if="boardDeletePending" class="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" aria-hidden="true" />
          <span v-else class="material-symbols-outlined text-lg shrink-0" aria-hidden="true">delete</span>
          {{ t('board.deleteBoard') }}
        </button>
      </div>
    </Teleport>

    <UserSearchPickModal
      v-model="collaboratorInviteOpen"
      :title="t('profile.boards.invitePromptTitle')"
      :message="t('profile.boards.inviteSearchMessage')"
      :input-placeholder="t('profile.boards.invitePlaceholder')"
      :disambiguation-rows="boardInviteDisambiguation"
      @pick="onBoardInvitePick"
    />

    <PinDetailOverlayHost :feed-items="boardPins" />

    <PinovaModal
      v-model:open="organizeModalOpen"
      presentation="tallSheet"
      presentation-lg="center"
      :presentation-lg-min-width="1280"
      disable-gesture
      :title="t('profile.boards.organizeTitle')"
    >
      <template #headerEnd>
        <button
          type="button"
          class="inline-flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 hover:bg-black/[0.06] dark:text-neutral-300 dark:hover:bg-white/[0.08] transition"
          :aria-label="t('common.close')"
          @click="closeOrganize"
        >
          <span class="material-symbols-outlined text-[22px] leading-none">close</span>
        </button>
      </template>

      <p class="text-xs app-text-muted -mt-1 mb-3">{{ t('profile.boards.organizeHint') }}</p>
      <div class="min-h-[120px] touch-pan-y">
        <div v-if="organizeLoading" class="min-h-[140px]">
          <UserListSkeleton :rows="7" thumb="rounded" :divided="false" />
        </div>
        <ul v-else class="space-y-2 touch-pan-y">
          <li
            v-for="(p, idx) in organizePins"
            :key="p.id"
            :data-organize-index="idx"
            class="lux-organize-row !cursor-default touch-pan-y"
            :class="
              organizeTouchDragging && organizeTouchFrom === idx
                ? 'ring-2 ring-pink-700/45 dark:ring-pink-600/35 opacity-90'
                : ''
            "
            @pointermove="onOrganizeRowPointerMove($event)"
            @pointerup="onOrganizeRowPointerUp($event)"
            @pointercancel="onOrganizeRowPointerUp($event)"
            @dragover="onOrganizeDragOver($event)"
            @dragenter.prevent="onOrganizeDragOver($event)"
            @drop.prevent="onOrganizeDrop(idx)"
          >
            <img
              :src="p.image"
              alt=""
              draggable="false"
              class="w-12 h-12 shrink-0 rounded-lg object-cover bg-neutral-200 dark:bg-neutral-700 pointer-events-none"
            />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{{ p.title }}</p>
              <p v-if="p.scheduled_publish_at" class="text-[10px] text-amber-700 dark:text-amber-400">{{ t('pin.scheduledBadge') }}</p>
            </div>
            <button
              type="button"
              draggable="true"
              class="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl border-2 border-neutral-200/95 bg-gradient-to-b from-white to-neutral-50 text-neutral-500 shadow-sm touch-none cursor-grab select-none active:cursor-grabbing active:scale-[0.98] dark:border-neutral-600 dark:from-neutral-800 dark:to-neutral-900 dark:text-neutral-300 dark:shadow-black/20"
              :aria-label="t('board.organizeDragHandle')"
              @pointerdown.stop="onOrganizeHandlePointerDown($event, idx)"
              @dragstart.stop="onOrganizeDragStart(idx, $event)"
              @dragend="onOrganizeDragEnd"
            >
              <span class="material-symbols-outlined text-[30px] leading-none" aria-hidden="true">drag_indicator</span>
            </button>
          </li>
        </ul>
      </div>

      <template #footer>
        <div class="flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <PinovaButton variant="secondary" class="w-full sm:w-auto min-h-[44px] sm:min-w-[7rem]" @click="closeOrganize">
            {{ t('profile.boards.organizeClose') }}
          </PinovaButton>
          <PinovaButton
            variant="primary"
            class="w-full sm:w-auto min-h-[44px] sm:min-w-[9rem]"
            :disabled="organizeSaving || organizeLoading || organizePins.length === 0"
            @click="saveBoardOrder"
          >
            {{ organizeSaving ? t('common.loading') : t('profile.boards.organizeSave') }}
          </PinovaButton>
        </div>
      </template>
    </PinovaModal>

    <PinovaModal
      v-model:open="boardEditOpen"
      presentation="tallSheet"
      presentation-lg="center"
      :title="t('board.editTitle')"
    >
      <template #headerEnd>
        <button
          type="button"
          class="inline-flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 hover:bg-black/[0.06] dark:text-neutral-300 dark:hover:bg-white/[0.08] transition"
          :aria-label="t('common.close')"
          @click="closeBoardEditor"
        >
          <span class="material-symbols-outlined text-[22px] leading-none">close</span>
        </button>
      </template>

      <div class="h-px w-full bg-gradient-to-r from-transparent via-pink-200/70 to-transparent opacity-70 mb-5 dark:via-pink-600/40" aria-hidden="true" />
      <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">{{ t('board.editName') }}</label>
      <input v-model="editBoardName" type="text" class="lux-input-elegant mb-4" maxlength="255" />
      <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">{{ t('board.editDescription') }}</label>
      <textarea v-model="editBoardDescription" rows="3" class="lux-input-elegant resize-none mb-4" />
      <label
        v-if="boardEditCanTogglePrivate"
        class="flex items-start gap-2 text-sm text-neutral-800 dark:text-neutral-200 mb-2 cursor-pointer"
      >
        <input v-model="editBoardPrivate" type="checkbox" class="mt-1 rounded border-neutral-300 text-pink-700" />
        <span>
          {{ t('profile.boards.modal.private') }}
          <span class="block text-[11px] text-neutral-500 dark:text-neutral-400 font-normal">{{ t('board.editPrivateHelp') }}</span>
        </span>
      </label>

      <template #footer>
        <div class="flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <PinovaButton variant="secondary" class="w-full sm:w-auto min-h-[44px] sm:min-w-[7rem]" @click="closeBoardEditor">
            {{ t('common.cancel') }}
          </PinovaButton>
          <PinovaButton
            variant="primary"
            class="w-full sm:w-auto min-h-[44px] sm:min-w-[9rem]"
            :disabled="boardEditSaving"
            @click="submitBoardMeta"
          >
            {{ boardEditSaving ? t('board.savingBoard') : t('board.saveChanges') }}
          </PinovaButton>
        </div>
      </template>
    </PinovaModal>
  </div>
</template>
