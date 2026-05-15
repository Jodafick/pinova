<script setup lang="ts">
/**
 * PagePresenter — présentation "page iOS" : slide right → left.
 *
 * Edge-back piloté par :
 *  - `useGestureEngine` (horizontal, edge=left, axis-locked)
 *  - `useSpring` pour la fermeture / annulation
 *  - Flick detection : swipe rapide vers la droite → ferme
 *  - Pendant le drag, la couche de dessous (figée derrière l'app shell)
 *    reste visible : effet "tirer pour révéler".
 */
import { computed, onMounted, provide, ref, watch } from 'vue'
import { layerManager } from '../../../navigation/layerManager'
import { LAYER_CONTEXT_KEY } from '../../../navigation/useLayer'
import type { Layer } from '../../../navigation/layerTypes'
import { useSafeArea } from '../../../composables/useSafeArea'
import { useGestureEngine } from '../../../composables/useGestureEngine'
import { useSpring } from '../../../composables/useSpring'
import { SPRINGS } from '../../../theme/motion'
import { getAdaptiveGesture } from '../../../navigation/adaptiveNavigator'

const props = defineProps<{ layer: Layer }>()

const { top: safeTop, bottom: safeBottom, left: safeLeft, right: safeRight } = useSafeArea()

const rootRef = ref<HTMLElement | null>(null)
const surfaceRef = ref<HTMLElement | null>(null)

const xSpring = useSpring(0, SPRINGS.spring)

const isEdgeBackEnabled = computed(
  () => props.layer.dismissStrategy.edgeBack && !props.layer.disableEdgeBack,
)

function close(result?: unknown) {
  layerManager.pop(props.layer.id, result)
}

const gesture = useGestureEngine(rootRef, {
  axis: 'horizontal',
  edge: 'left',
  edgeWidth: getAdaptiveGesture().edgeBackWidth,
  preventScroll: true,
  disabled: () => !isEdgeBackEnabled.value,
  onStart: () => {
    xSpring.stop()
  },
  onMove: ({ dx }) => {
    /* Pas de drag vers la gauche (rubber band léger). */
    if (dx < 0) xSpring.setImmediate(dx / 6)
    else xSpring.setImmediate(dx)
  },
  onEnd: ({ dx, vx }) => {
    const w = rootRef.value?.clientWidth ?? window.innerWidth
    const distanceThreshold = Math.min(120, w * 0.32)
    const isFling = vx >= getAdaptiveGesture().flickVelocity
    if (isFling || dx >= distanceThreshold) {
      xSpring.set(w, { velocity: vx * 1000, onRest: () => close() })
      return dx
    }
    xSpring.set(0, { velocity: vx * 1000 })
    return 0
  },
  onCancel: () => xSpring.set(0),
})

let raf: number | null = null
function tick() {
  const surf = surfaceRef.value
  if (!surf) return
  const x = xSpring.value.value
  surf.style.transform = `translate3d(${x}px, 0, 0)`
  const w = surf.clientWidth || window.innerWidth
  const ratio = Math.min(1, Math.max(0, x) / w)
  /* Légère réduction d'opacité pendant le drag (le contexte sous-jacent transparaît). */
  surf.style.opacity = String(1 - ratio * 0.15)

  if (xSpring.isAnimating.value || gesture.isDragging.value || x !== 0) {
    raf = requestAnimationFrame(tick)
  } else {
    raf = null
  }
}

watch([xSpring.isAnimating, gesture.isDragging], () => {
  if (raf == null) raf = requestAnimationFrame(tick)
})

onMounted(() => {
  const surf = surfaceRef.value
  if (!surf) return
  surf.style.willChange = 'transform, opacity'
  surf.style.backfaceVisibility = 'hidden'
})

provide(LAYER_CONTEXT_KEY, {
  layer: computed(() => props.layer),
  close,
})
</script>

<template>
  <div
    ref="rootRef"
    class="pinova-layer-page"
    role="dialog"
    aria-modal="true"
    :style="{
      zIndex: layer.zIndex,
      paddingTop: safeTop + 'px',
      paddingBottom: safeBottom + 'px',
      paddingLeft: safeLeft + 'px',
      paddingRight: safeRight + 'px',
    }"
  >
    <div
      ref="surfaceRef"
      class="pinova-layer-page__surface"
      :class="{ 'pinova-no-transition': gesture.isDragging.value }"
    >
      <component :is="layer.component" v-bind="layer.componentProps" />
    </div>
  </div>
</template>

<style>
.pinova-layer-page {
  position: absolute;
  inset: 0;
  background: var(--pinova-page-bg, rgb(250 247 249));
  overflow: hidden;
  /* Slide-in à l'entrée. */
  animation: pinova-page-in 380ms cubic-bezier(0.22, 1, 0.36, 1);
  transform: translate3d(0, 0, 0);
}

html.dark .pinova-layer-page {
  background: var(--pinova-page-bg-dark, rgb(7 5 6));
}

.pinova-layer-page__surface {
  position: absolute;
  inset: 0;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  will-change: transform, opacity;
  transform: translate3d(0, 0, 0);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

@keyframes pinova-page-in {
  from { transform: translate3d(100%, 0, 0); }
  to   { transform: translate3d(0, 0, 0); }
}

@media (prefers-reduced-motion: reduce) {
  .pinova-layer-page {
    animation-duration: 0.01ms !important;
  }
}
</style>
