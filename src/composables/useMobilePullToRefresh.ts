import { computed, onUnmounted, ref, watch, type ComputedRef, type Ref } from 'vue'

const DEFAULT_THRESHOLD_PX = 68
const MAX_PULL_PX = 100
/** Tolérance « tout en haut » du scroll racine (#main-content). */
const TOP_EPS_PX = 2

function isRootAtTop(scrollRoot: HTMLElement | null): boolean {
  return !!scrollRoot && scrollRoot.scrollTop <= TOP_EPS_PX
}

/** True si un ascendant scrollable (en dessous du root) est déjà défoulé — le PTR ne doit pas voler le geste. */
function nestedScrollerAwayFromTop(scrollRoot: HTMLElement, fromEl: HTMLElement | null): boolean {
  let el: HTMLElement | null = fromEl
  while (el && el !== scrollRoot) {
    if (el.scrollHeight > el.clientHeight + TOP_EPS_PX) {
      const oy = typeof window !== 'undefined' ? window.getComputedStyle(el).overflowY : 'visible'
      if (
        (oy === 'auto' || oy === 'scroll' || oy === 'overlay') &&
        el.scrollTop > TOP_EPS_PX
      ) {
        return true
      }
    }
    el = el.parentElement
  }
  return false
}

/**
 * Tirer depuis le haut du scroll principal (#main-content sur mobile lg-),
 * comme un navigateur mobile. Ne remplace pas l’installation PWA ; appelle `onRefresh`
 * après un seuil visuel (souvent `reloadPwaApplication()`).
 *
 * Zones / composants où le geste doit être ignoré : `data-pinova-no-pull-refresh`.
 * Ne s’active que si le `#main-content` est déjà tout en haut ; les écouteurs `touchmove`
 * sont **passifs** (pas de `preventDefault`) pour ne pas gêner le défilement.
 */
export function useMobilePullToRefresh(options: {
  scrollRootRef: Ref<HTMLElement | null>
  enabled: ComputedRef<boolean>
  onRefresh: () => void | Promise<void>
  /** Pixel de tirage depuis lequel on déclenche le rechargement (défaut 68). */
  thresholdPx?: number
}) {
  const threshold = options.thresholdPx ?? DEFAULT_THRESHOLD_PX
  const pullDistance = ref(0)

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      pullDistance,
      progress: computed(() => 0),
    }
  }

  let armed = false
  let startY = 0

  function resetArmHard() {
    armed = false
    pullDistance.value = 0
  }

  function onTouchStart(e: TouchEvent) {
    if (!options.enabled.value) return
    const el = options.scrollRootRef.value
    if (!el || !isRootAtTop(el)) return
    const target = e.target as HTMLElement | null
    if (target?.closest('[data-pinova-no-pull-refresh]')) return
    if (nestedScrollerAwayFromTop(el, target)) return

    armed = true
    startY = e.touches[0]?.clientY ?? 0
  }

  function onTouchMove(e: TouchEvent) {
    if (!armed || !options.enabled.value) return

    const el = options.scrollRootRef.value
    if (!el || !isRootAtTop(el)) {
      resetArmHard()
      return
    }

    const target = e.target as HTMLElement | null
    if (target?.closest('[data-pinova-no-pull-refresh]')) {
      resetArmHard()
      return
    }
    if (nestedScrollerAwayFromTop(el, target)) {
      resetArmHard()
      return
    }

    const y = e.touches[0]?.clientY ?? 0
    const dy = y - startY
    /* Geste de scroll de contenu (doigt vers le haut) : ne pas accrocher le PTR. */
    if (dy < -8) {
      resetArmHard()
      return
    }
    /* Tirer vers le bas uniquement ; pas de preventDefault (listeners passifs) pour ne pas bloquer le scroll natif. */
    if (dy <= 12) return

    pullDistance.value = Math.min((dy - 12) * 0.45, MAX_PULL_PX)
  }

  function onTouchEndOrCancel() {
    if (!armed) {
      pullDistance.value = 0
      return
    }
    armed = false
    const d = pullDistance.value
    pullDistance.value = 0
    if (d >= threshold) {
      void Promise.resolve(options.onRefresh()).catch(() => {
        /* rechargement : rien à faire si la page se démonte avant */
      })
    }
  }

  let attachedEl: HTMLElement | null = null

  /** Dès que le conteneur principal n’est plus en tête, annule le tirage (évite de gêner le scroll). */
  function onScrollRootScroll() {
    const el = options.scrollRootRef.value
    if (!el || !isRootAtTop(el)) resetArmHard()
  }

  function detach() {
    if (!attachedEl) return
    attachedEl.removeEventListener('touchstart', onTouchStart)
    attachedEl.removeEventListener('touchmove', onTouchMove as EventListener)
    attachedEl.removeEventListener('touchend', onTouchEndOrCancel)
    attachedEl.removeEventListener('touchcancel', onTouchEndOrCancel)
    attachedEl.removeEventListener('scroll', onScrollRootScroll)
    attachedEl = null
    resetArmHard()
  }

  function attach(el: HTMLElement) {
    detach()
    attachedEl = el
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove as EventListener, { passive: true })
    el.addEventListener('touchend', onTouchEndOrCancel, { passive: true })
    el.addEventListener('touchcancel', onTouchEndOrCancel, { passive: true })
    el.addEventListener('scroll', onScrollRootScroll, { passive: true })
  }

  watch(
    [() => options.scrollRootRef.value, () => options.enabled.value] as const,
    ([el, en]) => {
      detach()
      if (el && en) attach(el)
    },
    { flush: 'post', immediate: true },
  )

  onUnmounted(() => detach())

  const progress = computed(() => Math.min(1, pullDistance.value / Math.max(1, threshold)))

  return { pullDistance, progress }
}
