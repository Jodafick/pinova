<script setup lang="ts">
import { ref } from 'vue'
import RichCommentInput from './RichCommentInput.vue'
import { useI18n } from '../i18n'

const { t } = useI18n()

type Comment = {
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
  replies?: Comment[]
  repliesNextPage?: number | null
  repliesCount?: number
  contentMasked?: boolean
  hiddenByOwner?: boolean
}

withDefaults(
  defineProps<{
    comments: Comment[]
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

const emit = defineEmits<{
  (e: 'add', payload: { text: string; gif?: string | null; mediaFile?: File | null; replyTo?: string | null; parentId?: number }): void
  (e: 'like', commentId: number): void
  (e: 'translate', commentId: number): void
  (e: 'load-more-replies', commentId: number): void
  (e: 'moderate-comment', commentId: number, hidden: boolean): void
  (e: 'report-comment', commentId: number): void
}>()

const replyingTo = ref<number | null>(null)

const renderRichText = (str: string) => {
  return str.replace(/@(\w+)/g, '<span class="text-pink-600 font-semibold">@$1</span>')
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
</script>

<template>
  <div class="space-y-4">
    <div
      v-for="comment in comments"
      :id="`comment-${comment.id}`"
      :key="comment.id"
      class="flex gap-3 rounded-xl transition-all duration-300"
      :class="comment.id === highlightedCommentId ? 'bg-pink-50 ring-2 ring-pink-200 p-2' : ''"
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
        <div class="bg-neutral-100 rounded-2xl px-4 py-2.5">
          <div class="flex items-center gap-2 mb-0.5">
            <span class="text-sm font-semibold text-neutral-900">{{ comment.user }}</span>
            <span class="text-xs text-neutral-400">@{{ comment.username }}</span>
          </div>
          <p
            v-if="comment.contentMasked"
            class="text-sm text-neutral-500 italic leading-snug"
          >
            {{ t('comment.hiddenPlaceholder') }}
          </p>
          <p
            v-else-if="comment.text || comment.translatedText"
            class="text-sm text-neutral-700 leading-snug break-words"
            v-html="renderRichText(comment.translated && comment.translatedText ? comment.translatedText : comment.text)"
          ></p>
          <img v-if="!comment.contentMasked && comment.gif" :src="comment.gif" class="mt-2 max-h-40 rounded-lg" />
          <img v-if="!comment.contentMasked && comment.media" :src="comment.media" class="mt-2 max-h-40 rounded-lg" />
          <div
            v-if="!comment.contentMasked && comment.translated"
            class="mt-1 text-[11px] text-neutral-400 italic flex items-center gap-1"
          >
            <span class="material-symbols-outlined text-xs">translate</span>
            {{ t('translate.auto') }}
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-3 mt-1 px-2 text-xs text-neutral-500">
          <span>{{ comment.createdAt }}</span>
          <button
            v-if="!comment.contentMasked"
            class="font-semibold hover:text-neutral-800 transition flex items-center gap-1"
            :class="{ 'text-pink-600': comment.liked }"
            type="button"
            @click="emit('like', comment.id)"
          >
            <span class="material-symbols-outlined text-sm" :class="{ 'fill-1': comment.liked }">favorite</span>
            {{ comment.likes }}
          </button>
          <button
            v-if="viewerCanComment && !comment.contentMasked"
            type="button"
            class="font-semibold hover:text-neutral-800 transition"
            @click="toggleReply(comment.id)"
          >
            {{ t('comment.reply') }}
          </button>
          <button
            v-if="canTranslate && !comment.contentMasked"
            type="button"
            class="font-semibold hover:text-pink-600 transition flex items-center gap-1"
            @click="emit('translate', comment.id)"
          >
            <span class="material-symbols-outlined text-sm">translate</span>
            {{ comment.translated ? t('comment.viewOriginal') : t('comment.translate') }}
          </button>
          <button
            v-if="isPinOwner"
            type="button"
            class="font-semibold hover:text-pink-600 transition"
            @click="emit('moderate-comment', comment.id, !comment.hiddenByOwner)"
          >
            {{ comment.hiddenByOwner ? t('comment.moderation.show') : t('comment.moderation.hide') }}
          </button>
          <button
            v-if="viewerUsername && comment.username !== viewerUsername"
            type="button"
            class="font-semibold hover:text-amber-700 transition"
            @click="emit('report-comment', comment.id)"
          >
            {{ t('moderation.report') }}
          </button>
        </div>

        <!-- Reply input -->
        <div v-if="replyingTo === comment.id && viewerCanComment && !comment.contentMasked" class="mt-3">
          <RichCommentInput
            :placeholder="t('comment.replyTo.placeholder', { user: comment.username })"
            @submit="handleSubmitReply(comment.id, $event)"
          />
        </div>

        <!-- Nested replies -->
        <div v-if="comment.replies && comment.replies.length" class="mt-3 pl-4 border-l-2 border-neutral-100 space-y-3">
          <div
            v-for="reply in comment.replies"
            :id="`comment-${reply.id}`"
            :key="reply.id"
            class="flex gap-3 rounded-xl transition-all duration-300"
            :class="reply.id === highlightedCommentId ? 'bg-pink-50 ring-2 ring-pink-200 p-2' : ''"
          >
            <div
              class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden"
              :class="reply.avatarUrl ? 'bg-neutral-100' : reply.avatarColor"
            >
              <img
                v-if="reply.avatarUrl"
                :src="reply.avatarUrl"
                alt=""
                class="w-full h-full object-cover"
              />
              <span v-else>{{ reply.user[0] }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <div class="bg-neutral-100 rounded-2xl px-3 py-2">
                <div class="flex items-center gap-2 mb-0.5">
                  <span class="text-xs font-semibold text-neutral-900">{{ reply.user }}</span>
                  <span class="text-[10px] text-neutral-400">@{{ reply.username }}</span>
                </div>
                <p
                  v-if="reply.contentMasked"
                  class="text-sm text-neutral-500 italic leading-snug"
                >
                  {{ t('comment.hiddenPlaceholder') }}
                </p>
                <p
                  v-else
                  class="text-sm text-neutral-700 leading-snug break-words"
                  v-html="renderRichText(reply.translated && reply.translatedText ? reply.translatedText : reply.text)"
                ></p>
                <img v-if="!reply.contentMasked && reply.gif" :src="reply.gif" class="mt-2 max-h-32 rounded-lg" />
                <img v-if="!reply.contentMasked && reply.media" :src="reply.media" class="mt-2 max-h-32 rounded-lg" />
                <div
                  v-if="!reply.contentMasked && reply.translated"
                  class="mt-1 text-[11px] text-neutral-400 italic flex items-center gap-1"
                >
                  <span class="material-symbols-outlined text-xs">translate</span>
                  {{ t('translate.auto') }}
                </div>
              </div>
              <div class="flex items-center gap-3 mt-1 px-2 text-xs text-neutral-500">
                <span>{{ reply.createdAt }}</span>
                <button
                  v-if="!reply.contentMasked"
                  type="button"
                  class="font-semibold hover:text-neutral-800 transition flex items-center gap-1"
                  :class="{ 'text-pink-600': reply.liked }"
                  @click="emit('like', reply.id)"
                >
                  <span class="material-symbols-outlined text-xs" :class="{ 'fill-1': reply.liked }">favorite</span>
                  {{ reply.likes }}
                </button>
                <button
                  v-if="canTranslate && !reply.contentMasked"
                  type="button"
                  class="font-semibold hover:text-pink-600 transition flex items-center gap-1"
                  @click="emit('translate', reply.id)"
                >
                  <span class="material-symbols-outlined text-sm">translate</span>
                  {{ reply.translated ? t('comment.viewOriginal') : t('comment.translate') }}
                </button>
                <button
                  v-if="isPinOwner"
                  type="button"
                  class="font-semibold hover:text-pink-600 transition"
                  @click="emit('moderate-comment', reply.id, !reply.hiddenByOwner)"
                >
                  {{ reply.hiddenByOwner ? t('comment.moderation.show') : t('comment.moderation.hide') }}
                </button>
                <button
                  v-if="viewerUsername && reply.username !== viewerUsername"
                  type="button"
                  class="font-semibold hover:text-amber-700 transition"
                  @click="emit('report-comment', reply.id)"
                >
                  {{ t('moderation.report') }}
                </button>
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
  </div>
</template>
