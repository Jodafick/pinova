/**
 * Composable safe-area-inset (iOS notch + dynamic island + home indicator).
 *
 * Lit les valeurs CSS `env(safe-area-inset-*)` via un noeud sentinelle invisible
 * et expose des refs réactives. Recalcule au resize / orientationchange /
 * visualViewport resize (clavier iOS).
 *
 * Utiliser dans tous les LayerPresenters pour padder correctement.
 */

import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

let sentinel: HTMLDivElement | null = null
let refCount = 0

const top: Ref<number> = ref(0)
const right: Ref<number> = ref(0)
const bottom: Ref<number> = ref(0)
const left: Ref<number> = ref(0)
const keyboardHeight: Ref<number> = ref(0)

function ensureSentinel(): HTMLDivElement | null {
  if (typeof document === 'undefined') return null
  if (sentinel) return sentinel
  const el = document.createElement('div')
  el.setAttribute('aria-hidden', 'true')
  el.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'width:0',
    'height:0',
    'pointer-events:none',
    'visibility:hidden',
    'padding-top:env(safe-area-inset-top,0px)',
    'padding-right:env(safe-area-inset-right,0px)',
    'padding-bottom:env(safe-area-inset-bottom,0px)',
    'padding-left:env(safe-area-inset-left,0px)',
  ].join(';')
  document.body.appendChild(el)
  sentinel = el
  return sentinel
}

function readSafeArea() {
  const el = ensureSentinel()
  if (!el) return
  const cs = window.getComputedStyle(el)
  top.value = parseFloat(cs.paddingTop) || 0
  right.value = parseFloat(cs.paddingRight) || 0
  bottom.value = parseFloat(cs.paddingBottom) || 0
  left.value = parseFloat(cs.paddingLeft) || 0
}

function readKeyboard() {
  if (typeof window === 'undefined') return
  const vv = window.visualViewport
  if (!vv) {
    keyboardHeight.value = 0
    return
  }
  /* Heuristique iOS : clavier = window.innerHeight - visualViewport.height (+ safe bottom). */
  const diff = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
  keyboardHeight.value = diff > 24 ? diff : 0
}

function onResize() {
  readSafeArea()
  readKeyboard()
}

function bindListeners() {
  if (typeof window === 'undefined') return
  window.addEventListener('resize', onResize, { passive: true })
  window.addEventListener('orientationchange', onResize, { passive: true })
  window.visualViewport?.addEventListener('resize', onResize)
  window.visualViewport?.addEventListener('scroll', onResize)
}

function unbindListeners() {
  if (typeof window === 'undefined') return
  window.removeEventListener('resize', onResize)
  window.removeEventListener('orientationchange', onResize)
  window.visualViewport?.removeEventListener('resize', onResize)
  window.visualViewport?.removeEventListener('scroll', onResize)
}

export function useSafeArea() {
  onMounted(() => {
    refCount += 1
    if (refCount === 1) {
      bindListeners()
    }
    readSafeArea()
    readKeyboard()
  })
  onBeforeUnmount(() => {
    refCount = Math.max(0, refCount - 1)
    if (refCount === 0) {
      unbindListeners()
      if (sentinel) {
        sentinel.remove()
        sentinel = null
      }
    }
  })

  return {
    /** Inset haut (notch / dynamic island). */
    top,
    /** Inset droit (paysage iPhone X+). */
    right,
    /** Inset bas (home indicator). */
    bottom,
    /** Inset gauche. */
    left,
    /** Hauteur du clavier virtuel (iOS soft keyboard). */
    keyboardHeight,
  }
}
