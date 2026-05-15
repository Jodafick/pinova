/**
 * Shared Element Transitions — pattern FLIP (First, Last, Invert, Play).
 *
 * Cas d'usage :
 *  - tile de pin → fullscreen détail (image qui "morph")
 *  - avatar dans liste → fullscreen profil
 *  - FAB "+" → modale create
 *  - card → page détail
 *
 * Principe : on capture le rect de l'élément source AVANT le démontage,
 * puis on retrouve l'élément cible et on interpole transform + radius
 * depuis le rect source vers le rect destination, par-dessus le DOM.
 *
 * Avantage : 100% transform/opacity → GPU friendly, pas de reflow.
 *
 * Usage typique :
 *
 *   // Côté source (clic sur le pin) :
 *   captureSharedElement('pin:abc', tileEl, { borderRadius: 12 })
 *   router.push({ ... })
 *
 *   // Côté destination (composant fullscreen mounted) :
 *   playSharedElement('pin:abc', heroEl, {
 *     toBorderRadius: 0,
 *     duration: 320,
 *   })
 */

import { EASING, DURATIONS } from '../theme/motion'

interface CapturedElement {
  id: string
  rect: DOMRect
  borderRadius: number
  /** Image source si applicable (pour clone visuel). */
  imageSrc?: string | null
  /** Background-color si applicable. */
  backgroundColor?: string | null
  /** Heure de capture. */
  capturedAt: number
}

const captures = new Map<string, CapturedElement>()

/** Durée de validité d'un snapshot (ms) — purge automatique au-delà. */
const CAPTURE_TTL_MS = 1500

function purgeExpired() {
  const now = performance.now()
  for (const [id, cap] of captures) {
    if (now - cap.capturedAt > CAPTURE_TTL_MS) captures.delete(id)
  }
}

export interface CaptureOptions {
  /** Border-radius source (forcer si CSS non lisible). */
  borderRadius?: number
  /** Image URL si l'élément est conceptuellement une image (cache visuel). */
  imageSrc?: string | null
  /** Bg color override. */
  backgroundColor?: string | null
}

/**
 * Capture l'état visuel d'un élément source pour le réutiliser au mount
 * de l'élément cible.
 */
export function captureSharedElement(id: string, el: HTMLElement | null, opts: CaptureOptions = {}): void {
  purgeExpired()
  if (!el) return
  const rect = el.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return
  const cs = window.getComputedStyle(el)
  const radius = opts.borderRadius ?? (parseFloat(cs.borderTopLeftRadius || '0') || 0)
  captures.set(id, {
    id,
    rect,
    borderRadius: radius,
    imageSrc: opts.imageSrc ?? null,
    backgroundColor: opts.backgroundColor ?? (cs.backgroundColor || null),
    capturedAt: performance.now(),
  })
}

/** Consomme (et purge) la capture associée à `id` sans la jouer. */
export function consumeSharedElement(id: string): CapturedElement | null {
  const c = captures.get(id) ?? null
  if (c) captures.delete(id)
  return c
}

export interface PlayOptions {
  /** Border-radius destination. */
  toBorderRadius?: number
  /** Durée totale (ms). Default 320. */
  duration?: number
  /** Easing CSS. Default ease iOS out. */
  easing?: string
  /** Callback à la fin. */
  onComplete?: () => void
  /** Retarde le start (utile si l'image cible n'est pas encore décodée). */
  delay?: number
}

function isReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

/**
 * Joue la transition entre la capture précédente (par id) et la position
 * actuelle de `targetEl`. À appeler quand `targetEl` est monté et dans
 * sa position finale.
 *
 * Implémentation FLIP : on calcule l'inverse (transform pour faire revenir
 * la cible à la position source), puis on anime vers `transform: none`.
 */
export function playSharedElement(
  id: string,
  targetEl: HTMLElement | null,
  options: PlayOptions = {},
): boolean {
  const cap = consumeSharedElement(id)
  if (!cap || !targetEl) return false
  if (isReducedMotion()) {
    options.onComplete?.()
    return false
  }

  const targetRect = targetEl.getBoundingClientRect()
  if (targetRect.width === 0 || targetRect.height === 0) return false

  const duration = options.duration ?? DURATIONS.medium + 60
  const easing = options.easing ?? EASING.iosOut
  const toRadius = options.toBorderRadius ?? 0
  const delay = options.delay ?? 0

  /* Inverse : transformer la cible pour qu'elle apparaisse à la position source. */
  const sx = cap.rect.width / targetRect.width
  const sy = cap.rect.height / targetRect.height
  const tx = cap.rect.left - targetRect.left
  const ty = cap.rect.top - targetRect.top

  /* Préparation : pose immédiatement le transform inversé sans transition. */
  const prev = {
    transform: targetEl.style.transform,
    transformOrigin: targetEl.style.transformOrigin,
    borderRadius: targetEl.style.borderRadius,
    transition: targetEl.style.transition,
    willChange: targetEl.style.willChange,
  }
  targetEl.style.transformOrigin = '0 0'
  targetEl.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${sx}, ${sy})`
  targetEl.style.borderRadius = `${cap.borderRadius}px`
  targetEl.style.willChange = 'transform, border-radius'
  /* Force un reflow pour stabiliser le state initial. */
  void targetEl.offsetWidth

  /* Play : 2 rAF pour s'assurer que le browser a peint l'état initial. */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      targetEl.style.transition = `transform ${duration}ms ${easing} ${delay}ms, border-radius ${duration}ms ${easing} ${delay}ms`
      targetEl.style.transform = 'translate3d(0, 0, 0) scale(1, 1)'
      targetEl.style.borderRadius = `${toRadius}px`

      const onEnd = () => {
        targetEl.removeEventListener('transitionend', onEnd)
        /* Reset propre. */
        targetEl.style.transform = prev.transform
        targetEl.style.transformOrigin = prev.transformOrigin
        targetEl.style.borderRadius = prev.borderRadius
        targetEl.style.transition = prev.transition
        targetEl.style.willChange = prev.willChange
        options.onComplete?.()
      }
      targetEl.addEventListener('transitionend', onEnd, { once: true })
      /* Failsafe : si transitionend ne fire pas, force le reset après duration+delay+safety. */
      window.setTimeout(onEnd, duration + delay + 80)
    })
  })

  return true
}

/**
 * Helper "round-trip" : joue la transition dès qu'un sélecteur est trouvé
 * dans le DOM (utile pour les pages async).
 */
export function playSharedElementWhenReady(
  id: string,
  selectorOrEl: string | (() => HTMLElement | null),
  options: PlayOptions = {},
  timeoutMs = 1200,
): Promise<boolean> {
  return new Promise((resolve) => {
    const cap = captures.get(id)
    if (!cap) { resolve(false); return }

    const start = performance.now()
    const tryNow = () => {
      const el = typeof selectorOrEl === 'string'
        ? (document.querySelector(selectorOrEl) as HTMLElement | null)
        : selectorOrEl()
      if (el) {
        resolve(playSharedElement(id, el, options))
        return
      }
      if (performance.now() - start > timeoutMs) {
        /* Purge la capture pour ne pas leak. */
        captures.delete(id)
        resolve(false)
        return
      }
      requestAnimationFrame(tryNow)
    }
    tryNow()
  })
}

/** Purge totale (logout / cleanup). */
export function clearAllSharedElements() {
  captures.clear()
}
