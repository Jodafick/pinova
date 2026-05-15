/**
 * Micro-feedback — couche tactile premium (haptique + visuel + son optionnel).
 *
 * Centralise le mapping « intention UX → pattern vibratoire » pour rester
 * cohérent, subtil et jamais agressif (pas de rafales de vibrations).
 *
 * Usage :
 *
 *   import { emitMicroFeedback } from './useMicroFeedback'
 *   emitMicroFeedback('save')
 *   emitMicroFeedback('success', { visual: true })
 *
 * Son (optionnel, ex. WebAudio futur) :
 *
 *   registerFeedbackSound((intent) => { ... })
 */

import { triggerHaptic, type HapticPattern } from './useHaptics'

/** Intentions métier — une seule source de vérité pour le mapping. */
export type FeedbackIntent =
  | 'press'
  | 'like'
  | 'save'
  | 'modalOpen'
  | 'modalOpenHeavy'
  | 'modalClose'
  | 'pullRefreshArm'
  | 'pullRefreshRelease'
  | 'sheetSnap'
  | 'sheetDismiss'
  | 'tabSwitch'
  | 'longPress'
  | 'success'
  | 'warning'
  | 'error'
  | 'navigation'
  | 'validation'
  | 'danger'
  | 'edgeSwipe'

const INTENT_TO_HAPTIC: Record<FeedbackIntent, HapticPattern> = {
  press: 'light',
  like: 'medium',
  save: 'light',
  modalOpen: 'light',
  modalOpenHeavy: 'medium',
  modalClose: 'light',
  pullRefreshArm: 'light',
  pullRefreshRelease: 'medium',
  sheetSnap: 'light',
  sheetDismiss: 'light',
  tabSwitch: 'selection',
  longPress: 'medium',
  success: 'success',
  warning: 'warning',
  error: 'error',
  navigation: 'light',
  validation: 'selection',
  danger: 'heavy',
  edgeSwipe: 'light',
}

/** Pulse visuel ultra discret sur `<html>` (désactivé si reduced-motion). */
const PULSE_CLASS = 'pinova-micro-feedback-pulse'
let pulseTimer: ReturnType<typeof setTimeout> | null = null

function scheduleVisualPulse() {
  if (typeof document === 'undefined') return
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  } catch {
    return
  }
  document.documentElement.classList.add(PULSE_CLASS)
  if (pulseTimer) clearTimeout(pulseTimer)
  pulseTimer = setTimeout(() => {
    document.documentElement.classList.remove(PULSE_CLASS)
    pulseTimer = null
  }, 260)
}

let soundHook: ((intent: FeedbackIntent) => void) | null = null

export function registerFeedbackSound(fn: (intent: FeedbackIntent) => void): void {
  soundHook = fn
}

export function unregisterFeedbackSound(): void {
  soundHook = null
}

export interface EmitMicroFeedbackOptions {
  /** Force un pulse visuel (très subtil). */
  visual?: boolean
  /** Ne pas vibrer (ex. tests). */
  skipHaptic?: boolean
}

/**
 * Déclenche le retour haptique + optionnellement visuel/son pour une intention.
 */
export function emitMicroFeedback(
  intent: FeedbackIntent,
  options: EmitMicroFeedbackOptions = {},
): void {
  if (!options.skipHaptic) {
    const pattern = INTENT_TO_HAPTIC[intent]
    triggerHaptic(pattern)
  }
  try {
    soundHook?.(intent)
  } catch (e) {
    console.warn('[useMicroFeedback] soundHook error', e)
  }
  if (options.visual === false) return
  const autoVisual = intent === 'success' || intent === 'validation'
  if (options.visual === true || autoVisual) scheduleVisualPulse()
}

/** Raccourci : ouverture de couche selon intensité (fullscreen = heavy). */
export function emitLayerOpenFeedback(heavy: boolean): void {
  emitMicroFeedback(heavy ? 'modalOpenHeavy' : 'modalOpen')
}

export function emitLayerCloseFeedback(): void {
  emitMicroFeedback('modalClose')
}
