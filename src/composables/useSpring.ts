/**
 * useSpring — moteur de ressort physique RAF-based.
 *
 * Reproduit l'API de React Native Reanimated `withSpring()` mais côté DOM,
 * sans dépendance externe.
 *
 * Modèle physique : ressort amorti
 *   force_ressort = -stiffness * (position - target)
 *   force_amort = -damping * vitesse
 *   acceleration = (force_ressort + force_amort) / mass
 *
 * Pas d'intégration : Euler implicite tronqué à 16ms max (60fps target).
 * Optimisations :
 *  - cancelAnimationFrame agressif lors d'un nouveau `set()`
 *  - écoulement < 0.01px / 0.01vps → snap immédiat
 *  - `prefersReducedMotion` → instant snap
 *
 * Usage :
 *
 *   const x = useSpring(0, SPRINGS.spring)
 *   x.set(120)              // animation vers 120
 *   x.set(120, { velocity: 1.4 })  // injecter vitesse initiale (gesture release)
 *   watch(x.value, (v) => el.style.transform = `translateX(${v}px)`)
 *
 *   // En cas de gesture continu : "follow finger"
 *   x.setImmediate(dragX)
 */

import { onBeforeUnmount, ref, type Ref } from 'vue'
import { SPRINGS, type SpringConfig } from '../theme/motion'
import { acquireMotionSlot, shouldDegradeAnimation } from '../core/motionBudget'

export interface SpringSetOptions {
  /** Vitesse initiale en unités/seconde (default 0 ou vélocité courante). */
  velocity?: number
  /** Forcer un override de la config pour cette animation. */
  config?: Partial<SpringConfig>
  /** Snap instantané (skip physique). */
  immediate?: boolean
  /** Callback à la fin du repos. */
  onRest?: (finalValue: number) => void
}

export interface UseSpringReturn {
  /** Valeur courante (réactive). */
  value: Readonly<Ref<number>>
  /** Vitesse courante (px/s ou unités/s). */
  velocity: Readonly<Ref<number>>
  /** Le ressort est-il encore animé ? */
  isAnimating: Readonly<Ref<boolean>>
  /** Animer vers une cible. */
  set: (target: number, options?: SpringSetOptions) => void
  /** Snap instantané sans animation (utile pour suivre le doigt). */
  setImmediate: (value: number) => void
  /** Arrête l'animation au point courant (sans atteindre la cible). */
  stop: () => void
  /** Cible courante. */
  target: Readonly<Ref<number>>
}

/**
 * Force un cap dur sur dt pour éviter les sauts énormes après onglet en arrière-plan.
 */
const MAX_DT_MS = 32

export function useSpring(
  initial: number = 0,
  defaultConfig: SpringConfig = SPRINGS.spring,
): UseSpringReturn {
  const value = ref(initial)
  const velocity = ref(0)
  const target = ref(initial)
  const isAnimating = ref(false)

  let rafId: number | null = null
  let lastFrameTime: number | null = null
  let activeConfig: SpringConfig = defaultConfig
  let restCallback: ((v: number) => void) | null = null
  let reducedMotion = false
  /** Slot motion budget réservé pendant que la spring tourne. */
  let releaseSlot: (() => void) | null = null

  function cancelLoop() {
    if (rafId != null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    lastFrameTime = null
  }

  function emitRest() {
    if (!restCallback) return
    const cb = restCallback
    restCallback = null
    try { cb(value.value) } catch (e) { console.warn('[useSpring] onRest error', e) }
  }

  function settle() {
    cancelLoop()
    isAnimating.value = false
    velocity.value = 0
    value.value = target.value
    if (releaseSlot) {
      releaseSlot()
      releaseSlot = null
    }
    emitRest()
  }

  function step(now: number) {
    if (lastFrameTime == null) {
      lastFrameTime = now
      rafId = requestAnimationFrame(step)
      return
    }
    const dtMs = Math.min(MAX_DT_MS, now - lastFrameTime)
    lastFrameTime = now
    const dt = dtMs / 1000

    const k = activeConfig.stiffness
    const c = activeConfig.damping
    const m = activeConfig.mass || 1
    const restPos = activeConfig.restThreshold ?? 0.01
    const restVel = activeConfig.velocityThreshold ?? 0.01

    const x = value.value
    const v = velocity.value
    const t = target.value

    /* Sous-step à 240Hz pour réduire l'erreur d'Euler quand stiffness est haut. */
    const subSteps = dt > 0.012 ? 4 : 2
    const subDt = dt / subSteps
    let vi = v
    let xi = x
    for (let i = 0; i < subSteps; i += 1) {
      const fSpring = -k * (xi - t)
      const fDamp = -c * vi
      const ai = (fSpring + fDamp) / m
      vi += ai * subDt
      xi += vi * subDt
    }

    velocity.value = vi
    value.value = xi

    /* Conditions de repos : proche cible ET faible vélocité. */
    if (Math.abs(t - xi) < restPos && Math.abs(vi) < restVel) {
      settle()
      return
    }

    rafId = requestAnimationFrame(step)
  }

  function isReducedMotion(): boolean {
    if (typeof window === 'undefined') return reducedMotion
    try {
      reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
      /* keep last */
    }
    return reducedMotion
  }

  function set(nextTarget: number, options: SpringSetOptions = {}) {
    cancelLoop()
    target.value = nextTarget
    restCallback = options.onRest ?? null
    activeConfig = options.config ? { ...defaultConfig, ...options.config } : defaultConfig

    if (options.velocity != null) velocity.value = options.velocity

    if (options.immediate || isReducedMotion() || shouldDegradeAnimation('spring')) {
      /* Sous pression motion, on snap immédiatement plutôt que de surcharger le compositor. */
      settle()
      return
    }

    if (value.value === nextTarget && Math.abs(velocity.value) < (activeConfig.velocityThreshold ?? 0.01)) {
      settle()
      return
    }

    if (!releaseSlot) releaseSlot = acquireMotionSlot('spring')
    isAnimating.value = true
    rafId = requestAnimationFrame(step)
  }

  function setImmediate(next: number) {
    cancelLoop()
    value.value = next
    target.value = next
    velocity.value = 0
    isAnimating.value = false
    if (releaseSlot) {
      releaseSlot()
      releaseSlot = null
    }
  }

  function stop() {
    cancelLoop()
    isAnimating.value = false
    /* On garde la position courante comme nouvelle cible. */
    target.value = value.value
    velocity.value = 0
    if (releaseSlot) {
      releaseSlot()
      releaseSlot = null
    }
  }

  onBeforeUnmount(() => {
    cancelLoop()
    if (releaseSlot) {
      releaseSlot()
      releaseSlot = null
    }
  })

  return {
    value,
    velocity,
    target,
    isAnimating,
    set,
    setImmediate,
    stop,
  }
}
