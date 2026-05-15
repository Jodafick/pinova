/**
 * useLongPressMenu — détection long-press (iOS "haptic touch" / "3D touch")
 * pour ouvrir un menu contextuel.
 *
 * Caractéristiques :
 *  - délai 420ms par défaut (configurable)
 *  - cancel automatique si le pointer bouge > 8px (= drag-to-scroll)
 *  - cancel automatique sur pointerup avant le délai
 *  - cancel automatique sur pointercancel (interruption iOS)
 *  - haptic medium au déclenchement
 *  - `preventDefault()` sur contextmenu pour éviter le menu navigateur par défaut
 *
 * Le composable ne rend AUCUN UI : il appelle `onLongPress(point)`.
 * Un composant `PinContextualMenu` consomme ce point pour s'afficher.
 *
 * Usage :
 *
 *   const el = ref<HTMLElement | null>(null)
 *   useLongPressMenu(el, {
 *     onLongPress: ({ x, y }) => openMenu(pin, { x, y }),
 *   })
 */

import { onBeforeUnmount, onMounted, type Ref } from 'vue'
import { emitMicroFeedback } from './useMicroFeedback'

export interface LongPressPoint {
  x: number
  y: number
  localX: number
  localY: number
  pointerType: 'touch' | 'mouse' | 'pen'
}

export interface UseLongPressMenuOptions {
  onLongPress: (point: LongPressPoint) => void
  /** Délai (ms). Default 420. */
  delayMs?: number
  /** Distance max de drift autorisée (px). Default 8. */
  driftPx?: number
  /** Désactiver dynamiquement. */
  disabled?: () => boolean
  /** Inclure les pointers mouse (clic droit déclenche déjà l'équivalent). */
  enableMouse?: boolean
}

export function useLongPressMenu(
  elRef: Ref<HTMLElement | null>,
  options: UseLongPressMenuOptions,
): void {
  const delayMs = options.delayMs ?? 420
  const driftPx = options.driftPx ?? 8

  let timer: ReturnType<typeof setTimeout> | null = null
  let pressedAt = 0
  let startX = 0
  let startY = 0
  let pointerType: 'touch' | 'mouse' | 'pen' = 'touch'
  let activePointerId: number | null = null

  function clear() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    activePointerId = null
  }

  function onPointerDown(e: PointerEvent) {
    if (options.disabled?.()) return
    if (e.pointerType === 'mouse' && !options.enableMouse) return
    if (activePointerId != null) return
    activePointerId = e.pointerId
    pointerType = (e.pointerType as 'touch' | 'mouse' | 'pen') || 'touch'
    startX = e.clientX
    startY = e.clientY
    pressedAt = performance.now()

    timer = setTimeout(() => {
      const el = elRef.value
      const rect = el?.getBoundingClientRect()
      const point: LongPressPoint = {
        x: startX,
        y: startY,
        localX: rect ? startX - rect.left : 0,
        localY: rect ? startY - rect.top : 0,
        pointerType,
      }
      emitMicroFeedback('longPress')
      try { options.onLongPress(point) } catch (err) { console.warn('[useLongPressMenu] onLongPress error', err) }
      timer = null
    }, delayMs)
  }

  function onPointerMove(e: PointerEvent) {
    if (activePointerId !== e.pointerId) return
    if (!timer) return
    const dx = Math.abs(e.clientX - startX)
    const dy = Math.abs(e.clientY - startY)
    if (dx > driftPx || dy > driftPx) {
      clear()
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (activePointerId !== e.pointerId) return
    /* Si on relâche avant le délai → annule (c'était juste un tap, pas long-press). */
    if (timer && performance.now() - pressedAt < delayMs) clear()
  }

  function onPointerCancel() {
    clear()
  }

  function onContextMenu(e: MouseEvent) {
    /* Sur mobile, le contextmenu natif arrive parfois en concurrence du long-press
       custom : on l'empêche pour éviter le double menu. */
    if (pointerType === 'touch') e.preventDefault()
  }

  function attach() {
    const el = elRef.value
    if (!el) return
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerCancel)
    el.addEventListener('contextmenu', onContextMenu)
  }

  function detach() {
    const el = elRef.value
    if (!el) return
    el.removeEventListener('pointerdown', onPointerDown)
    el.removeEventListener('pointermove', onPointerMove)
    el.removeEventListener('pointerup', onPointerUp)
    el.removeEventListener('pointercancel', onPointerCancel)
    el.removeEventListener('contextmenu', onContextMenu)
    clear()
  }

  onMounted(attach)
  onBeforeUnmount(detach)
}
