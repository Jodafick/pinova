/**
 * Directive `v-spring` — version premium iOS-spring de `v-press`.
 *
 *  Différence avec `v-press` :
 *   - scale par défaut **0.92** (iOS native button feel) vs 0.96
 *   - ressort iOS-heavy par défaut (`SPRINGS.pressSpringHeavy` si dispo, sinon
 *     `SPRINGS.pressSpring`) pour un retour plus tactile
 *   - accepte une **`intent: FeedbackIntent`** qui mappe sur le bon micro-feedback
 *     (haptic + visual pulse) au lieu d'un simple `haptic: boolean`
 *
 *  Usage :
 *    <button v-spring>Save</button>
 *    <button v-spring="{ intent: 'like', scale: 0.9 }">Like</button>
 *    <Fab v-spring="{ intent: 'modalOpenHeavy' }" />
 *
 *  Installation :
 *    app.directive('spring', vSpring)
 */

import type { Directive, DirectiveBinding } from 'vue'
import { PRESS_FEEDBACK, SPRINGS, type SpringConfig } from '../theme/motion'
import { emitMicroFeedback, type FeedbackIntent } from '../composables/useMicroFeedback'

export interface SpringDirectiveOptions {
  /** Échelle target au press. Default 0.92 (iOS-native). */
  scale?: number
  /** Brightness target (assombrissement subtil au press). Default theme. */
  brightness?: number
  /** Désactiver le retour haptique. */
  noHaptic?: boolean
  /** Intention sémantique — pilote le pattern haptic + visual. Default 'press'. */
  intent?: FeedbackIntent
  /** Override du ressort. Default iOS-heavy. */
  spring?: SpringConfig
}

interface SpringState {
  pointerId: number | null
  startX: number
  startY: number
  pressedAt: number
  raf: number | null
  value: number
  velocity: number
  target: number
  config: SpringConfig
  opts: SpringDirectiveOptions
}

const STATES = new WeakMap<HTMLElement, SpringState>()

function readOpts(b: DirectiveBinding<SpringDirectiveOptions | undefined>): SpringDirectiveOptions {
  return b.value ?? {}
}

function isReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

function applyTransform(el: HTMLElement, scale: number, opts: SpringDirectiveOptions) {
  const minScale = opts.scale ?? 0.92
  const minBright = opts.brightness ?? PRESS_FEEDBACK.brightness
  const t = (scale - minScale) / Math.max(0.0001, 1 - minScale)
  const brightness = minBright + (1 - minBright) * t
  el.style.transform = `scale3d(${scale}, ${scale}, 1)`
  el.style.filter = `brightness(${brightness.toFixed(3)})`
}

function clearTransform(el: HTMLElement) {
  el.style.transform = ''
  el.style.filter = ''
}

function springStep(el: HTMLElement, state: SpringState) {
  let lastTime: number | null = null
  const cfg = state.config
  const tick = (now: number) => {
    if (lastTime == null) {
      lastTime = now
      state.raf = requestAnimationFrame(tick)
      return
    }
    const dtMs = Math.min(32, now - lastTime)
    lastTime = now
    const dt = dtMs / 1000
    const sub = 4
    const subDt = dt / sub
    let x = state.value
    let v = state.velocity
    for (let i = 0; i < sub; i += 1) {
      const fS = -cfg.stiffness * (x - state.target)
      const fD = -cfg.damping * v
      const a = (fS + fD) / (cfg.mass || 1)
      v += a * subDt
      x += v * subDt
    }
    state.value = x
    state.velocity = v
    applyTransform(el, x, state.opts)
    if (Math.abs(state.target - x) < 0.001 && Math.abs(v) < 0.01) {
      state.value = state.target
      if (state.target === 1) clearTransform(el)
      state.raf = null
      return
    }
    state.raf = requestAnimationFrame(tick)
  }
  state.raf = requestAnimationFrame(tick)
}

function startReleaseSpring(el: HTMLElement, state: SpringState) {
  if (state.raf != null) { cancelAnimationFrame(state.raf); state.raf = null }
  if (isReducedMotion()) { state.value = 1; clearTransform(el); return }
  state.target = 1
  springStep(el, state)
}

function onPointerDown(e: PointerEvent) {
  const el = e.currentTarget as HTMLElement
  const state = STATES.get(el)
  if (!state) return
  if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') return
  if (e.pointerType === 'mouse' && e.button !== 0) return

  if (state.raf != null) { cancelAnimationFrame(state.raf); state.raf = null }

  state.pointerId = e.pointerId
  state.startX = e.clientX
  state.startY = e.clientY
  state.pressedAt = performance.now()

  const minScale = state.opts.scale ?? 0.92
  state.value = minScale
  state.velocity = 0
  state.target = minScale

  if (isReducedMotion()) {
    el.style.opacity = '0.82'
  } else {
    applyTransform(el, minScale, state.opts)
  }

  if (!state.opts.noHaptic && e.pointerType === 'touch') {
    emitMicroFeedback(state.opts.intent ?? 'press')
  }
}

function onPointerMove(e: PointerEvent) {
  const el = e.currentTarget as HTMLElement
  const state = STATES.get(el)
  if (!state || state.pointerId == null || state.pointerId !== e.pointerId) return
  const dx = Math.abs(e.clientX - state.startX)
  const dy = Math.abs(e.clientY - state.startY)
  if (dx > 8 || dy > 8) cancelPress(el, state)
}

function onPointerUp(e: PointerEvent) {
  const el = e.currentTarget as HTMLElement
  const state = STATES.get(el)
  if (!state || state.pointerId == null || state.pointerId !== e.pointerId) return
  state.pointerId = null

  const elapsed = performance.now() - state.pressedAt
  const hold = Math.max(0, PRESS_FEEDBACK.minVisibleMs - elapsed)

  if (isReducedMotion()) {
    setTimeout(() => { el.style.opacity = '' }, hold)
    return
  }
  setTimeout(() => startReleaseSpring(el, state), hold)
}

function cancelPress(el: HTMLElement, state: SpringState) {
  state.pointerId = null
  if (isReducedMotion()) { el.style.opacity = ''; return }
  startReleaseSpring(el, state)
}

function onPointerCancel(e: PointerEvent) {
  const el = e.currentTarget as HTMLElement
  const state = STATES.get(el)
  if (!state) return
  cancelPress(el, state)
}

function onPointerLeave(e: PointerEvent) {
  const el = e.currentTarget as HTMLElement
  const state = STATES.get(el)
  if (!state || state.pointerId == null) return
  cancelPress(el, state)
}

export const vSpring: Directive<HTMLElement, SpringDirectiveOptions | undefined> = {
  mounted(el, binding) {
    const opts = readOpts(binding)
    const state: SpringState = {
      pointerId: null,
      startX: 0,
      startY: 0,
      pressedAt: 0,
      raf: null,
      value: 1,
      velocity: 0,
      target: 1,
      config: opts.spring ?? SPRINGS.pressSpring,
      opts,
    }
    STATES.set(el, state)
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove, { passive: true })
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerCancel)
    el.addEventListener('pointerleave', onPointerLeave)
    el.style.setProperty('-webkit-tap-highlight-color', 'transparent')
    if (!el.style.touchAction) el.style.touchAction = 'manipulation'
    el.style.transformOrigin = '50% 50%'
    el.style.backfaceVisibility = 'hidden'
    el.style.willChange = 'transform, filter'
  },
  updated(el, binding) {
    const state = STATES.get(el)
    if (!state) return
    state.opts = readOpts(binding)
    state.config = state.opts.spring ?? SPRINGS.pressSpring
  },
  beforeUnmount(el) {
    const state = STATES.get(el)
    if (state?.raf != null) cancelAnimationFrame(state.raf)
    el.removeEventListener('pointerdown', onPointerDown)
    el.removeEventListener('pointermove', onPointerMove)
    el.removeEventListener('pointerup', onPointerUp)
    el.removeEventListener('pointercancel', onPointerCancel)
    el.removeEventListener('pointerleave', onPointerLeave)
    el.style.willChange = ''
    STATES.delete(el)
  },
}

export default vSpring
