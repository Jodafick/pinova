<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePins } from '../composables/usePins'
import { useAuth } from '../composables/useAuth'
import { useI18n } from '../i18n'
import PrivateTags from '../components/PrivateTags.vue'
import api from '../api'

const { t } = useI18n()

const router = useRouter()
const { addPin, topics } = usePins()
const { currentUser, fetchMyBoards } = useAuth()

const title = ref('')
const description = ref('')
const link = ref('')
const topic = ref('')
const imageFile = ref<File | null>(null)
const imagePreviewUrl = ref<string | null>(null)
const isDragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const saving = ref(false)

// Privacy mode (qui peut voir ce pin)
const visibility = ref<'public' | 'followers' | 'private'>('public')

// Tags privés
const privateTags = ref<string[]>([])
const publicTagsInput = ref('')
const selectedBoardIds = ref<number[]>([])
const myBoards = ref<{ id: number; name: string; is_private?: boolean }[]>([])

const currentPlan = computed<'free' | 'plus' | 'pro'>(() => currentUser.value?.subscription?.plan || 'free')

// Crédit créateur certifié (plan Pro uniquement, aligné backend)
const canCertifyCredit = computed(() => currentPlan.value === 'pro')
const certifyCredit = ref(false)
watch(canCertifyCredit, (ok) => {
  certifyCredit.value = ok
}, { immediate: true })

const canSchedulePublish = computed(() => currentPlan.value === 'pro')
const scheduledPublishLocal = ref('')
watch(canSchedulePublish, (ok) => {
  if (!ok) scheduledPublishLocal.value = ''
}, { immediate: true })
type TopicOption = { name: string; originalName: string; icon?: string; color?: string }
const dynamicTopics = ref<TopicOption[]>([])
const boardsLoading = ref(false)
const showCategoryDropdown = ref(false)
const categorySearch = ref('')
let categorySearchTimer: ReturnType<typeof setTimeout> | null = null

const isStory = ref(false)
const variantStoryFile = ref<File | null>(null)
const variantSquareFile = ref<File | null>(null)
const variantLandscapeFile = ref<File | null>(null)

const isGif = computed(() => imageFile.value?.type === 'image/gif')
const canUsePrivateTags = computed(() => currentPlan.value !== 'free')
const resolvedTopics = computed<TopicOption[]>(() => {
  if (dynamicTopics.value.length > 0) return dynamicTopics.value
  return topics.value.map((topicName) => ({ name: topicName, originalName: topicName }))
})
const filteredTopics = computed(() => {
  const q = categorySearch.value.trim().toLowerCase()
  if (!q) return resolvedTopics.value.slice(0, 20)
  return resolvedTopics.value
    .filter((item) =>
      item.name.toLowerCase().includes(q) ||
      item.originalName.toLowerCase().includes(q),
    )
    .slice(0, 20)
})

const loadTopics = async (query = '') => {
  try {
    const lang = navigator.language?.split('-')[0] || 'fr'
    const response = await api.get('pins/topics/', { params: { lang, q: query, limit: 20 } })
    const payload = Array.isArray(response.data) ? response.data : []
    dynamicTopics.value = payload.map((item: any) => ({
      name: item?.name || '',
      originalName: item?.originalName || item?.name || '',
      icon: item?.icon || 'category',
      color: item?.color || '#6B7280',
    })).filter((item: TopicOption) => item.name)
  } catch (err) {
    console.warn('Impossible de charger les catégories dynamiques', err)
  }
}

const loadBoards = async () => {
  if (!currentUser.value) {
    myBoards.value = []
    return
  }
  boardsLoading.value = true
  try {
    myBoards.value = await fetchMyBoards()
  } catch (err) {
    console.warn('Impossible de charger les tableaux', err)
    myBoards.value = []
  } finally {
    boardsLoading.value = false
  }
}

onMounted(async () => {
  await loadTopics('')
  await loadBoards()
})

watch(currentUser, async () => {
  await loadBoards()
})

watch(categorySearch, (value) => {
  if (categorySearchTimer) clearTimeout(categorySearchTimer)
  categorySearchTimer = setTimeout(() => {
    void loadTopics(value.trim())
  }, 250)
})

const setImageFile = (file: File) => {
  if (!file.type.startsWith('image/')) {
    window.alert(t('create.upload.invalid'))
    return
  }
  if (imagePreviewUrl.value) URL.revokeObjectURL(imagePreviewUrl.value)
  imageFile.value = file
  imagePreviewUrl.value = URL.createObjectURL(file)
}

const onFileChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) setImageFile(file)
}

const onDrop = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) setImageFile(file)
}

const clearImage = () => {
  if (imagePreviewUrl.value) URL.revokeObjectURL(imagePreviewUrl.value)
  imageFile.value = null
  imagePreviewUrl.value = null
}

const submitPin = async () => {
  if (!title.value || !imageFile.value) return
  saving.value = true

  try {
    const formData = new FormData()
    formData.append('title', title.value)
    formData.append('description', description.value || '')
    formData.append('link', link.value || '')
    formData.append('image', imageFile.value)
    const resolvedTopic = topic.value || categorySearch.value.trim() || 'Général'
    formData.append('topic', resolvedTopic)
    formData.append('visibility', visibility.value)
    formData.append('is_story', isStory.value ? 'true' : 'false')
    formData.append('certified_credit', canCertifyCredit.value && certifyCredit.value ? 'true' : 'false')
    if (canSchedulePublish.value && scheduledPublishLocal.value) {
      const d = new Date(scheduledPublishLocal.value)
      if (!Number.isNaN(d.getTime())) {
        formData.append('scheduled_publish_at', d.toISOString())
      }
    }
    publicTagsInput.value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .forEach((tag) => formData.append('public_tags_input', tag))
    if (canUsePrivateTags.value) {
      privateTags.value.forEach((tag) => formData.append('private_tags_input', tag))
    }
    selectedBoardIds.value.forEach((boardId) => formData.append('board_ids_input', String(boardId)))

    if (variantStoryFile.value) formData.append('variant_story', variantStoryFile.value)
    if (variantSquareFile.value) formData.append('variant_square', variantSquareFile.value)
    if (variantLandscapeFile.value) formData.append('variant_landscape', variantLandscapeFile.value)

    if (currentUser.value) {
      formData.append('author', currentUser.value.id.toString())
    }

    await addPin(formData)
    router.push('/')
  } catch (err) {
    console.error('Erreur lors de la publication:', err)
    window.alert(t('create.publish.error'))
  } finally {
    saving.value = false
  }
}

const toggleBoardSelection = (boardId: number) => {
  if (selectedBoardIds.value.includes(boardId)) {
    selectedBoardIds.value = selectedBoardIds.value.filter((id) => id !== boardId)
  } else {
    selectedBoardIds.value = [...selectedBoardIds.value, boardId]
  }
}

const selectCategory = (selected: TopicOption) => {
  topic.value = selected.originalName
  categorySearch.value = selected.name
  showCategoryDropdown.value = false
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-neutral-900">{{ t('create.title') }}</h1>
        <p class="text-sm text-neutral-500 mt-1">{{ t('create.subtitle') }}</p>
      </div>
      <div class="flex items-center gap-3">
        <button
          class="px-5 py-2.5 rounded-full text-sm font-medium text-neutral-700 hover:bg-neutral-100 transition"
          @click="router.back()"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          class="px-6 py-2.5 rounded-full bg-pink-600 text-white text-sm font-semibold hover:bg-pink-700 disabled:opacity-50 transition flex items-center gap-2"
          :disabled="!title || !imagePreviewUrl || saving"
          @click="submitPin"
        >
          <svg v-if="saving" class="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {{ saving ? t('create.publishing') : t('create.publish') }}
        </button>
      </div>
    </div>

    <!-- Form -->
    <div class="bg-white rounded-3xl shadow-lg border border-neutral-100 overflow-hidden">
      <div class="flex flex-col lg:flex-row">
        <!-- Image upload area -->
        <div class="lg:w-2/5 p-6 sm:p-8 bg-neutral-50 border-b lg:border-b-0 lg:border-r border-neutral-100">
          <div
            v-if="!imagePreviewUrl"
            class="h-80 lg:h-full min-h-[320px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-4 text-center cursor-pointer transition-colors"
            :class="isDragging
              ? 'border-pink-400 bg-pink-50/60'
              : 'border-neutral-300 hover:border-pink-300 hover:bg-pink-50/30'"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop="onDrop"
            @click="fileInput?.click()"
          >
            <div class="w-16 h-16 rounded-full bg-neutral-200 flex items-center justify-center">
              <span class="material-symbols-outlined text-3xl text-neutral-500">cloud_upload</span>
            </div>
            <div>
              <p class="text-sm font-semibold text-neutral-700 mb-1">
                {{ t('create.upload.title') }}
              </p>
              <p class="text-xs text-neutral-500">
                {{ t('create.upload.subtitle') }}
              </p>
              <div class="flex items-center justify-center gap-2 mt-3">
                <span class="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-neutral-200 text-neutral-600 rounded font-bold">JPG</span>
                <span class="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-neutral-200 text-neutral-600 rounded font-bold">PNG</span>
                <span class="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-neutral-200 text-neutral-600 rounded font-bold">WEBP</span>
                <span class="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-pink-100 text-pink-700 rounded font-bold flex items-center gap-1">
                  <span class="material-symbols-outlined text-xs">animation</span>
                  {{ t('create.upload.gifBadge') }}
                </span>
              </div>
              <p class="text-xs text-neutral-400 mt-2">
                {{ t('create.upload.specs') }}
              </p>
            </div>
          </div>

          <div v-else class="relative">
            <img
              :src="imagePreviewUrl"
              alt="Aperçu"
              class="w-full rounded-2xl object-cover max-h-[500px]"
            />
            <span
              v-if="isGif"
              class="absolute top-3 left-3 px-2 py-1 rounded-md bg-pink-600 text-white text-[10px] font-bold tracking-wider flex items-center gap-1 shadow"
            >
              <span class="material-symbols-outlined text-sm">animation</span>
              {{ t('create.gif.label') }}
            </span>
            <button
              class="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 shadow-md flex items-center justify-center hover:bg-white transition"
              @click="clearImage"
            >
              <span class="material-symbols-outlined text-neutral-600">close</span>
            </button>
          </div>

          <input ref="fileInput" type="file" accept="image/*,image/gif" class="hidden" @change="onFileChange" />
        </div>

        <!-- Fields -->
        <div class="lg:w-3/5 p-6 sm:p-8 space-y-5">
          <div>
            <label class="block text-sm font-medium text-neutral-700 mb-2">{{ t('create.field.title') }}</label>
            <input
              v-model="title"
              type="text"
              :placeholder="t('create.field.title.placeholder')"
              class="w-full px-4 py-3 rounded-xl border border-neutral-200 text-base focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition placeholder:text-neutral-400"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-neutral-700 mb-2">{{ t('create.field.description') }}</label>
            <textarea
              v-model="description"
              rows="4"
              :placeholder="t('create.field.description.placeholder')"
              class="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition resize-none placeholder:text-neutral-400"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-neutral-700 mb-2">{{ t('create.field.link') }}</label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 text-lg">link</span>
              <input
                v-model="link"
                type="url"
                :placeholder="t('create.field.link.placeholder')"
                class="w-full pl-11 pr-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition placeholder:text-neutral-400"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-neutral-700 mb-2">{{ t('create.field.category') }}</label>
            <div class="relative">
              <input
                v-model="categorySearch"
                type="text"
                :placeholder="t('create.field.category.placeholder')"
                class="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition placeholder:text-neutral-400"
                @focus="showCategoryDropdown = true"
              />
              <button
                type="button"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full hover:bg-neutral-100 flex items-center justify-center"
                @click="showCategoryDropdown = !showCategoryDropdown"
              >
                <span class="material-symbols-outlined text-neutral-500">expand_more</span>
              </button>
              <div
                v-if="showCategoryDropdown"
                class="absolute z-20 mt-2 w-full bg-white border border-neutral-200 rounded-xl shadow-lg max-h-56 overflow-y-auto"
              >
                <button
                  v-for="topicItem in filteredTopics"
                  :key="topicItem.originalName"
                  type="button"
                  class="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 flex items-center gap-2"
                  @click="selectCategory(topicItem)"
                >
                  <span class="material-symbols-outlined text-base text-neutral-500">{{ topicItem.icon || 'category' }}</span>
                  <span>{{ topicItem.name }}</span>
                </button>
                <button
                  v-if="categorySearch.trim() && !resolvedTopics.some((item) => item.name === categorySearch.trim() || item.originalName === categorySearch.trim())"
                  type="button"
                  class="w-full text-left px-3 py-2 text-sm font-medium text-pink-600 hover:bg-pink-50"
                  @click="selectCategory({ name: categorySearch.trim(), originalName: categorySearch.trim() })"
                >
                  + {{ categorySearch.trim() }}
                </button>
              </div>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-neutral-700 mb-2">{{ t('create.field.publicTags') }}</label>
            <input
              v-model="publicTagsInput"
              type="text"
              :placeholder="t('create.field.publicTags.placeholder')"
              class="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition placeholder:text-neutral-400"
            />
          </div>

          <div class="pt-4 border-t border-neutral-100">
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm font-medium text-neutral-700">{{ t('create.field.boards') }}</label>
              <span v-if="boardsLoading" class="text-xs text-neutral-400">{{ t('common.loading') }}</span>
            </div>
            <div v-if="myBoards.length === 0" class="text-xs text-neutral-500">
              {{ t('create.field.boards.empty') }}
            </div>
            <div v-else class="flex flex-wrap gap-2">
              <button
                v-for="board in myBoards"
                :key="board.id"
                type="button"
                class="px-3 py-1.5 rounded-full text-xs border transition"
                :class="selectedBoardIds.includes(board.id)
                  ? 'bg-pink-50 border-pink-300 text-pink-700'
                  : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300'"
                @click="toggleBoardSelection(board.id)"
              >
                {{ board.name }}
              </button>
            </div>
          </div>

          <!-- Visibilité / Mode privé -->
          <div class="pt-4 border-t border-neutral-100">
            <label class="block text-sm font-medium text-neutral-700 mb-3">
              {{ t('create.visibility.label') }}
            </label>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="option in [
                  { id: 'public', label: t('create.visibility.public'), icon: 'public', desc: t('create.visibility.public.desc') },
                  { id: 'followers', label: t('create.visibility.followers'), icon: 'group', desc: t('create.visibility.followers.desc') },
                  { id: 'private', label: t('create.visibility.private'), icon: 'lock', desc: t('create.visibility.private.desc') },
                ]"
                :key="option.id"
                type="button"
                class="px-3 py-3 rounded-xl border-2 text-left transition-all"
                :class="visibility === option.id
                  ? 'border-pink-500 bg-pink-50/40'
                  : 'border-neutral-200 hover:border-neutral-300'"
                @click="visibility = option.id as typeof visibility"
              >
                <div class="flex items-center gap-1.5 mb-0.5">
                  <span
                    class="material-symbols-outlined text-base"
                    :class="visibility === option.id ? 'text-pink-600' : 'text-neutral-500'"
                  >{{ option.icon }}</span>
                  <span
                    class="text-xs font-bold"
                    :class="visibility === option.id ? 'text-pink-700' : 'text-neutral-700'"
                  >{{ option.label }}</span>
                </div>
                <p class="text-[10px] text-neutral-500 leading-tight">{{ option.desc }}</p>
              </button>
            </div>
          </div>

          <!-- Story 24h -->
          <div class="pt-4 border-t border-neutral-100">
            <label class="flex items-start gap-3 cursor-pointer">
              <input
                v-model="isStory"
                type="checkbox"
                class="mt-1 rounded border-neutral-300 text-pink-600 focus:ring-pink-500"
              />
              <div>
                <p class="text-sm font-medium text-neutral-800">{{ t('create.story.title') }}</p>
                <p class="text-xs text-neutral-500">{{ t('create.story.subtitle') }}</p>
              </div>
            </label>
          </div>

          <!-- Variantes (story / carré / paysage) -->
          <div class="pt-4 border-t border-neutral-100">
            <p class="text-sm font-medium text-neutral-700 mb-1">{{ t('create.variants.title') }}</p>
            <p class="text-xs text-neutral-500 mb-3">{{ t('create.variants.subtitle') }}</p>
            <div class="grid sm:grid-cols-3 gap-3">
              <div>
                <label class="text-[11px] text-neutral-600 block mb-1">{{ t('create.variants.story') }}</label>
                <input
                  type="file"
                  accept="image/*"
                  class="text-xs w-full"
                  @change="variantStoryFile = ($event.target as HTMLInputElement).files?.[0] ?? null"
                />
              </div>
              <div>
                <label class="text-[11px] text-neutral-600 block mb-1">{{ t('create.variants.square') }}</label>
                <input
                  type="file"
                  accept="image/*"
                  class="text-xs w-full"
                  @change="variantSquareFile = ($event.target as HTMLInputElement).files?.[0] ?? null"
                />
              </div>
              <div>
                <label class="text-[11px] text-neutral-600 block mb-1">{{ t('create.variants.landscape') }}</label>
                <input
                  type="file"
                  accept="image/*"
                  class="text-xs w-full"
                  @change="variantLandscapeFile = ($event.target as HTMLInputElement).files?.[0] ?? null"
                />
              </div>
            </div>
          </div>

          <!-- Publication planifiée (Pro) -->
          <div v-if="canSchedulePublish" class="pt-4 border-t border-neutral-100">
            <label class="block text-sm font-medium text-neutral-700 mb-1">{{ t('create.schedule.title') }}</label>
            <p class="text-xs text-neutral-500 mb-2">{{ t('create.schedule.subtitle') }}</p>
            <input
              v-model="scheduledPublishLocal"
              type="datetime-local"
              class="w-full max-w-xs px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>

          <!-- Crédit créateur certifié (Pro seulement) -->
          <div v-if="canCertifyCredit" class="pt-4 border-t border-neutral-100">
            <label class="flex items-start gap-3 cursor-pointer">
              <div class="relative mt-0.5">
                <input v-model="certifyCredit" type="checkbox" class="sr-only peer" />
                <div class="w-11 h-6 bg-neutral-200 peer-checked:bg-emerald-500 rounded-full transition-colors"></div>
                <div class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-base text-emerald-600 fill-1">verified</span>
                  <p class="text-sm font-semibold text-neutral-800">{{ t('create.certify.title') }}</p>
                </div>
                <p class="text-xs text-neutral-500 mt-0.5">
                  {{ t('create.certify.desc') }}
                </p>
              </div>
            </label>
          </div>

          <div class="pt-4 border-t border-neutral-100">
            <PrivateTags v-if="canUsePrivateTags" v-model="privateTags" />
            <div
              v-else
              class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 leading-relaxed"
            >
              {{ t('create.privateTags.upgradeRequired') }}
              <router-link to="/premium" class="ml-1 font-semibold underline hover:no-underline">
                {{ t('create.privateTags.upgradeCta') }}
              </router-link>
            </div>
          </div>

          <div class="pt-4 border-t border-neutral-100">
            <div class="flex items-start gap-3 text-sm text-neutral-500 bg-blue-50/40 border border-blue-100 rounded-xl px-4 py-3">
              <span class="material-symbols-outlined text-lg text-blue-600">shield</span>
              <p class="text-xs leading-relaxed">
                <span v-html="t('create.noTracking').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')"></span>
                <router-link to="/premium" class="text-blue-600 font-semibold hover:underline ml-1">{{ t('create.noTracking.learnMore') }}</router-link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
