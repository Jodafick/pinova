<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import 'emoji-picker-element'
import { GiphyFetch } from '@giphy/js-fetch-api'
import { useI18n } from '../i18n'
import { useAuth } from '../composables/useAuth'
import { useAppModal } from '../composables/useAppModal'
import { fetchMentionUsersPage } from '../composables/useUserSuggestSearch'
import { displayInitials } from '../utils/displayInitials'
import {
  COMMENT_MEDIA_MAX_BYTES,
  compressCommentAttachment,
} from '../utils/compressCommentAttachment'
import { useAnchoredDropdown } from '../composables/useAnchoredDropdown'
import { usePointerOutsideDismiss } from '../composables/usePointerOutsideDismiss'

type GifPickerRow = { url: string; title: string; key: string }

const { t } = useI18n()
const { currentUser } = useAuth()
const { showAlert } = useAppModal()

const text = ref('')
const showGifPicker = ref(false)
const showEmojiPicker = ref(false)
const showMentionList = ref(false)
const showMobileExtrasMenu = ref(false)
const selectedGif = ref<string | null>(null)
const selectedMediaFile = ref<File | null>(null)
const selectedMediaPreview = ref<string | null>(null)
const replyingTo = ref<string | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const mediaInputEl = ref<HTMLInputElement | null>(null)
const mediaCompressing = ref(false)

defineProps<{
  placeholder?: string
  submitting?: boolean
}>()

const emit = defineEmits<{
  (e: 'submit', payload: { text: string; gif?: string | null; mediaFile?: File | null; replyTo?: string | null }): void
}>()

const FALLBACK_STATIC_GIFS = [
  { id: 1, label: 'Clap', preview: 'https://media.tenor.com/d_0ZBGPxntwAAAAi/clap-emoji.gif' },
  { id: 2, label: 'Heart', preview: 'https://media.tenor.com/L1lzU7iMHEAAAAAi/heart-love.gif' },
  { id: 3, label: 'Wow', preview: 'https://media.tenor.com/Tjpks-bBu5UAAAAi/wow-mind-blown.gif' },
  { id: 4, label: 'Fire', preview: 'https://media.tenor.com/c0jElkPm00MAAAAi/fire-flame.gif' },
  { id: 5, label: 'LOL', preview: 'https://media.tenor.com/QQTRFOybnxQAAAAi/laughing.gif' },
  { id: 6, label: 'Thumbs', preview: 'https://media.tenor.com/HtdAulSCQDoAAAAi/like-thumbs-up.gif' },
] as const

const gifApiKey = (import.meta.env.VITE_GIPHY_API_KEY as string | undefined)?.trim()
const gifClient = gifApiKey ? new GiphyFetch(gifApiKey) : null

const gifSearchQuery = ref('')
const gifRows = ref<GifPickerRow[]>([])
const gifFetchLoading = ref(false)

const suggestedUsers = ref<
  { username: string; name: string; avatarColor: string; avatarUrl: string; relation: string }[]
>([])
let mentionTimer: ReturnType<typeof setTimeout> | null = null

const mentionFilter = ref('')
const mentionPage = ref(1)
const mentionHasNext = ref(false)
const mentionLoading = ref(false)

function relationMentionLabel(rel: string) {
  if (!rel) return ''
  if (rel === 'mutual') return t('userSuggest.relation.mutual')
  if (rel === 'following') return t('userSuggest.relation.following')
  if (rel === 'follower') return t('userSuggest.relation.follower')
  if (rel === 'often_viewed') return t('userSuggest.relation.oftenViewed')
  return ''
}
const canUseGifComments = computed(() => {
  const plan = currentUser.value?.subscription?.plan || 'free'
  return plan === 'plus' || plan === 'pro'
})

const canUsePremiumCommentMedia = canUseGifComments

const pickerLocale = computed(() => {
  const lang = (currentUser.value?.preferredLanguage || 'fr').toLowerCase()
  if (lang.startsWith('en')) return 'en'
  if (lang.startsWith('es')) return 'es'
  return 'fr'
})

function mapGifRowsFromApi(data: unknown): GifPickerRow[] {
  if (!Array.isArray(data)) return []
  const out: GifPickerRow[] = []
  for (const g of data as {
    id?: string
    title?: string
    images?: Record<string, { url?: string } | undefined>
  }[]) {
    const url =
      g.images?.fixed_height_small?.url
      ?? g.images?.fixed_height?.url
      ?? g.images?.downsized_medium?.url
      ?? g.images?.downsized_small?.url
    if (!url) continue
    out.push({
      url,
      title: typeof g.title === 'string' ? g.title : '',
      key: typeof g.id === 'string' ? g.id : url,
    })
  }
  return out
}

function loadFallbackStaticGifRows() {
  gifRows.value = FALLBACK_STATIC_GIFS.map((g) => ({
    url: g.preview,
    title: g.label,
    key: `static-${g.id}`,
  }))
}

async function loadGifTrending() {
  gifFetchLoading.value = true
  try {
    if (gifClient) {
      const { data } = await gifClient.trending({ type: 'gifs', offset: 0, limit: 30 })
      gifRows.value = mapGifRowsFromApi(data)
      if (!gifRows.value.length) loadFallbackStaticGifRows()
    } else {
      loadFallbackStaticGifRows()
    }
  } catch {
    loadFallbackStaticGifRows()
  } finally {
    gifFetchLoading.value = false
  }
}

let gifSearchDebounce: ReturnType<typeof setTimeout> | null = null

watch(showGifPicker, async (show) => {
  if (!show) return
  gifSearchQuery.value = ''
  await loadGifTrending()
})

watch(gifSearchQuery, (raw) => {
  if (!showGifPicker.value || !gifClient) return
  const q = raw.trim()
  if (gifSearchDebounce) clearTimeout(gifSearchDebounce)
  gifSearchDebounce = setTimeout(async () => {
    if (!gifClient || !showGifPicker.value) return
    gifFetchLoading.value = true
    try {
      if (!q.length) {
        await loadGifTrending()
        return
      }
      const langPick =
        pickerLocale.value === 'en' ? 'en' : pickerLocale.value === 'es' ? 'es' : 'fr'
      const { data } = await gifClient.search(q, {
        sort: 'relevant',
        lang: langPick,
        limit: 30,
      })
      gifRows.value = mapGifRowsFromApi(data)
    } catch {
      await loadGifTrending()
    } finally {
      gifFetchLoading.value = false
    }
  }, 380)
})

const fetchMentionUsers = async (query: string, reset = true) => {
  if (mentionLoading.value) return
  if (!reset && !mentionHasNext.value) return
  mentionLoading.value = true
  if (reset) {
    mentionPage.value = 1
    mentionHasNext.value = false
    suggestedUsers.value = []
  }
  try {
    const { users, nextUrl } = await fetchMentionUsersPage(query, mentionPage.value, 10)
    const mapped = users.map((u) => ({
      username: u.username,
      name: u.name,
      avatarColor: u.avatarColor,
      avatarUrl: u.avatarUrl,
      relation: u.relation,
    }))
    suggestedUsers.value = reset
      ? mapped
      : [
          ...suggestedUsers.value,
          ...mapped.filter((u) => !suggestedUsers.value.some((e) => e.username === u.username)),
        ]
    mentionHasNext.value = !!nextUrl
    if (nextUrl) {
      mentionPage.value += 1
    }
  } catch (err) {
    console.error('Erreur chargement suggestions de mention', err)
    if (reset) {
      suggestedUsers.value = []
    }
  } finally {
    mentionLoading.value = false
  }
}

const rootEl = ref<HTMLElement | null>(null)
const toolbarAnchorRef = ref<HTMLElement | null>(null)
const gifPanelEl = ref<HTMLElement | null>(null)
const emojiPanelEl = ref<HTMLElement | null>(null)
const mentionPanelEl = ref<HTMLElement | null>(null)
const mobileMenuPanelEl = ref<HTMLElement | null>(null)

const popLayerStyle = { zIndex: 135 }

const { floatingStyles: gifPopoverStyles } = useAnchoredDropdown(toolbarAnchorRef, gifPanelEl, {
  open: showGifPicker,
  placement: 'top-start',
  strategy: 'fixed',
  offsetPx: 10,
})
const { floatingStyles: emojiPopoverStyles } = useAnchoredDropdown(toolbarAnchorRef, emojiPanelEl, {
  open: showEmojiPicker,
  placement: 'top-start',
  strategy: 'fixed',
  offsetPx: 10,
})

const { floatingStyles: mentionPopoverStyles } = useAnchoredDropdown(
  toolbarAnchorRef,
  mentionPanelEl,
  {
    open: showMentionList,
    placement: 'top-start',
    strategy: 'fixed',
    offsetPx: 10,
  },
)
const { floatingStyles: mobileMenuPopoverStyles } = useAnchoredDropdown(
  toolbarAnchorRef,
  mobileMenuPanelEl,
  {
    open: showMobileExtrasMenu,
    placement: 'top-start',
    strategy: 'fixed',
    offsetPx: 10,
  },
)

const anyFloaterOpen = computed(
  () =>
    showGifPicker.value
    || showEmojiPicker.value
    || showMentionList.value
    || showMobileExtrasMenu.value,
)

function closeFloatingPanels() {
  showGifPicker.value = false
  showEmojiPicker.value = false
  showMentionList.value = false
  showMobileExtrasMenu.value = false
}

usePointerOutsideDismiss(() => [
  {
    isOpen: anyFloaterOpen,
    getRoots: () => [
      rootEl.value,
      gifPanelEl.value,
      emojiPanelEl.value,
      mentionPanelEl.value,
      mobileMenuPanelEl.value,
    ],
    close: closeFloatingPanels,
  },
])

const handleInput = () => {
  showMobileExtrasMenu.value = false
  const value = text.value
  const lastAt = value.lastIndexOf('@')
  if (lastAt !== -1) {
    const after = value.slice(lastAt + 1)
    if (!after.includes(' ') && after.length <= 20) {
      mentionFilter.value = after
      showMentionList.value = true
      showEmojiPicker.value = false
      if (mentionTimer) clearTimeout(mentionTimer)
      mentionTimer = setTimeout(() => {
        void fetchMentionUsers(after, true)
      }, 200)
      return
    }
  }
  showMentionList.value = false
}

const handleMentionListScroll = (event: Event) => {
  const element = event.target as HTMLElement
  if (!element || mentionLoading.value || !mentionHasNext.value) return
  const nearBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 20
  if (nearBottom) {
    void fetchMentionUsers(mentionFilter.value, false)
  }
}

const insertMention = (username: string) => {
  const lastAt = text.value.lastIndexOf('@')
  text.value = text.value.slice(0, lastAt) + `@${username} `
  showMentionList.value = false
  nextTick(() => inputEl.value?.focus())
}

const insertAtCursor = (el: HTMLInputElement, chunk: string) => {
  const start = el.selectionStart ?? text.value.length
  const end = el.selectionEnd ?? start
  text.value = text.value.slice(0, start) + chunk + text.value.slice(end)
  nextTick(() => {
    el.focus()
    const pos = start + chunk.length
    el.setSelectionRange(pos, pos)
  })
}

function onEmojiClick(ev: Event) {
  const detail = (ev as CustomEvent<{ unicode?: string; emoji?: { unicode?: string } }>).detail
  const unicode =
    detail?.unicode
    ?? (detail?.emoji && typeof detail.emoji.unicode === 'string' ? detail.emoji.unicode : '')
  if (!unicode || !inputEl.value) return
  insertAtCursor(inputEl.value, unicode)
  showEmojiPicker.value = false
}

function toggleGifPicker() {
  showMobileExtrasMenu.value = false
  showGifPicker.value = !showGifPicker.value
  showEmojiPicker.value = false
  showMentionList.value = false
}

function toggleEmojiPicker() {
  showMobileExtrasMenu.value = false
  showEmojiPicker.value = !showEmojiPicker.value
  showGifPicker.value = false
  showMentionList.value = false
}

function toggleMobileExtrasMenu() {
  showGifPicker.value = false
  showEmojiPicker.value = false
  showMentionList.value = false
  showMobileExtrasMenu.value = !showMobileExtrasMenu.value
}

function chooseImageFromMobileMenu() {
  showMobileExtrasMenu.value = false
  triggerMediaFileDialog()
}

function openStickerPanelFromMobile() {
  if (!canUseGifComments.value) {
    void showAlert(t('comment.gif.upgradeRequired'), { variant: 'warning' })
    showMobileExtrasMenu.value = false
    return
  }
  showMobileExtrasMenu.value = false
  showEmojiPicker.value = false
  showGifPicker.value = true
}

function openEmojiPanelFromMobile() {
  showMobileExtrasMenu.value = false
  showGifPicker.value = false
  showEmojiPicker.value = true
}

const pickGif = (url: string) => {
  if (!canUseGifComments.value) {
    void showAlert(t('comment.gif.upgradeRequired'), { variant: 'warning' })
    return
  }
  selectedGif.value = url
  if (selectedMediaPreview.value) {
    URL.revokeObjectURL(selectedMediaPreview.value)
  }
  selectedMediaFile.value = null
  selectedMediaPreview.value = null
  showGifPicker.value = false
  showMobileExtrasMenu.value = false
}

const removeGif = () => {
  selectedGif.value = null
}

const pickMediaFile = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!canUsePremiumCommentMedia.value) {
    void showAlert(t('comment.media.upgradeRequired'), { variant: 'warning' })
    input.value = ''
    return
  }
  if (!file.type.startsWith('image/')) {
    void showAlert(t('comment.media.imageOnly'), { variant: 'warning' })
    input.value = ''
    return
  }

  mediaCompressing.value = true
  try {
    let out = file
    if (file.size > COMMENT_MEDIA_MAX_BYTES) {
      try {
        out = await compressCommentAttachment(file)
        void showAlert(
          file.type === 'image/gif'
            ? t('comment.media.autoCompressedGif')
            : t('comment.media.autoCompressed'),
          { variant: 'info' },
        )
      } catch {
        void showAlert(t('comment.media.compressFailed'), { variant: 'warning' })
        input.value = ''
        return
      }
    }

    if (out.size > COMMENT_MEDIA_MAX_BYTES) {
      void showAlert(t('comment.media.tooLarge'), { variant: 'warning' })
      input.value = ''
      return
    }

    if (selectedMediaPreview.value) {
      URL.revokeObjectURL(selectedMediaPreview.value)
    }
    selectedGif.value = null
    selectedMediaFile.value = out
    selectedMediaPreview.value = URL.createObjectURL(out)
  } finally {
    mediaCompressing.value = false
    input.value = ''
  }
}

const removeMedia = () => {
  if (selectedMediaPreview.value) {
    URL.revokeObjectURL(selectedMediaPreview.value)
  }
  selectedMediaFile.value = null
  selectedMediaPreview.value = null
  if (mediaInputEl.value) {
    mediaInputEl.value.value = ''
  }
}

const setReply = (username: string) => {
  replyingTo.value = username
  text.value = `@${username} `
  nextTick(() => inputEl.value?.focus())
}

function openMentionPicker() {
  showMobileExtrasMenu.value = false
  text.value += '@'
  mentionFilter.value = ''
  showMentionList.value = true
  showGifPicker.value = false
  showEmojiPicker.value = false
  nextTick(() => inputEl.value?.focus())
  void fetchMentionUsers('', true)
}

function triggerMediaFileDialog() {
  if (!canUsePremiumCommentMedia.value) {
    void showAlert(t('comment.media.upgradeRequired'), { variant: 'warning' })
    return
  }
  if (mediaCompressing.value) return
  mediaInputEl.value?.click()
}

const submit = () => {
  if (!text.value.trim() && !selectedGif.value && !selectedMediaFile.value) return
  emit('submit', {
    text: text.value,
    gif: selectedGif.value,
    mediaFile: selectedMediaFile.value,
    replyTo: replyingTo.value,
  })
  text.value = ''
  selectedGif.value = null
  removeMedia()
  replyingTo.value = null
  showGifPicker.value = false
  showEmojiPicker.value = false
  showMentionList.value = false
  showMobileExtrasMenu.value = false
}

const cancelReply = () => {
  replyingTo.value = null
  text.value = ''
}

defineExpose({ setReply })
</script>

<template>
  <div ref="rootEl" class="relative">
    <div
      v-if="replyingTo"
      class="flex items-center justify-between px-3 py-1.5 mb-2 bg-pink-50 rounded-lg text-xs"
    >
      <span class="text-neutral-600">
        {{ t('comment.replyTo') }} <span class="text-pink-600 font-semibold">@{{ replyingTo }}</span>
      </span>
      <button type="button" class="text-neutral-400 hover:text-neutral-700" @click="cancelReply">
        <span class="material-symbols-outlined text-base">close</span>
      </button>
    </div>

    <div v-if="selectedGif" class="mb-2 relative inline-block">
      <img :src="selectedGif" class="max-h-32 rounded-lg" alt="" />
      <button
        type="button"
        class="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-neutral-900 text-white flex items-center justify-center shadow"
        @click="removeGif"
      >
        <span class="material-symbols-outlined text-sm">close</span>
      </button>
    </div>

    <div v-if="mediaCompressing" class="mb-2 flex items-center gap-2 text-xs text-neutral-500">
      <span class="w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin shrink-0" />
      {{ t('common.loading') }}
    </div>
    <div v-else-if="selectedMediaPreview" class="mb-2 relative inline-block">
      <img :src="selectedMediaPreview" class="max-h-32 rounded-lg" alt="" />
      <button
        type="button"
        class="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-neutral-900 text-white flex items-center justify-center shadow"
        @click="removeMedia"
      >
        <span class="material-symbols-outlined text-sm">close</span>
      </button>
    </div>

    <div class="relative z-10">
      <input
        ref="mediaInputEl"
        type="file"
        accept="image/*"
        class="hidden"
        tabindex="-1"
        aria-hidden="true"
        @change="pickMediaFile"
      />

      <!-- Barre + ancres Floating UI -->
      <div
        ref="toolbarAnchorRef"
        class="flex items-center gap-2 bg-neutral-100 rounded-full px-2 pl-4 py-1 focus-within:ring-2 focus-within:ring-pink-500 focus-within:bg-white transition"
      >
        <input
          ref="inputEl"
          v-model="text"
          type="text"
          :placeholder="placeholder || t('comment.placeholder')"
          class="flex-1 min-w-0 bg-transparent outline-none text-sm py-2"
          @input="handleInput"
          @keyup.enter="submit"
        />

        <div class="hidden md:flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            class="w-8 h-8 rounded-full hover:bg-neutral-200 flex items-center justify-center text-neutral-500 transition relative disabled:opacity-40 disabled:cursor-not-allowed"
            :title="canUseGifComments ? t('comment.gif.title') : t('comment.gif.upgradeRequired')"
            :disabled="!canUseGifComments"
            @click="toggleGifPicker"
          >
            <span class="text-[10px] font-bold border border-current rounded px-1 leading-none py-0.5">{{
              t('comment.gif')
            }}</span>
          </button>
          <button
            type="button"
            class="w-8 h-8 rounded-full hover:bg-neutral-200 flex items-center justify-center text-neutral-500 transition"
            :class="{ 'opacity-40 pointer-events-none': !canUsePremiumCommentMedia || mediaCompressing }"
            :title="canUsePremiumCommentMedia ? t('comment.media.title') : t('comment.media.upgradeRequired')"
            :disabled="mediaCompressing"
            @click="triggerMediaFileDialog"
          >
            <span class="material-symbols-outlined text-lg">add_photo_alternate</span>
          </button>
          <button
            type="button"
            class="w-8 h-8 rounded-full hover:bg-neutral-200 flex items-center justify-center text-neutral-500 transition"
            :title="t('comment.emoji.title')"
            @click="toggleEmojiPicker"
          >
            <span class="material-symbols-outlined text-lg">mood</span>
          </button>
        </div>

        <button
          type="button"
          class="w-8 h-8 shrink-0 rounded-full hover:bg-neutral-200 flex items-center justify-center text-neutral-500 transition"
          :title="t('comment.mention.title')"
          @click="openMentionPicker"
        >
          <span class="material-symbols-outlined text-lg">alternate_email</span>
        </button>

        <button
          type="button"
          class="md:hidden w-8 h-8 shrink-0 rounded-full hover:bg-neutral-200 flex items-center justify-center text-neutral-500 transition"
          :disabled="submitting || mediaCompressing"
          :title="t('comment.mobile.more')"
          @click="toggleMobileExtrasMenu"
        >
          <span class="material-symbols-outlined text-xl">add_circle</span>
        </button>

        <button
          type="button"
          class="w-9 h-9 shrink-0 rounded-full bg-pink-600 text-white flex items-center justify-center hover:bg-pink-700 transition disabled:opacity-40"
          :disabled="
            (!text.trim() && !selectedGif && !selectedMediaFile) || submitting || mediaCompressing
          "
          @click="submit"
        >
          <span
            v-if="submitting"
            class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
          />
          <span v-else class="material-symbols-outlined text-lg">send</span>
        </button>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="showGifPicker"
        ref="gifPanelEl"
        class="w-[min(100vw-1.25rem,22rem)] max-h-[70vh] flex flex-col bg-white rounded-2xl shadow-xl border border-neutral-100 overflow-hidden"
        role="dialog"
        aria-modal="false"
        :style="{ ...gifPopoverStyles, ...popLayerStyle }"
      >
        <div class="px-4 py-3 border-b border-neutral-100 flex items-center justify-between shrink-0">
          <h4 class="text-sm font-semibold">{{ t('comment.gif.trending') }}</h4>
          <button
            type="button"
            class="text-neutral-400 hover:text-neutral-700"
            @click="showGifPicker = false"
          >
            <span class="material-symbols-outlined text-base">close</span>
          </button>
        </div>
        <p v-if="gifClient" class="px-4 pt-2 text-[10px] text-neutral-400">
          {{ t('comment.gif.poweredByGiphy') }}
        </p>
        <p v-else class="px-4 pt-2 text-[10px] text-neutral-400">
          {{ t('comment.gif.localOnlyHint') }}
        </p>
        <div class="px-3 py-2 shrink-0">
          <div class="flex items-center gap-2 bg-neutral-100 rounded-full px-3 py-1.5">
            <span class="material-symbols-outlined text-base text-neutral-400">search</span>
            <input
              v-model="gifSearchQuery"
              type="text"
              :placeholder="t('comment.gif.search')"
              :readonly="!gifClient"
              class="flex-1 bg-transparent outline-none text-xs min-w-0"
              :class="{ 'opacity-60': !gifClient }"
            />
          </div>
        </div>
        <div class="relative min-h-[8rem] flex-1 overflow-hidden">
          <div
            v-if="gifFetchLoading"
            class="absolute inset-0 flex justify-center pt-12 bg-white/80 z-[1]"
          >
            <span
              class="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"
              aria-hidden="true"
            />
          </div>
          <div class="grid grid-cols-3 gap-1.5 p-2 max-h-[50vh] overflow-y-auto">
            <button
              v-for="gif in gifRows"
              :key="gif.key"
              type="button"
              class="aspect-square rounded-lg overflow-hidden bg-neutral-100 hover:ring-2 hover:ring-pink-400 transition relative group"
              :title="gif.title"
              @click="pickGif(gif.url)"
            >
              <img :src="gif.url" :alt="gif.title" class="w-full h-full object-cover" loading="lazy" />
              <span class="absolute bottom-1 left-1 text-[9px] font-bold bg-black/60 text-white px-1 rounded"
                >GIF</span
              >
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="showEmojiPicker"
        ref="emojiPanelEl"
        class="w-[min(100vw-1.25rem,22rem)] max-h-[min(380px,55vh)] flex flex-col bg-white rounded-2xl shadow-xl border border-neutral-100 overflow-hidden"
        :style="{ ...emojiPopoverStyles, ...popLayerStyle }"
      >
        <div class="px-4 py-2 border-b border-neutral-100 flex items-center justify-between shrink-0 bg-white">
          <h4 class="text-sm font-semibold text-neutral-900">{{ t('comment.emoji.title') }}</h4>
          <button
            type="button"
            class="text-neutral-400 hover:text-neutral-700"
            @click="showEmojiPicker = false"
          >
            <span class="material-symbols-outlined text-base">close</span>
          </button>
        </div>
        <emoji-picker
          class="pinova-emoji-picker border-0 shadow-none w-full min-h-0 flex-1"
          :locale="pickerLocale"
          @emoji-click="onEmojiClick"
        />
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="showMentionList"
        ref="mentionPanelEl"
        class="w-[min(100vw-2rem,20rem)] max-w-[20rem] bg-white rounded-2xl shadow-xl border border-neutral-100 overflow-hidden flex flex-col max-h-[60vh]"
        role="listbox"
        :style="{ ...mentionPopoverStyles, ...popLayerStyle }"
      >
        <div class="px-4 py-2 text-[11px] uppercase tracking-wider text-neutral-400 font-semibold border-b border-neutral-100">
          {{ t('comment.mention.list') }}
        </div>
        <div class="max-h-60 overflow-y-auto py-1" @scroll="handleMentionListScroll">
          <div v-if="mentionLoading && suggestedUsers.length === 0" class="flex justify-center py-6">
            <span
              class="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"
              aria-hidden="true"
            />
          </div>
          <button
            v-for="user in suggestedUsers"
            :key="user.username"
            type="button"
            class="w-full flex items-center gap-3 px-4 py-2 hover:bg-neutral-50 transition text-left"
            @click="insertMention(user.username)"
          >
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white overflow-hidden shrink-0 avatar-shadow"
              :class="user.avatarUrl ? 'bg-neutral-100' : user.avatarColor"
            >
              <img v-if="user.avatarUrl" :src="user.avatarUrl" alt="" class="w-full h-full object-cover" />
              <span v-else class="avatar-text leading-none">{{ displayInitials(user.name) }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-neutral-800 truncate">{{ user.name }}</p>
              <p class="text-xs text-neutral-500 truncate">@{{ user.username }}</p>
              <p
                v-if="relationMentionLabel(user.relation)"
                class="text-[10px] font-semibold text-pink-600 truncate"
              >
                {{ relationMentionLabel(user.relation) }}
              </p>
            </div>
          </button>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="showMobileExtrasMenu"
        ref="mobileMenuPanelEl"
        class="md:hidden w-[min(100vw-1.25rem,22rem)] rounded-2xl border border-neutral-100 bg-white shadow-xl divide-y divide-neutral-100 overflow-hidden"
        role="menu"
        :style="{ ...mobileMenuPopoverStyles, ...popLayerStyle }"
      >
        <button
          type="button"
          role="menuitem"
          class="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-neutral-900 hover:bg-neutral-50 disabled:opacity-40"
          :disabled="!canUsePremiumCommentMedia || mediaCompressing"
          @click="chooseImageFromMobileMenu"
        >
          <span class="material-symbols-outlined text-neutral-600 text-xl">add_photo_alternate</span>
          {{ t('comment.mobile.image') }}
        </button>
        <button
          type="button"
          role="menuitem"
          class="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-neutral-900 hover:bg-neutral-50 disabled:opacity-40"
          :disabled="!canUseGifComments"
          @click="openStickerPanelFromMobile"
        >
          <span class="text-[10px] font-bold border border-neutral-700 rounded px-1 leading-none py-0.5 text-neutral-800"
            >GIF</span
          >
          {{ t('comment.mobile.stickers') }}
        </button>
        <button
          type="button"
          role="menuitem"
          class="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-neutral-900 hover:bg-neutral-50"
          @click="openEmojiPanelFromMobile"
        >
          <span class="material-symbols-outlined text-neutral-600 text-xl">mood</span>
          {{ t('comment.mobile.emoji') }}
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style>
.pinova-emoji-picker {
  width: 100%;
  height: min(280px, 42vh);
}
</style>
