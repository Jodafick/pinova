/**
 * useDoubleTapLike — détection propre du double-tap pour le "like" iOS-style.
 *
 * Caractéristiques :
 *  - délai max 280ms entre les deux tap (proche du natif iOS)
 *  - distance max 16px entre les deux tap (anti-faux positif)
 *  - haptique « like » délégué au callback (`emitMicroFeedback('like')` côté parent)
 *  - position du burst transmise en callback pour animer un cœur localisé
 *  - compatible souris + touch + stylet (PointerEvent)
 *
 * Le composable n'anime pas — il déclenche `onLike(point)` ; un composant
 * `LikeHeartBurst` consomme ce point pour afficher le cœur animé.
 *
 * Usage :
 *
 *   const el = ref<HTMLElement | null>(null)
 *   useDoubleTapLike(el, {
 *     onLike: ({ x, y }) => {
 *       toggleLike(pin.slug)
 *       burstAt({ x, y })
 *     },
 *   })
 */

import { onBeforeUnmount, onMounted, type Ref } from 'vue'

export interface DoubleTapPoint {
  x: number
  y: number
  /** Relatif à l'élément cible. */
  localX: number
  localY: number
}

export interface UseDoubleTapLikeOptions {
  onLike: (point: DoubleTapPoint) => void
  /** Délai max entre les deux tap (ms). Default 280. */
  delayMs?: number
  /** Distance max entre les deux tap (px). Default 16. */
  distancePx?: number
  /** Désactiver dynamiquement (ex: si bouton ouvert / menu ouvert). */
  disabled?: () => boolean
  /**
   * Optionnel : callback sur le premier tap (single-tap) après le délai
   * de double-tap. Utile pour ouvrir la page détail seulement si ce n'est pas
   * un double-tap. Si omis, le single-tap n'est pas traité par ce composable.
   */
  onSingleTap?: (point: DoubleTapPoint) => void
}

export function useDoubleTapLike(
  elRef: Ref<HTMLElement | null>,
  options: UseDoubleTapLikeOptions,
): void {
  const delayMs = options.delayMs ?? 280
  const distancePx = options.distancePx ?? 16

  let firstTap: { x: number; y: number; time: number } | null = null
  let singleTapTimer: ReturnType<typeof setTimeout> | null = null

  function clearSingleTapTimer() {
    if (singleTapTimer) {
      clearTimeout(singleTapTimer)
      singleTapTimer = null
    }
  }

  function pointFromEvent(e: PointerEvent): DoubleTapPoint {
    const el = elRef.value
    const rect = el?.getBoundingClientRect()
    return {
      x: e.clientX,
      y: e.clientY,
      localX: rect ? e.clientX - rect.left : 0,
      localY: rect ? e.clientY - rect.top : 0,
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (options.disabled?.()) {
      firstTap = null
      clearSingleTapTimer()
      return
    }
    /* Ignore les boutons droits/molette. */
    if (e.button !== 0 && e.pointerType === 'mouse') return

    const point = pointFromEvent(e)
    const now = performance.now()

    if (firstTap && now - firstTap.time < delayMs) {
      const dx = Math.abs(e.clientX - firstTap.x)
      const dy = Math.abs(e.clientY - firstTap.y)
      if (dx <= distancePx && dy <= distancePx) {
        /* Double-tap confirmé. */
        clearSingleTapTimer()
        firstTap = null
        try { options.onLike(point) } catch (err) { console.warn('[useDoubleTapLike] onLike error', err) }
        return
      }
    }

    /* Premier tap : on déclenche le single-tap après le délai si pas suivi
       d'un second tap. */
    firstTap = { x: e.clientX, y: e.clientY, time: now }
    clearSingleTapTimer()
    if (options.onSingleTap) {
      const captured = point
      singleTapTimer = setTimeout(() => {
        try { options.onSingleTap?.(captured) } catch (err) { console.warn('[useDoubleTapLike] onSingleTap error', err) }
        firstTap = null
        singleTapTimer = null
      }, delayMs)
    }
  }

  function attach() {
    const el = elRef.value
    if (!el) return
    el.addEventListener('pointerup', onPointerUp)
  }

  function detach() {
    const el = elRef.value
    if (!el) return
    el.removeEventListener('pointerup', onPointerUp)
    clearSingleTapTimer()
  }

  onMounted(attach)
  onBeforeUnmount(detach)
}
