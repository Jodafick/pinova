<script setup lang="ts">
/**
 * ImmersiveMediaViewer — viewer fullscreen iOS-native pour image / vidéo / carrousel.
 *
 * Caractéristiques :
 *  - Support 3 types : single image, video, carousel (mix images+videos)
 *  - Backdrop : black solide (idéal pour images / videos plein-écran)
 *  - Pinch-zoom (image), pan zoomed, double-tap like
 *  - Drag-down dismiss (velocity-aware, rubber-band)
 *  - Swipe horizontal pour naviguer (carousel)
 *  - Chrome translucide auto-hide après inactivité
 *  - Préload des médias adjacents (prev/next) pour transitions instantanées
 *  - Memory safe : démonte les médias > 2 indices de l'index courant
 *  - Animation d'entrée : fade backdrop + scale-in subtle (intégrable avec
 *    `captureSharedElement` pour morph thumbnail → fullscreen)
 *  - Respect `prefers-reduced-motion`
 *
 * Le viewer N'EST PAS un composant de routing — il est ouvert imperativement
 * via `openImmersiveViewer({ items, initialIndex })` (singleton, voir bas).
 *
 * Si tu veux l'ouvrir depuis n'importe où :
 *
 *   import { openImmersiveViewer } from '@/components/ui/ImmersiveMediaViewer.vue'
 *   openImmersiveViewer({
 *     items: [
 *       { type: 'image', src: pin.imageUrl, blurhash: pin.blurhash },
 *       { type: 'video', src: pin.storyVideoUrl, poster: pin.imageUrl },
 *     ],
 *     initialIndex: 0,
 *     onClose: () => console.log('closed'),
 *   })
 */

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useMediaGestures, type MediaTransform } from '../../composables/useMediaGestures'
import { useReducedMotion } from '../../composables/useReducedMotion'
import { emitMicroFeedback } from '../../composables/useMicroFeedback'
import { mediaProfile, preloadImages, rememberVideoPoster } from '../../media'
import ProgressiveImage from './ProgressiveImage.vue'
import SmartVideo from './SmartVideo.vue'
import MediaChrome from './MediaChrome.vue'
import LikeHeartBurst from '../LikeHeartBurst.vue'

export type ImmersiveMediaItem =
  | { type: 'image'; src: string; blurhash?: string; lowResSrc?: string; alt?: string; aspectRatio?: number }
  | { type: 'video'; src: string; poster?: string; blurhash?: string; aspectRatio?: number }

interface Props {
  /** Items à afficher. */
  items: ImmersiveMediaItem[]
  /** Index initial. */
  initialIndex?: number
  /** Affichage. */
  open: boolean
  /** Permet le swipe horizontal (default true si >1 item). */
  swipeEnabled?: boolean
  /** Désactive pinch-zoom (utile pour video-only). */
  zoomEnabled?: boolean
  /** Titre affiché dans le chrome top (ex: "1 / 4"). */
  title?: string
  /** Callback like (double-tap). */
  onLike?: (item: ImmersiveMediaItem, point: { x: number; y: number }) => void
}

const props = withDefaults(defineProps<Props>(), {
  initialIndex: 0,
  swipeEnabled: true,
  zoomEnabled: true,
})

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'change-index', idx: number): void
}>()

const currentIndex = ref(props.initialIndex)
const isClosing = ref(false)
const dragOffset = ref(0)
const dragProgress = ref(0)
const mediaTransform = ref<MediaTransform>({ scale: 1, x: 0, y: 0 })
const stageRef = ref<HTMLElement | null>(null)
const heartBurstRef = ref<{ burstAt: (point: { x: number; y: number }) => void } | null>(null)
const { prefersReducedMotion } = useReducedMotion()

/* Items à monter : courant + N avant/après (N piloté par le profil adaptatif). */
const visibleItems = computed(() => {
  const idx = currentIndex.value
  const span = Math.max(1, mediaProfile().neighborPreloadCount)
  const items: Array<{ item: ImmersiveMediaItem; index: number }> = []
  for (let offset = -span; offset <= span; offset++) {
    const i = idx + offset
    if (i >= 0 && i < props.items.length) {
      items.push({ item: props.items[i], index: i })
    }
  }
  return items
})

const currentItem = computed(() => props.items[currentIndex.value])

/* Préchauffe via mediaEngine les images voisines au-delà des items montés
   (zone "soon-visible") + retient les posters vidéo en stale preview. */
function warmNeighbors(idx: number): void {
  const profile = mediaProfile()
  const span = profile.neighborPreloadCount + 1
  const imgsToWarm: string[] = []
  for (let offset = -span; offset <= span; offset++) {
    const i = idx + offset
    if (i < 0 || i >= props.items.length || i === idx) continue
    const it = props.items[i]
    if (!it) continue
    if (it.type === 'image') {
      imgsToWarm.push(it.src)
      if (it.lowResSrc) imgsToWarm.push(it.lowResSrc)
    } else if (it.type === 'video') {
      if (it.poster) {
        imgsToWarm.push(it.poster)
        rememberVideoPoster(it.src, it.poster)
      }
    }
  }
  if (imgsToWarm.length) preloadImages(imgsToWarm, { priority: 'low' })
}

/* Style stage : translateY pour drag-dismiss + scale pour zoom. */
const stageStyle = computed(() => ({
  transform: `translate3d(0, ${dragOffset.value}px, 0)`,
  opacity: 1 - dragProgress.value * 0.4,
  transition: dragProgress.value === 0 ? 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1), opacity 320ms ease' : 'none',
}))

const backdropStyle = computed(() => ({
  opacity: 1 - dragProgress.value * 0.6,
}))

const mediaTransformStyle = computed(() => ({
  transform: `translate3d(${mediaTransform.value.x}px, ${mediaTransform.value.y}px, 0) scale3d(${mediaTransform.value.scale}, ${mediaTransform.value.scale}, 1)`,
  transformOrigin: 'center center',
  transition: mediaTransform.value.scale === 1 && mediaTransform.value.x === 0 && mediaTransform.value.y === 0
    ? 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)'
    : 'none',
}))

/* ─── Gestures ─── */

useMediaGestures(stageRef, {
  enableZoom: props.zoomEnabled,
  maxScale: 4,
  minScale: 1,
  enableDismiss: true,
  dismissDistance: 120,
  dismissVelocity: 0.6,
  enableSwipe: props.swipeEnabled && props.items.length > 1,
  swipeThreshold: 60,
  onTransform: (t) => { mediaTransform.value = t },
  onDoubleTap: (point) => {
    emitMicroFeedback('like')
    heartBurstRef.value?.burstAt(point)
    props.onLike?.(currentItem.value, point)
  },
  onDismissProgress: (p) => {
    dragProgress.value = p
    dragOffset.value = p * 200
  },
  onDismiss: () => close(),
  onSwipeNext: () => goNext(),
  onSwipePrev: () => goPrev(),
  onHold: () => {
    /* Pause vidéo si en cours, sinon trigger contextual menu (caller-defined). */
    const vid = stageRef.value?.querySelector<HTMLVideoElement>('video')
    if (vid) vid.pause()
  },
  onHoldEnd: () => {
    const vid = stageRef.value?.querySelector<HTMLVideoElement>('video')
    if (vid?.paused) vid.play().catch(() => { /* ignore */ })
  },
})

/* ─── Navigation ─── */

function goNext() {
  if (currentIndex.value >= props.items.length - 1) return
  currentIndex.value++
  mediaTransform.value = { scale: 1, x: 0, y: 0 }
  emitMicroFeedback('navigation')
  warmNeighbors(currentIndex.value)
  emit('change-index', currentIndex.value)
}

function goPrev() {
  if (currentIndex.value <= 0) return
  currentIndex.value--
  mediaTransform.value = { scale: 1, x: 0, y: 0 }
  emitMicroFeedback('navigation')
  warmNeighbors(currentIndex.value)
  emit('change-index', currentIndex.value)
}

/* ─── Close ─── */

function close() {
  if (isClosing.value) return
  isClosing.value = true
  emitMicroFeedback('modalClose')
  /* Animation de fermeture : on rend la déclaration au layer parent via emit. */
  setTimeout(() => {
    isClosing.value = false
    dragOffset.value = 0
    dragProgress.value = 0
    mediaTransform.value = { scale: 1, x: 0, y: 0 }
    emit('update:open', false)
  }, prefersReducedMotion.value ? 80 : 220)
}

/* ─── Keyboard ─── */

function onKeydown(e: KeyboardEvent) {
  if (!props.open) return
  if (e.key === 'Escape') { e.preventDefault(); close() }
  if (e.key === 'ArrowRight') goNext()
  if (e.key === 'ArrowLeft') goPrev()
}

/* ─── Body scroll lock ─── */

let savedOverflow = ''
function lockScroll() {
  savedOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
}
function unlockScroll() {
  document.body.style.overflow = savedOverflow
}

watch(() => props.open, (open) => {
  if (open) {
    currentIndex.value = props.initialIndex
    mediaTransform.value = { scale: 1, x: 0, y: 0 }
    dragOffset.value = 0
    dragProgress.value = 0
    lockScroll()
    warmNeighbors(currentIndex.value)
  } else {
    unlockScroll()
  }
}, { immediate: true })

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  unlockScroll()
})
</script>

<template>
  <Teleport to="body">
    <transition name="immersive-fade">
      <div
        v-if="open"
        class="immersive-viewer"
        role="dialog"
        aria-modal="true"
        aria-label="Visionneuse de media"
      >
        <!-- Backdrop noir. -->
        <div class="immersive-viewer__backdrop" :style="backdropStyle" aria-hidden="true" />

        <!-- Stage : conteneur drag-dismiss. -->
        <div
          ref="stageRef"
          class="immersive-viewer__stage"
          :style="stageStyle"
        >
          <!-- Items adjacent + courant (preload + recycle). -->
          <div
            v-for="vi in visibleItems"
            :key="vi.index"
            class="immersive-viewer__slot"
            :class="{ 'is-active': vi.index === currentIndex }"
            :style="{
              transform: `translate3d(${(vi.index - currentIndex) * 100}%, 0, 0)`,
            }"
          >
            <div class="immersive-viewer__media-wrap" :style="vi.index === currentIndex ? mediaTransformStyle : undefined">
              <!-- Image. -->
              <ProgressiveImage
                v-if="vi.item.type === 'image'"
                :src="vi.item.src"
                :blurhash="vi.item.blurhash"
                :low-res-src="vi.item.lowResSrc"
                :alt="vi.item.alt"
                :aspect-ratio="vi.item.aspectRatio"
                :priority="vi.index === currentIndex ? 'high' : 'auto'"
                :eager="vi.index === currentIndex"
                fit="contain"
                anti-leak
                class="immersive-viewer__media immersive-viewer__media--image"
              />

              <!-- Video. -->
              <SmartVideo
                v-else
                :src="vi.item.src"
                :poster="vi.item.poster"
                :blurhash="vi.item.blurhash"
                :aspect-ratio="vi.item.aspectRatio"
                :autoplay="vi.index === currentIndex"
                :loop="true"
                :muted="true"
                anti-leak
                class="immersive-viewer__media immersive-viewer__media--video"
              />
            </div>
          </div>
        </div>

        <!-- Chrome translucide auto-hide. -->
        <MediaChrome variant="dark" @back="close">
          <template #title>
            <span v-if="title">{{ title }}</span>
            <span v-else-if="items.length > 1" class="immersive-viewer__counter">
              {{ currentIndex + 1 }} / {{ items.length }}
            </span>
          </template>
          <template v-if="$slots.actions" #actions>
            <slot name="actions" :index="currentIndex" :item="currentItem" />
          </template>
          <template v-if="$slots.bottom" #bottom>
            <slot name="bottom" :index="currentIndex" :item="currentItem" />
          </template>
        </MediaChrome>

        <!-- Heart burst (double tap like). -->
        <LikeHeartBurst ref="heartBurstRef" />
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.immersive-viewer {
  position: fixed;
  inset: 0;
  z-index: 1000;
  overflow: hidden;
  background: transparent;
  -webkit-tap-highlight-color: transparent;
  touch-action: none;
  isolation: isolate;
}

.immersive-viewer__backdrop {
  position: absolute;
  inset: 0;
  background-color: #000;
  transition: opacity 220ms cubic-bezier(0.22, 1, 0.36, 1);
  pointer-events: none;
}

.immersive-viewer__stage {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  will-change: transform, opacity;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.immersive-viewer__slot {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}

.immersive-viewer__media-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  will-change: transform;
}

.immersive-viewer__media {
  max-width: 100%;
  max-height: 100%;
  width: 100%;
  height: 100%;
  pointer-events: auto;
}

.immersive-viewer__media--image {
  background: transparent !important;
}

.immersive-viewer__counter {
  color: white;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  font-size: 14px;
  font-weight: 600;
}

/* Entrée / sortie. */
.immersive-fade-enter-active,
.immersive-fade-leave-active {
  transition: opacity 220ms cubic-bezier(0.22, 1, 0.36, 1);
}
.immersive-fade-enter-active .immersive-viewer__stage,
.immersive-fade-leave-active .immersive-viewer__stage {
  transition:
    transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 220ms ease;
}
.immersive-fade-enter-from,
.immersive-fade-leave-to {
  opacity: 0;
}
.immersive-fade-enter-from .immersive-viewer__stage {
  transform: scale3d(0.92, 0.92, 1);
  opacity: 0;
}
.immersive-fade-leave-to .immersive-viewer__stage {
  transform: scale3d(0.96, 0.96, 1);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .immersive-fade-enter-active,
  .immersive-fade-leave-active {
    transition: opacity 100ms linear;
  }
  .immersive-fade-enter-active .immersive-viewer__stage,
  .immersive-fade-leave-active .immersive-viewer__stage {
    transform: none !important;
  }
  .immersive-viewer__slot { transition: none !important; }
}
</style>
