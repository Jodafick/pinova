/**
 * useScrollDirection — détecte la direction et la position de scroll
 * sur un élément (ou window), avec smoothing et thresholds.
 *
 * Utile pour :
 *  - hide/show dynamique d'un header ou d'une tab bar
 *  - opacity adaptative d'un chrome translucide
 *  - "back to top" button
 *  - skeleton parallax
 *
 * Caractéristiques :
 *  - throttle via requestAnimationFrame (pas de re-render au-delà de 60fps)
 *  - hystérésis : ne flip pas la direction sur du jitter
 *  - inversion automatique en bas de page (évite que le header disparaisse
 *    sur du bounce iOS)
 *  - support window OU élément scrollable
 *
 * Usage :
 *
 *   const { direction, scrollY, atTop, isScrollingDown } = useScrollDirection()
 *
 *   // dans template :
 *   <header :class="isScrollingDown ? 'header--hidden' : ''">
 */

import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

export interface UseScrollDirectionOptions {
  /** Ref vers l'élément scrollable. Si null → window. */
  target?: Ref<HTMLElement | null>
  /** Distance min (px) entre 2 samples pour décider d'une direction. Default 6. */
  threshold?: number
  /** Distance depuis le haut (px) sous laquelle on considère "atTop". Default 8. */
  atTopThreshold?: number
  /** Désactiver dynamiquement. */
  disabled?: () => boolean
}

export interface UseScrollDirectionReturn {
  /** Position Y courante (px). */
  scrollY: Ref<number>
  /** Direction de scroll : null tant qu'indécidée. */
  direction: Ref<'up' | 'down' | null>
  /** Helper : scrolle-t-on vers le bas (pour cacher header) ? */
  isScrollingDown: Ref<boolean>
  /** Helper : sommes-nous au-dessus du seuil (pour rendre header opaque/transparent) ? */
  atTop: Ref<boolean>
  /** Atteint-on le bas de la zone scrollable ? */
  atBottom: Ref<boolean>
}

export function useScrollDirection(
  options: UseScrollDirectionOptions = {},
): UseScrollDirectionReturn {
  const threshold = options.threshold ?? 6
  const atTopThreshold = options.atTopThreshold ?? 8

  const scrollY = ref(0)
  const direction = ref<'up' | 'down' | null>(null)
  const isScrollingDown = ref(false)
  const atTop = ref(true)
  const atBottom = ref(false)

  let lastY = 0
  let ticking = false
  let scrollHost: HTMLElement | Window | null = null

  function readScroll(): { y: number; max: number; client: number } {
    if (scrollHost === window || scrollHost == null) {
      const doc = document.documentElement
      return {
        y: window.scrollY || doc.scrollTop || 0,
        max: doc.scrollHeight - doc.clientHeight,
        client: doc.clientHeight,
      }
    }
    const el = scrollHost as HTMLElement
    return { y: el.scrollTop, max: el.scrollHeight - el.clientHeight, client: el.clientHeight }
  }

  function onScroll() {
    if (options.disabled?.()) return
    if (ticking) return
    ticking = true
    requestAnimationFrame(() => {
      const { y, max } = readScroll()
      scrollY.value = y
      atTop.value = y <= atTopThreshold
      atBottom.value = max > 0 && y >= max - 2
      const delta = y - lastY
      /* Hystérésis : on ne change la direction que si le delta dépasse le seuil. */
      if (Math.abs(delta) >= threshold) {
        const nextDir: 'up' | 'down' = delta > 0 ? 'down' : 'up'
        /* Ignore le hide-down si on est tout en bas (bounce iOS). */
        if (nextDir === 'down' && atBottom.value) {
          /* stay */
        } else {
          direction.value = nextDir
          isScrollingDown.value = nextDir === 'down' && !atTop.value
        }
        lastY = y
      }
      /* Toujours forcer "non caché" si on est en haut. */
      if (atTop.value) isScrollingDown.value = false
      ticking = false
    })
  }

  function attach() {
    scrollHost = options.target?.value ?? window
    if (!scrollHost) return
    const { y } = readScroll()
    lastY = y
    scrollY.value = y
    atTop.value = y <= atTopThreshold
    scrollHost.addEventListener('scroll', onScroll, { passive: true })
  }

  function detach() {
    scrollHost?.removeEventListener('scroll', onScroll as EventListener)
    scrollHost = null
  }

  onMounted(attach)
  onBeforeUnmount(detach)

  return { scrollY, direction, isScrollingDown, atTop, atBottom }
}
