/**
 * useMotion — façade unifiée pour le système d'animation Pinova.
 *
 *  Sucre par-dessus les briques déjà existantes :
 *    - `useSpring`         → ressort physique RAF-based (mobile parity)
 *    - `useHaptics`        → vibration patterns
 *    - `useMicroFeedback`  → intent → haptic + visual mapping
 *    - `useReducedMotion`  → respect WCAG 2.3.3 + Apple HIG
 *    - `theme/motion`      → tokens MOTION (fast/medium/slow + springs)
 *    - `adaptiveNavigator` → spring contextuel iOS/material/desktop
 *
 *  Objectif : un composant peut écrire `const motion = useMotion()` et
 *  accéder à TOUT le système motion en une ligne, sans assembler 5
 *  imports différents. Idéal pour les composants présentation (boutons,
 *  cartes, FABs, transitions custom).
 *
 *  Exemple :
 *
 *    const motion = useMotion()
 *    motion.haptic('like')
 *    motion.spring(0).set(120, { velocity: 0.4 })
 *    if (!motion.isReduced.value) playFlourish()
 *    el.style.transition = `transform ${motion.dur.medium}ms ${motion.ease.iosOut}`
 */

import { computed, type ComputedRef } from 'vue'
import { useSpring, type UseSpringReturn } from './useSpring'
import { triggerHaptic, type HapticPattern } from './useHaptics'
import { emitMicroFeedback, type FeedbackIntent } from './useMicroFeedback'
import { useReducedMotion } from './useReducedMotion'
import { MOTION, SPRINGS, EASING, type SpringConfig } from '../theme/motion'
import { getAdaptiveSheetSpring, adaptiveProfile, type MotionLanguage } from '../navigation/adaptiveNavigator'

export interface UseMotionReturn {
  /** Crée un ressort réactif (RAF, motion-budget aware). */
  spring: (initial?: number, config?: SpringConfig) => UseSpringReturn
  /** Spring contextuel à la plateforme (iOS heavy, material balanced, desktop fast). */
  contextualSpring: () => SpringConfig
  /** Mode motion résolu (ios | material | desktop). */
  language: ComputedRef<MotionLanguage>

  /** Trigger haptique brut. */
  haptic: (pattern: HapticPattern) => void
  /** Trigger haptique + visuel via intent sémantique. */
  feedback: (intent: FeedbackIntent) => void

  /** `true` si l'utilisateur préfère reduced-motion. Réactif. */
  isReduced: ComputedRef<boolean>

  /** Durées canoniques (ms) — alignées sur mobile (`theme/motion.ts`). */
  dur: {
    fast: number
    medium: number
    slow: number
  }
  /** Easings cubic-bezier canoniques. */
  ease: {
    iosOut: string
    iosInOut: string
    standard: string
    decel: string
    accel: string
  }
  /** Tokens spring nommés (alias). */
  springs: typeof SPRINGS
}

/**
 * Cubic-béziers cohérents iOS / Material / Desktop. Mêmes courbes que dans
 * `style.css` (transitions CSS). On exporte ici pour usage JS (inline style,
 * GSAP-like, etc.).
 */
const EASE_MAP = {
  iosOut: 'cubic-bezier(0.32, 0.72, 0, 1)',
  iosInOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  decel: 'cubic-bezier(0, 0, 0, 1)',
  accel: 'cubic-bezier(0.42, 0, 1, 1)',
} as const

export function useMotion(): UseMotionReturn {
  const { prefersReducedMotion } = useReducedMotion()
  const language = computed<MotionLanguage>(() => adaptiveProfile.value.motionLanguage)
  const isReduced = computed(() => prefersReducedMotion.value)

  return {
    spring: (initial = 0, config = SPRINGS.spring) => useSpring(initial, config),
    contextualSpring: () => getAdaptiveSheetSpring(),
    language,
    haptic: triggerHaptic,
    feedback: emitMicroFeedback,
    isReduced,
    dur: {
      fast: MOTION.fast,
      medium: MOTION.medium,
      slow: MOTION.slow,
    },
    ease: { ...EASE_MAP },
    springs: SPRINGS,
  }
}

/* Réexport des tokens EASING (théoriquement importables aussi depuis theme/motion). */
export { EASING }
