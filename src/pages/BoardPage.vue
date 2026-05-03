<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PinGrid from '../components/PinGrid.vue'
import BoardHeaderSkeleton from '../components/BoardHeaderSkeleton.vue'
import UserListSkeleton from '../components/UserListSkeleton.vue'
import api from '../api'
import { mapDjangoPinToFrontend, usePins } from '../composables/usePins'
import { useAuth } from '../composables/useAuth'
import type { Pin } from '../types'
import { useI18n } from '../i18n'
import { useAppModal } from '../composables/useAppModal'
import { shareUrlWithFallback } from '../utils/shareFallback'
import { formatDrfErrorMessages } from '../utils/apiValidationErrors'

const { t } = useI18n()
const { showAlert, showPrompt, showConfirm } = useAppModal()
const route = useRoute()
const router = useRouter()
const { toggleSave } = usePins()
const { currentUser, updateBoard, deleteBoard } = useAuth()

const boardId = computed(() => Number(route.params.boardId))
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

const showOrganizeButton = computed(() => viewerCanManage.value && !!currentUser.value)

async function loadBoard() {
  if (!Number.isFinite(boardId.value) || boardId.value < 1) {
    loadError.value = 'not_found'
    loading.value = false
    return
  }
  loading.value = true
  loadError.value = null
  try {
    const shareParam = typeof route.query.share === 'string' ? route.query.share : ''
    const res = await api.get(`boards/${boardId.value}/`, shareParam ? { params: { share: shareParam } } : {})
    boardName.value = res.data.name || ''
    ownerUsername.value = res.data.owner_username || ''
    viewerCanManage.value = !!(res.data.viewer_can_manage ?? res.data.viewerCanManage)
    boardIsPrivate.value = !!(res.data.is_private ?? res.data.isPrivate)
    boardIsOwner.value = !!(res.data.is_owner ?? res.data.isOwner)
    boardDescription.value = String(res.data.description ?? '')
    boardPins.value = (res.data.pins || []).map(mapDjangoPinToFrontend)
  } catch (e: unknown) {
    const status = (e as { response?: { status?: number } })?.response?.status
    loadError.value = status === 404 ? 'not_found' : 'generic'
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
  router.push(`/pin/${slug}`)
}

async function onToggleSave(slug: string) {
  if (!currentUser.value) {
    router.push('/login')
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
}

async function openOrganize() {
  if (!viewerCanManage.value || !currentUser.value) return
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
  organizePins.value = []
}

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
    const owner = ownerUsername.value.trim()
    router.replace(owner ? `/profile/${owner}` : '/')
  } catch {
    await showAlert(t('board.deleteError'), { variant: 'danger', title: t('modal.errorTitle') })
  } finally {
    boardDeletePending.value = false
  }
}

onMounted(loadBoard)
watch([boardId, () => route.query.share], loadBoard)
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
    <button
      type="button"
      class="mb-6 flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900 transition"
      @click="router.back()"
    >
      <span class="material-symbols-outlined text-lg">arrow_back</span>
      {{ t('common.back') }}
    </button>

    <div v-if="loading" class="animate-pulse">
      <BoardHeaderSkeleton />
      <PinGrid class="mt-8" :pins="[]" loading-initial />
    </div>

    <div v-else-if="loadError === 'not_found'" class="text-center py-16 text-neutral-600">
      {{ t('board.notFound') }}
    </div>

    <div v-else-if="loadError === 'generic'" class="text-center py-16 text-neutral-600">
      {{ t('board.loadError') }}
    </div>

    <template v-else>
      <div class="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0 flex-1">
          <h1 class="text-2xl sm:text-3xl font-bold text-neutral-900">{{ boardName }}</h1>
          <router-link
            v-if="ownerUsername"
            :to="`/profile/${ownerUsername}`"
            class="text-sm text-pink-600 hover:underline mt-1 inline-block"
          >
            @{{ ownerUsername }}
          </router-link>
          <p class="text-sm text-neutral-500 mt-2">{{ t('board.pinCount', { count: boardPins.length }) }}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto justify-end ml-auto">
          <button
            v-if="viewerCanManage"
            type="button"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-neutral-200 bg-white text-neutral-800 text-sm font-semibold hover:bg-neutral-50 transition"
            @click="openBoardEditor"
          >
            <span class="material-symbols-outlined text-lg">edit</span>
            {{ t('board.editBoard') }}
          </button>
          <button
            v-if="boardIsOwner"
            type="button"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-red-200 bg-white text-red-700 text-sm font-semibold hover:bg-red-50 transition disabled:opacity-50"
            :disabled="boardDeletePending"
            @click="confirmDeleteBoard"
          >
            <span v-if="boardDeletePending" class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
            <span v-else class="material-symbols-outlined text-lg" aria-hidden="true">delete</span>
            {{ t('board.deleteBoard') }}
          </button>
          <button
            v-if="showOrganizeButton"
            type="button"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-800 transition"
            @click="openOrganize"
          >
            <span class="material-symbols-outlined text-lg">drag_indicator</span>
            {{ t('board.organizePins') }}
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-neutral-200 bg-white text-neutral-800 text-sm font-semibold hover:bg-neutral-50 transition"
            :aria-label="t('board.share')"
            @click="shareThisBoard"
          >
            <span class="material-symbols-outlined text-lg">share</span>
            {{ t('board.share') }}
          </button>
        </div>
      </div>

      <PinGrid v-if="boardPins.length" :pins="boardPins" @open-pin="openPin" @toggle-save="onToggleSave" @pin-deleted="onPinDeletedFromGrid" />
      <p v-else class="text-neutral-500 text-center py-16">{{ t('board.empty') }}</p>
    </template>

    <div
      v-if="organizeModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm"
    >
      <div class="bg-white rounded-3xl w-full max-w-lg max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
        <div class="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <h3 class="text-lg font-bold text-neutral-900">{{ t('profile.boards.organizeTitle') }}</h3>
          <button type="button" class="text-neutral-500 hover:text-neutral-800" @click="closeOrganize">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <p class="text-xs text-neutral-500 px-5 pt-3">{{ t('profile.boards.organizeHint') }}</p>
        <div class="flex-1 overflow-y-auto px-5 py-4 min-h-[120px]">
          <div v-if="organizeLoading" class="min-h-[140px]">
            <UserListSkeleton :rows="7" thumb="rounded" :divided="false" />
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
          <button type="button" class="px-4 py-2 rounded-full text-sm font-semibold bg-neutral-100 text-neutral-800" @click="closeOrganize">
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

    <div
      v-if="boardEditOpen"
      class="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div class="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 sm:p-7">
        <h3 class="text-lg font-bold text-neutral-900 mb-4">{{ t('board.editTitle') }}</h3>
        <label class="block text-sm font-medium text-neutral-700 mb-2">{{ t('board.editName') }}</label>
        <input
          v-model="editBoardName"
          type="text"
          class="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-pink-500"
          maxlength="255"
        />
        <label class="block text-sm font-medium text-neutral-700 mb-2">{{ t('board.editDescription') }}</label>
        <textarea
          v-model="editBoardDescription"
          rows="3"
          class="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none"
        />
        <label
          v-if="boardEditCanTogglePrivate"
          class="flex items-start gap-2 text-sm text-neutral-800 mb-6 cursor-pointer"
        >
          <input v-model="editBoardPrivate" type="checkbox" class="mt-1 rounded border-neutral-300 text-pink-600" />
          <span>
            {{ t('profile.boards.modal.private') }}
            <span class="block text-[11px] text-neutral-500 font-normal">{{ t('board.editPrivateHelp') }}</span>
          </span>
        </label>
        <div class="flex flex-col-reverse sm:flex-row gap-2 justify-end">
          <button type="button" class="px-4 py-2 rounded-full text-sm font-semibold bg-neutral-100 text-neutral-800" @click="closeBoardEditor">
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            class="px-5 py-2 rounded-full text-sm font-semibold bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-50"
            :disabled="boardEditSaving"
            @click="submitBoardMeta"
          >
            {{ boardEditSaving ? t('board.savingBoard') : t('board.saveChanges') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
