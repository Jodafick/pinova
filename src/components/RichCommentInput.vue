<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useI18n } from '../i18n'
import api from '../api'

const { t } = useI18n()

const text = ref('')
const showGifPicker = ref(false)
const showMentionList = ref(false)
const selectedGif = ref<string | null>(null)
const replyingTo = ref<string | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)

defineProps<{
  placeholder?: string
}>()

const emit = defineEmits<{
  (e: 'submit', payload: { text: string; gif?: string | null; replyTo?: string | null }): void
}>()

const trendingGifs = [
  { id: 1, label: 'Clap', preview: 'https://media.tenor.com/d_0ZBGPxntwAAAAi/clap-emoji.gif' },
  { id: 2, label: 'Heart', preview: 'https://media.tenor.com/L1lzU7iMHEAAAAAi/heart-love.gif' },
  { id: 3, label: 'Wow', preview: 'https://media.tenor.com/Tjpks-bBu5UAAAAi/wow-mind-blown.gif' },
  { id: 4, label: 'Fire', preview: 'https://media.tenor.com/c0jElkPm00MAAAAi/fire-flame.gif' },
  { id: 5, label: 'LOL', preview: 'https://media.tenor.com/QQTRFOybnxQAAAAi/laughing.gif' },
  { id: 6, label: 'Thumbs', preview: 'https://media.tenor.com/HtdAulSCQDoAAAAi/like-thumbs-up.gif' },
]

const suggestedUsers = ref<{ username: string; name: string; avatar: string }[]>([])
let mentionTimer: ReturnType<typeof setTimeout> | null = null

const mentionFilter = ref('')
const mentionPage = ref(1)
const mentionHasNext = ref(false)
const mentionLoading = ref(false)

const filteredUsers = computed(() => {
  if (!mentionFilter.value) return suggestedUsers.value
  const q = mentionFilter.value.toLowerCase()
  return suggestedUsers.value.filter(u => u.username.toLowerCase().includes(q) || u.name.toLowerCase().includes(q))
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
    const response = await api.get('users/mentions/', { params: { q: query, page: mentionPage.value, page_size: 10 } })
    const payload = response.data || {}
    const users = Array.isArray(payload) ? payload : payload.results || []
    const mapped = users.map((user: any) => ({
      username: user.username,
      name: user.display_name || user.username,
      avatar: user.avatar_color || 'bg-pink-500',
    }))
    suggestedUsers.value = reset
      ? mapped
      : [
          ...suggestedUsers.value,
          ...mapped.filter((u: { username: string }) => !suggestedUsers.value.some((e) => e.username === u.username)),
        ]
    mentionHasNext.value = !!payload.next
    if (payload.next) {
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

const pickGif = (url: string) => {
  selectedGif.value = url
  showGifPicker.value = false
}

const removeGif = () => {
  selectedGif.value = null
}

const setReply = (username: string) => {
  replyingTo.value = username
  text.value = `@${username} `
  nextTick(() => inputEl.value?.focus())
}

const submit = () => {
  if (!text.value.trim() && !selectedGif.value) return
  emit('submit', {
    text: text.value,
    gif: selectedGif.value,
    replyTo: replyingTo.value,
  })
  text.value = ''
  selectedGif.value = null
  replyingTo.value = null
  showGifPicker.value = false
  showMentionList.value = false
}

const cancelReply = () => {
  replyingTo.value = null
  text.value = ''
}

defineExpose({ setReply })
</script>

<template>
  <div class="relative">
    <!-- Reply badge -->
    <div
      v-if="replyingTo"
      class="flex items-center justify-between px-3 py-1.5 mb-2 bg-pink-50 rounded-lg text-xs"
    >
      <span class="text-neutral-600">
        {{ t('comment.replyTo') }} <span class="text-pink-600 font-semibold">@{{ replyingTo }}</span>
      </span>
      <button class="text-neutral-400 hover:text-neutral-700" @click="cancelReply">
        <span class="material-symbols-outlined text-base">close</span>
      </button>
    </div>

    <!-- Selected GIF preview -->
    <div v-if="selectedGif" class="mb-2 relative inline-block">
      <img :src="selectedGif" class="max-h-32 rounded-lg" />
      <button
        class="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-neutral-900 text-white flex items-center justify-center shadow"
        @click="removeGif"
      >
        <span class="material-symbols-outlined text-sm">close</span>
      </button>
    </div>

    <!-- Input bar -->
    <div class="flex items-center gap-2 bg-neutral-100 rounded-full px-2 pl-4 py-1 focus-within:ring-2 focus-within:ring-pink-500 focus-within:bg-white transition">
      <input
        ref="inputEl"
        v-model="text"
        type="text"
        :placeholder="placeholder || t('comment.placeholder')"
        class="flex-1 bg-transparent outline-none text-sm py-2"
        @input="handleInput"
        @keyup.enter="submit"
      />

      <!-- GIF button -->
      <button
        class="w-8 h-8 rounded-full hover:bg-neutral-200 flex items-center justify-center text-neutral-500 transition relative"
        :title="t('comment.gif.title')"
        @click="showGifPicker = !showGifPicker; showMentionList = false"
      >
        <span class="text-[10px] font-bold border border-current rounded px-1 leading-none py-0.5">{{ t('comment.gif') }}</span>
      </button>

      <!-- Mention button -->
      <button
        class="w-8 h-8 rounded-full hover:bg-neutral-200 flex items-center justify-center text-neutral-500 transition"
        :title="t('comment.mention.title')"
        @click="text += '@'; mentionFilter = ''; showMentionList = true; inputEl?.focus(); void fetchMentionUsers('', true)"
      >
        <span class="material-symbols-outlined text-lg">alternate_email</span>
      </button>

      <!-- Emoji placeholder -->
      <button
        class="w-8 h-8 rounded-full hover:bg-neutral-200 flex items-center justify-center text-neutral-500 transition"
        :title="t('comment.emoji.title')"
      >
        <span class="material-symbols-outlined text-lg">mood</span>
      </button>

      <!-- Submit -->
      <button
        class="w-9 h-9 rounded-full bg-pink-600 text-white flex items-center justify-center hover:bg-pink-700 transition disabled:opacity-40"
        :disabled="!text.trim() && !selectedGif"
        @click="submit"
      >
        <span class="material-symbols-outlined text-lg">send</span>
      </button>
    </div>

    <!-- GIF picker dropdown -->
    <div
      v-if="showGifPicker"
      class="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-2xl shadow-xl border border-neutral-100 overflow-hidden z-30"
    >
      <div class="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
        <h4 class="text-sm font-semibold">{{ t('comment.gif.trending') }}</h4>
        <button class="text-neutral-400 hover:text-neutral-700" @click="showGifPicker = false">
          <span class="material-symbols-outlined text-base">close</span>
        </button>
      </div>
      <div class="px-3 py-2">
        <div class="flex items-center gap-2 bg-neutral-100 rounded-full px-3 py-1.5">
          <span class="material-symbols-outlined text-base text-neutral-400">search</span>
          <input
            type="text"
            :placeholder="t('comment.gif.search')"
            class="flex-1 bg-transparent outline-none text-xs"
          />
        </div>
      </div>
      <div class="grid grid-cols-3 gap-1.5 p-2 max-h-64 overflow-y-auto">
        <button
          v-for="gif in trendingGifs"
          :key="gif.id"
          class="aspect-square rounded-lg overflow-hidden bg-neutral-100 hover:ring-2 hover:ring-pink-400 transition relative group"
          :title="gif.label"
          @click="pickGif(gif.preview)"
        >
          <img :src="gif.preview" :alt="gif.label" class="w-full h-full object-cover" />
          <span class="absolute bottom-1 left-1 text-[9px] font-bold bg-black/60 text-white px-1 rounded">GIF</span>
        </button>
      </div>
    </div>

    <!-- Mention list dropdown -->
    <div
      v-if="showMentionList && filteredUsers.length"
      class="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-2xl shadow-xl border border-neutral-100 overflow-hidden z-30"
    >
      <div class="px-4 py-2 text-[11px] uppercase tracking-wider text-neutral-400 font-semibold border-b border-neutral-100">
        {{ t('comment.mention.list') }}
      </div>
      <div class="max-h-60 overflow-y-auto py-1" @scroll="handleMentionListScroll">
        <button
          v-for="user in filteredUsers"
          :key="user.username"
          class="w-full flex items-center gap-3 px-4 py-2 hover:bg-neutral-50 transition text-left"
          @click="insertMention(user.username)"
        >
          <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" :class="user.avatar">
            {{ user.name[0] }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-neutral-800 truncate">{{ user.name }}</p>
            <p class="text-xs text-neutral-500 truncate">@{{ user.username }}</p>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>
