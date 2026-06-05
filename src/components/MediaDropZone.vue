<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from '../i18n'
import OfflineImg from './OfflineImg.vue'
import OfflineVideo from './OfflineVideo.vue'

const props = defineProps<{
  previewUrl?: string
  mediaType?: 'image' | 'video'
  fileName?: string
}>()

const emit = defineEmits<{
  (e: 'file', payload: { file: File | null; previewUrl: string; mediaType: 'image' | 'video' }): void
}>()

const { t } = useI18n()
const dragging = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

function applyFile(file: File | null) {
  if (!file) {
    emit('file', { file: null, previewUrl: '', mediaType: 'image' })
    return
  }
  const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(file.name)
  const mediaType = isVideo ? 'video' : 'image'
  emit('file', { file, previewUrl: URL.createObjectURL(file), mediaType })
}

function onInput(ev: Event) {
  const input = ev.target as HTMLInputElement
  applyFile(input.files?.[0] ?? null)
}

function onDrop(ev: DragEvent) {
  ev.preventDefault()
  dragging.value = false
  const file = ev.dataTransfer?.files?.[0] ?? null
  if (file) applyFile(file)
}

function onDragOver(ev: DragEvent) {
  ev.preventDefault()
  dragging.value = true
}

function onDragLeave() {
  dragging.value = false
}

function clear() {
  if (inputRef.value) inputRef.value.value = ''
  applyFile(null)
}
</script>

<template>
  <div class="media-drop-zone space-y-2">
    <div
      v-if="previewUrl"
      class="relative rounded-2xl overflow-hidden border app-divider-subtle bg-neutral-100 dark:bg-neutral-900"
    >
      <OfflineVideo
        v-if="mediaType === 'video'"
        :src="previewUrl"
        class="w-full max-h-48 object-cover"
        muted
        playsinline
        controls
        preload="metadata"
      />
      <OfflineImg v-else :src="previewUrl" alt="" class="w-full max-h-48 object-cover" />
      <button
        type="button"
        class="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/55 text-white flex items-center justify-center backdrop-blur-sm"
        :aria-label="t('common.close')"
        @click="clear"
      >
        <span class="material-symbols-outlined text-lg">close</span>
      </button>
      <p v-if="fileName" class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2 text-[10px] text-white truncate">
        {{ fileName }}
      </p>
    </div>

    <div
      role="button"
      tabindex="0"
      class="relative rounded-2xl border-2 border-dashed px-4 py-8 text-center transition cursor-pointer"
      :class="dragging
        ? 'border-pink-500 bg-pink-50/80 dark:bg-pink-950/40 scale-[1.01]'
        : 'border-neutral-200 dark:border-neutral-700 hover:border-pink-300 hover:bg-pink-50/30 dark:hover:bg-pink-950/20'"
      @click="inputRef?.click()"
      @keydown.enter="inputRef?.click()"
      @drop="onDrop"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
    >
      <input
        ref="inputRef"
        type="file"
        accept="image/*,video/mp4,video/webm,video/quicktime"
        class="sr-only"
        @change="onInput"
      />
      <span class="material-symbols-outlined text-4xl text-pink-500/80 mb-2 block" aria-hidden="true">
        {{ dragging ? 'download' : 'perm_media' }}
      </span>
      <p class="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
        {{ dragging ? t('promote.media.dropNow') : t('promote.media.dropTitle') }}
      </p>
      <p class="text-xs text-neutral-500 mt-1">{{ t('promote.media.dropHint') }}</p>
      <button
        type="button"
        class="mt-3 inline-flex items-center gap-1 rounded-full bg-pink-700 text-white text-xs font-bold px-4 py-2"
        @click.stop="inputRef?.click()"
      >
        <span class="material-symbols-outlined text-base">upload</span>
        {{ t('promote.media.browse') }}
      </button>
    </div>
  </div>
</template>
