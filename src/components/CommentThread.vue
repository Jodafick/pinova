<script setup lang="ts">
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
} from 'vue'
import RichCommentInput from './RichCommentInput.vue'
import { useI18n } from '../i18n'
import { formatCommentRelativeTime } from '../utils/formatCommentRelativeTime'
import { useAnchoredDropdown } from '../composables/useAnchoredDropdown'
import { usePointerOutsideDismiss } from '../composables/usePointerOutsideDismiss'

type CommentModel = {
  id: number
  user: string
  username: string
  avatarColor: string
  avatarUrl: string
  text: string
  translatedText?: string
  gif?: string | null
  media?: string | null
  createdAt: string
  liked?: boolean
  likes: number
  translated?: boolean
  replies?: CommentModel[]
  repliesNextPage?: number | null
  repliesCount?: number
  contentMasked?: boolean
  hiddenByOwner?: boolean
}

const props = withDefaults(
  defineProps<{
    comments: CommentModel[]
    canTranslate?: boolean
    highlightedCommentId?: number | null
    isPinOwner?: boolean
    viewerCanComment?: boolean
    viewerUsername?: string | null
  }>(),
  {
    canTranslate: false,
    highlightedCommentId: null,
    isPinOwner: false,
    viewerCanComment: true,
    viewerUsername: null,
  },
)

type Comment = CommentModel

const emit = defineEmits<{
  (e: 'add', payload: { text: string; gif?: string | null; mediaFile?: File | null; replyTo?: string | null; parentId?: number }): void
  (e: 'like', commentId: number): void
  (e: 'translate', commentId: number): void
  (e: 'load-more-replies', commentId: number): void
  (e: 'moderate-comment', commentId: number, hidden: boolean): void
  (e: 'report-comment', commentId: number): void
  (e: 'delete-comment', commentId: number): void
}>()

const { t, currentLang } = useI18n()

const relativeTimeTick = ref(0)
let relativeTimeTimer: ReturnType<typeof setInterval> | null = null

const menuOpenCommentId = ref<number | null>(null)
const menuAnchorRef = ref<HTMLElement | null>(null)
const floatingMenuPanelEl = ref<HTMLElement | null>(null)

const commentMenuOpen = computed(() => menuOpenCommentId.value !== null)

const { floatingStyles: commentMenuFloatingStyles } = useAnchoredDropdown(menuAnchorRef, floatingMenuPanelEl, {
  open: commentMenuOpen,
  placement: 'bottom-end',
  strategy: 'fixed',
  offsetPx: 6,
})

function formatCommentWhen(iso: string) {
  void relativeTimeTick.value
  void currentLang.value
  return formatCommentRelativeTime(iso, currentLang.value, t)
}

function usernamesMatch(a?: string | null, b?: string | null) {
  return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()
}

function findCommentById(nodes: Comment[], id: number): Comment | null {
  for (const c of nodes) {
    if (c.id === id) return c
    if (c.replies?.length) {
      const inReplies = findCommentById(c.replies, id)
      if (inReplies) return inReplies
    }
  }
  return null
}

const floatingMenuComment = computed(() => {
  const id = menuOpenCommentId.value
  return id === null ? null : findCommentById(props.comments, id)
})

function closeMenu() {
  menuOpenCommentId.value = null
  menuAnchorRef.value = null
}

function toggleMenu(commentId: number, ev?: MouseEvent) {
  const targetEl = ev?.currentTarget instanceof HTMLElement ? ev.currentTarget : null
  if (menuOpenCommentId.value === commentId) {
    closeMenu()
    return
  }
  menuAnchorRef.value = targetEl
  menuOpenCommentId.value = commentId
}

usePointerOutsideDismiss(() => [
  {
    isOpen: commentMenuOpen,
    getRoots: () => [menuAnchorRef.value, floatingMenuPanelEl.value],
    close: closeMenu,
  },
])

onMounted(() => {
  relativeTimeTimer = setInterval(() => {
    relativeTimeTick.value += 1
  }, 30_000)
})

onUnmounted(() => {
  if (relativeTimeTimer) {
    clearInterval(relativeTimeTimer)
    relativeTimeTimer = null
  }
})

const replyingTo = ref<number | null>(null)

const renderRichText = (str: string) => {
  return str.replace(/@(\w+)/g, '<span class="text-pink-600 font-semibold">@$1</span>')
}

function canReply(comment: Comment) {
  return props.viewerCanComment && !comment.contentMasked
}

function showReport(comment: Comment) {
  return (
    !!props.viewerUsername
    && !usernamesMatch(props.viewerUsername, comment.username)
    && !comment.contentMasked
  )
}

function canDelete(comment: Comment) {
  return (
    !!props.viewerUsername
    && (usernamesMatch(props.viewerUsername, comment.username) || props.isPinOwner)
  )
}

function hasOverflowMenu(comment: Comment) {
  if (canReply(comment)) return true
  if (props.canTranslate && !comment.contentMasked) return true
  if (props.isPinOwner) return true
  if (showReport(comment)) return true
  if (canDelete(comment)) return true
  return false
}

const toggleReply = (commentId: number) => {
  replyingTo.value = replyingTo.value === commentId ? null : commentId
}

const handleSubmitReply = (
  commentId: number,
  payload: { text: string; gif?: string | null; mediaFile?: File | null; replyTo?: string | null },
) => {
  emit('add', { ...payload, parentId: commentId })
  replyingTo.value = null
}

function menuReply() {
  const c = floatingMenuComment.value
  if (!c || !canReply(c)) return
  toggleReply(c.id)
  closeMenu()
}

function menuTranslate() {
  const c = floatingMenuComment.value
  if (!c || !props.canTranslate || c.contentMasked) return
  emit('translate', c.id)
  closeMenu()
}

function menuModerateToggle() {
  const c = floatingMenuComment.value
  if (!c || !props.isPinOwner) return
  emit('moderate-comment', c.id, !c.hiddenByOwner)
  closeMenu()
}

function menuReport() {
  const c = floatingMenuComment.value
  if (!c || !showReport(c)) return
  emit('report-comment', c.id)
  closeMenu()
}

function menuDelete() {
  const c = floatingMenuComment.value
  if (!c || !canDelete(c)) return
  emit('delete-comment', c.id)
  closeMenu()
}
</script>

<template>
  <div class="space-y-4">
    <div
      v-for="comment in props.comments"
      :id="`comment-${comment.id}`"
      :key="comment.id"
      class="flex gap-3 rounded-xl transition-all duration-300"
      :class="comment.id === props.highlightedCommentId ? 'bg-pink-50 ring-2 ring-pink-200 p-2' : ''"
    >
      <div
        class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 overflow-hidden"
        :class="comment.avatarUrl ? 'bg-neutral-100' : comment.avatarColor"
      >
        <img
          v-if="comment.avatarUrl"
          :src="comment.avatarUrl"
          alt=""
          class="w-full h-full object-cover"
        />
        <span v-else>{{ comment.user[0] }}</span>
      </div>

      <div class="flex-1 min-w-0">
        <div class="bg-neutral-100 rounded-2xl px-4 pt-2.5 pb-2">
          <div class="flex items-start justify-between gap-2 mb-1">
            <div class="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span class="text-sm font-semibold text-neutral-900">{{ comment.user }}</span>
              <span class="text-xs text-neutral-400">@{{ comment.username }}</span>
            </div>
            <div v-if="hasOverflowMenu(comment)" class="relative shrink-0 -mr-1 -mt-1">
              <button
                type="button"
                data-comment-menu-trigger
                class="p-1.5 rounded-full text-neutral-500 hover:bg-neutral-200/70 transition shrink-0"
                :aria-label="t('comment.menu.more')"
                :aria-expanded="menuOpenCommentId === comment.id"
                aria-haspopup="menu"
                @click.stop.prevent="toggleMenu(comment.id, $event)"
              >
                <span class="material-symbols-outlined text-[22px] leading-none translate-y-px">
                  more_horiz
                </span>
              </button>
            </div>
          </div>
          <p
            v-if="comment.contentMasked"
            class="text-sm text-neutral-500 italic leading-snug pr-8"
          >
            {{ t('comment.hiddenPlaceholder') }}
          </p>
          <p
            v-else-if="comment.text || comment.translatedText"
            class="text-sm text-neutral-700 leading-snug break-words pr-1"
            v-html="renderRichText(comment.translated && comment.translatedText ? comment.translatedText : comment.text)"
          />
          <img v-if="!comment.contentMasked && comment.gif" :src="comment.gif" class="mt-2 max-h-40 rounded-lg" alt="" />
          <img v-if="!comment.contentMasked && comment.media" :src="comment.media" class="mt-2 max-h-40 rounded-lg" alt="" />
          <div
            v-if="!comment.contentMasked && comment.translated"
            class="mt-1 text-[11px] text-neutral-400 italic flex items-center gap-1"
          >
            <span class="material-symbols-outlined text-xs">translate</span>
            {{ t('translate.auto') }}
          </div>
        </div>

        <div class="mt-1.5 px-2 flex items-center justify-between gap-3 text-xs text-neutral-500">
          <span class="tabular-nums shrink-0">{{ formatCommentWhen(comment.createdAt) }}</span>
          <button
            v-if="!comment.contentMasked"
            type="button"
            class="shrink-0 font-semibold hover:text-neutral-800 transition flex items-center gap-1"
            :class="{ 'text-pink-600': comment.liked }"
            @click="emit('like', comment.id)"
          >
            <span class="material-symbols-outlined text-base" :class="{ 'fill-1': comment.liked }">
              favorite
            </span>
            {{ comment.likes }}
          </button>
          <span v-else aria-hidden="true" class="w-px h-px overflow-hidden">{{ ' ' }}</span>
        </div>

        <div v-if="replyingTo === comment.id && props.viewerCanComment && !comment.contentMasked" class="mt-3">
          <RichCommentInput
            :placeholder="t('comment.replyTo.placeholder', { user: comment.username })"
            @submit="handleSubmitReply(comment.id, $event)"
          />
        </div>

        <div
          v-if="comment.replies && comment.replies.length"
          class="mt-3 pl-4 border-l-2 border-neutral-100 space-y-3"
        >
          <div
            v-for="reply in comment.replies"
            :id="`comment-${reply.id}`"
            :key="reply.id"
            class="flex gap-3 rounded-xl transition-all duration-300"
            :class="reply.id === props.highlightedCommentId ? 'bg-pink-50 ring-2 ring-pink-200 p-2' : ''"
          >
            <div
              class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden"
              :class="reply.avatarUrl ? 'bg-neutral-100' : reply.avatarColor"
            >
              <img v-if="reply.avatarUrl" :src="reply.avatarUrl" alt="" class="w-full h-full object-cover" />
              <span v-else>{{ reply.user[0] }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <div class="bg-neutral-100 rounded-2xl px-3 pt-2 pb-1.5">
                <div class="flex items-start justify-between gap-2 mb-0.5">
                  <div class="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span class="text-xs font-semibold text-neutral-900">{{ reply.user }}</span>
                    <span class="text-[10px] text-neutral-400">@{{ reply.username }}</span>
                  </div>
                  <div v-if="hasOverflowMenu(reply)" class="relative shrink-0 -mr-0.5 -mt-0.5">
                    <button
                      type="button"
                      data-comment-menu-trigger
                      class="p-1 rounded-full text-neutral-500 hover:bg-neutral-200/70 transition shrink-0"
                      :aria-label="t('comment.menu.more')"
                      :aria-expanded="menuOpenCommentId === reply.id"
                      aria-haspopup="menu"
                      @click.stop.prevent="toggleMenu(reply.id, $event)"
                    >
                      <span class="material-symbols-outlined text-lg leading-none translate-y-px">
                        more_horiz
                      </span>
                    </button>
                  </div>
                </div>
                <p
                  v-if="reply.contentMasked"
                  class="text-sm text-neutral-500 italic leading-snug pr-6"
                >
                  {{ t('comment.hiddenPlaceholder') }}
                </p>
                <p
                  v-else
                  class="text-sm text-neutral-700 leading-snug break-words pr-0.5"
                  v-html="renderRichText(reply.translated && reply.translatedText ? reply.translatedText : reply.text)"
                />
                <img v-if="!reply.contentMasked && reply.gif" :src="reply.gif" class="mt-2 max-h-32 rounded-lg" alt="" />
                <img v-if="!reply.contentMasked && reply.media" :src="reply.media" class="mt-2 max-h-32 rounded-lg" alt="" />
                <div
                  v-if="!reply.contentMasked && reply.translated"
                  class="mt-1 text-[11px] text-neutral-400 italic flex items-center gap-1"
                >
                  <span class="material-symbols-outlined text-xs">translate</span>
                  {{ t('translate.auto') }}
                </div>
              </div>

              <div class="mt-1.5 px-2 flex items-center justify-between gap-3 text-[11px] text-neutral-500">
                <span class="tabular-nums shrink-0">{{ formatCommentWhen(reply.createdAt) }}</span>
                <button
                  v-if="!reply.contentMasked"
                  type="button"
                  class="shrink-0 font-semibold hover:text-neutral-800 transition flex items-center gap-1"
                  :class="{ 'text-pink-600': reply.liked }"
                  @click="emit('like', reply.id)"
                >
                  <span class="material-symbols-outlined text-sm" :class="{ 'fill-1': reply.liked }">
                    favorite
                  </span>
                  {{ reply.likes }}
                </button>
                <span v-else aria-hidden="true" class="w-px h-px overflow-hidden">{{ ' ' }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="comment.repliesNextPage" class="mt-2 pl-4">
          <button
            class="text-xs font-semibold text-pink-600 hover:text-pink-700"
            @click="emit('load-more-replies', comment.id)"
          >
            {{ t('comment.loadMoreReplies') }}
          </button>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="menuOpenCommentId !== null && floatingMenuComment"
        ref="floatingMenuPanelEl"
        role="menu"
        data-comment-menu-panel
        class="fixed z-[220] rounded-2xl border border-neutral-200 bg-white shadow-2xl py-1.5 w-[min(240px,calc(100vw-1rem))]"
        :style="{ ...commentMenuFloatingStyles, zIndex: 220 }"
        @pointerdown.stop
      >
        <template v-if="floatingMenuComment">
          <button
            v-if="props.viewerCanComment && !floatingMenuComment.contentMasked"
            type="button"
            role="menuitem"
            class="w-full px-4 py-2.5 text-left text-sm text-neutral-800 hover:bg-neutral-50 flex items-center gap-2"
            @click="menuReply"
          >
            <span class="material-symbols-outlined text-lg text-neutral-500">reply</span>
            {{ t('comment.menu.reply') }}
          </button>
          <button
            v-if="props.canTranslate && !floatingMenuComment.contentMasked"
            type="button"
            role="menuitem"
            class="w-full px-4 py-2.5 text-left text-sm text-neutral-800 hover:bg-neutral-50 flex items-center gap-2"
            @click="menuTranslate"
          >
            <span class="material-symbols-outlined text-lg text-neutral-500">translate</span>
            {{
              floatingMenuComment.translated
                ? t('comment.menu.viewOriginal')
                : t('comment.menu.translate')
            }}
          </button>
          <button
            v-if="props.isPinOwner"
            type="button"
            role="menuitem"
            class="w-full px-4 py-2.5 text-left text-sm text-neutral-800 hover:bg-neutral-50 flex items-center gap-2"
            @click="menuModerateToggle"
          >
            <span class="material-symbols-outlined text-lg text-neutral-500">{{
              floatingMenuComment.hiddenByOwner ? 'visibility' : 'visibility_off'
            }}</span>
            {{
              floatingMenuComment.hiddenByOwner ? t('comment.menu.show') : t('comment.menu.hide')
            }}
          </button>
          <button
            v-if="floatingMenuComment && showReport(floatingMenuComment)"
            type="button"
            role="menuitem"
            class="w-full px-4 py-2.5 text-left text-sm text-neutral-800 hover:bg-neutral-50 flex items-center gap-2"
            @click="menuReport"
          >
            <span class="material-symbols-outlined text-lg text-amber-600">flag</span>
            {{ t('comment.menu.report') }}
          </button>
          <button
            v-if="floatingMenuComment && canDelete(floatingMenuComment)"
            type="button"
            role="menuitem"
            class="w-full px-4 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2"
            @click="menuDelete"
          >
            <span class="material-symbols-outlined text-lg">delete</span>
            {{ t('comment.menu.delete') }}
          </button>
        </template>
      </div>
    </Teleport>
  </div>
</template>

