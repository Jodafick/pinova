<script setup lang="ts">
import { ref } from 'vue'
import RichCommentInput from './RichCommentInput.vue'
import { useI18n } from '../i18n'

const { t } = useI18n()

type Comment = {
  id: number
  user: string
  username: string
  avatar: string
  text: string
  translatedText?: string
  gif?: string | null
  createdAt: string
  liked?: boolean
  likes: number
  translated?: boolean
  originalLang?: string
  replies?: Comment[]
}

defineProps<{
  comments: Comment[]
  canTranslate?: boolean
}>()

const emit = defineEmits<{
  (e: 'add', payload: { text: string; gif?: string | null; replyTo?: string | null; parentId?: number }): void
  (e: 'like', commentId: number): void
  (e: 'translate', commentId: number): void
}>()

const replyingTo = ref<number | null>(null)

const renderRichText = (str: string) => {
  return str.replace(/@(\w+)/g, '<span class="text-pink-600 font-semibold">@$1</span>')
}

const toggleReply = (commentId: number) => {
  replyingTo.value = replyingTo.value === commentId ? null : commentId
}

const handleSubmitReply = (commentId: number, payload: { text: string; gif?: string | null; replyTo?: string | null }) => {
  emit('add', { ...payload, parentId: commentId })
  replyingTo.value = null
}
</script>

<template>
  <div class="space-y-4">
    <div v-for="comment in comments" :key="comment.id" class="flex gap-3">
      <div
        class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
        :class="comment.avatar"
      >
        {{ comment.user[0] }}
      </div>

      <div class="flex-1 min-w-0">
        <div class="bg-neutral-100 rounded-2xl px-4 py-2.5">
          <div class="flex items-center gap-2 mb-0.5">
            <span class="text-sm font-semibold text-neutral-900">{{ comment.user }}</span>
            <span class="text-xs text-neutral-400">@{{ comment.username }}</span>
            <span
              v-if="comment.originalLang"
              class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-white text-neutral-500 rounded font-bold"
            >{{ comment.originalLang }}</span>
          </div>
          <p
            v-if="comment.text || comment.translatedText"
            class="text-sm text-neutral-700 leading-snug break-words"
            v-html="renderRichText(comment.translated && comment.translatedText ? comment.translatedText : comment.text)"
          ></p>
          <img v-if="comment.gif" :src="comment.gif" class="mt-2 max-h-40 rounded-lg" />
          <div
            v-if="comment.translated"
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
            class="font-semibold hover:text-neutral-800 transition flex items-center gap-1"
            :class="{ 'text-pink-600': comment.liked }"
            @click="emit('like', comment.id)"
          >
            <span class="material-symbols-outlined text-sm" :class="{ 'fill-1': comment.liked }">favorite</span>
            {{ comment.likes }}
          </button>
          <button
            class="font-semibold hover:text-neutral-800 transition"
            @click="toggleReply(comment.id)"
          >
            {{ t('comment.reply') }}
          </button>
          <button
            v-if="canTranslate && comment.originalLang"
            class="font-semibold hover:text-pink-600 transition flex items-center gap-1"
            @click="emit('translate', comment.id)"
          >
            <span class="material-symbols-outlined text-sm">translate</span>
            {{ comment.translated ? t('comment.viewOriginal') : t('comment.translate') }}
          </button>
        </div>

        <!-- Reply input -->
        <div v-if="replyingTo === comment.id" class="mt-3">
          <RichCommentInput
            :placeholder="t('comment.replyTo.placeholder', { user: comment.username })"
            @submit="handleSubmitReply(comment.id, $event)"
          />
        </div>

        <!-- Nested replies -->
        <div v-if="comment.replies && comment.replies.length" class="mt-3 pl-4 border-l-2 border-neutral-100 space-y-3">
          <div v-for="reply in comment.replies" :key="reply.id" class="flex gap-3">
            <div
              class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
              :class="reply.avatar"
            >
              {{ reply.user[0] }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="bg-neutral-100 rounded-2xl px-3 py-2">
                <div class="flex items-center gap-2 mb-0.5">
                  <span class="text-xs font-semibold text-neutral-900">{{ reply.user }}</span>
                  <span class="text-[10px] text-neutral-400">@{{ reply.username }}</span>
                </div>
                <p
                  class="text-sm text-neutral-700 leading-snug break-words"
                  v-html="renderRichText(reply.text)"
                ></p>
                <img v-if="reply.gif" :src="reply.gif" class="mt-2 max-h-32 rounded-lg" />
              </div>
              <div class="flex items-center gap-3 mt-1 px-2 text-xs text-neutral-500">
                <span>{{ reply.createdAt }}</span>
                <button class="font-semibold hover:text-neutral-800 transition flex items-center gap-1">
                  <span class="material-symbols-outlined text-xs">favorite</span>
                  {{ reply.likes }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
