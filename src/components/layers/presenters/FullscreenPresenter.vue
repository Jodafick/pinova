<script setup lang="ts">
/**
 * FullscreenPresenter — slide vertical bas → haut, fond opaque noir.
 *
 * Animation pilotée par physique :
 *  - `useGestureEngine` (vertical, rubber band haut, velocity tracking)
 *  - `useSpring` pour la fermeture / annulation (avec velocity injectée)
 *  - Flick detection : si l'utilisateur swipe vite vers le bas, on ferme
 *    même sans atteindre la distance seuil (= "fling" iOS)
 *  - safe-area top/bottom
 *  - Respect prefers-reduced-motion
 */
import { computed, onMounted, provide, ref, watch } from 'vue'
import { layerManager } from '../../../navigation/layerManager'
import { LAYER_CONTEXT_KEY } from '../../../navigation/useLayer'
import type { Layer } from '../../../navigation/layerTypes'
import { useSafeArea } from '../../../composables/useSafeArea'
import { useGestureEngine } from '../../../composables/useGestureEngine'
import { useSpring } from '../../../composables/useSpring'
import { GESTURE, SPRINGS } from '../../../theme/motion'
import { getAdaptiveGesture } from '../../../navigation/adaptiveNavigator'

const props = defineProps<{ layer: Layer }>()

const { top: safeTop, bottom: safeBottom, left: safeLeft, right: safeRight } = useSafeArea()

const rootRef = ref<HTMLElement | null>(null)
const surfaceRef = ref<HTMLElement | null>(null)

/* Position Y de la surface (px depuis sa position naturelle "haut").
   0 = déployé, hauteur = caché.  */
const ySpring = useSpring(0, SPRINGS.sheetSpring)

function close(result?: unknown) {
  layerManager.pop(props.layer.id, result)
}

const swipeEnabled = computed(() => props.layer.dismissStrategy.swipeDown)

const gesture = useGestureEngine(surfaceRef, {
  axis: 'vertical',
  /* On laisse le scroll vertical natif fonctionner SAUF si l'utilisateur
     amorce un drag depuis le haut (au-dessus du contenu scrollable). */
  preventScroll: false,
  canAcceptPointerDown: (e) => {
    if (!props.layer.dismissStrategy.swipeFromHeaderOnly) return true
    const el = e.target as HTMLElement | null
    return !!(el && typeof el.closest === 'function' && el.closest('[data-pinova-swipe-dismiss-handle]'))
  },
  onStart: () => {
    if (!swipeEnabled.value) {
      gesture.cancel()
      return
    }
    ySpring.stop()
  },
  onMove: ({ dy }) => {
    if (!swipeEnabled.value) return
    /* Rubber band si on tire vers le haut (dy < 0). */
    if (dy < 0) {
      ySpring.setImmediate(dy / 5)
    } else {
      ySpring.setImmediate(dy)
    }
  },
  onEnd: ({ dy, vy }) => {
    if (!swipeEnabled.value) return 0
    const h = surfaceRef.value?.clientHeight ?? window.innerHeight
    const distanceThreshold = Math.min(GESTURE.swipeDismissThresholdPx, h * getAdaptiveGesture().swipeDismissThresholdRatio)
    const isFling = vy >= getAdaptiveGesture().flickVelocity /* px/ms */
    const isFar = dy >= distanceThreshold
    if (isFling || isFar) {
      /* Fermeture : on anime jusqu'à h, vélocité injectée pour continuité. */
      ySpring.set(h, { velocity: vy * 1000, onRest: () => close() })
      return dy /* on garde la position courante pendant l'anim */
    }
    /* Annulation : retour à 0 avec velocity inversée (ressort doux). */
    ySpring.set(0, { velocity: vy * 1000 })
    return 0
  },
  onCancel: () => {
    ySpring.set(0)
  },
})

/* Applique transform sur la surface à chaque frame du spring. */
let raf: number | null = null
function tick() {
  const surf = surfaceRef.value
  if (!surf) return
  const y = Math.max(ySpring.value.value, -40) /* clamp rubber band visuel */
  const h = surf.clientHeight || window.innerHeight
  const scale = Math.max(0.9, 1 - Math.max(0, y) / (h * 2.2))
  const radius = Math.min(28, Math.max(0, y) / 6)
  surf.style.transform = `translate3d(0, ${y}px, 0) scale(${scale})`
  surf.style.borderRadius = `${radius}px`
  /* Dim du fond (le noir s'éclaircit légèrement à mesure que la surface descend). */
  const dim = Math.max(0.4, 1 - Math.max(0, y) / h)
  rootRef.value?.style.setProperty('--pinova-fs-dim', String(dim))

  if (ySpring.isAnimating.value || gesture.isDragging.value || y !== 0) {
    raf = requestAnimationFrame(tick)
  } else {
    raf = null
  }
}

watch([ySpring.isAnimating, gesture.isDragging], ([anim, drag]) => {
  if ((anim || drag) && raf == null) raf = requestAnimationFrame(tick)
})

onMounted(() => {
  /* Première frame pour activer la transform 3D et préchauffer le GPU. */
  const surf = surfaceRef.value
  if (surf) {
    surf.style.willChange = 'transform, border-radius'
    surf.style.backfaceVisibility = 'hidden'
  }
})

provide(LAYER_CONTEXT_KEY, {
  layer: computed(() => props.layer),
  close,
})
</script>

<template>
  <div
    ref="rootRef"
    class="pinova-layer-fullscreen"
    role="dialog"
    aria-modal="true"
    :style="{ zIndex: layer.zIndex } as Record<string, string | number>"
  >
    <div class="pinova-layer-fullscreen__dim" aria-hidden="true" />
    <div
      ref="surfaceRef"
      class="pinova-layer-fullscreen__surface"
      :class="{ 'pinova-no-transition': gesture.isDragging.value }"
      :style="{
        paddingTop: safeTop + 'px',
        paddingBottom: safeBottom + 'px',
        paddingLeft: safeLeft + 'px',
        paddingRight: safeRight + 'px',
      }"
    >
      <!-- WebKit iOS : chaîne flex explicite — sinon routes plein écran (création) ont hauteur 0. -->
      <div class="pinova-layer-fullscreen__route-root">
        <component :is="layer.component" v-bind="layer.componentProps" />
      </div>
    </div>
  </div>
</template>

<style>
.pinova-layer-fullscreen {
  position: absolute;
  inset: 0;
  background: transparent;
  overflow: hidden;
  --pinova-fs-dim: 1;
}

.pinova-layer-fullscreen__dim {
  position: absolute;
  inset: 0;
  background: #000;
  opacity: var(--pinova-fs-dim, 1);
  pointer-events: none;
}

.pinova-layer-fullscreen__surface {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  background: #000;
  /* Slide bottom→top à l'entrée (jouée une seule fois). */
  animation: pinova-fs-in 360ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform, border-radius;
  transform: translate3d(0, 0, 0);
}

.pinova-layer-fullscreen__route-root {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

@keyframes pinova-fs-in {
  from { transform: translate3d(0, 100%, 0); }
  to   { transform: translate3d(0, 0, 0); }
}

@media (prefers-reduced-motion: reduce) {
  .pinova-layer-fullscreen__surface {
    animation-duration: 0.01ms !important;
  }
}
</style>
