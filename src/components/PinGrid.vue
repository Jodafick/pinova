<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { Pin } from '../types'
import { usePins } from '../composables/usePins'
import { useAuth } from '../composables/useAuth'
import { useRouter } from 'vue-router'
import { useI18n } from '../i18n'
import PinSensitiveMedia from './PinSensitiveMedia.vue'
import { viewerCanRevealSensitiveMedia, sensitiveMediaBlurredByDefault } from '../composables/useModeration'
import { useDataSaver } from '../composables/useDataSaver'
import { useAnchoredDropdown } from '../composables/useAnchoredDropdown'
import { usePointerOutsideDismiss } from '../composables/usePointerOutsideDismiss'
import { useAppModal } from '../composables/useAppModal'
import {
  PIN_MEDIA_ANTI_LEAK_CLASS,
  pinMediaAntiLeakImgBindings,
  pinMediaAntiLeakVideoBindings,
} from '../composables/mediaAntiLeak'

const { isPinSavePending, toggleLike, deletePin } = usePins()
const { isAuthenticated, currentUser } = useAuth()
const router = useRouter()
const { t } = useI18n()
const { showConfirm, showAlert } = useAppModal()
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
  (e: 'pin-deleted', slug: string): void
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
  const cells: GridCell[] = []
  props.pins.forEach((pin) => {
    cells.push({ kind: 'pin', pin })
  })
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

/** Menu ⋯ propriétaire (modifier / supprimer) */
const gridOwnerMenuSlug = ref<string | null>(null)
const gridOwnerMenuAnchorRef = ref<HTMLElement | null>(null)
const gridOwnerMenuFloatingRef = ref<HTMLElement | null>(null)
const gridOwnerMenuOpen = computed(() => gridOwnerMenuSlug.value !== null)

function closeGridOwnerMenu() {
  gridOwnerMenuSlug.value = null
  gridOwnerMenuAnchorRef.value = null
}

const { floatingStyles: gridOwnerMenuFloatingStyles } = useAnchoredDropdown(
  gridOwnerMenuAnchorRef,
  gridOwnerMenuFloatingRef,
  {
    open: gridOwnerMenuOpen,
    placement: 'bottom-end',
    strategy: 'fixed',
    offsetPx: 8,
  },
)

usePointerOutsideDismiss(() => [
  {
    isOpen: gridOwnerMenuOpen,
    getRoots: () => [gridOwnerMenuAnchorRef.value, gridOwnerMenuFloatingRef.value],
    close: closeGridOwnerMenu,
  },
])

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
  if (pin.isStory && usernamesMatch(currentUser.value?.username, pin.username)) return
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

function usernamesMatch(a?: string | null, b?: string | null) {
  return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()
}

function viewerOwnsPin(pin: Pin): boolean {
  return isAuthenticated.value && usernamesMatch(currentUser.value?.username, pin.username)
}

function toggleGridOwnerMenu(pin: Pin, ev: MouseEvent) {
  if (!viewerOwnsPin(pin)) return
  ev.stopPropagation()
  const target = ev.currentTarget instanceof HTMLElement ? ev.currentTarget : null
  if (!target) return
  if (gridOwnerMenuSlug.value === pin.slug) {
    closeGridOwnerMenu()
    return
  }
  gridOwnerMenuAnchorRef.value = target
  gridOwnerMenuSlug.value = pin.slug
}

function goGridOwnerEdit(slug: string) {
  closeGridOwnerMenu()
  router.push(`/pin/${slug}/edit`)
}

async function confirmDeleteGridOwnedPin(slug: string) {
  closeGridOwnerMenu()
  const ok = await showConfirm({
    title: t('pin.delete.confirmTitle'),
    message: t('pin.delete.confirmBody'),
    variant: 'danger',
  })
  if (!ok) return
  try {
    await deletePin(slug)
    emit('pin-deleted', slug)
  } catch {
    await showAlert(t('pin.delete.error'), { variant: 'danger', title: t('modal.errorTitle') })
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
  <section class="pin-grid-scope app-skeleton-wave" aria-labelledby="pin-feed-grid-heading" :aria-busy="gridBusy || undefined">
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
        class="group lux-pin-card focus-visible:outline-none"
        @click="onArticleClick(cell.pin, $event)"
        @keydown="onCardKeydown(cell.pin, $event)"
      >
        <!-- Image container : hauteur naturelle après chargement -->
        <div
          data-pin-media
          class="relative overflow-hidden rounded-3xl bg-neutral-100/90 dark:bg-neutral-800 min-h-[140px]"
          @click.stop="onPinMediaTap(cell.pin)"
          @dblclick.stop.prevent="onPinMediaDblClick(cell.pin)"
        >
          <div
            v-if="!isMediaLoaded(cell.pin.id)"
            class="aspect-[3/4] w-full animate-pulse bg-gradient-to-b from-neutral-200 via-neutral-100 to-neutral-200 dark:from-neutral-800 dark:via-neutral-700 dark:to-neutral-800"
          ></div>
          <PinSensitiveMedia
            v-if="cell.pin.imageUrl"
            :sensitive="!!cell.pin.mediaSensitiveBlur"
            :viewer-can-reveal="viewerCanRevealSensitive"
            :blur-by-default="blurSensitiveByDefault"
            :enable-client-scan="false"
            :media-url="cell.pin.imageUrl"
            media-type="image"
            wrapper-class="w-full"
          >
            <img
              :src="cell.pin.imageUrl"
              :alt="cell.pin.title ? `${cell.pin.title} — ${cell.pin.user}` : t('feed.pinImageFallback', { user: cell.pin.user })"
              :sizes="gridImageSizes"
              :fetchpriority="gridImageFetchPriority"
              decoding="async"
              :class="[
                PIN_MEDIA_ANTI_LEAK_CLASS,
                'w-full h-auto block object-cover group-hover:scale-[1.02] transition-transform duration-500 select-none',
                isMediaLoaded(cell.pin.id) ? 'opacity-100 relative z-[1]' : 'opacity-0 absolute inset-0 w-full h-full object-cover',
              ]"
              loading="lazy"
              @load="markMediaLoaded(cell.pin.id)"
              v-bind="pinMediaAntiLeakImgBindings()"
            />
          </PinSensitiveMedia>
          <PinSensitiveMedia
            v-else-if="cell.pin.storyVideoUrl"
            :sensitive="!!cell.pin.mediaSensitiveBlur"
            :viewer-can-reveal="viewerCanRevealSensitive"
            :blur-by-default="blurSensitiveByDefault"
            :enable-client-scan="false"
            :media-url="cell.pin.storyVideoUrl"
            media-type="video"
            wrapper-class="w-full"
          >
            <video
              :src="cell.pin.storyVideoUrl"
              muted
              playsinline
              :preload="storyVideoPreload"
              :class="[
                PIN_MEDIA_ANTI_LEAK_CLASS,
                'w-full h-auto block object-cover group-hover:scale-[1.02] transition-transform duration-500 select-none max-h-[480px]',
                isMediaLoaded(cell.pin.id) ? 'opacity-100 relative z-[1]' : 'opacity-0 absolute inset-0 w-full h-full object-cover',
              ]"
              @loadedmetadata="markMediaLoaded(cell.pin.id)"
              @error="markMediaLoaded(cell.pin.id)"
              v-bind="pinMediaAntiLeakVideoBindings(false)"
            />
          </PinSensitiveMedia>

          <div
            v-if="cell.pin.scheduledPublishAt"
            class="absolute top-2 left-2 z-10 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-600 to-amber-500 text-white text-[10px] font-bold tracking-wide shadow-lg shadow-amber-900/25 ring-1 ring-white/20"
          >
            {{ t('pin.scheduledBadge') }}
          </div>
          <button
            v-if="viewerOwnsPin(cell.pin)"
            type="button"
            class="absolute z-[16] flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/35 text-white shadow-lg backdrop-blur-md border border-white/15 transition-opacity duration-200 hover:bg-black/55 opacity-100 md:opacity-0 md:group-hover:opacity-100"
            :class="cell.pin.scheduledPublishAt ? 'top-10 left-3' : 'top-3 left-3'"
            :aria-expanded="gridOwnerMenuSlug === cell.pin.slug"
            aria-haspopup="menu"
            :aria-label="t('pin.ownerMenu.more')"
            @click="toggleGridOwnerMenu(cell.pin, $event)"
          >
            <span class="material-symbols-outlined text-[22px] leading-none translate-y-px pointer-events-none" aria-hidden="true">
              more_horiz
            </span>
          </button>

          <!-- Dark overlay on hover (sous les boutons, au-dessus du média) -->
          <div class="absolute inset-0 bg-gradient-to-t from-black/25 via-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-[5] pointer-events-none"></div>

          <!-- Save button -->
          <button
            v-if="isAuthenticated"
            type="button"
            :aria-pressed="cell.pin.saved"
            class="z-10 lux-btn-pin-save"
            :class="cell.pin.saved ? 'lux-btn-pin-save-saved opacity-100 translate-y-0' : ''"
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
              class="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/92 dark:bg-neutral-900/92 backdrop-blur-md text-xs font-semibold text-neutral-800 dark:text-neutral-100 shadow-xl shadow-black/10 ring-1 ring-white/60 dark:ring-neutral-700/80 hover:bg-white dark:hover:bg-neutral-800 max-w-[60%] truncate transition"
              @click.stop
            >
              <span class="material-symbols-outlined text-sm">link</span>
              <span class="truncate">{{ cell.pin.link }}</span>
            </a>
            <div v-else></div>
          </div>
        </div>

      </article>


      <!-- Placeholder masonry : même shell que les cartes pour suivre les colonnes. -->
      <div
        v-else
        class="lux-pin-skeleton-card"
        aria-hidden="true"
      >
        <div class="relative overflow-hidden rounded-3xl bg-neutral-100 dark:bg-neutral-900/80 min-h-[140px]">
          <div class="aspect-[3/4] w-full animate-pulse bg-gradient-to-b from-neutral-200 via-neutral-100 to-neutral-200 dark:from-neutral-800 dark:via-neutral-900 dark:to-neutral-800" />
        </div>
      </div>
      </template>
    </div>
    </div>

    <Teleport to="body">
      <div
        v-if="gridOwnerMenuSlug"
        ref="gridOwnerMenuFloatingRef"
        role="menu"
        class="lux-dropdown-panel"
        :style="{ ...gridOwnerMenuFloatingStyles, zIndex: 130 }"
        @pointerdown.stop
      >
        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-neutral-800 hover:bg-pink-50/60 transition-colors"
          @click="gridOwnerMenuSlug ? goGridOwnerEdit(gridOwnerMenuSlug) : null"
        >
          <span class="material-symbols-outlined text-lg text-neutral-500" aria-hidden="true">edit</span>
          {{ t('pin.ownerMenu.edit') }}
        </button>
        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-red-700 hover:bg-red-50/90 transition-colors"
          @click="gridOwnerMenuSlug ? confirmDeleteGridOwnedPin(gridOwnerMenuSlug) : null"
        >
          <span class="material-symbols-outlined text-lg" aria-hidden="true">delete</span>
          {{ t('pin.ownerMenu.delete') }}
        </button>
      </div>
    </Teleport>
  </section>
</template>
