import { computed, onUnmounted, ref, watch, type ComputedRef, type Ref } from 'vue'

const DEFAULT_THRESHOLD_PX = 68
const MAX_PULL_PX = 100

/**
 * Tirer depuis le haut du scroll principal (#main-content sur mobile lg-),
 * comme un navigateur mobile. Ne remplace pas l’installation PWA ; appelle `onRefresh`
 * après un seuil visuel (souvent `reloadPwaApplication()`).
 *
 * Zones / composants où le geste doit être ignoré : `data-pinova-no-pull-refresh`.
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

  function scrollTopSafe(): number {
    const el = options.scrollRootRef.value
    return el ? el.scrollTop : 0
  }

  function resetArmHard() {
    armed = false
    pullDistance.value = 0
  }

  function onTouchStart(e: TouchEvent) {
    if (!options.enabled.value) return
    const el = options.scrollRootRef.value
    if (!el || scrollTopSafe() > 4) return
    const target = e.target as HTMLElement | null
    if (target?.closest('[data-pinova-no-pull-refresh]')) return

    armed = true
    startY = e.touches[0]?.clientY ?? 0
  }

  function onTouchMove(e: TouchEvent) {
    if (!armed || !options.enabled.value) return

    if (scrollTopSafe() > 4) {
      resetArmHard()
      return
    }

    const target = e.target as HTMLElement | null
    if (target?.closest('[data-pinova-no-pull-refresh]')) {
      resetArmHard()
      return
    }

    const y = e.touches[0]?.clientY ?? 0
    const dy = y - startY
    if (dy <= 8) return

    if (e.cancelable) e.preventDefault()
    pullDistance.value = Math.min((dy - 8) * 0.45, MAX_PULL_PX)
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

  function detach() {
    if (!attachedEl) return
    attachedEl.removeEventListener('touchstart', onTouchStart)
    attachedEl.removeEventListener('touchmove', onTouchMove as EventListener)
    attachedEl.removeEventListener('touchend', onTouchEndOrCancel)
    attachedEl.removeEventListener('touchcancel', onTouchEndOrCancel)
    attachedEl = null
    resetArmHard()
  }

  function attach(el: HTMLElement) {
    detach()
    attachedEl = el
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove as EventListener, { passive: false })
    el.addEventListener('touchend', onTouchEndOrCancel)
    el.addEventListener('touchcancel', onTouchEndOrCancel)
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
