/**
 * usePullToRefresh — pull-to-refresh iOS-style avec :
 *   - tension élastique (rubber band)
 *   - résistance progressive
 *   - release threshold avec velocity
 *   - spring back natif
 *
 * Le composable n'anime pas tout seul — il publie un `pull` réactif (px de
 * déplacement courant) et un état (`refreshing`, `armed`). Le composant
 * consommateur applique le `translateY` et affiche un spinner premium.
 *
 * Conditions de déclenchement :
 *   - le conteneur scrollable doit être au tout début (`scrollTop === 0`)
 *   - le geste doit débuter vers le bas (`dy > 0`)
 *   - si le geste démarre alors qu'on n'est pas en haut → ignoré (laisse passer
 *     le scroll natif)
 *
 * Le composable enrobe également la gestion du `touch-action` (on désactive
 * temporairement `pan-y` sur l'élément cible quand le pull est armé).
 *
 * Usage :
 *
 *   const root = ref<HTMLElement | null>(null)
 *   const { pull, refreshing, armed, progress } = usePullToRefresh(root, {
 *     onRefresh: async () => fetchHomeFeed(true),
 *   })
 */

import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { rubberBand, SPRINGS } from '../theme/motion'
import { getAdaptiveGesture } from '../navigation/adaptiveNavigator'
import { useGestureEngine } from './useGestureEngine'
import { useSpring } from './useSpring'
import { emitMicroFeedback } from './useMicroFeedback'

export interface UsePullToRefreshOptions {
  /** Callback appelé au release au-dessus du threshold. Peut être async. */
  onRefresh: () => void | Promise<void>
  /** Distance (px) avant l'armement du refresh. Default 64. */
  threshold?: number
  /** Distance max du pull (px). Default 120. */
  maxPull?: number
  /** Désactiver dynamiquement. */
  disabled?: () => boolean
  /** Élément réellement scrollable (ref). Si omis → on prend `rootRef`. */
  scrollRef?: Ref<HTMLElement | null>
}

export interface UsePullToRefreshReturn {
  /** Distance verticale courante (px) à appliquer en translateY. */
  pull: Ref<number>
  /** Progression [0..1] vers le threshold. */
  progress: Ref<number>
  /** Le pull a atteint le threshold (visuel : spinner activable). */
  armed: Ref<boolean>
  /** En cours de refresh API ? (le pull reste affiché pendant ce temps). */
  refreshing: Ref<boolean>
  /** Force la fin du refresh (à appeler côté composant après onRefresh résolu). */
  finish: () => void
}

export function usePullToRefresh(
  rootRef: Ref<HTMLElement | null>,
  options: UsePullToRefreshOptions,
): UsePullToRefreshReturn {
  const threshold = options.threshold ?? 64
  const maxPull = options.maxPull ?? 120

  const pullSpring = useSpring(0, SPRINGS.sheetSpring)
  const pull = ref(0)
  const armed = ref(false)
  const refreshing = ref(false)
  const progress = ref(0)
  let lastArmed = false
  let scrollHost: HTMLElement | null = null

  function isAtTop(): boolean {
    const target = options.scrollRef?.value ?? scrollHost ?? rootRef.value
    if (!target) return true
    /* Si le scrollable est window, on regarde document.scrollingElement. */
    if (target === document.documentElement || target === document.body) {
      return (document.scrollingElement?.scrollTop ?? 0) <= 0
    }
    return target.scrollTop <= 0
  }

  useGestureEngine(rootRef, {
    axis: 'vertical',
    directionThreshold: 6,
    preventScroll: false,
    disabled: () => !!(options.disabled?.()) || refreshing.value,
    onStart: () => {
      if (!isAtTop()) {
        /* Pas en haut : on laisse le scroll natif s'occuper. */
        return
      }
      pullSpring.stop()
    },
    onMove: ({ dy }) => {
      if (refreshing.value) return
      if (dy <= 0) {
        /* Drag vers le haut : pas de pull, mais on autorise le scroll natif. */
        pull.value = 0
        progress.value = 0
        if (armed.value) armed.value = false
        return
      }
      if (!isAtTop()) return
      /* Resistance élastique : plus on tire, plus c'est dur. */
      const elastic = rubberBand(dy, maxPull * 1.4) + (dy < maxPull ? dy : maxPull)
      const clamped = Math.min(maxPull * 1.5, elastic * 0.7)
      pull.value = clamped
      pullSpring.setImmediate(clamped)
      const p = Math.min(1, clamped / threshold)
      progress.value = p
      const nowArmed = clamped >= threshold
      if (nowArmed && !lastArmed) {
        emitMicroFeedback('pullRefreshArm')
        lastArmed = true
      } else if (!nowArmed && lastArmed) {
        lastArmed = false
      }
      armed.value = nowArmed
    },
    onEnd: ({ dy, vy }) => {
      if (refreshing.value) return undefined
      if (dy <= 0) return 0
      /* Décision : threshold OU flick vers le bas. */
      const isFling = vy >= getAdaptiveGesture().flickVelocity * 0.6
      const shouldRefresh = pull.value >= threshold || (pull.value > threshold * 0.55 && isFling)
      if (shouldRefresh) {
        /* Spring vers la position "refresh" et déclenche le callback. */
        pullSpring.set(threshold)
        pull.value = threshold
        progress.value = 1
        armed.value = false
        refreshing.value = true
        emitMicroFeedback('pullRefreshRelease')
        Promise.resolve(options.onRefresh()).catch((e) => {
          console.warn('[usePullToRefresh] onRefresh error', e)
        }).finally(() => {
          finish()
        })
      } else {
        pullSpring.set(0, {
          velocity: vy * 1000,
          onRest: () => {
            pull.value = 0
            progress.value = 0
            armed.value = false
          },
        })
      }
      return undefined
    },
    onCancel: () => {
      pullSpring.set(0, { onRest: () => { pull.value = 0; progress.value = 0; armed.value = false } })
    },
  })

  /* Boucle de synchronisation : on pousse `pullSpring.value` dans `pull`. */
  let rafId: number | null = null
  function syncLoop() {
    if (!pullSpring.isAnimating.value && !refreshing.value) {
      rafId = null
      return
    }
    pull.value = pullSpring.value.value
    progress.value = Math.min(1, pull.value / threshold)
    rafId = requestAnimationFrame(syncLoop)
  }

  function finish() {
    refreshing.value = false
    armed.value = false
    pullSpring.set(0, { onRest: () => {
      pull.value = 0
      progress.value = 0
    } })
    if (rafId == null) rafId = requestAnimationFrame(syncLoop)
  }

  onMounted(() => {
    scrollHost = rootRef.value
  })

  onBeforeUnmount(() => {
    if (rafId != null) cancelAnimationFrame(rafId)
  })

  return { pull, progress, armed, refreshing, finish }
}
