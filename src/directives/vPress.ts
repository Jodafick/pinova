/**
 * Directive `v-press` — feedback iOS-style sans composable explicite.
 *
 * Usage :
 *   <button v-press>Save</button>
 *   <button v-press="{ scale: 0.94, haptic: false }">Custom</button>
 *
 * Installation :
 *   app.directive('press', vPress)
 *
 * Sous le capot : équivalent à `usePressFeedback`, mais implémentation
 * pure JS sans recourir à composable (la directive est mountée hors `setup()`).
 */

import type { Directive, DirectiveBinding } from 'vue'
import { PRESS_FEEDBACK, SPRINGS, type SpringConfig } from '../theme/motion'
import { emitMicroFeedback } from '../composables/useMicroFeedback'

interface PressOptions {
  scale?: number
  brightness?: number
  haptic?: boolean
  spring?: SpringConfig
}

interface PressState {
  pointerId: number | null
  startX: number
  startY: number
  pressedAt: number
  raf: number | null
  springValue: number
  springVelocity: number
  springTarget: number
  springConfig: SpringConfig
  options: PressOptions
}

const STATES = new WeakMap<HTMLElement, PressState>()

function getOptions(binding: DirectiveBinding<PressOptions | undefined>): PressOptions {
  return binding.value ?? {}
}

function applyTransform(el: HTMLElement, scale: number, options: PressOptions) {
  const minScale = options.scale ?? PRESS_FEEDBACK.scale
  const brightnessMin = options.brightness ?? PRESS_FEEDBACK.brightness
  /* scale ∈ [minScale..1] → brightness ∈ [brightnessMin..1] linéaire. */
  const t = (scale - minScale) / Math.max(0.0001, 1 - minScale)
  const b = brightnessMin + (1 - brightnessMin) * t
  el.style.transform = `scale3d(${scale}, ${scale}, 1)`
  el.style.filter = `brightness(${b.toFixed(3)})`
  el.style.boxShadow = scale <= minScale + 0.02 ? '0 6px 22px rgba(224, 36, 94, 0.12)' : ''
}

function clearTransform(el: HTMLElement) {
  el.style.transform = ''
  el.style.filter = ''
  el.style.boxShadow = ''
}

function isReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

function startSpringToOne(el: HTMLElement, state: PressState) {
  if (isReducedMotion()) {
    state.springValue = 1
    clearTransform(el)
    return
  }
  state.springTarget = 1
  let lastTime: number | null = null
  const cfg = state.springConfig

  const step = (now: number) => {
    if (lastTime == null) {
      lastTime = now
      state.raf = requestAnimationFrame(step)
      return
    }
    const dtMs = Math.min(32, now - lastTime)
    lastTime = now
    const dt = dtMs / 1000

    const subSteps = 4
    const subDt = dt / subSteps
    let x = state.springValue
    let v = state.springVelocity
    for (let i = 0; i < subSteps; i += 1) {
      const fS = -cfg.stiffness * (x - state.springTarget)
      const fD = -cfg.damping * v
      const a = (fS + fD) / (cfg.mass || 1)
      v += a * subDt
      x += v * subDt
    }
    state.springValue = x
    state.springVelocity = v
    applyTransform(el, x, state.options)

    if (Math.abs(state.springTarget - x) < 0.001 && Math.abs(v) < 0.01) {
      state.springValue = state.springTarget
      clearTransform(el)
      state.raf = null
      return
    }
    state.raf = requestAnimationFrame(step)
  }
  state.raf = requestAnimationFrame(step)
}

function onPointerDown(e: PointerEvent) {
  const el = e.currentTarget as HTMLElement
  const state = STATES.get(el)
  if (!state) return
  if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') return
  if (e.pointerType === 'mouse' && e.button !== 0) return

  /* Annule un éventuel ressort en cours. */
  if (state.raf != null) {
    cancelAnimationFrame(state.raf)
    state.raf = null
  }

  state.pointerId = e.pointerId
  state.startX = e.clientX
  state.startY = e.clientY
  state.pressedAt = performance.now()

  const minScale = state.options.scale ?? PRESS_FEEDBACK.scale
  state.springValue = minScale
  state.springVelocity = 0
  state.springTarget = minScale

  if (isReducedMotion()) {
    el.style.opacity = '0.85'
  } else {
    applyTransform(el, minScale, state.options)
  }

  if ((state.options.haptic ?? true) && e.pointerType === 'touch') emitMicroFeedback('press')
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
  setTimeout(() => startSpringToOne(el, state), hold)
}

function cancelPress(el: HTMLElement, state: PressState) {
  state.pointerId = null
  if (isReducedMotion()) {
    el.style.opacity = ''
    return
  }
  startSpringToOne(el, state)
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

export const vPress: Directive<HTMLElement, PressOptions | undefined> = {
  mounted(el, binding) {
    const state: PressState = {
      pointerId: null,
      startX: 0,
      startY: 0,
      pressedAt: 0,
      raf: null,
      springValue: 1,
      springVelocity: 0,
      springTarget: 1,
      springConfig: getOptions(binding).spring ?? SPRINGS.pressSpring,
      options: getOptions(binding),
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
    state.options = getOptions(binding)
    state.springConfig = state.options.spring ?? SPRINGS.pressSpring
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
