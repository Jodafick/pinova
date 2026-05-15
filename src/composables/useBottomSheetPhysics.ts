/**
 * useBottomSheetPhysics — physique iOS-style pour les bottom sheets.
 *
 * - Suivi du doigt 1:1 dans la zone autorisée
 * - Rubber band hors-bornes (hauteur max dépassée)
 * - Snap points : half / expanded / fullscreen
 * - Release : `useSpring` vers le snap choisi avec velocity injectée
 *   (= effet "fling" iOS Maps / Apple Music Now Playing)
 * - Bloque drag-to-dismiss si un scroller interne est encore scrollé > 0
 * - Respect prefers-reduced-motion
 *
 * Le composable expose `translateY` (px depuis le bas) à brancher en
 * `transform: translateY(...px)` sur la surface du sheet.
 */

import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { SPRINGS } from '../theme/motion'
import { getAdaptiveGesture } from '../navigation/adaptiveNavigator'
import { useGestureEngine, pickSnapPoint } from './useGestureEngine'
import { useSpring } from './useSpring'
import { emitMicroFeedback } from './useMicroFeedback'

export type SheetSnap = 'closed' | 'half' | 'expanded' | 'fullscreen'

export interface UseBottomSheetPhysicsOptions {
  /** Élément de la surface du sheet. */
  surfaceRef: Ref<HTMLElement | null>
  /** Hauteur courante de la fenêtre (px). Si non fourni, utilise window.innerHeight. */
  viewportHeight?: Ref<number>
  /** Snap points disponibles (sous-ensemble de SheetSnap). Default ['half','expanded']. */
  snaps?: SheetSnap[]
  /** Snap initial. Default 'half'. */
  initial?: SheetSnap
  /** Pour 'half', hauteur (ratio viewport). Default 0.5. */
  halfRatio?: number
  /** Pour 'expanded', hauteur (ratio viewport). Default 0.85. */
  expandedRatio?: number
  /** Sélecteur d'un scroller interne qui peut absorber le drag vertical. */
  innerScrollerSelector?: string
  /** Callback quand on atteint le snap 'closed'. */
  onDismiss?: () => void
  /** Callback à chaque snap (notif d'état). */
  onSnap?: (snap: SheetSnap) => void
}

export function useBottomSheetPhysics(options: UseBottomSheetPhysicsOptions) {
  const {
    surfaceRef,
    snaps = ['half', 'expanded'],
    initial = 'half',
    halfRatio = 0.5,
    expandedRatio = 0.85,
    innerScrollerSelector,
    onDismiss,
    onSnap,
  } = options

  const vh = ref(typeof window !== 'undefined' ? window.innerHeight : 800)
  if (options.viewportHeight) {
    watch(options.viewportHeight, (v) => { vh.value = v }, { immediate: true })
  } else {
    const onResize = () => { vh.value = window.innerHeight }
    onMounted(() => window.addEventListener('resize', onResize, { passive: true }))
    onBeforeUnmount(() => window.removeEventListener('resize', onResize))
  }

  /** Convertit un snap en hauteur visible (px) depuis le bas. */
  function snapToHeight(s: SheetSnap): number {
    switch (s) {
      case 'closed': return 0
      case 'half': return Math.round(vh.value * halfRatio)
      case 'expanded': return Math.round(vh.value * expandedRatio)
      case 'fullscreen': return vh.value
    }
  }

  /* On travaille en "translateY depuis bas" interne : 0 = caché, viewport.height = entièrement visible. */
  const heightSpring = useSpring(snapToHeight(initial), SPRINGS.sheetSpring)
  const currentSnap = ref<SheetSnap>(initial)

  /** Hauteur visible (px). Plus haut = sheet plus déployé. */
  const visibleHeight = computed(() => heightSpring.value.value)

  /**
   * `translateY` à appliquer sur la surface : 0 = entièrement visible, +N = caché.
   * Si la surface a `height: 100dvh`, on translate vers le bas par
   * `viewportHeight - visibleHeight`.
   */
  const translateY = computed(() => Math.max(0, vh.value - visibleHeight.value))

  function snapTo(snap: SheetSnap, velocity = 0) {
    const prev = currentSnap.value
    currentSnap.value = snap
    const target = snapToHeight(snap)
    heightSpring.set(target, { velocity })
    if (prev !== snap && snap !== 'closed') emitMicroFeedback('sheetSnap')
    onSnap?.(snap)
    if (snap === 'closed') {
      /* `onDismiss` est différé au repos pour laisser l'anim se jouer. */
      const stop = watch(heightSpring.isAnimating, (busy) => {
        if (busy) return
        stop()
        if (heightSpring.value.value === 0) onDismiss?.()
      })
    }
  }

  /* Liste des hauteurs cibles (px) en ordre croissant. */
  function snapHeights(): number[] {
    const list = snaps.map(snapToHeight)
    /* Toujours autoriser 'closed' comme point de fuite implicite. */
    if (!list.includes(0)) list.push(0)
    list.sort((a, b) => a - b)
    return list
  }

  function snapForHeight(h: number): SheetSnap {
    const ordered: { snap: SheetSnap; px: number }[] = (['closed', 'half', 'expanded', 'fullscreen'] as SheetSnap[])
      .filter((s) => s === 'closed' || snaps.includes(s))
      .map((s) => ({ snap: s, px: snapToHeight(s) }))
    let best = ordered[0]
    let bestDist = Math.abs(ordered[0].px - h)
    for (let i = 1; i < ordered.length; i += 1) {
      const d = Math.abs(ordered[i].px - h)
      if (d < bestDist) {
        best = ordered[i]
        bestDist = d
      }
    }
    return best.snap
  }

  /* ────── Gesture handling ────── */

  /** Si le pointer commence dans un scroller scrolled-down, on n'absorbe pas le geste. */
  function canStartDrag(e: PointerEvent): boolean {
    if (!innerScrollerSelector) return true
    const target = e.target as HTMLElement | null
    const scroller = target?.closest(innerScrollerSelector) as HTMLElement | null
    if (!scroller) return true
    return scroller.scrollTop <= 0
  }

  const gesture = useGestureEngine(surfaceRef, {
    axis: 'vertical',
    onStart: () => {
      /* Stop any spring : following finger 1:1. */
      heightSpring.stop()
    },
    onMove: ({ dy }) => {
      /* dy > 0 → on tire vers le bas (réduit la hauteur visible).
         dy < 0 → on tire vers le haut (augmente).
         On veut bornes : [snapToHeight(min), vh] avec rubber band hors. */
      const heights = snapHeights()
      const minH = Math.min(...heights)
      const maxH = Math.max(...heights, snapToHeight('fullscreen'))
      const base = snapToHeight(currentSnap.value)
      let target = base - dy
      if (target < minH) {
        /* Rubber band en bas (sheet veut sortir). */
        const excess = minH - target
        target = minH - Math.min(excess * 0.7, vh.value * 0.2)
      } else if (target > maxH) {
        const excess = target - maxH
        target = maxH + Math.min(excess * 0.4, vh.value * 0.1)
      }
      heightSpring.setImmediate(target)
    },
    onEnd: ({ vy }) => {
      /* Vélocité en px/ms ; positive = vers le bas (réduit hauteur). */
      const heightVelocity = -vy /* sens inverse de dy : - = augmente */
      const candidate = pickSnapPoint(
        heightSpring.value.value,
        heightVelocity * 1, /* px/ms : seuil flickVelocity comparable */
        snapHeights(),
      )
      const nextSnap = snapForHeight(candidate)
      /* Convertit la vélocité en unités de hauteur (px/s pour useSpring). */
      const sec = heightVelocity * 1000
      snapTo(nextSnap, sec)
      /* On laisse le gesture engine remettre dy = 0 implicitement par snap. */
      return 0
    },
  })

  /* Initial : sync surface pre-mount pour pas de flash. */
  watch(() => surfaceRef.value, (el) => {
    if (!el) return
    el.style.willChange = 'transform'
    el.style.transform = `translate3d(0, ${translateY.value}px, 0)`
  })

  /* Synchronise translateY sur l'élément (sans déclencher reactivité Vue inutile). */
  watch(translateY, (v) => {
    const el = surfaceRef.value
    if (!el) return
    el.style.transform = `translate3d(0, ${v}px, 0)`
  })

  /* Pré-démarre intercepteur scroll si scroller interne fourni. */
  function attachInnerGuard() {
    const el = surfaceRef.value
    if (!el || !innerScrollerSelector) return
    /* On override l'edge case via un wrapper pointerdown qui annule si pas autorisé. */
    el.addEventListener('pointerdown', (e) => {
      if (!canStartDrag(e as PointerEvent)) gesture.cancel()
    }, { capture: true })
  }
  onMounted(attachInnerGuard)

  return {
    /** Hauteur visible (px). */
    visibleHeight,
    /** translateY (px) à appliquer sur la surface. */
    translateY,
    /** Snap courant ('half', 'expanded', etc.). */
    currentSnap,
    /** Naviguer programmatique. */
    snapTo,
    /** L'utilisateur est-il en train de drag ? */
    isDragging: gesture.isDragging,
    /** Fermer le sheet (utility). */
    dismiss: () => snapTo('closed', getAdaptiveGesture().flickVelocity * 1000),
  }
}
