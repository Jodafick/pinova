<script setup lang="ts">
/**
 * FotoVirtualGrid — feed masonry virtualisé (colonne la plus courte).
 *
 * - DOM minimal : seuls les items proches du viewport sont montés
 * - Scroll root Fotoce (#main-content mobile, document desktop)
 * - Pins, contenus sponsorisés, bannières réseau
 * - Vidéos : lecture uniquement en viewport, preload minimal
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { FeedItem, Foto, SponsoredAd } from '../types'
import { isFeedFoto } from '../types'
import SponsoredContentCard from './SponsoredContentCard.vue'
import NetworkAdBanner from './NetworkAdBanner.vue'
import { useNetworkAds } from '../composables/useNetworkAds'
import { useFotos } from '../composables/useFotos'
import { useAuth } from '../composables/useAuth'
import { useGuestAuthGate } from '../composables/useGuestAuthGate'
import { useI18n } from '../i18n'
import { useDataSaver } from '../composables/useDataSaver'
import { useImagePreheat } from '../composables/useImagePreheat'
import {
  PIN_MEDIA_ANTI_LEAK_CLASS,
  pinMediaAntiLeakImgBindings,
  pinMediaAntiLeakVideoBindings,
} from '../composables/mediaAntiLeak'
import FotoSensitiveMedia from './FotoSensitiveMedia.vue'
import OfflineImg from './OfflineImg.vue'
import OfflineVideo from './OfflineVideo.vue'
import { viewerCanRevealSensitiveMedia, sensitiveMediaBlurredByDefault } from '../composables/moderationPolicy'
import { elementToPinOverlayOriginRect, setPinOverlayOrigin } from '../utils/pinOverlayOrigin'
import {
  buildFeedMasonryCells,
  columnCountForViewport,
  MASONRY_GAP_PX,
  type MasonryCell,
} from '../utils/masonryLayout'
import { useMasonryScrollVirtual } from '../composables/useMasonryScrollVirtual'
import { pinGridImageSrc, pinGridImageSrcSet } from '../utils/pinMediaUrls'
import { prefetchFotosMediaForOffline } from '../media/offlineCache'
import { FOTOCE_FEED_KEYBOARD_SCROLL } from '../navigation/inputAbstraction'

const props = withDefaults(
  defineProps<{
    pins: FeedItem[]
    loadingInitial?: boolean
    loadingMore?: boolean
    overscanPx?: number
  }>(),
  {
    loadingInitial: false,
    loadingMore: false,
    overscanPx: 480,
  },
)

const emit = defineEmits<{
  (e: 'toggle-save', slug: string): void
  (e: 'open-pin', slug: string): void
  (e: 'open-sponsored', item: SponsoredAd): void
  (e: 'pin-deleted', slug: string): void
}>()

const { t } = useI18n()
const { isAuthenticated, currentUser } = useAuth()
const { promptGuest } = useGuestAuthGate()
const { isFotoSavePending, toggleLike } = useFotos()
const { gridImageFetchPriority, gridImageSizes, storyVideoPreload } = useDataSaver()
const { showFeedAds, feedEveryN, webClientId, webFeedSlot } = useNetworkAds()

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

const columnCount = ref(2)
const gridRef = shallowRef<HTMLElement | null>(null)
const measuredHeights = ref(new Map<number, number>())
const mediaTapTimers = new Map<number, ReturnType<typeof setTimeout>>()

function updateColumnCount() {
  columnCount.value = columnCountForViewport(window.innerWidth)
}

const skeletonCount = computed(() => {
  const n = columnCount.value
  if (props.loadingInitial && props.pins.length === 0) return Math.max(n * 5, 12)
  if (props.loadingMore) return Math.max(n * 2, 6)
  return 0
})

const masonryCells = computed(() =>
  buildFeedMasonryCells(props.pins, {
    showFeedAds: showFeedAds.value,
    feedEveryN: feedEveryN.value,
    skeletonCount: skeletonCount.value,
  }),
)

const { visibleItems, totalHeight, scrollMargin, syncScroll } = useMasonryScrollVirtual({
  cells: masonryCells,
  columnCount,
  containerRef: gridRef,
  overscanPx: props.overscanPx,
  measuredHeights,
})

const { preheatMany } = useImagePreheat()

watch(visibleItems, (items) => {
  if (!items.length) return
  const urls: string[] = []
  items.forEach((vi) => {
    if (vi.cell.kind === 'foto' && vi.cell.foto.imageUrl) {
      urls.push(pinGridImageSrc(vi.cell.foto))
    }
  })
  preheatMany(urls)
})

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

function estimatePinHeight() {
  const w = gridRef.value?.clientWidth || window.innerWidth - 24
  const colW = (w - MASONRY_GAP_PX * (columnCount.value - 1)) / columnCount.value
  return colW * (4 / 3)
}

function onFeedKeyboardScroll(e: Event) {
  const ce = e as CustomEvent<{ delta?: number }>
  const delta = ce.detail?.delta ?? 0
  if (!delta) return
  const root = document.getElementById('main-content') ?? document.documentElement
  const step = estimatePinHeight() * Math.max(1, columnCount.value) * 0.45
  root.scrollBy({ top: delta * step, behavior: 'smooth' })
}

onMounted(() => {
  updateColumnCount()
  window.addEventListener('resize', updateColumnCount, { passive: true })
  window.addEventListener(FOTOCE_FEED_KEYBOARD_SCROLL, onFeedKeyboardScroll as EventListener)
  void syncScroll()
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', updateColumnCount)
  window.removeEventListener(FOTOCE_FEED_KEYBOARD_SCROLL, onFeedKeyboardScroll as EventListener)
  mediaTapTimers.forEach((tid) => clearTimeout(tid))
  mediaTapTimers.clear()
})

function cardWidthStyle(lane: number) {
  const n = columnCount.value
  const gap = MASONRY_GAP_PX
  return {
    width: `calc(${100 / n}% - ${gap * (n - 1) / n}px)`,
    left: `calc(${(lane / n) * 100}% + ${lane * gap / n}px)`,
  }
}

function onCardMeasured(cellIndex: number, el: HTMLElement | null) {
  if (!el) return
  const h = el.offsetHeight
  if (h < 40) return
  const prev = measuredHeights.value.get(cellIndex)
  if (prev != null && Math.abs(prev - h) < 6) return
  const next = new Map(measuredHeights.value)
  next.set(cellIndex, h)
  measuredHeights.value = next
}

function isSavePending(slug: string) {
  return isFotoSavePending(slug)
}

function pinCardLabel(foto: Foto) {
  return t('foto.cardAriaLabel', { title: foto.title || foto.slug, user: foto.user })
}

function emitOpenFoto(foto: Foto, originEl?: Element | null) {
  setPinOverlayOrigin(pin.slug, elementToPinOverlayOriginRect(originEl ?? null))
  emit('open-pin', foto.slug)
}

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
  await toggleLike(pin.slug)
}

function onPinMediaTap(foto: Foto, _e: MouseEvent, originEl: Element) {
  const existing = mediaTapTimers.get(pin.id)
  if (existing) {
    clearTimeout(existing)
    mediaTapTimers.delete(pin.id)
    void doubleTapLike(foto)
    return
  }
  const timer = setTimeout(() => {
    mediaTapTimers.delete(pin.id)
    emitOpenFoto(pin, originEl)
  }, 320)
  mediaTapTimers.set(pin.id, timer)
}

function onPinMediaDblClick(foto: Foto) {
  const t = mediaTapTimers.get(pin.id)
  if (t) clearTimeout(t)
  mediaTapTimers.delete(pin.id)
  void doubleTapLike(foto)
}

/* Vidéos feed : play en viewport uniquement */
const videoEls = new Map<number, HTMLVideoElement>()
let videoObserver: IntersectionObserver | null = null

function masonryFoto(cell: MasonryCell): Foto | null {
  return cell.kind === 'foto' ? cell.pin : null
}

function observeVideo(fotoId: number, comp: { videoEl?: { value: HTMLVideoElement | null } } | null) {
  const el = comp?.videoEl?.value ?? null
  if (!el) {
    videoEls.delete(fotoId)
    return
  }
  videoEls.set(fotoId, el)
  videoObserver?.observe(el)
}

onMounted(() => {
  if (typeof IntersectionObserver === 'undefined') return
  videoObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const v = entry.target as HTMLVideoElement
        if (entry.isIntersecting && entry.intersectionRatio >= 0.35) {
          void v.play().catch(() => undefined)
        } else {
          v.pause()
        }
      })
    },
    { threshold: [0, 0.35, 0.6] },
  )
  videoEls.forEach((el) => videoObserver?.observe(el))
})
onBeforeUnmount(() => {
  videoObserver?.disconnect()
  videoObserver = null
  videoEls.clear()
})
</script>

<template>
  <section
    ref="gridRef"
    class="pin-virtual-grid pin-grid-scope app-skeleton-wave w-full min-w-0 max-w-full overflow-x-hidden"
    aria-labelledby="pin-virtual-grid-heading"
    :aria-busy="(loadingInitial && fotos.length === 0) || loadingMore || undefined"
    :style="{ height: `${totalHeight}px`, position: 'relative' }"
  >
    <h2 id="pin-virtual-grid-heading" class="sr-only">{{ t('feed.pinsGridHeading') }}</h2>

    <div
      v-for="vi in visibleItems"
      :key="`${vi.cellIndex}-${vi.lane}-${vi.cell.kind}`"
      class="pin-virtual-grid__item absolute top-0"
      :style="{
        ...cardWidthStyle(vi.lane),
        transform: `translate3d(0, ${vi.top - scrollMargin}px, 0)`,
      }"
    >
      <SponsoredContentCard
        v-if="vi.cell.kind === 'sponsored'"
        :item="vi.cell.ad"
        variant="feed"
        @open-overlay="(item) => emit('open-sponsored', item)"
      />
      <NetworkAdBanner
        v-else-if="vi.cell.kind === 'network_ad' && webClientId && webFeedSlot"
        :ad-key="vi.cell.key"
        :client-id="webClientId"
        :slot-id="webFeedSlot"
        variant="feed"
      />
      <template v-else-if="vi.cell.kind === 'foto'">
      <article
        :ref="(el) => onCardMeasured(vi.cellIndex, el as HTMLElement | null)"
        tabindex="0"
        role="article"
        :aria-label="pinCardLabel(vi.cell.foto)"
        class="group lux-foto-card focus-visible:outline-none max-w-full box-border"
        :class="vi.cell.foto.isBoosted ? 'border-2 border-amber-400/70 dark:border-amber-500/50 shadow-[0_0_24px_rgba(245,158,11,0.25)]' : ''"
        @click="emitOpenFoto(vi.cell.pin, $event.currentTarget as Element)"
        @keydown.enter.prevent="emitOpenFoto(vi.cell.pin, $event.currentTarget as Element)"
        @keydown.space.prevent="emitOpenFoto(vi.cell.pin, $event.currentTarget as Element)"
      >
        <div
          data-foto-media
          class="relative overflow-hidden rounded-3xl bg-neutral-100/90 dark:bg-neutral-800"
          @click.stop="onPinMediaTap(vi.cell.pin, $event, $event.currentTarget as Element)"
          @dblclick.stop.prevent="onPinMediaDblClick(vi.cell.foto)"
        >
          <span
            v-if="vi.cell.foto.isBoosted"
            class="absolute top-2 left-2 z-10 rounded-full bg-amber-500/90 text-white text-[10px] font-bold px-2 py-0.5"
          >
            {{ t('feed.pinBoosted') }}
          </span>
          <FotoSensitiveMedia
            v-if="vi.cell.foto.imageUrl || vi.cell.foto.feedImageUrl"
            :sensitive="!!vi.cell.foto.mediaSensitiveBlur"
            :viewer-can-reveal="viewerCanRevealSensitive"
            :blur-by-default="blurSensitiveByDefault"
            :enable-client-scan="false"
            :media-url="vi.cell.foto.imageUrl || vi.cell.foto.feedImageUrl || ''"
            media-type="image"
            wrapper-class="w-full"
          >
            <OfflineImg
              :src="pinGridImageSrc(vi.cell.foto)"
              :srcset="pinGridImageSrcSet(vi.cell.foto)"
              :alt="vi.cell.foto.title ? `${vi.cell.foto.title} — ${vi.cell.foto.user}` : t('feed.pinImageFallback', { user: vi.cell.foto.user })"
              :sizes="gridImageSizes"
              :fetchpriority="vi.cellIndex < columnCount * 2 ? 'high' : gridImageFetchPriority"
              decoding="async"
              loading="lazy"
              :class="[PIN_MEDIA_ANTI_LEAK_CLASS, 'w-full h-auto block object-cover select-none']"
              v-bind="pinMediaAntiLeakImgBindings()"
            />
          </FotoSensitiveMedia>
          <FotoSensitiveMedia
            v-else-if="vi.cell.foto.storyVideoUrl"
            :sensitive="!!vi.cell.foto.mediaSensitiveBlur"
            :viewer-can-reveal="viewerCanRevealSensitive"
            :blur-by-default="blurSensitiveByDefault"
            :enable-client-scan="false"
            :media-url="vi.cell.foto.storyVideoUrl"
            media-type="video"
            wrapper-class="w-full"
          >
            <OfflineVideo
              :ref="(el) => { const p = masonryFoto(vi.cell); if (p) observeVideo(p.id, el as { videoEl?: { value: HTMLVideoElement | null } } | null) }"
              :src="vi.cell.foto.storyVideoUrl"
              muted
              playsinline
              loop
              :preload="storyVideoPreload"
              :class="[PIN_MEDIA_ANTI_LEAK_CLASS, 'w-full h-auto block object-cover select-none max-h-[480px]']"
              v-bind="pinMediaAntiLeakVideoBindings(false)"
            />
          </FotoSensitiveMedia>
          <button
            v-if="isAuthenticated"
            type="button"
            :aria-pressed="vi.cell.foto.saved"
            class="z-10 lux-btn-foto-save fotoce-focus-ring"
            :class="vi.cell.foto.saved ? 'lux-btn-foto-save-saved opacity-100 translate-y-0' : ''"
            :disabled="isSavePending(vi.cell.foto.slug)"
            @click.stop="onSavePinClick(vi.cell.foto.slug)"
          >
            <span v-if="isSavePending(vi.cell.foto.slug)" class="w-4 h-4 inline-block border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span v-else>{{ vi.cell.foto.saved ? t('foto.saved') : t('foto.save') }}</span>
          </button>
        </div>
      </article>
      </template>
      <div
        v-else
        :ref="(el) => onCardMeasured(vi.cellIndex, el as HTMLElement | null)"
        class="lux-foto-skeleton-card"
        aria-hidden="true"
      >
        <div class="relative overflow-hidden rounded-3xl bg-neutral-100 dark:bg-neutral-900/80">
          <div class="aspect-[3/4] w-full animate-pulse bg-gradient-to-b from-neutral-200 via-neutral-100 to-neutral-200 dark:from-neutral-800 dark:via-neutral-900 dark:to-neutral-800" />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pin-virtual-grid {
  contain: layout style;
}

.pin-virtual-grid__item {
  will-change: transform;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
</style>
