<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import type { FeedItem, Pin, SponsoredAd } from '../types'
import { isFeedPin } from '../types'
import SponsoredContentCard from './SponsoredContentCard.vue'
import NetworkAdBanner from './NetworkAdBanner.vue'
import { useNetworkAds } from '../composables/useNetworkAds'
import { usePins } from '../composables/usePins'
import { useAuth } from '../composables/useAuth'
import { useGuestAuthGate } from '../composables/useGuestAuthGate'
import { useRouter } from 'vue-router'
import { useI18n } from '../i18n'
import PinSensitiveMedia from './PinSensitiveMedia.vue'
import { viewerCanRevealSensitiveMedia, sensitiveMediaBlurredByDefault } from '../composables/moderationPolicy'
import { useDataSaver } from '../composables/useDataSaver'
import { useAnchoredDropdown } from '../composables/useAnchoredDropdown'
import { usePointerOutsideDismiss } from '../composables/usePointerOutsideDismiss'
import { useAppModal } from '../composables/useAppModal'
import { elementToPinOverlayOriginRect, setPinOverlayOrigin } from '../utils/pinOverlayOrigin'
import {
  PIN_MEDIA_ANTI_LEAK_CLASS,
  pinMediaAntiLeakImgBindings,
  pinMediaAntiLeakVideoBindings,
} from '../composables/mediaAntiLeak'
import OfflineImg from './OfflineImg.vue'
import OfflineVideo from './OfflineVideo.vue'
import PromotePinSheet from './PromotePinSheet.vue'
import { prefetchPinsMediaForOffline } from '../media/offlineCache'
import PinVirtualGrid from './PinVirtualGrid.vue'
import {
  buildFeedMasonryCells,
  layoutMasonryShortestColumn,
  MASONRY_GAP_PX,
  MASONRY_GAP_PX_SM,
} from '../utils/masonryLayout'
import { pinGridImageSrc, pinGridImageSrcSet } from '../utils/pinMediaUrls'

/** Au-delà de ce seuil, on bascule sur la grille virtualisée (DOM stable). */
const VIRTUAL_THRESHOLD = 24

const { isPinSavePending, toggleLike, deletePin } = usePins()
const { isAuthenticated, currentUser, fetchCurrentUser } = useAuth()
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
  | { kind: 'sponsored'; ad: SponsoredAd }
  | { kind: 'network_ad'; key: string }
  | { kind: 'skeleton'; key: string }

const { showFeedAds, feedEveryN, webClientId, webFeedSlot } = useNetworkAds()

const props = withDefaults(
  defineProps<{
    pins: FeedItem[]
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
  (e: 'open-sponsored', item: SponsoredAd): void
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

const measuredHeights = ref(new Map<number, number>())

const masonryCells = computed(() =>
  buildFeedMasonryCells(props.pins, {
    showFeedAds: showFeedAds.value,
    feedEveryN: feedEveryN.value,
    skeletonCount: skeletonPlaceholders.value,
  }),
)

const useVirtualGrid = computed(() => masonryCells.value.length >= VIRTUAL_THRESHOLD)

const columns = computed(() => {
  const gap = columnCount.value >= 3 ? MASONRY_GAP_PX_SM : MASONRY_GAP_PX
  const width =
    typeof window !== 'undefined' ? Math.max(280, window.innerWidth - 24) : 360
  return layoutMasonryShortestColumn(
    masonryCells.value,
    columnCount.value,
    width,
    gap,
    measuredHeights.value,
  ).columns as GridCell[][]
})

const gridBusy = computed(
  () =>
    (props.loadingInitial && props.pins.length === 0) || props.loadingMore,
)

let prefetchDebounce: ReturnType<typeof setTimeout> | null = null
watch(
  () => props.pins,
  (pins) => {
    if (!pins?.length) return
    if (prefetchDebounce) clearTimeout(prefetchDebounce)
    prefetchDebounce = setTimeout(() => {
      prefetchPinsMediaForOffline(pins.filter(isFeedPin))
      prefetchDebounce = null
    }, 450)
  },
  { deep: true },
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

function pinOpenOriginFromEvent(e: Event): ReturnType<typeof elementToPinOverlayOriginRect> {
  const target = e.currentTarget instanceof Element ? e.currentTarget : null
  return elementToPinOverlayOriginRect(target?.closest('.lux-pin-card') ?? target)
}

function emitOpenPin(pin: Pin, originRect: ReturnType<typeof elementToPinOverlayOriginRect>) {
  setPinOverlayOrigin(pin.slug, originRect)
  emit('open-pin', pin.slug)
}

const { promptGuest } = useGuestAuthGate()

function onSavePinClick(slug: string) {
  if (!isAuthenticated.value) {
    promptGuest('save', { resourceId: slug })
    return
  }
  emit('toggle-save', slug)
}

async function doubleTapLike(pin: Pin) {
  if (!isAuthenticated.value) {
    promptGuest('like', { resourceId: pin.slug })
    return
  }
  if (pin.isStory && usernamesMatch(currentUser.value?.username, pin.username)) return
  await toggleLike(pin.slug)
}

function onPinMediaTap(pin: Pin, e: MouseEvent) {
  const originRect = pinOpenOriginFromEvent(e)
  const existing = mediaTapTimers.get(pin.id)
  if (existing) {
    clearMediaTimer(pin.id)
    void doubleTapLike(pin)
    return
  }
  const t = setTimeout(() => {
    mediaTapTimers.delete(pin.id)
    emitOpenPin(pin, originRect)
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
  emitOpenPin(pin, pinOpenOriginFromEvent(e))
}

function pinCardLabel(pin: Pin) {
  return t('pin.cardAriaLabel', { title: pin.title || pin.slug, user: pin.user })
}

function onCardKeydown(pin: Pin, ev: KeyboardEvent) {
  if (ev.key === 'Enter' || ev.key === ' ') {
    ev.preventDefault()
    emitOpenPin(pin, null)
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

const promoteSheetOpen = ref(false)
const promoteSheetSlug = ref('')
const promoteSheetMode = ref<'boost' | 'campaign'>('boost')

function openPromoteSheet(slug: string, mode: 'boost' | 'campaign' = 'boost') {
  closeGridOwnerMenu()
  promoteSheetSlug.value = slug
  promoteSheetMode.value = mode
  promoteSheetOpen.value = true
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
    /* Compteurs /me (pins_count) doivent décroître immédiatement → refresh forcé + localStorage. */
    void fetchCurrentUser({ force: true, silent: true })
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
  <PinVirtualGrid
    v-if="useVirtualGrid"
    class="pin-grid-scope w-full min-w-0 max-w-full overflow-x-hidden"
    :pins="pins"
    :loading-initial="loadingInitial"
    :loading-more="loadingMore"
    @toggle-save="(slug) => emit('toggle-save', slug)"
    @open-pin="(slug) => emit('open-pin', slug)"
    @open-sponsored="(item) => emit('open-sponsored', item)"
    @pin-deleted="(slug) => emit('pin-deleted', slug)"
  />
  <section
    v-else
    class="pin-grid-scope app-skeleton-wave w-full min-w-0 max-w-full overflow-x-hidden"
    aria-labelledby="pin-feed-grid-heading"
    :aria-busy="gridBusy || undefined"
  >
    <h2 id="pin-feed-grid-heading" class="sr-only">{{ t('feed.pinsGridHeading') }}</h2>
    <div class="flex w-full min-w-0 gap-2.5 sm:gap-4 items-start">
    <div
      v-for="(column, colIndex) in columns"
      :key="colIndex"
      role="presentation"
      class="flex-1 min-w-0 flex flex-col gap-2.5 sm:gap-4"
    >
      <template
        v-for="cell in column"
        :key="cell.kind === 'pin' ? cell.pin.id : cell.kind === 'sponsored' ? cell.ad.id : cell.key"
      >
      <SponsoredContentCard
        v-if="cell.kind === 'sponsored'"
        :item="cell.ad"
        variant="feed"
        @open-overlay="(item) => emit('open-sponsored', item)"
      />
      <NetworkAdBanner
        v-else-if="cell.kind === 'network_ad' && webClientId && webFeedSlot"
        :key="cell.key"
        :ad-key="cell.key"
        :client-id="webClientId"
        :slot-id="webFeedSlot"
        variant="feed"
      />
      <article
        v-else-if="cell.kind === 'pin'"
        tabindex="0"
        role="article"
        :aria-label="pinCardLabel(cell.pin)"
        class="group lux-pin-card focus-visible:outline-none max-w-full box-border"
        :class="cell.pin.isBoosted ? 'border-2 border-amber-400/70 dark:border-amber-500/50 shadow-[0_0_24px_rgba(245,158,11,0.25)]' : ''"
        @click="onArticleClick(cell.pin, $event)"
        @keydown="onCardKeydown(cell.pin, $event)"
      >
        <!-- Image container : hauteur naturelle après chargement -->
        <div
          data-pin-media
          class="relative overflow-hidden rounded-3xl bg-neutral-100/90 dark:bg-neutral-800"
          @click.stop="onPinMediaTap(cell.pin, $event)"
          @dblclick.stop.prevent="onPinMediaDblClick(cell.pin)"
        >
          <span
            v-if="cell.pin.isBoosted"
            class="absolute top-2 left-2 z-10 rounded-full bg-amber-500/90 text-white text-[10px] font-bold px-2 py-0.5"
          >
            {{ t('feed.pinBoosted') }}
          </span>
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
            <OfflineImg
              :src="pinGridImageSrc(cell.pin)"
              :srcset="pinGridImageSrcSet(cell.pin)"
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
            <OfflineVideo
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
            class="absolute z-[16] flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/35 text-white shadow-lg backdrop-blur-md border border-white/15 transition-opacity duration-200 hover:bg-black/55 opacity-100 pinova-focus-ring"
            :class="cell.pin.scheduledPublishAt ? 'top-10 left-3' : 'top-3 left-3'"
            :aria-expanded="gridOwnerMenuSlug === cell.pin.slug"
            aria-haspopup="menu"
            :aria-label="t('pin.ownerMenu.more')"
            @click="toggleGridOwnerMenu(cell.pin, $event)"
          >
            <PinovaIcon name="more_horiz" class="text-[22px] leading-none translate-y-px pointer-events-none" />
          </button>

          <!-- Dark overlay on hover (sous les boutons, au-dessus du média) -->
          <div class="absolute inset-0 bg-gradient-to-t from-black/25 via-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-[5] pointer-events-none"></div>

          <!-- Save button -->
          <button
            v-if="isAuthenticated"
            type="button"
            :aria-pressed="cell.pin.saved"
            :aria-label="cell.pin.saved ? t('pin.a11y.saved') : t('pin.a11y.save')"
            class="z-10 lux-btn-pin-save pinova-focus-ring"
            :class="cell.pin.saved ? 'lux-btn-pin-save-saved opacity-100 translate-y-0' : ''"
            :disabled="isSavePending(cell.pin.slug)"
            @click.stop="onSavePinClick(cell.pin.slug)"
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
              <PinovaIcon name="link" class="text-sm" />
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
        <div class="relative overflow-hidden rounded-3xl bg-neutral-100 dark:bg-neutral-900/80">
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
          class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-neutral-800 dark:text-neutral-100 hover:bg-pink-50/60 dark:hover:bg-white/[0.06] transition-colors"
          @click="gridOwnerMenuSlug ? goGridOwnerEdit(gridOwnerMenuSlug) : null"
        >
          <PinovaIcon name="edit" class="text-lg text-neutral-500 dark:text-neutral-400" />
          {{ t('pin.ownerMenu.edit') }}
        </button>
        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-neutral-800 dark:text-neutral-100 hover:bg-pink-50/60 dark:hover:bg-white/[0.06] transition-colors"
          @click="gridOwnerMenuSlug ? openPromoteSheet(gridOwnerMenuSlug, 'boost') : null"
        >
          <PinovaIcon name="rocket_launch" class="text-lg text-amber-600" />
          {{ t('pin.boost.cta') }}
        </button>
        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-red-700 dark:text-red-400 hover:bg-red-50/90 dark:hover:bg-red-950/35 transition-colors"
          @click="gridOwnerMenuSlug ? confirmDeleteGridOwnedPin(gridOwnerMenuSlug) : null"
        >
          <PinovaIcon name="delete" class="text-lg" />
          {{ t('pin.ownerMenu.delete') }}
        </button>
      </div>
    </Teleport>

    <PromotePinSheet
      :open="promoteSheetOpen"
      :pin-slug="promoteSheetSlug"
      :initial-mode="promoteSheetMode"
      @close="promoteSheetOpen = false"
    />
  </section>
</template>
