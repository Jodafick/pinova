/**
 * Input Abstraction — couche d'entrée unifiée (clavier, souris, touch).
 *
 * - J / K : défilement du feed (routes avec `meta.keyboardFeedNav`)
 * - Ctrl / Cmd + clic sur lien interne : ouvre en couche si `presentation !== 'page'`
 *   (sinon navigation normale — laisser le navigateur ouvrir un onglet si besoin)
 *
 * Ne pas capturer les touches quand la cible est un champ éditable.
 *
 * Initialisation : `initInputAbstraction(router)` depuis `main.ts`.
 */

import type { Router } from 'vue-router'
import { navigateOrOpenLayer } from './routerLayerBridge'

const FEED_SCROLL_EVENT = 'pinova-feed-keyboard-scroll'

let routerRef: Router | null = null
let bound = false

function isEditableTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  if (el.closest('[contenteditable="true"]')) return true
  if (el.closest('input, textarea, select')) return true
  return false
}

function onKeydown(e: KeyboardEvent) {
  if (e.defaultPrevented) return
  if (e.altKey || e.ctrlKey || e.metaKey) return
  if (isEditableTarget(e.target)) return
  const router = routerRef
  if (!router) return
  const meta = router.currentRoute.value.meta
  if (!meta.keyboardFeedNav) return

  if (e.key === 'j' || e.key === 'J') {
    e.preventDefault()
    window.dispatchEvent(new CustomEvent(FEED_SCROLL_EVENT, { detail: { delta: 1 } }))
    return
  }
  if (e.key === 'k' || e.key === 'K') {
    e.preventDefault()
    window.dispatchEvent(new CustomEvent(FEED_SCROLL_EVENT, { detail: { delta: -1 } }))
  }
}

function onDocumentClickCapture(e: MouseEvent) {
  if (!(e.ctrlKey || e.metaKey)) return
  const router = routerRef
  if (!router) return
  const a = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null
  if (!a || !a.href) return
  if (a.target === '_blank' || a.hasAttribute('download')) return
  try {
    const url = new URL(a.href, window.location.origin)
    if (url.origin !== window.location.origin) return
    const path = `${url.pathname}${url.search}${url.hash}`
    const resolved = router.resolve(path)
    const presentation = (resolved.meta as { presentation?: string }).presentation ?? 'page'
    if (presentation === 'page' || resolved.name === 'pin-detail') return
    e.preventDefault()
    e.stopPropagation()
    void navigateOrOpenLayer(router, path)
  } catch {
    /* ignore */
  }
}

export function initInputAbstraction(router: Router): void {
  if (bound || typeof window === 'undefined') return
  bound = true
  routerRef = router
  window.addEventListener('keydown', onKeydown, { passive: false, capture: true })
  window.addEventListener('click', onDocumentClickCapture, { capture: true })
}

/** Nom d'évent pour que les grilles virtualisées écoutent le scroll clavier. */
export const PINOVA_FEED_KEYBOARD_SCROLL = FEED_SCROLL_EVENT
