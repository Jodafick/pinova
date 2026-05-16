<script setup lang="ts">
/**
 * PinVirtualGrid — version virtualisée du PinGrid via @tanstack/vue-virtual.
 *
 * Caractéristiques :
 *  - Masonry multi-colonnes (2 / 3 / 4 / 5 selon viewport)
 *  - DOM minimal : seuls les pins visibles + overscan sont montés
 *  - Hauteurs estimées par pin (depuis ratio API, sinon estimation 4:3)
 *  - Scroll fluide grâce à la window virtualization (scroll natif page)
 *  - Préchauffage des images proches du viewport via useImagePreheat
 *  - Memory safety : démontage automatique des images hors viewport via la
 *    virtualisation, plus eviction LRU du cache de preheat
 *  - Double-tap like + haptic burst (LikeHeartBurst singleton injecté)
 *  - Long-press menu contextuel (PinContextualMenu)
 *  - Skeleton fin de feed (matchs exactement la taille des cards)
 *
 * Pour les listes courtes (< 24 pins), garder `PinGrid.vue` (plus simple).
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useWindowVirtualizer } from '@tanstack/vue-virtual'
import type { Pin } from '../types'
import { useAuth } from '../composables/useAuth'
import { useRouter } from 'vue-router'
import { useI18n } from '../i18n'
import { usePins } from '../composables/usePins'
import { useDataSaver } from '../composables/useDataSaver'
import { useImagePreheat } from '../composables/useImagePreheat'
import { emitMicroFeedback } from '../composables/useMicroFeedback'
import {
  PIN_MEDIA_ANTI_LEAK_CLASS,
  pinMediaAntiLeakImgBindings,
  pinMediaAntiLeakVideoBindings,
} from '../composables/mediaAntiLeak'
import PinSensitiveMedia from './PinSensitiveMedia.vue'
import LikeHeartBurst from './LikeHeartBurst.vue'
import { openPinContextualMenu } from '../composables/usePinContextualMenu'
import { viewerCanRevealSensitiveMedia, sensitiveMediaBlurredByDefault } from '../composables/useModeration'
import { elementToPinOverlayOriginRect, setPinOverlayOrigin } from '../utils/pinOverlayOrigin'
import { PINOVA_FEED_KEYBOARD_SCROLL } from '../navigation/inputAbstraction'

const props = withDefaults(
  defineProps<{
    pins: Pin[]
    loadingInitial?: boolean
    loadingMore?: boolean
    overscanPx?: number
    disablePremiumInteractions?: boolean
  }>(),
  {
    loadingInitial: false,
    loadingMore: false,
    overscanPx: 600,
    disablePremiumInteractions: false,
  },
)

const emit = defineEmits<{
  (e: 'toggle-save', slug: string): void
  (e: 'open-pin', slug: string): void
  (e: 'like', slug: string): void
  (e: 'pin-deleted', slug: string): void
}>()

const { t } = useI18n()
const { isAuthenticated, currentUser } = useAuth()
const { isPinSavePending, toggleLike } = usePins()
const router = useRouter()
const { gridImageFetchPriority, gridImageSizes, storyVideoPreload } = useDataSaver()

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

/* ─────────────────────── Layout : nombre de colonnes ─────────────────────── */

const columnCount = ref(2)
const GAP = 12

function updateColumnCount() {
  const w = window.innerWidth
  if (w >= 1280) columnCount.value = 5
  else if (w >= 1024) columnCount.value = 4
  else if (w >= 640) columnCount.value = 3
  else columnCount.value = 2
}

const gridRef = shallowRef<HTMLElement | null>(null)
const scrollMargin = ref(0)

function estimatePinHeight(): number {
  const colCount = columnCount.value || 2
  const containerW = typeof window !== 'undefined' ? Math.max(280, window.innerWidth - 24) : 360
  const colWidth = (containerW - GAP * (colCount - 1)) / colCount
  const mediaH = colWidth * 1.33
  return mediaH + 44
}

function recomputeScrollMargin() {
  const el = gridRef.value
  if (!el) {
    scrollMargin.value = 0
    return
  }
  const rect = el.getBoundingClientRect()
  scrollMargin.value = rect.top + window.scrollY
}

function onFeedKeyboardScroll(e: Event) {
  const ce = e as CustomEvent<{ delta?: number }>
  const delta = ce.detail?.delta ?? 0
  if (!delta) return
  const step = estimatePinHeight() * Math.max(1, columnCount.value) * 0.45
  window.scrollBy({ top: delta * step, behavior: 'smooth' })
}

onMounted(() => {
  updateColumnCount()
  window.addEventListener('resize', updateColumnCount, { passive: true })
  window.addEventListener(PINOVA_FEED_KEYBOARD_SCROLL, onFeedKeyboardScroll as EventListener)
  recomputeScrollMargin()
  window.addEventListener('resize', recomputeScrollMargin, { passive: true })
  window.addEventListener('scroll', recomputeScrollMargin, { passive: true })
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', updateColumnCount)
  window.removeEventListener(PINOVA_FEED_KEYBOARD_SCROLL, onFeedKeyboardScroll as EventListener)
  window.removeEventListener('resize', recomputeScrollMargin)
  window.removeEventListener('scroll', recomputeScrollMargin)
})

const virtualizer = useWindowVirtualizer(
  computed(() => ({
    count: props.pins.length,
    estimateSize: () => estimatePinHeight(),
    lanes: columnCount.value,
    overscan: 6,
    gap: GAP,
    scrollMargin: scrollMargin.value,
  })),
)

const virtualItems = computed(() => virtualizer.value.getVirtualItems())
const totalSize = computed(() => virtualizer.value.getTotalSize())

watch(columnCount, () => {
  virtualizer.value.measure()
})

/* ─────────────────────── Image preheat ─────────────────────── */

const { preheatMany } = useImagePreheat({ maxCache: 80, concurrency: 3 })

watch(virtualItems, (items) => {
  if (items.length === 0) return
  const lastIndex = items[items.length - 1].index
  const toPreheat: string[] = []
  for (let i = lastIndex + 1; i < Math.min(props.pins.length, lastIndex + 13); i += 1) {
    const p = props.pins[i]
    if (!p) continue
    if (p.imageUrl) toPreheat.push(p.imageUrl)
  }
  preheatMany(toPreheat)
})

/* ─────────────────────── Interactions premium ─────────────────────── */

const heartBurstRef = ref<InstanceType<typeof LikeHeartBurst> | null>(null)

function isOwnedStory(pin: Pin): boolean {
  if (!pin.isStory) return false
  return (currentUser.value?.username ?? '').trim().toLowerCase() === (pin.username ?? '').trim().toLowerCase()
}

function onSavePinClick(slug: string) {
  emitMicroFeedback('save')
  emit('toggle-save', slug)
}

async function performLike(pin: Pin, point: { x: number; y: number }) {
  if (!isAuthenticated.value) {
    router.push('/login')
    return
  }
  if (isOwnedStory(pin)) return
  heartBurstRef.value?.burstAt(point)
  emitMicroFeedback('like')
  emit('like', pin.slug)
  try {
    await toggleLike(pin.slug)
  } catch (e) {
    console.warn('[PinVirtualGrid] toggleLike error', e)
  }
}

function performOpen(pin: Pin, originEl?: Element | null) {
  setPinOverlayOrigin(pin.slug, elementToPinOverlayOriginRect(originEl ?? null))
  emit('open-pin', pin.slug)
}

/** Carte réutilisée par la virtualisation : toujours résoudre le pin depuis le slug DOM courant. */
function resolvePinFromCard(cardEl: HTMLElement): Pin | undefined {
  const slug = cardEl.dataset.pinSlug?.trim()
  if (!slug) return undefined
  return props.pins.find((p) => p.slug === slug)
}

function openContextMenu(pin: Pin, point: { x: number; y: number }) {
  const items = [
    { id: 'open',  label: t('pin.contextual.open'),  icon: 'open_in_new' },
    { id: 'save',  label: pin.saved ? t('pin.saved') : t('pin.save'), icon: pin.saved ? 'bookmark' : 'bookmark_add' },
    { id: 'share', label: t('pin.contextual.share'), icon: 'share' },
  ]
  openPinContextualMenu({
    point,
    items,
    onSelect: (id) => {
      if (id === 'open') performOpen(pin, null)
      else if (id === 'save') {
        emitMicroFeedback('save')
        emit('toggle-save', pin.slug)
      }
      else if (id === 'share' && typeof navigator !== 'undefined' && 'share' in navigator) {
        const url = `${window.location.origin}/pin/${pin.slug}`
        void (navigator as Navigator & { share: (data: ShareData) => Promise<void> })
          .share({ title: pin.title || 'Pinova', url })
          .catch(() => undefined)
      }
    },
  })
}

/* ─────────────────────── Attachement listeners par card ─────────────────────── */

interface CardBinding {
  el: HTMLElement
  onPointerUp: (e: PointerEvent) => void
  onPointerDown: (e: PointerEvent) => void
  onPointerMove: (e: PointerEvent) => void
  onPointerCancel: () => void
  onContextMenu: (e: MouseEvent) => void
  longPressTimer: ReturnType<typeof setTimeout> | null
  firstTap: { x: number; y: number; time: number } | null
  singleTapTimer: ReturnType<typeof setTimeout> | null
}

/* On utilise UNIQUEMENT un WeakMap : quand le node est démonté par Vue
   (virtualisation), ses listeners disparaissent avec lui et l'entrée du
   WeakMap est GC. Cela évite toute fuite mémoire malgré le scroll infini. */
const bindings = new WeakMap<HTMLElement, CardBinding>()

const DOUBLE_TAP_DELAY = 280
const DOUBLE_TAP_DISTANCE = 16
const LONG_PRESS_DELAY = 420
const LONG_PRESS_DRIFT = 8

function bindInteractions(el: HTMLElement | null) {
  if (!el || props.disablePremiumInteractions) return
  if (bindings.has(el)) return /* déjà attaché. */

  const binding: CardBinding = {
    el,
    onPointerUp: () => undefined,
    onPointerDown: () => undefined,
    onPointerMove: () => undefined,
    onPointerCancel: () => undefined,
    onContextMenu: () => undefined,
    longPressTimer: null,
    firstTap: null,
    singleTapTimer: null,
  }

  binding.onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const startX = e.clientX
    const startY = e.clientY
    binding.longPressTimer = setTimeout(() => {
      const pin = resolvePinFromCard(el)
      if (!pin) return
      openContextMenu(pin, { x: startX, y: startY })
      /* Annule le double-tap pour cette interaction. */
      binding.firstTap = null
      binding.longPressTimer = null
    }, LONG_PRESS_DELAY)
  }

  binding.onPointerMove = (e: PointerEvent) => {
    if (!binding.longPressTimer) return
    const dx = Math.abs(e.movementX)
    const dy = Math.abs(e.movementY)
    if (dx > LONG_PRESS_DRIFT || dy > LONG_PRESS_DRIFT) {
      clearTimeout(binding.longPressTimer)
      binding.longPressTimer = null
    }
  }

  binding.onPointerUp = (e: PointerEvent) => {
    if (binding.longPressTimer) {
      clearTimeout(binding.longPressTimer)
      binding.longPressTimer = null
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return
    /* Ignore les taps qui partent d'un bouton (save) interne. */
    const tgt = e.target as HTMLElement | null
    if (tgt && tgt.closest('button, a, [data-no-pin-tap]')) return

    const now = performance.now()
    if (binding.firstTap && now - binding.firstTap.time < DOUBLE_TAP_DELAY) {
      const dx = Math.abs(e.clientX - binding.firstTap.x)
      const dy = Math.abs(e.clientY - binding.firstTap.y)
      if (dx <= DOUBLE_TAP_DISTANCE && dy <= DOUBLE_TAP_DISTANCE) {
        if (binding.singleTapTimer) {
          clearTimeout(binding.singleTapTimer)
          binding.singleTapTimer = null
        }
        binding.firstTap = null
        const pin = resolvePinFromCard(el)
        if (pin) void performLike(pin, { x: e.clientX, y: e.clientY })
        return
      }
    }
    binding.firstTap = { x: e.clientX, y: e.clientY, time: now }
    if (binding.singleTapTimer) clearTimeout(binding.singleTapTimer)
    binding.singleTapTimer = setTimeout(() => {
      const pin = resolvePinFromCard(el)
      if (!pin) {
        binding.firstTap = null
        binding.singleTapTimer = null
        return
      }
      performOpen(pin, el)
      binding.firstTap = null
      binding.singleTapTimer = null
    }, DOUBLE_TAP_DELAY)
  }

  binding.onPointerCancel = () => {
    if (binding.longPressTimer) {
      clearTimeout(binding.longPressTimer)
      binding.longPressTimer = null
    }
  }

  binding.onContextMenu = (e: MouseEvent) => {
    /* Empêche le menu navigateur quand on a déjà notre long-press. */
    e.preventDefault()
  }

  el.addEventListener('pointerdown', binding.onPointerDown)
  el.addEventListener('pointermove', binding.onPointerMove)
  el.addEventListener('pointerup', binding.onPointerUp)
  el.addEventListener('pointercancel', binding.onPointerCancel)
  el.addEventListener('contextmenu', binding.onContextMenu)

  bindings.set(el, binding)
}

function isSavePending(slug: string) {
  return isPinSavePending(slug)
}

function pinCardLabel(pin: Pin) {
  return t('pin.cardAriaLabel', { title: pin.title || pin.slug, user: pin.user })
}
</script>

<template>
  <section
    ref="gridRef"
    class="pin-virtual-grid"
    aria-labelledby="pin-virtual-grid-heading"
    :aria-busy="(loadingInitial && pins.length === 0) || loadingMore || undefined"
    :style="{ height: `${totalSize}px`, position: 'relative' }"
  >
    <h2 id="pin-virtual-grid-heading" class="sr-only">{{ t('feed.pinsGridHeading') }}</h2>

    <article
      v-for="vi in virtualItems"
      :key="(pins[vi.index]?.id ?? vi.index) + '-' + vi.lane"
      :ref="(el) => bindInteractions(el as HTMLElement | null)"
      :data-pin-slug="pins[vi.index]?.slug ?? ''"
      :data-index="vi.index"
      :data-lane="vi.lane"
      class="pin-virtual-grid__card lux-pin-card pinova-virtual-item pinova-gpu"
      :style="{
        position: 'absolute',
        top: '0px',
        left: `calc(${(vi.lane / columnCount) * 100}% + ${vi.lane > 0 ? GAP / 2 : 0}px)`,
        width: `calc(${100 / columnCount}% - ${columnCount > 1 ? GAP / 2 : 0}px - ${vi.lane < columnCount - 1 ? GAP / 2 : 0}px)`,
        transform: `translate3d(0, ${vi.start - scrollMargin}px, 0)`,
      }"
      :aria-label="pins[vi.index] ? pinCardLabel(pins[vi.index]) : ''"
    >
      <template v-if="pins[vi.index]">
        <div
          data-pin-media
          class="relative overflow-hidden rounded-3xl bg-neutral-100/90 dark:bg-neutral-800 min-h-[140px]"
        >
          <PinSensitiveMedia
            v-if="pins[vi.index].imageUrl"
            :sensitive="!!pins[vi.index].mediaSensitiveBlur"
            :viewer-can-reveal="viewerCanRevealSensitive"
            :blur-by-default="blurSensitiveByDefault"
            :enable-client-scan="false"
            :media-url="pins[vi.index].imageUrl"
            media-type="image"
            wrapper-class="w-full"
          >
            <img
              :src="pins[vi.index].imageUrl"
              :alt="pins[vi.index].title || pins[vi.index].user"
              :sizes="gridImageSizes"
              :fetchpriority="vi.index < columnCount * 2 ? 'high' : gridImageFetchPriority"
              decoding="async"
              :loading="vi.index < columnCount * 2 ? 'eager' : 'lazy'"
              :class="[PIN_MEDIA_ANTI_LEAK_CLASS, 'w-full h-auto block object-cover select-none']"
              v-bind="pinMediaAntiLeakImgBindings()"
            />
          </PinSensitiveMedia>
          <PinSensitiveMedia
            v-else-if="pins[vi.index].storyVideoUrl"
            :sensitive="!!pins[vi.index].mediaSensitiveBlur"
            :viewer-can-reveal="viewerCanRevealSensitive"
            :blur-by-default="blurSensitiveByDefault"
            :enable-client-scan="false"
            :media-url="pins[vi.index].storyVideoUrl"
            media-type="video"
            wrapper-class="w-full"
          >
            <video
              :src="pins[vi.index].storyVideoUrl"
              muted
              playsinline
              :preload="storyVideoPreload"
              :class="[PIN_MEDIA_ANTI_LEAK_CLASS, 'w-full h-auto block object-cover select-none max-h-[480px]']"
              v-bind="pinMediaAntiLeakVideoBindings(false)"
            />
          </PinSensitiveMedia>

          <button
            v-if="isAuthenticated"
            type="button"
            data-no-pin-tap
            :aria-pressed="pins[vi.index].saved"
            class="z-10 lux-btn-pin-save"
            :class="pins[vi.index].saved ? 'lux-btn-pin-save-saved opacity-100 translate-y-0' : ''"
            :disabled="isSavePending(pins[vi.index].slug)"
            @click.stop="onSavePinClick(pins[vi.index].slug)"
          >
            <span v-if="isSavePending(pins[vi.index].slug)" class="w-4 h-4 inline-block border-2 border-current border-t-transparent rounded-full animate-spin"></span>
            <span v-else>{{ pins[vi.index].saved ? t('pin.saved') : t('pin.save') }}</span>
          </button>
        </div>
      </template>
    </article>

    <!-- Skeleton "fin de feed" -->
    <div
      v-if="loadingMore"
      class="pin-virtual-grid__loading-strip"
      aria-hidden="true"
    >
      <div
        v-for="i in columnCount * 2"
        :key="`vskel-${i}`"
        class="pinova-skel pin-virtual-grid__skel"
      />
    </div>

    <LikeHeartBurst ref="heartBurstRef" />
  </section>
</template>

<style scoped>
.pin-virtual-grid {
  width: 100%;
  overflow: visible;
  contain: layout style;
}

.pin-virtual-grid__card {
  /* GPU friendly */
  will-change: transform;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.pin-virtual-grid__loading-strip {
  position: absolute;
  left: 0;
  right: 0;
  bottom: -260px;
  display: grid;
  grid-template-columns: repeat(var(--col-count, 2), 1fr);
  gap: 12px;
  pointer-events: none;
}

.pin-virtual-grid__skel {
  height: 220px;
  border-radius: 24px;
}
</style>
