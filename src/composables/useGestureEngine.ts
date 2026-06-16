/**
 * Gesture Engine — moteur unifié de gestes tactiles (et souris).
 *
 * Inspiré de :
 *  - UIPanGestureRecognizer (iOS)
 *  - react-native-gesture-handler / Reanimated
 *  - Framer Motion drag API
 *
 * Capacités :
 *  - swipe horizontal / vertical (avec direction lock)
 *  - drag (free, axis, edge-only)
 *  - dismiss (vertical / horizontal)
 *  - velocity tracking (moyenne pondérée sur fenêtre courte)
 *  - momentum simulation après release (inertie iOS)
 *  - rubber band hors-bornes
 *  - snap points (avec interpolation par velocity ET position)
 *  - gesture interruption (réagit instantanément à un nouveau down)
 *  - cancel (move > 90deg ou pointercancel)
 *  - edge swipe (depuis le bord gauche/droite/haut/bas avec largeur configurable)
 *
 * Le moteur N'ANIME PAS lui-même : il publie les valeurs réactives et délègue
 * l'animation finale à `useSpring()` (pour le "rest" / snap / fling).
 */

import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { rubberBand, SPRINGS, type SpringConfig } from '../theme/motion'
import { getAdaptiveGesture } from '../navigation/adaptiveNavigator'

/* ────────────── Types ────────────── */

export type GestureAxis = 'horizontal' | 'vertical' | 'both'

export type GestureEdge = 'left' | 'right' | 'top' | 'bottom'

export interface GesturePoint {
  x: number
  y: number
  time: number
}

export interface GestureState {
  /** Position relative au point de départ (px). */
  dx: number
  dy: number
  /** Vélocité instantanée (px/ms). */
  vx: number
  vy: number
  /** Direction décidée après le seuil (`null` tant qu'indécis). */
  direction: 'horizontal' | 'vertical' | null
  /** Position absolue à la pression initiale. */
  startX: number
  startY: number
  /** Position absolue courante. */
  currentX: number
  currentY: number
  /** Heure (perf.now()) du press initial. */
  startedAt: number
  /** ID du pointer actif. */
  pointerId: number
  /** Type de pointer iOS. */
  pointerType: 'touch' | 'mouse' | 'pen'
}

export interface UseGestureEngineOptions {
  /** Axe(s) suivi(s). 'both' n'applique aucun lock. Default 'both'. */
  axis?: GestureAxis
  /** Distance min pour décider la direction (px). Default 8. */
  directionThreshold?: number
  /** Edge swipe : démarre seulement depuis le bord indiqué. */
  edge?: GestureEdge
  /** Largeur du bord pour edge swipe (px). Default 24. */
  edgeWidth?: number
  /** Bornes [min, max] pour dx avec rubber band. */
  boundsX?: [number, number]
  /** Bornes [min, max] pour dy avec rubber band. */
  boundsY?: [number, number]
  /** Snap points sur l'axe principal (y pour vertical, x pour horizontal). */
  snapPoints?: number[]
  /** Vélocité au-delà de laquelle on snap au point suivant (px/ms). */
  flickVelocity?: number
  /**
   * Empêche le scroll natif quand un drag est actif.
   * Si une fonction : reçoit l’état courant ; retourner true pour `preventDefault`
   * (ex. seulement quand l’utilisateur tire vers le bas pour fermer un sheet).
   */
  preventScroll?: boolean | ((state: GestureState) => boolean)
  /** Désactive le moteur. */
  disabled?: () => boolean
  /** Si défini et retourne false, le geste n’est pas pris en charge (ex. zone header uniquement). */
  canAcceptPointerDown?: (e: PointerEvent) => boolean

  /* ────── Callbacks ────── */
  onStart?: (state: GestureState) => void
  onMove?: (state: GestureState) => void
  /** Appelé au release (pointerup). Doit retourner la position de snap finale (sur axis), ou undefined pour utiliser la valeur courante. */
  onEnd?: (state: GestureState) => number | undefined
  onCancel?: (state: GestureState) => void
}

export interface UseGestureEngineReturn {
  /** Position relative courante (x). */
  dx: Ref<number>
  /** Position relative courante (y). */
  dy: Ref<number>
  /** Velocity courante (px/ms). */
  velocityX: Ref<number>
  velocityY: Ref<number>
  /** Y a-t-il un geste actif ? */
  isDragging: Ref<boolean>
  /** Direction décidée. */
  direction: Ref<'horizontal' | 'vertical' | null>
  /** Forcer la fin d'un geste (utile pour interception). */
  cancel: () => void
}

/**
 * Calcule la vélocité moyenne pondérée sur une fenêtre glissante.
 * On donne plus de poids aux échantillons récents.
 */
function computeVelocity(history: GesturePoint[]): { vx: number; vy: number } {
  if (history.length < 2) return { vx: 0, vy: 0 }
  const last = history[history.length - 1]
  /* On ne garde que les samples dans la fenêtre. */
  const cutoff = last.time - getAdaptiveGesture().velocityWindow
  let totalWeight = 0
  let vx = 0
  let vy = 0
  for (let i = history.length - 2; i >= 0; i -= 1) {
    const p = history[i]
    if (p.time < cutoff) break
    const dt = last.time - p.time
    if (dt <= 0) continue
    const ix = (last.x - p.x) / dt
    const iy = (last.y - p.y) / dt
    /* Poids = inverse du dt (le sample le + récent pèse +). */
    const w = 1 / Math.max(1, dt)
    vx += ix * w
    vy += iy * w
    totalWeight += w
  }
  if (totalWeight === 0) return { vx: 0, vy: 0 }
  return { vx: vx / totalWeight, vy: vy / totalWeight }
}

/**
 * Choisit le snap point le plus proche, biaisé par la vélocité (fling).
 * Reproduit le comportement iOS scroll-snap iOS 14+.
 */
export function pickSnapPoint(
  current: number,
  velocity: number,
  snaps: number[],
  flickThreshold?: number,
): number {
  if (snaps.length === 0) return current
  const thresh = flickThreshold ?? getAdaptiveGesture().flickVelocity
  /* Si la vélocité dépasse le seuil, on prend le snap dans la direction du fling. */
  if (Math.abs(velocity) >= thresh) {
    const dir = velocity > 0 ? 1 : -1
    /* Cherche le snap dans la direction du fling le plus proche. */
    const filtered = snaps.filter((s) => (dir > 0 ? s > current : s < current))
    if (filtered.length > 0) {
      return dir > 0 ? Math.min(...filtered) : Math.max(...filtered)
    }
  }
  /* Sinon : snap le plus proche en distance. */
  let nearest = snaps[0]
  let nearestDist = Math.abs(snaps[0] - current)
  for (let i = 1; i < snaps.length; i += 1) {
    const d = Math.abs(snaps[i] - current)
    if (d < nearestDist) {
      nearest = snaps[i]
      nearestDist = d
    }
  }
  return nearest
}

/**
 * Attache un moteur de gestures à un élément.
 *
 * @example
 *   const root = ref<HTMLElement | null>(null)
 *   const { dx, isDragging } = useGestureEngine(root, {
 *     axis: 'horizontal',
 *     edge: 'left',
 *     onEnd: ({ dx, vx }) => (dx > 100 || vx > 0.6 ? close() : 0)
 *   })
 */
export function useGestureEngine(
  elRef: Ref<HTMLElement | null>,
  options: UseGestureEngineOptions = {},
): UseGestureEngineReturn {
  const ag = getAdaptiveGesture()
  const dx = ref(0)
  const dy = ref(0)
  const velocityX = ref(0)
  const velocityY = ref(0)
  const isDragging = ref(false)
  const direction = ref<'horizontal' | 'vertical' | null>(null)

  let pointerId: number | null = null
  let startX = 0
  let startY = 0
  let startedAt = 0
  let pointerType: 'touch' | 'mouse' | 'pen' = 'touch'
  const history: GesturePoint[] = []
  const dirThreshold = options.directionThreshold ?? ag.directionThreshold

  function makeState(currentX: number, currentY: number): GestureState {
    return {
      dx: dx.value,
      dy: dy.value,
      vx: velocityX.value,
      vy: velocityY.value,
      direction: direction.value,
      startX,
      startY,
      currentX,
      currentY,
      startedAt,
      pointerId: pointerId ?? -1,
      pointerType,
    }
  }

  function withinEdge(e: PointerEvent): boolean {
    if (!options.edge) return true
    const el = elRef.value
    if (!el) return false
    const r = el.getBoundingClientRect()
    const w = options.edgeWidth ?? ag.edgeBackWidth
    switch (options.edge) {
      case 'left': return e.clientX - r.left <= w
      case 'right': return r.right - e.clientX <= w
      case 'top': return e.clientY - r.top <= w
      case 'bottom': return r.bottom - e.clientY <= w
    }
  }

  function clampWithRubberBand(value: number, bounds?: [number, number], dim = 1): number {
    if (!bounds) return value
    const [min, max] = bounds
    if (value < min) return min + rubberBand(value - min, dim)
    if (value > max) return max + rubberBand(value - max, dim)
    return value
  }

  function onPointerDown(e: PointerEvent) {
    if (options.disabled?.()) return
    if (pointerId != null) return /* déjà actif */
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (!withinEdge(e)) return
    if (options.canAcceptPointerDown && !options.canAcceptPointerDown(e)) return

    pointerId = e.pointerId
    startX = e.clientX
    startY = e.clientY
    startedAt = performance.now()
    pointerType = (e.pointerType as 'touch' | 'mouse' | 'pen') || 'touch'
    history.length = 0
    history.push({ x: e.clientX, y: e.clientY, time: startedAt })
    direction.value = null
    isDragging.value = false
    /*
     * NE PAS capturer le pointeur ici : un simple tap (sans drag) doit
     * laisser le clic remonter naturellement au bouton/lien cible. La capture
     * détourne `pointerup` vers l'élément capturant et casse les boutons
     * placés dans la zone de geste (ex. Annuler / fermer dans le header
     * `data-fotoce-swipe-dismiss-handle`). On capture seulement quand le
     * drag est confirmé dans `onPointerMove`.
     */
  }

  function onPointerMove(e: PointerEvent) {
    if (pointerId == null || e.pointerId !== pointerId) return

    const now = performance.now()
    const rawDx = e.clientX - startX
    const rawDy = e.clientY - startY

    if (direction.value == null) {
      if (Math.abs(rawDx) < dirThreshold && Math.abs(rawDy) < dirThreshold) return
      /*
       * Edge horizontal : exiger une dominance horizontaire nette (sinon Chrome Android
       * verrouille souvent le scroll après un léger dx depuis le bord gauche).
       */
      const edgeHoriz =
        options.axis === 'horizontal' &&
        options.edge != null &&
        (options.edge === 'left' || options.edge === 'right')
      const ratio = edgeHoriz ? 1.28 : 1
      direction.value =
        Math.abs(rawDx) >= Math.abs(rawDy) * ratio ? 'horizontal' : 'vertical'

      /* Axis lock : si l'axe choisi n'est pas autorisé → cancel. */
      if (
        (options.axis === 'horizontal' && direction.value !== 'horizontal') ||
        (options.axis === 'vertical' && direction.value !== 'vertical')
      ) {
        const state = makeState(e.clientX, e.clientY)
        cancel()
        options.onCancel?.(state)
        return
      }
      isDragging.value = true
      /* Le drag est confirmé : on capture maintenant pour ne pas perdre le
         geste si le pointeur sort de l'élément (et pour profiter de
         pointermove fluide). */
      try { elRef.value?.setPointerCapture?.(e.pointerId) } catch { /* ignore */ }
      options.onStart?.(makeState(e.clientX, e.clientY))
    }

    /* Filtre axis lock : mettre à jour dx/dy AVANT preventScroll / onMove (état cohérent). */
    if (options.axis === 'horizontal') {
      dx.value = clampWithRubberBand(rawDx, options.boundsX, elRef.value?.clientWidth ?? 320)
      dy.value = 0
    } else if (options.axis === 'vertical') {
      dx.value = 0
      dy.value = clampWithRubberBand(rawDy, options.boundsY, elRef.value?.clientHeight ?? 480)
    } else {
      dx.value = clampWithRubberBand(rawDx, options.boundsX, elRef.value?.clientWidth ?? 320)
      dy.value = clampWithRubberBand(rawDy, options.boundsY, elRef.value?.clientHeight ?? 480)
    }

    /* Prevent scroll : booléen OU fonction(state) — la fonction n'était pas appelée avant. */
    const shouldPreventScroll =
      typeof options.preventScroll === 'function'
        ? options.preventScroll(makeState(e.clientX, e.clientY))
        : Boolean(options.preventScroll)
    if (shouldPreventScroll && direction.value && e.cancelable) {
      try { e.preventDefault() } catch { /* ignore */ }
    }

    /* Velocity tracking : garde les 8 derniers samples. */
    history.push({ x: e.clientX, y: e.clientY, time: now })
    if (history.length > 12) history.splice(0, history.length - 12)
    const v = computeVelocity(history)
    velocityX.value = v.vx
    velocityY.value = v.vy

    options.onMove?.(makeState(e.clientX, e.clientY))
  }

  function onPointerUp(e: PointerEvent) {
    if (pointerId == null || e.pointerId !== pointerId) return
    const state = makeState(e.clientX, e.clientY)
    isDragging.value = false
    pointerId = null
    /* Donne au callback la chance de réajuster la position finale (snap). */
    const finalAxis = options.onEnd?.(state)
    if (finalAxis !== undefined) {
      if (direction.value === 'horizontal' || options.axis === 'horizontal') dx.value = finalAxis
      else dy.value = finalAxis
    }
    try { elRef.value?.releasePointerCapture?.(e.pointerId) } catch { /* ignore */ }
  }

  function cancel() {
    if (pointerId == null && !isDragging.value && dx.value === 0 && dy.value === 0) return
    const state = makeState(0, 0)
    pointerId = null
    isDragging.value = false
    direction.value = null
    dx.value = 0
    dy.value = 0
    velocityX.value = 0
    velocityY.value = 0
    options.onCancel?.(state)
  }

  let attachedEl: HTMLElement | null = null

  function detach() {
    if (!attachedEl) return
    attachedEl.removeEventListener('pointerdown', onPointerDown)
    attachedEl.removeEventListener('pointermove', onPointerMove)
    attachedEl.removeEventListener('pointerup', onPointerUp)
    attachedEl.removeEventListener('pointercancel', cancel)
    attachedEl = null
  }

  function attach() {
    detach()
    const el = elRef.value
    if (!el) return
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove, {
      passive: !(options.preventScroll === true || typeof options.preventScroll === 'function'),
    })
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', cancel)
    attachedEl = el
  }

  watch(
    elRef,
    () => {
      attach()
    },
    { flush: 'post' },
  )

  onBeforeUnmount(() => {
    detach()
  })

  return { dx, dy, velocityX, velocityY, isDragging, direction, cancel }
}

/* ────────────── Re-export ────────────── */

export { SPRINGS, type SpringConfig }
