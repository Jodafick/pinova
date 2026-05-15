/**
 * useFocusTrap — piège le focus à l'intérieur d'un conteneur (modal, sheet).
 *
 * Comportement :
 *  - Mémorise l'élément focus avant l'activation, le restaure à la sortie
 *  - Place le focus sur le premier élément focusable du conteneur (ou un
 *    élément explicitement marqué `[data-autofocus]`)
 *  - Tab / Shift+Tab : cycle uniquement dans le conteneur
 *  - Ignore `aria-hidden="true"` ou `inert` sur les sous-arbres
 *  - Réactif : on peut désactiver / réactiver via la ref `active`
 *
 * À utiliser dans toutes les modales (sheet, center, fullscreen, contextual menu).
 *
 * Usage :
 *
 *   const root = ref<HTMLElement | null>(null)
 *   useFocusTrap(root, computed(() => isOpen.value))
 */

import { onBeforeUnmount, watch, type Ref } from 'vue'

const FOCUSABLE_SELECTOR = [
  'a[href]:not([disabled])',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',')

export interface UseFocusTrapOptions {
  /**
   * Faut-il placer le focus initial à l'activation ? Default true.
   * Désactiver si la modale est ouverte automatiquement (pas par un user gesture).
   */
  autofocus?: boolean
  /**
   * Faut-il restaurer le focus à la désactivation ? Default true.
   */
  restoreFocus?: boolean
  /**
   * Sélecteur du premier élément à focus prioritairement. Default '[data-autofocus]'.
   */
  initialFocusSelector?: string
}

export function useFocusTrap(
  containerRef: Ref<HTMLElement | null>,
  active: Ref<boolean>,
  options: UseFocusTrapOptions = {},
): void {
  const autofocus = options.autofocus ?? true
  const restoreFocus = options.restoreFocus ?? true
  const initialFocusSelector = options.initialFocusSelector ?? '[data-autofocus]'

  let previouslyFocused: HTMLElement | null = null
  let attached = false

  function getFocusable(el: HTMLElement): HTMLElement[] {
    const list = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    return list.filter((node) => {
      if (node.hasAttribute('disabled')) return false
      if (node.getAttribute('aria-hidden') === 'true') return false
      if (node.hasAttribute('inert')) return false
      /* Ignore les nodes invisibles (display:none ou taille 0). */
      const rect = node.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) return false
      return true
    })
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key !== 'Tab') return
    const root = containerRef.value
    if (!root) return
    const focusables = getFocusable(root)
    if (focusables.length === 0) {
      e.preventDefault()
      return
    }
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    const current = document.activeElement as HTMLElement | null
    if (e.shiftKey) {
      if (current === first || !root.contains(current)) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (current === last || !root.contains(current)) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  function activate() {
    if (attached) return
    const root = containerRef.value
    if (!root) return
    previouslyFocused = document.activeElement as HTMLElement | null
    document.addEventListener('keydown', onKeydown)
    attached = true
    if (!autofocus) return
    /* Place le focus initial. */
    const target = root.querySelector<HTMLElement>(initialFocusSelector)
      ?? getFocusable(root)[0]
      ?? root
    /* tabIndex sur le root au cas où il est seul focusable. */
    if (target === root && !root.hasAttribute('tabindex')) {
      root.setAttribute('tabindex', '-1')
    }
    /* requestAnimationFrame pour laisser le DOM se monter complètement
       (utile en cas de Teleport + transition). */
    requestAnimationFrame(() => {
      try { target.focus({ preventScroll: true }) } catch { /* ignore */ }
    })
  }

  function deactivate() {
    if (!attached) return
    document.removeEventListener('keydown', onKeydown)
    attached = false
    if (!restoreFocus) return
    const prev = previouslyFocused
    previouslyFocused = null
    if (prev && typeof prev.focus === 'function') {
      try { prev.focus({ preventScroll: true }) } catch { /* ignore */ }
    }
  }

  watch(active, (isActive) => {
    if (isActive) activate()
    else deactivate()
  }, { immediate: true })

  onBeforeUnmount(deactivate)
}
