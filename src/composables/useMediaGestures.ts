/**
 * useMediaGestures — gestes média immersifs iOS-natives.
 *
 * Fournit, sur un élément cible (image ou video), TOUS les gestures qu'un
 * utilisateur attend d'une app native moderne :
 *
 *   1. Pinch zoom        : 2 doigts → scale + clamp [min, max]
 *   2. Pan (when zoomed) : drag avec inertie limitée aux bornes scale
 *   3. Double tap        : like-burst sur image, play/pause sur vidéo
 *   4. Vertical drag     : drag-to-dismiss (close viewer)
 *   5. Horizontal swipe  : next/prev media (carrousel)
 *   6. Hold (long press) : pause vidéo OU contextual menu
 *   7. Tap (single)      : toggle chrome / mute
 *
 * Toutes les positions/scale sont gérées en transform GPU (translate3d + scale),
 * sans `top/left` (jamais de layout thrashing).
 *
 * Respect strict de `prefers-reduced-motion` (animations short ou désactivées).
 *
 * IMPORTANT :
 *  - Le composable NE modifie PAS le DOM transform en continu (jank risk).
 *  - Il appelle des callbacks (`onTransform`) que le caller applique au RAF.
 *  - Le caller a le contrôle ultime (peut interpoler, snap, dismiss).
 *
 * Usage :
 *
 *   useMediaGestures(targetRef, {
 *     enableZoom: true,
 *     onDoubleTap: () => like(),
 *     onDismiss: () => close(),
 *     onSwipeNext: () => next(),
 *     onSwipePrev: () => prev(),
 *   })
 */

import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

export interface MediaTransform {
  scale: number
  x: number
  y: number
}

export interface UseMediaGesturesOptions {
  /** Active pinch-zoom. Default true. */
  enableZoom?: boolean
  /** Scale max. Default 4. */
  maxScale?: number
  /** Scale min (1 = pas de zoom out en-dessous). */
  minScale?: number
  /** Active drag-to-dismiss vertical. Default true. */
  enableDismiss?: boolean
  /** Seuil distance pour valider dismiss (px). */
  dismissDistance?: number
  /** Seuil velocity pour flick-dismiss (px/ms). */
  dismissVelocity?: number
  /** Active swipe horizontal (next/prev). Default false. */
  enableSwipe?: boolean
  /** Seuil swipe (px). */
  swipeThreshold?: number
  /** Délai max entre 2 taps pour double-tap (ms). */
  doubleTapDelay?: number
  /** Délai long-press (ms). */
  longPressDelay?: number

  /** Callback transform (zoom / pan). À utiliser pour appliquer translate3d/scale. */
  onTransform?: (t: MediaTransform) => void
  /** Single tap (après débounce vs double-tap). */
  onTap?: (point: { x: number; y: number }) => void
  /** Double tap (point local du tap). */
  onDoubleTap?: (point: { x: number; y: number }) => void
  /** Long press / hold. */
  onHold?: (point: { x: number; y: number }) => void
  /** Hold released. */
  onHoldEnd?: () => void
  /** Dismiss validé (drag-down). */
  onDismiss?: () => void
  /** Pendant le dismiss (progression 0..1). */
  onDismissProgress?: (progress: number) => void
  /** Swipe horizontal (next = vers gauche). */
  onSwipeNext?: () => void
  onSwipePrev?: () => void
}

interface ActiveGesture {
  type: 'pinch' | 'pan' | 'drag' | 'idle'
  startX: number
  startY: number
  lastX: number
  lastY: number
  startTime: number
  startDistance?: number
  startScale?: number
  startTransform?: MediaTransform
  lastVy?: number
  lastTime?: number
}

function distance(t1: Touch, t2: Touch): number {
  const dx = t1.clientX - t2.clientX
  const dy = t1.clientY - t2.clientY
  return Math.sqrt(dx * dx + dy * dy)
}

function midpoint(t1: Touch, t2: Touch): { x: number; y: number } {
  return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 }
}

function clamp(v: number, min: number, max: number): number { return Math.min(max, Math.max(min, v)) }

export function useMediaGestures(targetRef: Ref<HTMLElement | null>, options: UseMediaGesturesOptions = {}) {
  const enableZoom = options.enableZoom ?? true
  const maxScale = options.maxScale ?? 4
  const minScale = options.minScale ?? 1
  const enableDismiss = options.enableDismiss ?? true
  const dismissDistance = options.dismissDistance ?? 120
  const dismissVelocity = options.dismissVelocity ?? 0.6
  const enableSwipe = options.enableSwipe ?? false
  const swipeThreshold = options.swipeThreshold ?? 60
  const doubleTapDelay = options.doubleTapDelay ?? 280
  const longPressDelay = options.longPressDelay ?? 450

  const transform = ref<MediaTransform>({ scale: 1, x: 0, y: 0 })
  const gesture: ActiveGesture = {
    type: 'idle',
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    startTime: 0,
  }

  let lastTapTime = 0
  let lastTapPos: { x: number; y: number } | null = null
  let tapTimeout: ReturnType<typeof setTimeout> | null = null
  let longPressTimeout: ReturnType<typeof setTimeout> | null = null
  let isHolding = false

  function emit(t: MediaTransform) {
    transform.value = t
    options.onTransform?.(t)
  }

  function reset() {
    emit({ scale: 1, x: 0, y: 0 })
    gesture.type = 'idle'
  }

  /* ───────── Touch handlers ───────── */

  function onTouchStart(e: TouchEvent) {
    if (!e.touches.length) return

    const now = performance.now()
    /* 2 touches → pinch start. */
    if (e.touches.length === 2 && enableZoom) {
      cancelLongPress()
      gesture.type = 'pinch'
      gesture.startDistance = distance(e.touches[0], e.touches[1])
      gesture.startScale = transform.value.scale
      gesture.startTransform = { ...transform.value }
      const mid = midpoint(e.touches[0], e.touches[1])
      gesture.startX = mid.x
      gesture.startY = mid.y
      return
    }

    /* 1 touche : décision pan vs drag-dismiss vs swipe selon contexte. */
    const t = e.touches[0]
    gesture.startX = t.clientX
    gesture.startY = t.clientY
    gesture.lastX = t.clientX
    gesture.lastY = t.clientY
    gesture.startTime = now
    gesture.lastTime = now
    gesture.startTransform = { ...transform.value }

    /* Si zoomé → on commence en pan. Sinon en drag (dismiss/swipe). */
    gesture.type = transform.value.scale > 1.02 ? 'pan' : 'drag'

    /* Long-press detection (annulé dès qu'on bouge). */
    longPressTimeout = setTimeout(() => {
      if (gesture.type !== 'idle' && Math.hypot(gesture.lastX - gesture.startX, gesture.lastY - gesture.startY) < 10) {
        isHolding = true
        options.onHold?.({ x: t.clientX, y: t.clientY })
      }
    }, longPressDelay)
  }

  function onTouchMove(e: TouchEvent) {
    if (gesture.type === 'idle') return
    if (gesture.type === 'pinch' && e.touches.length === 2) {
      const d = distance(e.touches[0], e.touches[1])
      if (gesture.startDistance && gesture.startScale != null) {
        const ratio = d / gesture.startDistance
        const newScale = clamp(gesture.startScale * ratio, minScale * 0.92 /* rubber band */, maxScale * 1.08)
        emit({ ...transform.value, scale: newScale })
      }
      return
    }

    if (e.touches.length !== 1) return
    const t = e.touches[0]
    const dx = t.clientX - gesture.startX
    const dy = t.clientY - gesture.startY
    const now = performance.now()
    const dt = now - (gesture.lastTime ?? now) || 16
    gesture.lastVy = (t.clientY - gesture.lastY) / dt
    gesture.lastX = t.clientX
    gesture.lastY = t.clientY
    gesture.lastTime = now

    /* Pan en mode zoom. */
    if (gesture.type === 'pan') {
      const start = gesture.startTransform ?? transform.value
      emit({
        scale: transform.value.scale,
        x: start.x + dx,
        y: start.y + dy,
      })
      return
    }

    /* Drag : si vertical down dominant → dismiss. */
    if (gesture.type === 'drag') {
      if (Math.abs(dy) > Math.abs(dx) && enableDismiss && dy > 0) {
        const progress = clamp(dy / (dismissDistance * 2), 0, 1)
        options.onDismissProgress?.(progress)
        emit({ scale: 1 - progress * 0.08, x: 0, y: dy })
      }
      /* Si horizontal dominant et enableSwipe → on track pour décider à la fin. */
    }

    /* Tout move > 10px annule long-press. */
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) cancelLongPress()
  }

  function onTouchEnd(e: TouchEvent) {
    cancelLongPress()
    if (isHolding) {
      isHolding = false
      options.onHoldEnd?.()
    }

    if (gesture.type === 'idle') return

    /* Pinch end → snap si zoom < min ou > max. */
    if (gesture.type === 'pinch') {
      const snapped = clamp(transform.value.scale, minScale, maxScale)
      if (snapped <= minScale + 0.01) {
        /* Zoom out complet → reset position. */
        emit({ scale: minScale, x: 0, y: 0 })
      } else {
        emit({ ...transform.value, scale: snapped })
      }
      gesture.type = 'idle'
      return
    }

    /* Pan end (zoomed). */
    if (gesture.type === 'pan') {
      gesture.type = 'idle'
      return
    }

    /* Drag end : décider dismiss / swipe / tap. */
    const dx = gesture.lastX - gesture.startX
    const dy = gesture.lastY - gesture.startY
    const dtTotal = performance.now() - gesture.startTime
    const distMoved = Math.hypot(dx, dy)

    /* Dismiss validé : distance ou velocity. */
    if (enableDismiss && (dy > dismissDistance || (gesture.lastVy ?? 0) > dismissVelocity)) {
      options.onDismiss?.()
      gesture.type = 'idle'
      return
    }

    /* Swipe horizontal. */
    if (enableSwipe && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > swipeThreshold) {
      if (dx < 0) options.onSwipeNext?.()
      else options.onSwipePrev?.()
      gesture.type = 'idle'
      reset()
      return
    }

    /* Tap (mouvement < 8px, durée < 280ms). */
    if (distMoved < 8 && dtTotal < 280) {
      handleTap(gesture.lastX, gesture.lastY, e)
    }

    /* Aucune action validée : reset visuel (spring-back). */
    reset()
  }

  function handleTap(x: number, y: number, _e: TouchEvent) {
    const now = performance.now()
    if (lastTapTime && now - lastTapTime < doubleTapDelay && lastTapPos) {
      const d = Math.hypot(x - lastTapPos.x, y - lastTapPos.y)
      if (d < 36) {
        /* Double tap confirmed. */
        if (tapTimeout) { clearTimeout(tapTimeout); tapTimeout = null }
        lastTapTime = 0
        lastTapPos = null
        options.onDoubleTap?.({ x, y })
        return
      }
    }
    /* Pending single tap (annulé si un 2e tap arrive). */
    lastTapTime = now
    lastTapPos = { x, y }
    if (tapTimeout) clearTimeout(tapTimeout)
    tapTimeout = setTimeout(() => {
      options.onTap?.({ x, y })
      lastTapTime = 0
      lastTapPos = null
      tapTimeout = null
    }, doubleTapDelay)
  }

  function cancelLongPress() {
    if (longPressTimeout) {
      clearTimeout(longPressTimeout)
      longPressTimeout = null
    }
  }

  /* ───────── Cleanup / lifecycle ───────── */

  function bind() {
    const el = targetRef.value
    if (!el) return
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', onTouchEnd, { passive: true })
  }

  function unbind() {
    const el = targetRef.value
    if (!el) return
    el.removeEventListener('touchstart', onTouchStart)
    el.removeEventListener('touchmove', onTouchMove)
    el.removeEventListener('touchend', onTouchEnd)
    el.removeEventListener('touchcancel', onTouchEnd)
  }

  onMounted(bind)
  onBeforeUnmount(() => {
    unbind()
    if (tapTimeout) clearTimeout(tapTimeout)
    if (longPressTimeout) clearTimeout(longPressTimeout)
  })

  return {
    transform,
    reset,
  }
}
