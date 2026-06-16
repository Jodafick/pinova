<script setup lang="ts">
/**
 * SheetPresenter — bottom sheet iOS (drag handle, swipe-down + fling dismiss).
 *
 * Pilotage physique :
 *  - `useGestureEngine` (vertical, axis-locked, rubber band haut)
 *  - `useSpring` (sheetSpring) pour la fermeture / annulation
 *  - Détection de fling (vélocité > seuil) → dismiss instantané
 *  - Keyboard avoiding via safe-area composable
 *
 * Pour les sheets multi-snap (half / expanded), utiliser
 * `useBottomSheetPhysics` directement dans le composant enfant.
 */
import { computed, onMounted, provide, ref, watch } from 'vue'
import { layerManager } from '../../../navigation/layerManager'
import { LAYER_CONTEXT_KEY } from '../../../navigation/useLayer'
import type { Layer } from '../../../navigation/layerTypes'
import LayerBackdrop from '../LayerBackdrop.vue'
import { useSafeArea } from '../../../composables/useSafeArea'
import { useGestureEngine } from '../../../composables/useGestureEngine'
import { useSpring } from '../../../composables/useSpring'
import { SPRINGS } from '../../../theme/motion'
import { getAdaptiveGesture } from '../../../navigation/adaptiveNavigator'

const props = defineProps<{ layer: Layer }>()

const { bottom: safeBottom, keyboardHeight } = useSafeArea()

const surfaceRef = ref<HTMLElement | null>(null)
const handleRef = ref<HTMLElement | null>(null)

/* translateY de la surface depuis sa position naturelle (0 = visible, +N = descend). */
const ySpring = useSpring(0, SPRINGS.sheetSpring)
const startedFromHandle = ref(false)

function close(result?: unknown) {
  layerManager.pop(props.layer.id, result)
}

const allowSwipe = computed(() => props.layer.dismissStrategy.swipeDown)

const surfaceGesture = useGestureEngine(surfaceRef, {
  axis: 'vertical',
  preventScroll: false,
  onStart: () => {
    if (!allowSwipe.value && !startedFromHandle.value) {
      surfaceGesture.cancel()
      return
    }
    ySpring.stop()
  },
  onMove: ({ dy }) => {
    if (dy < 0) {
      /* Rubber band vers le haut. */
      ySpring.setImmediate(dy / 5)
    } else {
      ySpring.setImmediate(dy)
    }
  },
  onEnd: ({ dy, vy }) => {
    const h = surfaceRef.value?.clientHeight ?? 360
    const distanceThreshold = Math.max(60, h * getAdaptiveGesture().swipeDismissThresholdRatio)
    const isFling = vy >= getAdaptiveGesture().flickVelocity
    const isFar = dy >= distanceThreshold

    if (isFling || isFar) {
      ySpring.set(h + 80, { velocity: vy * 1000, onRest: () => close() })
      return dy
    }
    /* Annulation : retour. */
    ySpring.set(0, { velocity: vy * 1000 })
    return 0
  },
  onCancel: () => ySpring.set(0),
})

/* Gesture séparée sur le handle (toujours dismissable, même si swipeDown false côté layer). */
useGestureEngine(handleRef, {
  axis: 'vertical',
  preventScroll: true,
  onStart: () => {
    startedFromHandle.value = true
    ySpring.stop()
  },
  onMove: ({ dy }) => {
    if (dy < 0) ySpring.setImmediate(dy / 5)
    else ySpring.setImmediate(dy)
  },
  onEnd: ({ dy, vy }) => {
    startedFromHandle.value = false
    const h = surfaceRef.value?.clientHeight ?? 360
    const distanceThreshold = Math.max(60, h * 0.2) /* seuil plus permissif sur le handle */
    if (vy >= getAdaptiveGesture().flickVelocity || dy >= distanceThreshold) {
      ySpring.set(h + 80, { velocity: vy * 1000, onRest: () => close() })
      return dy
    }
    ySpring.set(0, { velocity: vy * 1000 })
    return 0
  },
})

/* Boucle de tick : pose transform sur la surface en suivant le ressort. */
let raf: number | null = null
function tick() {
  const surf = surfaceRef.value
  if (!surf) return
  const baseY = ySpring.value.value
  const kbLift = keyboardHeight.value > 0 ? -keyboardHeight.value : 0
  surf.style.transform = `translate3d(0, ${baseY + kbLift}px, 0)`

  if (
    ySpring.isAnimating.value ||
    surfaceGesture.isDragging.value ||
    baseY !== 0 ||
    kbLift !== 0
  ) {
    raf = requestAnimationFrame(tick)
  } else {
    raf = null
  }
}

watch([ySpring.isAnimating, surfaceGesture.isDragging, keyboardHeight], () => {
  if (raf == null) raf = requestAnimationFrame(tick)
})

onMounted(() => {
  const surf = surfaceRef.value
  if (!surf) return
  surf.style.willChange = 'transform'
  surf.style.transform = 'translate3d(0, 0, 0)'
})

provide(LAYER_CONTEXT_KEY, {
  layer: computed(() => props.layer),
  close,
})
</script>

<template>
  <div
    class="fotoce-layer-sheet"
    :style="{ zIndex: layer.zIndex }"
  >
    <LayerBackdrop :layer="layer" :opacity="0.5" tint="neutral" />
    <div
      ref="surfaceRef"
      class="fotoce-layer-sheet__surface"
      :class="{ 'fotoce-no-transition': surfaceGesture.isDragging.value }"
      role="dialog"
      aria-modal="true"
      :style="{ paddingBottom: Math.max(safeBottom, 8) + 'px' }"
    >
      <div
        ref="handleRef"
        class="fotoce-layer-sheet__handle-wrap"
        aria-hidden="true"
      >
        <div class="fotoce-layer-sheet__handle" />
      </div>
      <div class="fotoce-layer-sheet__content">
        <component :is="layer.component" v-bind="layer.componentProps" />
      </div>
    </div>
  </div>
</template>

<style>
.fotoce-layer-sheet {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.fotoce-layer-sheet__surface {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 640px;
  max-height: 92dvh;
  border-top-left-radius: 28px;
  border-top-right-radius: 28px;
  background: var(--fotoce-bg-surface, #ffffff);
  border-top: 1px solid var(--fotoce-border-soft, rgb(234 221 229));
  /* Petit dépassement esthétique derrière la safe area iOS. */
  margin-bottom: -2px;
  padding-bottom: 8px;
  box-shadow: 0 -22px 56px -18px rgba(15, 23, 42, 0.28);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: fotoce-sheet-in 360ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
  transform: translate3d(0, 0, 0);
  touch-action: pan-y;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

html.dark .fotoce-layer-sheet__surface {
  background: var(--fotoce-bg-surface-dark, rgb(18 16 20));
  border-top-color: var(--fotoce-border-dark, rgb(45 38 43));
  box-shadow: 0 -28px 64px -20px rgba(0, 0, 0, 0.58);
}

.fotoce-layer-sheet__handle-wrap {
  display: grid;
  place-items: center;
  padding: 10px 0 6px;
  touch-action: none;
  cursor: grab;
}

.fotoce-layer-sheet__handle {
  width: 44px;
  height: 5px;
  border-radius: 999px;
  background: rgba(120, 113, 117, 0.5);
}

html.dark .fotoce-layer-sheet__handle {
  background: rgba(255, 255, 255, 0.28);
}

.fotoce-layer-sheet__content {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

@keyframes fotoce-sheet-in {
  from { transform: translate3d(0, 100%, 0); }
  to   { transform: translate3d(0, 0, 0); }
}

@media (prefers-reduced-motion: reduce) {
  .fotoce-layer-sheet__surface {
    animation-duration: 0.01ms !important;
  }
}
</style>
