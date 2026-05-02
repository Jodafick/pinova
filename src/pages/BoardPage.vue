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
    boardPins.value = (res.data.pins || []).map(mapDjangoPinToFrontend)
  } catch (e: unknown) {
    const status = (e as { response?: { status?: number } })?.response?.status
    loadError.value = status === 404 ? 'not_found' : 'generic'
    boardPins.value = []
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
      <div class="mb-8">
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

      <PinGrid v-if="boardPins.length" :pins="boardPins" @open-pin="openPin" @toggle-save="onToggleSave" />
      <p v-else class="text-neutral-500 text-center py-16">{{ t('board.empty') }}</p>
    </template>
  </div>
</template>
