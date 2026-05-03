<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { Pin } from '../types'
import { usePins } from '../composables/usePins'
import { useAuth } from '../composables/useAuth'
import { useRouter } from 'vue-router'
import { useI18n } from '../i18n'
import { displayInitials } from '../utils/displayInitials'
import PinSensitiveMedia from './PinSensitiveMedia.vue'
import { viewerCanRevealSensitiveMedia, sensitiveMediaBlurredByDefault } from '../composables/useModeration'
import { useDataSaver } from '../composables/useDataSaver'

const { formatCount, isPinSavePending, toggleLike } = usePins()
const { isAuthenticated, currentUser } = useAuth()
const router = useRouter()
const { t } = useI18n()
const {
  gridImageFetchPriority,
  gridImageSizes,
  storyVideoPreload,
} = useDataSaver()

const viewerCanRevealSensitive = computed(() =>
  viewerCanRevealSensitiveMedia(isAuthenticated.value, currentUser.value?.birthDate),
)

const blurSensitiveByDefault = computed(() =>
  sensitiveMediaBlurredByDefault(
    isAuthenticated.value,
    currentUser.value?.birthDate,
    currentUser.value?.subscription?.plan,
    currentUser.value?.subscription?.sensitiveMediaBlurByDefault,
  ),
)

type GridCell =
  | { kind: 'pin'; pin: Pin }
  | { kind: 'skeleton'; key: string }

const props = withDefaults(
  defineProps<{
    pins: Pin[]
    /** Grille pleine (ex. premier chargement) : placeholders alignés comme les cartes. */
    loadingInitial?: boolean
    /** Suite de chargement (infinite scroll / page suivante). */
    loadingMore?: boolean
  }>(),
  {
    loadingInitial: false,
    loadingMore: false,
  },
)

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

/** Même logique de répartition que les pins pour que les skeletons prolongent la grille sans rupture. */
const skeletonPlaceholders = computed(() => {
  const n = columnCount.value
  if (props.loadingInitial && props.pins.length === 0) {
    return Math.max(n * 5, 12)
  }
  if (props.loadingMore) {
    return Math.max(n * 2, 6)
  }
  return 0
})

const columns = computed(() => {
  const n = columnCount.value
  const cells: GridCell[] = props.pins.map((pin) => ({ kind: 'pin', pin }))
  const sk = skeletonPlaceholders.value
  for (let i = 0; i < sk; i++) {
    cells.push({ kind: 'skeleton', key: `pin-skeleton-${i}` })
  }
  const cols = Array.from({ length: n }, () => [] as GridCell[])
  cells.forEach((cell, index) => {
    const col = cols[index % n]
    if (col) col.push(cell)
  })
  return cols
})

const gridBusy = computed(
  () =>
    (props.loadingInitial && props.pins.length === 0) || props.loadingMore,
)

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

function pinCardLabel(pin: Pin) {
  return t('pin.cardAriaLabel', { title: pin.title || pin.slug, user: pin.user })
}

function onCardKeydown(pin: Pin, ev: KeyboardEvent) {
  if (ev.key === 'Enter' || ev.key === ' ') {
    ev.preventDefault()
    emit('open-pin', pin.slug)
  }
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
  <section class="pin-grid-scope" aria-labelledby="pin-feed-grid-heading" :aria-busy="gridBusy || undefined">
    <h2 id="pin-feed-grid-heading" class="sr-only">{{ t('feed.pinsGridHeading') }}</h2>
    <div class="flex gap-3 sm:gap-4 items-start">
    <div
      v-for="(column, colIndex) in columns"
      :key="colIndex"
      role="presentation"
      class="flex-1 flex flex-col gap-3 sm:gap-4"
    >
      <template v-for="cell in column" :key="cell.kind === 'pin' ? cell.pin.id : cell.key">
      <article
        v-if="cell.kind === 'pin'"
        tabindex="0"
        role="article"
        :aria-label="pinCardLabel(cell.pin)"
        class="group relative rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-xl transition-all cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        @click="onArticleClick(cell.pin, $event)"
        @keydown="onCardKeydown(cell.pin, $event)"
      >
        <!-- Image container : hauteur naturelle après chargement -->
        <div
          data-pin-media
          class="relative overflow-hidden rounded-2xl bg-neutral-100 min-h-[140px]"
          @click.stop="onPinMediaTap(cell.pin)"
          @dblclick.stop.prevent="onPinMediaDblClick(cell.pin)"
        >
          <div
            v-if="!isMediaLoaded(cell.pin.id)"
            class="aspect-[3/4] w-full animate-pulse bg-gradient-to-b from-neutral-200 via-neutral-100 to-neutral-200"
          ></div>
          <PinSensitiveMedia
            v-if="cell.pin.imageUrl"
            :sensitive="!!cell.pin.mediaSensitiveBlur"
            :viewer-can-reveal="viewerCanRevealSensitive"
            :blur-by-default="blurSensitiveByDefault"
            wrapper-class="w-full"
          >
            <img
              :src="cell.pin.imageUrl"
              :alt="cell.pin.title ? `${cell.pin.title} — ${cell.pin.user}` : t('feed.pinImageFallback', { user: cell.pin.user })"
              :sizes="gridImageSizes"
              :fetchpriority="gridImageFetchPriority"
              decoding="async"
              class="w-full h-auto block object-cover group-hover:scale-[1.02] transition-transform duration-500 select-none"
              draggable="false"
              :class="isMediaLoaded(cell.pin.id) ? 'opacity-100 relative z-[1]' : 'opacity-0 absolute inset-0 w-full h-full object-cover'"
              loading="lazy"
              @load="markMediaLoaded(cell.pin.id)"
              @contextmenu.prevent
              @dragstart.prevent
            />
          </PinSensitiveMedia>
          <PinSensitiveMedia
            v-else-if="cell.pin.storyVideoUrl"
            :sensitive="!!cell.pin.mediaSensitiveBlur"
            :viewer-can-reveal="viewerCanRevealSensitive"
            :blur-by-default="blurSensitiveByDefault"
            wrapper-class="w-full"
          >
            <video
              :src="cell.pin.storyVideoUrl"
              muted
              playsinline
              :preload="storyVideoPreload"
              class="w-full h-auto block object-cover group-hover:scale-[1.02] transition-transform duration-500 select-none max-h-[480px]"
              :class="isMediaLoaded(cell.pin.id) ? 'opacity-100 relative z-[1]' : 'opacity-0 absolute inset-0 w-full h-full object-cover'"
              @loadedmetadata="markMediaLoaded(cell.pin.id)"
              @error="markMediaLoaded(cell.pin.id)"
            />
          </PinSensitiveMedia>

          <div
            v-if="cell.pin.scheduledPublishAt"
            class="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold shadow"
          >
            {{ t('pin.scheduledBadge') }}
          </div>
          <div
            v-if="cell.pin.isStory"
            class="absolute z-10 px-2 py-0.5 rounded-full bg-violet-600 text-white text-[10px] font-bold shadow"
            :class="cell.pin.scheduledPublishAt ? 'top-2 right-2' : 'top-2 left-2'"
          >
            {{ t('pin.storyBadge') }}
          </div>

          <!-- Dark overlay on hover (sous les boutons, au-dessus du média) -->
          <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 z-[5] pointer-events-none"></div>

          <!-- Save button -->
          <button
            v-if="isAuthenticated"
            type="button"
            :aria-pressed="cell.pin.saved"
            class="absolute top-3 right-3 px-4 py-2 rounded-full text-sm font-bold opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200 shadow-lg z-10"
            :class="cell.pin.saved ? 'bg-neutral-950 text-white' : 'bg-pink-700 text-white hover:bg-pink-800'"
            :disabled="isSavePending(cell.pin.slug)"
            @click.stop="emit('toggle-save', cell.pin.slug)"
          >
            <span v-if="isSavePending(cell.pin.slug)" class="w-4 h-4 inline-block border-2 border-current border-t-transparent rounded-full animate-spin"></span>
            <span v-else>{{ cell.pin.saved ? t('pin.saved') : t('pin.save') }}</span>
          </button>

          <!-- Bottom actions on hover -->
          <div class="absolute bottom-3 left-3 right-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
            <!-- Link badge -->
            <a
              v-if="cell.pin.link"
              :href="cell.pin.link.startsWith('http') ? cell.pin.link : 'https://' + cell.pin.link"
              target="_blank"
              class="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/95 text-xs font-medium text-neutral-800 shadow-md hover:bg-white max-w-[60%] truncate"
              @click.stop
            >
              <span class="material-symbols-outlined text-sm">link</span>
              <span class="truncate">{{ cell.pin.link }}</span>
            </a>
            <div v-else></div>
          </div>
        </div>

        <!-- Pin info below image -->
        <div class="px-2 pt-2 pb-3">
          <p v-if="cell.pin.title" class="text-sm font-semibold leading-snug line-clamp-2 text-neutral-950">
            {{ cell.pin.title }}
          </p>

          <router-link
            :to="`/profile/${cell.pin.username}`"
            class="mt-1.5 flex items-center gap-2 hover:bg-neutral-100 p-1 rounded-lg transition-colors"
            @click.stop
            :aria-label="t('pin.openAuthorProfile', { name: cell.pin.user })"
          >
            <div
              class="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 overflow-hidden avatar-shadow"
              :class="cell.pin.userAvatarColor"
            >
              <img v-if="cell.pin.userAvatarUrl" :src="cell.pin.userAvatarUrl" class="w-full h-full object-cover" />
              <span v-else class="avatar-text">{{ displayInitials(cell.pin.user) }}</span>
            </div>
            <span class="text-xs text-neutral-600 truncate font-medium">{{ cell.pin.user }}</span>
          </router-link>

          <div class="mt-1 flex items-center gap-3 text-[11px] text-neutral-700">
            <span v-if="cell.pin.stats.saves > 0" class="flex items-center gap-0.5">
              {{ formatCount(cell.pin.stats.saves) }}
              <span class="material-symbols-outlined text-xs" :class="{ 'fill-1 text-neutral-600': cell.pin.saved }">bookmark</span>
            </span>
            <span v-if="cell.pin.stats.reactions > 0" class="flex items-center gap-0.5">
              {{ formatCount(cell.pin.stats.reactions) }}
              <span class="material-symbols-outlined text-xs fill-1" :class="cell.pin.liked ? 'text-pink-600' : 'text-neutral-600'">favorite</span>
            </span>
          </div>
          <div v-if="cell.pin.boards?.length" class="mt-2 flex flex-wrap gap-1.5">
            <router-link
              v-for="board in cell.pin.boards.slice(0, 2)"
              :key="board.id"
              :to="`/profile/${board.ownerUsername || cell.pin.username}/board/${board.id}`"
              class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-purple-50 text-[10px] font-semibold text-purple-700 hover:bg-purple-100 max-w-full"
              :title="board.name"
              @click.stop
            >
              <span class="material-symbols-outlined text-xs shrink-0" aria-hidden="true">dashboard</span>
              <span class="truncate">{{ board.name }}</span>
            </router-link>
          </div>
        </div>
      </article>

      <!-- Placeholder masonry : même shell que les cartes pour suivre les colonnes. -->
      <div
        v-else
        class="rounded-2xl overflow-hidden bg-white shadow-sm pointer-events-none select-none touch-none"
        aria-hidden="true"
      >
        <div class="relative overflow-hidden rounded-2xl bg-neutral-100 min-h-[140px]">
          <div class="aspect-[3/4] w-full animate-pulse bg-gradient-to-b from-neutral-200 via-neutral-100 to-neutral-200" />
        </div>
        <div class="px-2 pt-2 pb-3 space-y-2">
          <div class="h-[15px] w-5/6 max-w-[90%] rounded-md bg-neutral-200 animate-pulse" />
          <div class="flex items-center gap-2 mt-1.5">
            <div class="w-7 h-7 rounded-full bg-neutral-200 animate-pulse shrink-0" />
            <div class="h-3 w-[55%] max-w-[9rem] rounded-md bg-neutral-200 animate-pulse" />
          </div>
          <div class="mt-1 flex items-center gap-3 pt-0.5">
            <div class="h-[11px] w-9 rounded bg-neutral-100 animate-pulse" />
            <div class="h-[11px] w-9 rounded bg-neutral-100 animate-pulse" />
          </div>
        </div>
      </div>
      </template>
    </div>
    </div>
  </section>
</template>
