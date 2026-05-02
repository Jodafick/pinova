<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PinGrid from '../components/PinGrid.vue'
import api from '../api'
import { mapDjangoPinToFrontend, usePins } from '../composables/usePins'
import { useAuth } from '../composables/useAuth'
import type { Pin } from '../types'
import { useI18n } from '../i18n'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { toggleSave } = usePins()
const { currentUser } = useAuth()

const boardId = computed(() => Number(route.params.boardId))
const loading = ref(true)
const loadError = ref<'not_found' | 'generic' | null>(null)
const boardName = ref('')
const ownerUsername = ref('')
const boardPins = ref<Pin[]>([])
const viewerCanManage = ref(false)

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
    const res = await api.get(`boards/${boardId.value}/`)
    boardName.value = res.data.name || ''
    ownerUsername.value = res.data.owner_username || ''
    viewerCanManage.value = !!(res.data.viewer_can_manage ?? res.data.viewerCanManage)
    boardPins.value = (res.data.pins || []).map(mapDjangoPinToFrontend)
  } catch (e: unknown) {
    const status = (e as { response?: { status?: number } })?.response?.status
    loadError.value = status === 404 ? 'not_found' : 'generic'
    boardPins.value = []
    viewerCanManage.value = false
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

async function saveBoardOrder() {
  if (!boardId.value) return
  organizeSaving.value = true
  try {
    await api.post(`boards/${boardId.value}/reorder-pins/`, {
      pin_ids: organizePins.value.map((p) => p.id),
    })
    closeOrganize()
    await loadBoard()
  } catch (err: any) {
    window.alert(err?.response?.data?.error || t('board.organizeError'))
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

onMounted(loadBoard)
watch(boardId, loadBoard)
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

    <div v-if="loading" class="flex justify-center py-20">
      <div class="w-10 h-10 border-4 border-neutral-100 border-t-pink-600 rounded-full animate-spin"></div>
    </div>

    <div v-else-if="loadError === 'not_found'" class="text-center py-16 text-neutral-600">
      {{ t('board.notFound') }}
    </div>

    <div v-else-if="loadError === 'generic'" class="text-center py-16 text-neutral-600">
      {{ t('board.loadError') }}
    </div>

    <template v-else>
      <div class="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
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
        <button
          v-if="showOrganizeButton"
          type="button"
          class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-800 transition"
          @click="openOrganize"
        >
          <span class="material-symbols-outlined text-lg">drag_indicator</span>
          {{ t('board.organizePins') }}
        </button>
      </div>

      <PinGrid v-if="boardPins.length" :pins="boardPins" @open-pin="openPin" @toggle-save="onToggleSave" />
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
  </div>
</template>
