<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import type { FeedItem, Foto, SponsoredAd } from '../types'
import { isFeedFoto } from '../types'
import SponsoredContentCard from './SponsoredContentCard.vue'
import NetworkAdBanner from './NetworkAdBanner.vue'
import { useNetworkAds } from '../composables/useNetworkAds'
import { useFotos } from '../composables/useFotos'
import { useAuth } from '../composables/useAuth'
import { useGuestAuthGate } from '../composables/useGuestAuthGate'
import { useRouter } from 'vue-router'
import { useI18n } from '../i18n'
import FotoSensitiveMedia from './FotoSensitiveMedia.vue'
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
import PromoteFotoSheet from './PromoteFotoSheet.vue'
import { prefetchFotosMediaForOffline } from '../media/offlineCache'
import FotoVirtualGrid from './FotoVirtualGrid.vue'
import {
  buildFeedMasonryCells,
  layoutMasonryShortestColumn,
  MASONRY_GAP_PX,
  MASONRY_GAP_PX_SM,
} from '../utils/masonryLayout'
import { pinGridImageSrc, pinGridImageSrcSet } from '../utils/pinMediaUrls'

/** Au-delà de ce seuil, on bascule sur la grille virtualisée (DOM stable). */
const VIRTUAL_THRESHOLD = 24

const { isFotoSavePending, toggleLike, deleteFoto } = useFotos()
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
  | { kind: 'foto'; foto: Foto }
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

/** Même logique de répartition que les fotos pour que les skeletons prolongent la grille sans rupture. */
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
      prefetchFotosMediaForOffline(pins.filter(isFeedFoto))
      prefetchDebounce = null
    }, 1100)
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

const markMediaLoaded = (fotoId: number) => {
  loadedImages.value[fotoId] = true
}

const gridImageSrcOverrides = ref<Record<number, string>>({})

function effectiveGridImageSrc(foto: Foto): string {
  return gridImageSrcOverrides.value[pin.id] || pinGridImageSrc(foto)
}

function onFotoGridImageError(foto: Foto) {
  const fallback = foto.imageUrl?.trim()
  const current = effectiveGridImageSrc(foto)
  if (fallback && fallback !== current) {
    gridImageSrcOverrides.value = { ...gridImageSrcOverrides.value, [pin.id]: fallback }
    return
  }
  markMediaLoaded(pin.id)
}

const isMediaLoaded = (fotoId: number) => !!loadedImages.value[fotoId]
const isSavePending = (slug: string) => isFotoSavePending(slug)

function clearMediaTimer(fotoId: number) {
  const t = mediaTapTimers.get(fotoId)
  if (t) clearTimeout(t)
  mediaTapTimers.delete(fotoId)
}

function pinOpenOriginFromEvent(e: Event): ReturnType<typeof elementToPinOverlayOriginRect> {
  const target = e.currentTarget instanceof Element ? e.currentTarget : null
  return elementToPinOverlayOriginRect(target?.closest('.lux-foto-card') ?? target)
}

function emitOpenFoto(foto: Foto, originRect: ReturnType<typeof elementToPinOverlayOriginRect>) {
  setPinOverlayOrigin(pin.slug, originRect)
  emit('open-pin', foto.slug)
}

const { promptGuest } = useGuestAuthGate()

function onSavePinClick(slug: string) {
  if (!isAuthenticated.value) {
    promptGuest('save', { resourceId: slug })
    return
  }
  emit('toggle-save', slug)
}

async function doubleTapLike(foto: Foto) {
  if (!isAuthenticated.value) {
    promptGuest('like', { resourceId: foto.slug })
    return
  }
  if (pin.liked) return
  if (pin.isStory && usernamesMatch(currentUser.value?.username, foto.username)) return
  await toggleLike(pin.slug)
}

function onPinMediaTap(foto: Foto, e: MouseEvent) {
  const originRect = pinOpenOriginFromEvent(e)
  const existing = mediaTapTimers.get(pin.id)
  if (existing) {
    clearMediaTimer(pin.id)
    void doubleTapLike(foto)
    return
  }
  const t = setTimeout(() => {
    mediaTapTimers.delete(pin.id)
    emitOpenFoto(pin, originRect)
  }, 320)
  mediaTapTimers.set(pin.id, t)
}

function onPinMediaDblClick(foto: Foto) {
  clearMediaTimer(pin.id)
  void doubleTapLike(foto)
}

function onArticleClick(foto: Foto, e: MouseEvent) {
  const el = e.target as HTMLElement | null
  if (el?.closest('[data-foto-media]')) return
  emitOpenFoto(pin, pinOpenOriginFromEvent(e))
}

function pinCardLabel(foto: Foto) {
  return t('foto.cardAriaLabel', { title: foto.title || foto.slug, user: foto.user })
}

function onCardKeydown(foto: Foto, ev: KeyboardEvent) {
  if (ev.key === 'Enter' || ev.key === ' ') {
    ev.preventDefault()
    emitOpenFoto(pin, null)
  }
}

function usernamesMatch(a?: string | null, b?: string | null) {
  return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()
}

function viewerOwnsFoto(foto: Foto): boolean {
  return isAuthenticated.value && usernamesMatch(currentUser.value?.username, foto.username)
}

function toggleGridOwnerMenu(foto: Foto, ev: MouseEvent) {
  if (!viewerOwnsFoto(foto)) return
  ev.stopPropagation()
  const target = ev.currentTarget instanceof HTMLElement ? ev.currentTarget : null
  if (!target) return
  if (gridOwnerMenuSlug.value === foto.slug) {
    closeGridOwnerMenu()
    return
  }
  gridOwnerMenuAnchorRef.value = target
  gridOwnerMenuSlug.value = foto.slug
}

function goGridOwnerEdit(slug: string) {
  closeGridOwnerMenu()
  router.push(`/foto/${slug}/edit`)
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

async function confirmDeleteGridOwnedFoto(slug: string) {
  closeGridOwnerMenu()
  const ok = await showConfirm({
    title: t('foto.delete.confirmTitle'),
    message: t('foto.delete.confirmBody'),
    variant: 'danger',
  })
  if (!ok) return
  try {
    await deleteFoto(slug)
    /* Compteurs /me (pins_count) doivent décroître immédiatement → refresh forcé + localStorage. */
    void fetchCurrentUser({ force: true, silent: true })
    emit('pin-deleted', slug)
  } catch {
    await showAlert(t('foto.delete.error'), { variant: 'danger', title: t('modal.errorTitle') })
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
  <FotoVirtualGrid
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
        :key="cell.kind === 'foto' ? cell.foto.id : cell.kind === 'sponsored' ? cell.ad.id : cell.key"
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
        v-else-if="cell.kind === 'foto'"
        tabindex="0"
        role="article"
        :aria-label="pinCardLabel(cell.foto)"
        class="group lux-foto-card focus-visible:outline-none max-w-full box-border"
        :class="cell.foto.isBoosted ? 'border-2 border-amber-400/70 dark:border-amber-500/50 shadow-[0_0_24px_rgba(245,158,11,0.25)]' : ''"
        @click="onArticleClick(cell.pin, $event)"
        @keydown="onCardKeydown(cell.pin, $event)"
      >
        <!-- Image container : hauteur naturelle après chargement -->
        <div
          data-foto-media
          class="relative overflow-hidden rounded-3xl bg-neutral-100/90 dark:bg-neutral-800"
          @click.stop="onPinMediaTap(cell.pin, $event)"
          @dblclick.stop.prevent="onPinMediaDblClick(cell.foto)"
        >
          <span
            v-if="cell.foto.isBoosted"
            class="absolute top-2 left-2 z-10 rounded-full bg-amber-500/90 text-white text-[10px] font-bold px-2 py-0.5"
          >
            {{ t('feed.pinBoosted') }}
          </span>
          <div
            v-if="!isMediaLoaded(cell.foto.id)"
            class="aspect-[3/4] w-full animate-pulse bg-gradient-to-b from-neutral-200 via-neutral-100 to-neutral-200 dark:from-neutral-800 dark:via-neutral-700 dark:to-neutral-800"
          ></div>
          <FotoSensitiveMedia
            v-if="cell.foto.imageUrl || cell.foto.feedImageUrl"
            :sensitive="!!cell.foto.mediaSensitiveBlur"
            :viewer-can-reveal="viewerCanRevealSensitive"
            :blur-by-default="blurSensitiveByDefault"
            :enable-client-scan="false"
            :media-url="cell.foto.imageUrl || cell.foto.feedImageUrl || ''"
            media-type="image"
            wrapper-class="w-full"
          >
            <OfflineImg
              :src="effectiveGridImageSrc(cell.foto)"
              :srcset="pinGridImageSrcSet(cell.foto)"
              :alt="cell.foto.title ? `${cell.foto.title} — ${cell.foto.user}` : t('feed.pinImageFallback', { user: cell.foto.user })"
              :sizes="gridImageSizes"
              :fetchpriority="gridImageFetchPriority"
              decoding="async"
              :class="[
                PIN_MEDIA_ANTI_LEAK_CLASS,
                'w-full h-auto block object-cover group-hover:scale-[1.02] transition-transform duration-500 select-none',
                isMediaLoaded(cell.foto.id) ? 'opacity-100 relative z-[1]' : 'opacity-0 absolute inset-0 w-full h-full object-cover',
              ]"
              loading="lazy"
              @load="markMediaLoaded(cell.foto.id)"
              @error="onFotoGridImageError(cell.foto)"
              v-bind="pinMediaAntiLeakImgBindings()"
            />
          </FotoSensitiveMedia>
          <FotoSensitiveMedia
            v-else-if="cell.foto.storyVideoUrl"
            :sensitive="!!cell.foto.mediaSensitiveBlur"
            :viewer-can-reveal="viewerCanRevealSensitive"
            :blur-by-default="blurSensitiveByDefault"
            :enable-client-scan="false"
            :media-url="cell.foto.storyVideoUrl"
            media-type="video"
            wrapper-class="w-full"
          >
            <OfflineVideo
              :src="cell.foto.storyVideoUrl"
              muted
              playsinline
              :preload="storyVideoPreload"
              :class="[
                PIN_MEDIA_ANTI_LEAK_CLASS,
                'w-full h-auto block object-cover group-hover:scale-[1.02] transition-transform duration-500 select-none max-h-[480px]',
                isMediaLoaded(cell.foto.id) ? 'opacity-100 relative z-[1]' : 'opacity-0 absolute inset-0 w-full h-full object-cover',
              ]"
              @loadedmetadata="markMediaLoaded(cell.foto.id)"
              @error="markMediaLoaded(cell.foto.id)"
              v-bind="pinMediaAntiLeakVideoBindings(false)"
            />
          </FotoSensitiveMedia>

          <div
            v-if="cell.foto.scheduledPublishAt"
            class="absolute top-2 left-2 z-10 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-600 to-amber-500 text-white text-[10px] font-bold tracking-wide shadow-lg shadow-amber-900/25 ring-1 ring-white/20"
          >
            {{ t('foto.scheduledBadge') }}
          </div>
          <button
            v-if="viewerOwnsFoto(cell.foto)"
            type="button"
            class="absolute z-[16] flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/35 text-white shadow-lg backdrop-blur-md border border-white/15 transition-opacity duration-200 hover:bg-black/55 opacity-100 fotoce-focus-ring"
            :class="cell.foto.scheduledPublishAt ? 'top-10 left-3' : 'top-3 left-3'"
            :aria-expanded="gridOwnerMenuSlug === cell.foto.slug"
            aria-haspopup="menu"
            :aria-label="t('foto.ownerMenu.more')"
            @click="toggleGridOwnerMenu(cell.pin, $event)"
          >
            <FotoceIcon name="more_horiz" class="text-[22px] leading-none translate-y-px pointer-events-none" />
          </button>

          <!-- Dark overlay on hover (sous les boutons, au-dessus du média) -->
          <div class="absolute inset-0 bg-gradient-to-t from-black/25 via-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-[5] pointer-events-none"></div>

          <!-- Save button -->
          <button
            v-if="isAuthenticated"
            type="button"
            :aria-pressed="cell.foto.saved"
            :aria-label="cell.foto.saved ? t('foto.a11y.saved') : t('foto.a11y.save')"
            class="z-10 lux-btn-foto-save fotoce-focus-ring"
            :class="cell.foto.saved ? 'lux-btn-foto-save-saved opacity-100 translate-y-0' : ''"
            :disabled="isSavePending(cell.foto.slug)"
            @click.stop="onSavePinClick(cell.foto.slug)"
          >
            <span v-if="isSavePending(cell.foto.slug)" class="w-4 h-4 inline-block border-2 border-current border-t-transparent rounded-full animate-spin"></span>
            <span v-else>{{ cell.foto.saved ? t('foto.saved') : t('foto.save') }}</span>
          </button>

          <!-- Bottom actions on hover -->
          <div class="absolute bottom-3 left-3 right-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
            <!-- Link badge -->
            <a
              v-if="cell.foto.link"
              :href="cell.foto.link.startsWith('http') ? cell.foto.link : 'https://' + cell.foto.link"
              target="_blank"
              class="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/92 dark:bg-neutral-900/92 backdrop-blur-md text-xs font-semibold text-neutral-800 dark:text-neutral-100 shadow-xl shadow-black/10 ring-1 ring-white/60 dark:ring-neutral-700/80 hover:bg-white dark:hover:bg-neutral-800 max-w-[60%] truncate transition"
              @click.stop
            >
              <FotoceIcon name="link" class="text-sm" />
              <span class="truncate">{{ cell.foto.link }}</span>
            </a>
            <div v-else></div>
          </div>
        </div>

      </article>


      <!-- Placeholder masonry : même shell que les cartes pour suivre les colonnes. -->
      <div
        v-else
        class="lux-foto-skeleton-card"
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
          <FotoceIcon name="edit" class="text-lg text-neutral-500 dark:text-neutral-400" />
          {{ t('foto.ownerMenu.edit') }}
        </button>
        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-neutral-800 dark:text-neutral-100 hover:bg-pink-50/60 dark:hover:bg-white/[0.06] transition-colors"
          @click="gridOwnerMenuSlug ? openPromoteSheet(gridOwnerMenuSlug, 'boost') : null"
        >
          <FotoceIcon name="rocket_launch" class="text-lg text-amber-600" />
          {{ t('foto.boost.cta') }}
        </button>
        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-red-700 dark:text-red-400 hover:bg-red-50/90 dark:hover:bg-red-950/35 transition-colors"
          @click="gridOwnerMenuSlug ? confirmDeleteGridOwnedFoto(gridOwnerMenuSlug) : null"
        >
          <FotoceIcon name="delete" class="text-lg" />
          {{ t('foto.ownerMenu.delete') }}
        </button>
      </div>
    </Teleport>

    <PromoteFotoSheet
      :open="promoteSheetOpen"
      :pin-slug="promoteSheetSlug"
      :initial-mode="promoteSheetMode"
      @close="promoteSheetOpen = false"
    />
  </section>
</template>
