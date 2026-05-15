/**
 * Fermeture « tirer le header vers le bas » pour une page fullscreen rendue
 * hors LayerHost (cold start / URL directe). Même logique que FullscreenPresenter
 * (axe vertical + handle `data-pinova-swipe-dismiss-handle`).
 *
 * Le pointerdown est attaché à `gestureRootRef` (typiquement le header seul)
 * pour ne pas entrer en conflit avec un `useEdgeSwipeBack` sur la coquille.
 * La translation / scale s'appliquent à `transformRef` (souvent la coquille entière).
 */
import { onBeforeUnmount, onMounted, watch, type Ref } from 'vue'
import { useGestureEngine } from './useGestureEngine'
import { useSpring } from './useSpring'
import { GESTURE, SPRINGS } from '../theme/motion'
import { getAdaptiveGesture } from '../navigation/adaptiveNavigator'

export interface UsePinovaHeaderSwipeDismissOptions {
  gestureRootRef: Ref<HTMLElement | null>
  transformRef: Ref<HTMLElement | null>
  enabled: () => boolean
  onClose: () => void
}

export function usePinovaHeaderSwipeDismiss(options: UsePinovaHeaderSwipeDismissOptions) {
  const ySpring = useSpring(0, SPRINGS.sheetSpring)

  const gesture = useGestureEngine(options.gestureRootRef, {
    axis: 'vertical',
    preventScroll: false,
    canAcceptPointerDown: (e) => {
      const el = e.target as HTMLElement | null
      return !!(el && typeof el.closest === 'function' && el.closest('[data-pinova-swipe-dismiss-handle]'))
    },
    disabled: () => !options.enabled(),
    onStart: () => {
      ySpring.stop()
    },
    onMove: ({ dy }) => {
      if (!options.enabled()) return
      if (dy < 0) ySpring.setImmediate(dy / 5)
      else ySpring.setImmediate(dy)
    },
    onEnd: ({ dy, vy }) => {
      if (!options.enabled()) return 0
      const h = options.transformRef.value?.clientHeight ?? window.innerHeight
      const distanceThreshold = Math.min(GESTURE.swipeDismissThresholdPx, h * getAdaptiveGesture().swipeDismissThresholdRatio)
      const isFling = vy >= getAdaptiveGesture().flickVelocity
      if (isFling || dy >= distanceThreshold) {
        ySpring.set(h, { velocity: vy * 1000, onRest: () => options.onClose() })
        return dy
      }
      ySpring.set(0, { velocity: vy * 1000 })
      return 0
    },
    onCancel: () => {
      ySpring.set(0)
    },
  })

  let raf: number | null = null
  function tick() {
    const surf = options.transformRef.value
    if (!surf) return
    const y = Math.max(ySpring.value.value, -40)
    const h = surf.clientHeight || window.innerHeight
    const scale = Math.max(0.9, 1 - Math.max(0, y) / (h * 2.2))
    const radius = Math.min(28, Math.max(0, y) / 6)
    surf.style.transform = `translate3d(0, ${y}px, 0) scale(${scale})`
    surf.style.borderRadius = `${radius}px`

    if (ySpring.isAnimating.value || gesture.isDragging.value || y !== 0) {
      raf = requestAnimationFrame(tick)
    } else {
      raf = null
    }
  }

  watch([ySpring.isAnimating, gesture.isDragging], () => {
    if (raf == null) raf = requestAnimationFrame(tick)
  })

  onMounted(() => {
    const surf = options.transformRef.value
    if (!surf) return
    surf.style.willChange = 'transform, border-radius'
    surf.style.backfaceVisibility = 'hidden'
  })

  onBeforeUnmount(() => {
    const surf = options.transformRef.value
    if (!surf) return
    surf.style.transform = ''
    surf.style.borderRadius = ''
    surf.style.willChange = ''
  })

  return { gesture, ySpring }
}
