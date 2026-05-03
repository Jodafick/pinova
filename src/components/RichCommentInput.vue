<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
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
import AvatarDisc from './AvatarDisc.vue'

const { t } = useI18n()
const { currentUser } = useAuth()
const { showAlert } = useAppModal()

const text = ref('')
const showMentionList = ref(false)
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
  (e: 'submit', payload: { text: string; mediaFile?: File | null; replyTo?: string | null }): void
}>()

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

const plan = computed(() => currentUser.value?.subscription?.plan || 'free')
const canUsePremiumCommentMedia = computed(() => plan.value === 'plus' || plan.value === 'pro')

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
const mentionPanelEl = ref<HTMLElement | null>(null)

const popLayerStyle = { zIndex: 135 }

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

const anyFloaterOpen = computed(() => showMentionList.value)

function closeFloatingPanels() {
  showMentionList.value = false
}

usePointerOutsideDismiss(() => [
  {
    isOpen: anyFloaterOpen,
    getRoots: () => [rootEl.value, mentionPanelEl.value],
    close: closeFloatingPanels,
  },
])

/** Ouvre le clavier système (mobile) puisque le sélecteur d’émojis est celui du clavier. */
function focusKeyboardForEmoji() {
  showMentionList.value = false
  nextTick(() => {
    const el = inputEl.value
    if (!el) return
    el.focus()
    const nav = navigator as Navigator & {
      virtualKeyboard?: { show?: () => Promise<void> | void }
    }
    try {
      void nav.virtualKeyboard?.show?.()
    } catch {
      /* API expérimentale, ignore */
    }
  })
}

const handleInput = () => {
  const value = text.value
  const lastAt = value.lastIndexOf('@')
  if (lastAt !== -1) {
    const after = value.slice(lastAt + 1)
    if (!after.includes(' ') && after.length <= 20) {
      mentionFilter.value = after
      showMentionList.value = true
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

const pickMediaFile = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!canUsePremiumCommentMedia.value) {
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
  text.value += '@'
  mentionFilter.value = ''
  showMentionList.value = true
  nextTick(() => inputEl.value?.focus())
  void fetchMentionUsers('', true)
}

function triggerMediaFileDialog() {
  if (!canUsePremiumCommentMedia.value) return
  if (mediaCompressing.value) return
  mediaInputEl.value?.click()
}

const submit = () => {
  if (!text.value.trim() && !selectedMediaFile.value) return
  emit('submit', {
    text: text.value,
    mediaFile: selectedMediaFile.value,
    replyTo: replyingTo.value,
  })
  text.value = ''
  removeMedia()
  replyingTo.value = null
  showMentionList.value = false
}

const cancelReply = () => {
  replyingTo.value = null
  text.value = ''
}

defineExpose({ setReply })
</script>

<template>
  <div ref="rootEl" class="relative w-full min-w-0">
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

    <div class="relative z-10 w-full flex flex-col gap-2">
      <input
        ref="mediaInputEl"
        type="file"
        accept="image/*"
        class="hidden"
        tabindex="-1"
        aria-hidden="true"
        @change="pickMediaFile"
      />

      <div
        class="w-full rounded-2xl bg-neutral-100 px-3 py-2 focus-within:ring-2 focus-within:ring-pink-500 focus-within:bg-white transition"
      >
        <input
          ref="inputEl"
          v-model="text"
          type="text"
          enterkeyhint="send"
          :placeholder="placeholder || t('comment.placeholder')"
          class="w-full min-w-0 bg-transparent outline-none text-sm py-1.5"
          @input="handleInput"
          @keyup.enter="submit"
        />
      </div>

      <div
        ref="toolbarAnchorRef"
        class="flex w-full flex-wrap items-center justify-end gap-1 sm:gap-2"
      >
        <div class="hidden md:flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            class="w-8 h-8 rounded-full flex items-center justify-center transition"
            :class="
              canUsePremiumCommentMedia && !mediaCompressing
                ? 'hover:bg-neutral-200 text-neutral-500'
                : 'opacity-40 cursor-not-allowed text-neutral-400'
            "
            :title="canUsePremiumCommentMedia ? t('comment.media.title') : t('comment.media.premiumHint')"
            :aria-label="canUsePremiumCommentMedia ? t('comment.media.title') : t('comment.media.premiumHint')"
            :disabled="!canUsePremiumCommentMedia || mediaCompressing"
            @click="triggerMediaFileDialog"
          >
            <span class="material-symbols-outlined text-lg">add_photo_alternate</span>
          </button>
          <button
            type="button"
            class="w-8 h-8 rounded-full hover:bg-neutral-200 flex items-center justify-center text-neutral-500 transition"
            :title="t('comment.emoji.nativeHint')"
            @click="focusKeyboardForEmoji"
          >
            <span class="material-symbols-outlined text-lg">mood</span>
          </button>
        </div>

        <button
          type="button"
          class="md:hidden w-8 h-8 shrink-0 rounded-full hover:bg-neutral-200 flex items-center justify-center text-neutral-500 transition"
          :title="t('comment.emoji.nativeHint')"
          @click="focusKeyboardForEmoji"
        >
          <span class="material-symbols-outlined text-lg">mood</span>
        </button>

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
          class="md:hidden w-8 h-8 shrink-0 rounded-full flex items-center justify-center transition"
          :class="
            canUsePremiumCommentMedia && !mediaCompressing && !submitting
              ? 'hover:bg-neutral-200 text-neutral-500'
              : 'opacity-40 cursor-not-allowed text-neutral-400'
          "
          :disabled="submitting || mediaCompressing || !canUsePremiumCommentMedia"
          :title="canUsePremiumCommentMedia ? t('comment.media.title') : t('comment.media.premiumHint')"
          :aria-label="canUsePremiumCommentMedia ? t('comment.media.title') : t('comment.media.premiumHint')"
          @click="triggerMediaFileDialog"
        >
          <span class="material-symbols-outlined text-xl">add_photo_alternate</span>
        </button>

        <button
          type="button"
          class="w-9 h-9 shrink-0 rounded-full bg-pink-600 text-white flex items-center justify-center hover:bg-pink-700 transition disabled:opacity-40"
          :disabled="(!text.trim() && !selectedMediaFile) || submitting || mediaCompressing"
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
            <AvatarDisc
              :color="user.avatarColor"
              frame-class="w-8 h-8 text-xs"
              text-class="text-white"
              :has-image="!!user.avatarUrl"
            >
              <img v-if="user.avatarUrl" :src="user.avatarUrl" alt="" class="w-full h-full object-cover" />
              <span v-else class="avatar-text leading-none">{{ displayInitials(user.name) }}</span>
            </AvatarDisc>
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
  </div>
</template>
