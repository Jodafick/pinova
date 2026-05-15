/**
 * Press Feedback iOS — scale 0.92 au touch + rebond spring au release.
 *
 * Deux usages :
 *
 *  1. Composable `usePressFeedback(elRef, options)` : pour s'attacher
 *     à un `ref<HTMLElement>` existant.
 *
 *  2. Directive `v-press` (cf. `vPressDirective.ts`) :
 *     `<button v-press>Save</button>` → applique le feedback sans
 *     ref + composable explicites.
 *
 * Caractéristiques :
 *  - réagit en < 16ms (pointerdown synchrone)
 *  - utilise un ressort RAF pour le retour (pressSpring)
 *  - respecte `prefers-reduced-motion`
 *  - haptique optionnel (light) au touch
 *  - ignore les éléments désactivés (`disabled`, `aria-disabled="true"`)
 *  - protège contre les "tap-fantômes" en cas de scroll (>8px déplacement = cancel)
 */

import { onBeforeUnmount, onMounted, type Ref } from 'vue'
import { PRESS_FEEDBACK } from '../theme/motion'
import { useSpring } from './useSpring'
import { emitMicroFeedback } from './useMicroFeedback'

export interface UsePressFeedbackOptions {
  /** Échelle min au touch. Default 0.92. */
  scale?: number
  /** Multiplier brightness. Default 0.97. */
  brightness?: number
  /** Déclencher un haptic light au touch. Default true (no-op si non supporté). */
  haptic?: boolean
  /** Désactive le feedback (ex: bouton chargement). */
  disabled?: () => boolean
}

export function usePressFeedback(
  elRef: Ref<HTMLElement | null>,
  options: UsePressFeedbackOptions = {},
) {
  const scaleTarget = options.scale ?? PRESS_FEEDBACK.scale
  const brightnessTarget = options.brightness ?? PRESS_FEEDBACK.brightness
  const wantHaptic = options.haptic ?? true

  /* Spring "scale" ∈ [scaleTarget, 1]. */
  const sp = useSpring(1, PRESS_FEEDBACK.releaseSpring)

  let pointerId: number | null = null
  let startX = 0
  let startY = 0
  let pressedAt = 0

  function apply(value: number) {
    const el = elRef.value
    if (!el) return
    /* On encode brightness sur le filter pour éviter de toucher couleur/opacité. */
    const b = 1 - (1 - brightnessTarget) * (1 - (value - scaleTarget) / Math.max(0.0001, 1 - scaleTarget))
    el.style.transform = `scale3d(${value}, ${value}, 1)`
    el.style.filter = `brightness(${b.toFixed(3)})`
    el.style.boxShadow = value <= scaleTarget + 0.02 ? '0 6px 22px rgba(224, 36, 94, 0.12)' : ''
  }

  function watchSpring() {
    /* Boucle de rendu : on relit `sp.value.value` à chaque rAF tant que actif. */
    if (!sp.isAnimating.value && sp.value.value === sp.target.value) {
      apply(sp.value.value)
      return
    }
    apply(sp.value.value)
    requestAnimationFrame(watchSpring)
  }

  function isDisabled(): boolean {
    if (options.disabled?.()) return true
    const el = elRef.value
    if (!el) return true
    if (el.hasAttribute('disabled')) return true
    if (el.getAttribute('aria-disabled') === 'true') return true
    return false
  }

  function onPointerDown(e: PointerEvent) {
    if (isDisabled()) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    pointerId = e.pointerId
    startX = e.clientX
    startY = e.clientY
    pressedAt = performance.now()
    if (wantHaptic && e.pointerType === 'touch') emitMicroFeedback('press')
    sp.set(scaleTarget, { immediate: true })
    apply(scaleTarget)
    /* On lance la boucle uniquement au release (pour la phase de retour). */
  }

  function onPointerMove(e: PointerEvent) {
    if (pointerId == null || e.pointerId !== pointerId) return
    const dx = Math.abs(e.clientX - startX)
    const dy = Math.abs(e.clientY - startY)
    /* Annulation si l'utilisateur scroll/drag. */
    if (dx > 8 || dy > 8) cancelPress()
  }

  function onPointerUp(e: PointerEvent) {
    if (pointerId == null || e.pointerId !== pointerId) return
    pointerId = null
    /* Maintenir l'effet au moins `minVisibleMs` pour ne pas flasher si l'utilisateur
       a tappé très vite (< 1 frame). */
    const elapsed = performance.now() - pressedAt
    const hold = Math.max(0, PRESS_FEEDBACK.minVisibleMs - elapsed)
    setTimeout(() => {
      sp.set(1, {
        onRest: () => {
          const el = elRef.value
          if (el) {
            el.style.transform = ''
            el.style.filter = ''
          }
        },
      })
      requestAnimationFrame(watchSpring)
    }, hold)
  }

  function cancelPress() {
    if (pointerId == null) return
    pointerId = null
    sp.set(1, {
      onRest: () => {
        const el = elRef.value
        if (el) {
          el.style.transform = ''
          el.style.filter = ''
          el.style.boxShadow = ''
        }
      },
    })
    requestAnimationFrame(watchSpring)
  }

  function attach() {
    const el = elRef.value
    if (!el) return
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove, { passive: true })
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', cancelPress)
    el.addEventListener('pointerleave', cancelPress)
    /* iOS Safari : empêche tap highlight + 300ms delay. */
    el.style.setProperty('-webkit-tap-highlight-color', 'transparent')
    el.style.touchAction = el.style.touchAction || 'manipulation'
    el.style.willChange = 'transform, filter, box-shadow'
    el.style.transformOrigin = '50% 50%'
    el.style.backfaceVisibility = 'hidden'
  }

  function detach() {
    const el = elRef.value
    if (!el) return
    el.removeEventListener('pointerdown', onPointerDown)
    el.removeEventListener('pointermove', onPointerMove)
    el.removeEventListener('pointerup', onPointerUp)
    el.removeEventListener('pointercancel', cancelPress)
    el.removeEventListener('pointerleave', cancelPress)
    el.style.willChange = ''
  }

  onMounted(() => attach())
  onBeforeUnmount(() => detach())

  return { isPressing: sp.isAnimating, scale: sp.value }
}
