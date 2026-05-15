/**
 * Haptics — abstraction simple sur `navigator.vibrate`.
 *
 * Web ne fournit que vibrate (Android Chrome principalement). iOS Safari
 * actuel n'expose RIEN (Apple bloque vibrate). On garde l'API pour
 * que le code reste prêt à brancher sur l'iOS Web Haptics API quand elle
 * sera disponible (ou via Capacitor en wrapper natif).
 *
 * Utilisation :
 *   triggerHaptic('light')
 *   triggerHaptic('medium')
 *   triggerHaptic('success')
 *
 * Aucun throw : si non supporté, c'est un no-op silencieux.
 */

export type HapticPattern =
  /** Tap léger (~8ms). */
  | 'light'
  /** Sélection (~14ms). */
  | 'medium'
  /** Impact ferme (~24ms). */
  | 'heavy'
  /** Double micro-impulsion type « changement de segment / picker » iOS. */
  | 'selection'
  /** Confirmation positive (pattern court). */
  | 'success'
  /** Avertissement (pattern double). */
  | 'warning'
  /** Erreur (pattern long). */
  | 'error'

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 8,
  medium: 14,
  heavy: 24,
  /* Deux ticks courts séparés — proche du feedback « selection changed » iOS. */
  selection: [3, 42, 5],
  success: [6, 40, 12],
  warning: [8, 30, 8, 30, 12],
  error: [12, 60, 24],
}

/** Anti-spam : évite les rafales (scroll + tap, listes virtualisées). */
const THROTTLE_DEFAULT_MS = 44
const THROTTLE_COMPLEX_MS = 140
let lastHapticAt = 0
let lastPattern: HapticPattern | null = null

function shouldThrottle(pattern: HapticPattern, now: number): boolean {
  if (lastHapticAt === 0) return false
  const dt = now - lastHapticAt
  if (dt <= 0) return false
  const complex = pattern === 'success' || pattern === 'warning' || pattern === 'error'
  if (complex) return dt < THROTTLE_COMPLEX_MS
  /* Même pattern répété très vite (ex. press sur liste) → throttle plus ferme. */
  if (lastPattern === pattern && dt < THROTTLE_DEFAULT_MS) return true
  /* Entre deux patterns légers différents, garde un plancher minimal. */
  if (dt < 28) return true
  return false
}

let userOptedOut = false

/**
 * Désactive globalement les vibrations (paramètre utilisateur).
 */
export function setHapticsEnabled(enabled: boolean) {
  userOptedOut = !enabled
}

/**
 * Renvoie `true` si l'haptique peut potentiellement déclencher quelque chose.
 * (Note : iOS Safari renvoie `true` à la présence de l'API mais ne vibre pas
 * réellement. C'est volontaire d'Apple. On garde l'appel pour Android.)
 */
export function isHapticSupported(): boolean {
  if (userOptedOut) return false
  if (typeof navigator === 'undefined') return false
  return typeof navigator.vibrate === 'function'
}

/**
 * Déclenche un retour haptique. Toujours sûr (no-op si non supporté).
 */
export function triggerHaptic(pattern: HapticPattern = 'light'): void {
  if (!isHapticSupported()) return
  /* Préfère pas vibrer si l'utilisateur a `prefers-reduced-motion: reduce`. */
  try {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    }
  } catch {
    /* ignore */
  }
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  if (shouldThrottle(pattern, now)) return
  lastHapticAt = now
  lastPattern = pattern
  try {
    navigator.vibrate(PATTERNS[pattern])
  } catch {
    /* iOS sans support : silent. */
  }
}

/**
 * Composable Vue : expose les méthodes pour usage dans setup().
 */
export function useHaptics() {
  return {
    trigger: triggerHaptic,
    isSupported: isHapticSupported,
    setEnabled: setHapticsEnabled,
    /** Raccourcis sémantiques (alignés iOS UIFeedbackGenerator). */
    light: () => triggerHaptic('light'),
    medium: () => triggerHaptic('medium'),
    heavy: () => triggerHaptic('heavy'),
    selection: () => triggerHaptic('selection'),
    success: () => triggerHaptic('success'),
    warning: () => triggerHaptic('warning'),
    error: () => triggerHaptic('error'),
  }
}
