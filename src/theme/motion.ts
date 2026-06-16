/**
 * Motion System Fotoce — tokens partagés iOS-like.
 *
 * Inspiré de :
 *  - iOS UIKit (UIView animateWithSpring, damping ratio)
 *  - React Native Reanimated (withSpring, stiffness/mass)
 *  - Apple Music / Pinterest / Instagram
 *
 * Conventions :
 *  - Toutes les courbes en `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out doux iOS)
 *    ou `cubic-bezier(0.34, 1.56, 0.64, 1)` (overshoot léger, "spring-like").
 *  - Les ressorts (springs) sont définis par damping / stiffness / mass,
 *    consommés par `useSpring()` côté JS pour des trajectoires physiques.
 *
 * Important : à 60fps un step = 16ms. On vise donc des animations qui
 * STARTENT en < 16ms pour donner la sensation "réactive immédiate" (cf. HIG).
 */

/* ───────────────────────── Durations ───────────────────────── */

export const DURATIONS = {
  /** Feedback tactile instantané (press, ripple). */
  ultraFast: 120,
  /** Transitions courtes : icônes, toggles, hover. */
  fast: 180,
  /** Standard : modales, panneaux, presenters. */
  medium: 260,
  /** Transitions amples : pages, fullscreen, sheets larges. */
  slow: 380,
  /** Très lent : boot splash, animations idle. */
  ambient: 640,
} as const

export type MotionDurationKey = keyof typeof DURATIONS

/* ───────────────────────── Easing curves ───────────────────────── */

/**
 * `iosOut` : la courbe par défaut iOS pour les out-transitions (l'élément
 * arrive et se pose). Démarrage rapide, fin très douce.
 */
export const EASING = {
  /** Standard out (UIKit `UIViewAnimationCurveEaseOut` ≈). */
  iosOut: 'cubic-bezier(0.22, 1, 0.36, 1)',
  /** Léger overshoot (ressort visuel sans rebond). */
  iosOvershoot: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  /** In/out doux (panneaux, valeurs intermédiaires). */
  iosInOut: 'cubic-bezier(0.42, 0, 0.58, 1)',
  /** Snappy : démarrage instantané, fin nette. */
  iosSnappy: 'cubic-bezier(0.18, 0.89, 0.32, 1.28)',
  /** Linéaire (rarement utilisé : barres de progression). */
  linear: 'linear',
} as const

export type MotionEasingKey = keyof typeof EASING

/* ───────────────────────── Spring configs ───────────────────────── */

/**
 * Spring config — interprétée par `useSpring()` (RAF physique).
 * - `damping` : friction. Plus élevé = moins d'oscillation. ∈ [10..40]
 * - `stiffness` : raideur. Plus élevé = arrive plus vite. ∈ [80..600]
 * - `mass` : inertie. ∈ [0.5..2]
 * - `restThreshold` : seuil de repos (position) sous lequel on snappe. Default 0.01.
 * - `velocityThreshold` : seuil de repos (vitesse). Default 0.01.
 */
export interface SpringConfig {
  damping: number
  stiffness: number
  mass: number
  restThreshold?: number
  velocityThreshold?: number
  /** Vitesse initiale en unités/seconde (souvent injectée par un gesture). */
  initialVelocity?: number
}

/**
 * Set de presets utilisés à travers l'app.
 * Reproduisent les feels Reanimated du mobile (`MOTION.spring`, `springSoft`).
 */
export const SPRINGS = {
  /** Standard : modales, panels, press release. */
  spring: { damping: 18, stiffness: 320, mass: 0.85 } satisfies SpringConfig,
  /** Doux : drawer, sheet de hauteur moyenne. */
  springSoft: { damping: 22, stiffness: 280, mass: 1 } satisfies SpringConfig,
  /** Snappy : badges, toggles, micro-interactions. */
  springSnappy: { damping: 14, stiffness: 480, mass: 0.7 } satisfies SpringConfig,
  /** Bottom sheet : amorti, gros mass pour le poids visuel. */
  sheetSpring: { damping: 26, stiffness: 240, mass: 1.1 } satisfies SpringConfig,
  /** Press feedback : retour rapide après touch release. */
  pressSpring: { damping: 16, stiffness: 420, mass: 0.6 } satisfies SpringConfig,
  /** Fade synchronisé (transitions opacité avec courbe spring-like). */
  fadeSpring: { damping: 20, stiffness: 220, mass: 0.9 } satisfies SpringConfig,
} as const

export type MotionSpringKey = keyof typeof SPRINGS

/* ───────────────────────── Compositions prêtes ───────────────────────── */

/**
 * Pre-composed CSS transition strings, pour usage rapide en `<style>`.
 * Pour des animations physiques (springs), utiliser `useSpring()` côté JS.
 */
export const TRANSITIONS = {
  /** Boutons : press feedback compatible CSS (fallback du JS spring). */
  press: `transform ${DURATIONS.ultraFast}ms ${EASING.iosOut}, filter ${DURATIONS.fast}ms ${EASING.iosOut}`,
  /** Carte / foto / élément liste. */
  card: `transform ${DURATIONS.medium}ms ${EASING.iosOut}, box-shadow ${DURATIONS.medium}ms ${EASING.iosOut}, border-color ${DURATIONS.fast}ms ${EASING.iosOut}`,
  /** Apparition / disparition standard. */
  fade: `opacity ${DURATIONS.medium}ms ${EASING.iosOut}`,
  /** Sheet : translateY. */
  sheet: `transform ${DURATIONS.slow}ms ${EASING.iosOut}`,
  /** Pages : translateX iOS push. */
  page: `transform ${DURATIONS.slow}ms ${EASING.iosOut}, opacity ${DURATIONS.medium}ms ${EASING.iosOut}`,
  /** Couleurs (theme, hover). */
  color: `background-color ${DURATIONS.fast}ms ${EASING.iosInOut}, color ${DURATIONS.fast}ms ${EASING.iosInOut}, border-color ${DURATIONS.fast}ms ${EASING.iosInOut}`,
} as const

/* ───────────────────────── Press feedback (visuel) ───────────────────────── */

/** Valeurs partagées par `usePressFeedback` et la directive `v-press`. */
export const PRESS_FEEDBACK = {
  /** Échelle au touch (= scale RN 0.92). */
  scale: 0.92,
  /** Brightness multiplier (subtle). */
  brightness: 0.97,
  /** Durée minimum de l'effet visible (évite le flash sub-frame). */
  minVisibleMs: 110,
  /** Spring de retour à l'état idle. */
  releaseSpring: SPRINGS.pressSpring,
} as const

/* ───────────────────────── Gestures ───────────────────────── */

export const GESTURE = {
  /** Distance min (px) pour décider d'une direction de drag. */
  directionThreshold: 8,
  /** Distance edge-back depuis bord gauche (px). */
  edgeBackWidth: 24,
  /** Distance min de dismiss vertical (px). */
  swipeDismissThresholdPx: 120,
  /** Pourcentage de hauteur de la couche pour dismiss (sheet). */
  swipeDismissThresholdRatio: 0.3,
  /** Velocity au-delà de laquelle on dismiss même sans atteindre le seuil distance. */
  flickVelocity: 1.2, // px/ms
  /** Rubber band : résistance hors-bornes (0..1, plus petit = plus dur à étirer). */
  rubberBandFactor: 0.5,
  /** Fenêtre de calcul de la vélocité (ms). */
  velocityWindow: 60,
  /** Hauteur d'inertie max après release (ms simulés). */
  momentumDurationMs: 600,
} as const

/* ───────────────────────── Helpers ───────────────────────── */

/**
 * Convertit une spring config en string CSS approximant.
 * Pour les cas où on ne veut pas brancher de JS spring (transitions CSS simples).
 */
export function springToCss(spring: SpringConfig, property = 'transform'): string {
  /* Approximation : durée plus longue si stiffness faible, courbe overshoot
     si damping faible. */
  const dur = Math.round(Math.max(140, 1000 / Math.sqrt(spring.stiffness / spring.mass)))
  const easing = spring.damping < 18 ? EASING.iosOvershoot : EASING.iosOut
  return `${property} ${dur}ms ${easing}`
}

/**
 * Effet rubber band (résistance élastique iOS) appliqué à un déplacement
 * hors-bornes. Reproduit `UIScrollView.bounces` côté natif.
 *
 * @param offset déplacement brut (px), peut être négatif
 * @param dimension dimension limitante (px) — typiquement hauteur du sheet
 * @returns déplacement amorti (px)
 */
export function rubberBand(offset: number, dimension: number): number {
  if (dimension <= 0) return offset
  const c = GESTURE.rubberBandFactor
  const sign = offset < 0 ? -1 : 1
  const abs = Math.abs(offset)
  return sign * ((1 - 1 / (abs / dimension + 1)) * dimension * (1 / c))
}

/** Synonyme MOTION pour parité avec Fotoce-Mobile/src/theme/motion.ts. */
export const MOTION = {
  fast: DURATIONS.fast,
  medium: DURATIONS.medium,
  slow: DURATIONS.slow,
  spring: SPRINGS.spring,
  springSoft: SPRINGS.springSoft,
} as const
