<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { Pin } from '../types'
import { usePins } from '../composables/usePins'
import { useAuth } from '../composables/useAuth'
import { useRouter } from 'vue-router'
import { useI18n } from '../i18n'
import PinSensitiveMedia from './PinSensitiveMedia.vue'
import { viewerCanRevealSensitiveMedia } from '../composables/useModeration'

const { formatCount, isPinSavePending, toggleLike } = usePins()
const { isAuthenticated, currentUser } = useAuth()
const router = useRouter()
const { t } = useI18n()

const viewerCanRevealSensitive = computed(() =>
  viewerCanRevealSensitiveMedia(isAuthenticated.value, currentUser.value?.birthDate),
)

const props = defineProps<{
  pins: Pin[]
}>()

const emit = defineEmits<{
  (e: 'toggle-save', slug: string): void
  (e: 'open-pin', slug: string): void
}>()

const columnCount = ref(2)
const loadedImages = ref<Record<number, boolean>>({})
const mediaTapTimers = new Map<number, ReturnType<typeof setTimeout>>()

const updateColumnCount = () => {
  const width = window.innerWidth
  if (width >= 1280) columnCount.value = 5
  else if (width >= 1024) columnCount.value = 4
  else if (width >= 640) columnCount.value = 3
  else columnCount.value = 2
}

const columns = computed(() => {
  const cols = Array.from({ length: columnCount.value }, () => [] as Pin[])
  props.pins.forEach((pin, index) => {
    const targetCol = cols[index % columnCount.value]
    if (targetCol) {
      targetCol.push(pin)
    }
  })
  return cols
})

const markMediaLoaded = (pinId: number) => {
  loadedImages.value[pinId] = true
}

const isMediaLoaded = (pinId: number) => !!loadedImages.value[pinId]
const isSavePending = (slug: string) => isPinSavePending(slug)

function clearMediaTimer(pinId: number) {
  const t = mediaTapTimers.get(pinId)
  if (t) clearTimeout(t)
  mediaTapTimers.delete(pinId)
}

async function doubleTapLike(pin: Pin) {
  if (!isAuthenticated.value) {
    router.push('/login')
    return
  }
  await toggleLike(pin.slug)
}

function onPinMediaTap(pin: Pin) {
  const existing = mediaTapTimers.get(pin.id)
  if (existing) {
    clearMediaTimer(pin.id)
    void doubleTapLike(pin)
    return
  }
  const t = setTimeout(() => {
    mediaTapTimers.delete(pin.id)
    emit('open-pin', pin.slug)
  }, 320)
  mediaTapTimers.set(pin.id, t)
}

function onPinMediaDblClick(pin: Pin) {
  clearMediaTimer(pin.id)
  void doubleTapLike(pin)
}

function onArticleClick(pin: Pin, e: MouseEvent) {
  const el = e.target as HTMLElement | null
  if (el?.closest('[data-pin-media]')) return
  emit('open-pin', pin.slug)
}

onMounted(() => {
  updateColumnCount()
  window.addEventListener('resize', updateColumnCount)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateColumnCount)
  mediaTapTimers.forEach((tid) => clearTimeout(tid))
  mediaTapTimers.clear()
})
</script>

<template>
  <div class="flex gap-3 sm:gap-4 items-start" :aria-label="t('pin.related')">
    <div
      v-for="(column, colIndex) in columns"
      :key="colIndex"
      class="flex-1 flex flex-col gap-3 sm:gap-4"
    >
      <article
        v-for="pin in column"
        :key="pin.id"
        class="group relative rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-xl transition-all cursor-pointer"
        @click="onArticleClick(pin, $event)"
      >
        <!-- Image container : hauteur naturelle après chargement -->
        <div
          data-pin-media
          class="relative overflow-hidden rounded-2xl bg-neutral-100 min-h-[140px]"
          @click.stop="onPinMediaTap(pin)"
          @dblclick.stop.prevent="onPinMediaDblClick(pin)"
        >
          <div
            v-if="!isMediaLoaded(pin.id)"
            class="aspect-[3/4] w-full animate-pulse bg-gradient-to-b from-neutral-200 via-neutral-100 to-neutral-200"
          ></div>
          <PinSensitiveMedia
            v-if="pin.imageUrl"
            :sensitive="!!pin.mediaSensitiveBlur"
            :viewer-can-reveal="viewerCanRevealSensitive"
            wrapper-class="w-full"
          >
            <img
              :src="pin.imageUrl"
              :alt="pin.title"
              class="w-full h-auto block object-cover group-hover:scale-[1.02] transition-transform duration-500 select-none"
              draggable="false"
              :class="isMediaLoaded(pin.id) ? 'opacity-100 relative z-[1]' : 'opacity-0 absolute inset-0 w-full h-full object-cover'"
              loading="lazy"
              @load="markMediaLoaded(pin.id)"
              @contextmenu.prevent
              @dragstart.prevent
            />
          </PinSensitiveMedia>
          <PinSensitiveMedia
            v-else-if="pin.storyVideoUrl"
            :sensitive="!!pin.mediaSensitiveBlur"
            :viewer-can-reveal="viewerCanRevealSensitive"
            wrapper-class="w-full"
          >
            <video
              :src="pin.storyVideoUrl"
              muted
              playsinline
              preload="metadata"
              class="w-full h-auto block object-cover group-hover:scale-[1.02] transition-transform duration-500 select-none max-h-[480px]"
              :class="isMediaLoaded(pin.id) ? 'opacity-100 relative z-[1]' : 'opacity-0 absolute inset-0 w-full h-full object-cover'"
              @loadedmetadata="markMediaLoaded(pin.id)"
              @error="markMediaLoaded(pin.id)"
            />
          </PinSensitiveMedia>

          <div
            v-if="pin.scheduledPublishAt"
            class="absolute top-2 left-2 z-[45] px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold shadow"
          >
            {{ t('pin.scheduledBadge') }}
          </div>
          <div
            v-if="pin.isStory"
            class="absolute z-[45] px-2 py-0.5 rounded-full bg-violet-600 text-white text-[10px] font-bold shadow"
            :class="pin.scheduledPublishAt ? 'top-2 right-2' : 'top-2 left-2'"
          >
            {{ t('pin.storyBadge') }}
          </div>

          <!-- Dark overlay on hover -->
          <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 z-[40] pointer-events-none"></div>

          <!-- Save button -->
          <button
            v-if="isAuthenticated"
            class="absolute top-3 right-3 px-4 py-2 rounded-full text-sm font-bold opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200 shadow-lg z-[45]"
            :class="pin.saved ? 'bg-neutral-900 text-white' : 'bg-pink-600 text-white hover:bg-pink-700'"
            :disabled="isSavePending(pin.slug)"
            @click.stop="emit('toggle-save', pin.slug)"
          >
            <span v-if="isSavePending(pin.slug)" class="w-4 h-4 inline-block border-2 border-current border-t-transparent rounded-full animate-spin"></span>
            <span v-else>{{ pin.saved ? t('pin.saved') : t('pin.save') }}</span>
          </button>

          <!-- Bottom actions on hover -->
          <div class="absolute bottom-3 left-3 right-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-[45]">
            <!-- Link badge -->
            <a
              v-if="pin.link"
              :href="pin.link.startsWith('http') ? pin.link : 'https://' + pin.link"
              target="_blank"
              class="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/95 text-xs font-medium text-neutral-800 shadow-md hover:bg-white max-w-[60%] truncate"
              @click.stop
            >
              <span class="material-symbols-outlined text-sm">link</span>
              <span class="truncate">{{ pin.link }}</span>
            </a>
            <div v-else></div>
          </div>
        </div>

        <!-- Pin info below image -->
        <div class="px-2 pt-2 pb-3">
          <h2 v-if="pin.title" class="text-sm font-semibold leading-snug line-clamp-2 text-neutral-900">
            {{ pin.title }}
          </h2>

          <router-link
            :to="`/profile/${pin.username}`"
            class="mt-1.5 flex items-center gap-2 hover:bg-neutral-100 p-1 rounded-lg transition-colors"
            @click.stop
          >
            <div
              class="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 overflow-hidden avatar-shadow"
              :class="pin.userAvatarColor"
            >
              <img v-if="pin.userAvatarUrl" :src="pin.userAvatarUrl" class="w-full h-full object-cover" />
              <span v-else class="avatar-text">{{ pin.user[0] }}</span>
            </div>
            <span class="text-xs text-neutral-600 truncate font-medium">{{ pin.user }}</span>
          </router-link>

          <div class="mt-1 flex items-center gap-3 text-[11px] text-neutral-400">
            <span v-if="pin.stats.saves > 0" class="flex items-center gap-0.5">
              {{ formatCount(pin.stats.saves) }}
              <span class="material-symbols-outlined text-xs" :class="{ 'fill-1 text-neutral-600': pin.saved }">bookmark</span>
            </span>
            <span v-if="pin.stats.reactions > 0" class="flex items-center gap-0.5">
              {{ formatCount(pin.stats.reactions) }}
              <span class="material-symbols-outlined text-xs fill-1" :class="pin.liked ? 'text-pink-500' : 'text-neutral-300'">favorite</span>
            </span>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>
