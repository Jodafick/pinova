/**
 * useEdgeSwipeBack — geste de retour iOS depuis le bord gauche.
 *
 * Conçu pour être attaché à une PAGE ENTIÈRE (router-view) ou à un composant
 * racine de couche. Différent du presenter `PagePresenter.vue` :
 *   - peut être posé sur une vue Router classique (non-layer)
 *   - rend visuellement la translation et l'opacité
 *   - délègue la décision finale à un callback (`onDismiss`)
 *
 * Caractéristiques :
 *   - Threshold edge : 24px depuis bord gauche (configurable)
 *   - Suivi du doigt temps réel (transform translateX 1:1)
 *   - Velocity tracking + flick detection
 *   - Preview : la page précédente apparaît derrière (gérée par le caller,
 *     typiquement via `id="app-shell"` + scale léger)
 *   - Page courante : translation + shadow dynamique bord gauche (drop)
 *
 * Usage :
 *
 *   const root = ref<HTMLElement | null>(null)
 *   useEdgeSwipeBack(root, {
 *     enabled: () => route.meta.gestureDismiss !== false,
 *     onDismiss: () => nativeStack.pop(),
 *   })
 */

import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { SPRINGS } from '../theme/motion'
import { getAdaptiveGesture } from '../navigation/adaptiveNavigator'
import { useGestureEngine } from './useGestureEngine'
import { useSpring } from './useSpring'
import { emitMicroFeedback } from './useMicroFeedback'

export interface UseEdgeSwipeBackOptions {
  /** Activer / désactiver dynamiquement (ex: pages en édition). */
  enabled?: () => boolean
  /** Largeur du bord pour démarrer (px). Default 24. */
  edgeWidth?: number
  /**
   * Si false, le pointerdown est ignoré (ex: zones avec swipe horizontal dédié).
   * S’applique après la détection « bord gauche ».
   */
  canAcceptPointerDown?: (e: PointerEvent) => boolean
  /**
   * true (défaut) : anime jusqu’à sortie pleine largeur puis `onDismiss`.
   * false : appelle `onDismiss` au seuil puis ressort le spring à 0 (navigation interne
   * sans quitter la route, ex. étape précédente du formulaire création).
   */
  fullSlideOut?: boolean | (() => boolean)
  /** Callback à appeler quand le seuil est franchi (dismiss page). */
  onDismiss: () => void
  /**
   * Sélecteur ou ref de l'élément à animer pendant le drag.
   * Par défaut : l'élément reçu en premier argument.
   */
  surfaceRef?: Ref<HTMLElement | null>
  /**
   * Ajouter une shadow dynamique sur le bord gauche pendant le drag
   * (effet "carte qui se soulève"). Default true.
   */
  showShadow?: boolean
}

export interface UseEdgeSwipeBackReturn {
  /** Geste en cours ? */
  isDragging: Ref<boolean>
  /** Translation X courante (px). */
  translateX: Ref<number>
  /** Annule programmatique. */
  cancel: () => void
}

export function useEdgeSwipeBack(
  rootRef: Ref<HTMLElement | null>,
  options: UseEdgeSwipeBackOptions,
): UseEdgeSwipeBackReturn {
  const surfaceRef = options.surfaceRef ?? rootRef
  const xSpring = useSpring(0, SPRINGS.spring)

  const gesture = useGestureEngine(rootRef, {
    axis: 'horizontal',
    edge: 'left',
    edgeWidth: options.edgeWidth ?? getAdaptiveGesture().edgeBackWidth,
    preventScroll: true,
    disabled: () => !(options.enabled ? options.enabled() : true),
    canAcceptPointerDown: options.canAcceptPointerDown,
    onStart: () => {
      xSpring.stop()
    },
    onMove: ({ dx }) => {
      /* Pas de drag négatif (rubber band léger). */
      if (dx < 0) xSpring.setImmediate(dx / 6)
      else xSpring.setImmediate(dx)
    },
    onEnd: ({ dx, vx }) => {
      const w = rootRef.value?.clientWidth ?? window.innerWidth
      const distanceThreshold = Math.min(120, w * 0.32)
      const isFling = vx >= getAdaptiveGesture().flickVelocity
      const fs = options.fullSlideOut
      const slideOut = typeof fs === 'function' ? fs() : fs !== false
      if (isFling || dx >= distanceThreshold) {
        if (!slideOut) {
          try {
            options.onDismiss()
          } catch (e) {
            console.warn('[useEdgeSwipeBack] onDismiss error', e)
          }
          xSpring.set(0, { velocity: vx * 1000 })
          emitMicroFeedback('edgeSwipe')
          return 0
        }
        /* Anime jusqu'à la sortie complète, puis dismiss callback. */
        xSpring.set(w, {
          velocity: vx * 1000,
          onRest: () => {
            try { options.onDismiss() } catch (e) { console.warn('[useEdgeSwipeBack] onDismiss error', e) }
          },
        })
        emitMicroFeedback('edgeSwipe')
        return dx
      }
      xSpring.set(0, { velocity: vx * 1000 })
      return 0
    },
    onCancel: () => xSpring.set(0),
  })

  /* Boucle d'animation : applique transform + shadow sur la surface. */
  let raf: number | null = null
  function tick() {
    const surf = surfaceRef.value
    if (!surf) return
    const x = xSpring.value.value
    const w = surf.clientWidth || window.innerWidth

    /*
     * Quand x === 0 et le spring est au repos : retirer transform/opacity/box-shadow.
     * Sinon `translate3d(0,0,0)` reste appliqué sur #app-shell → tout `position: fixed`
     * *descendant* (AmbientGlow, etc.) est ancré à cette surface au lieu du viewport,
     * et le fond semble « défiler » avec le scroll.
     */
    if (x === 0 && !xSpring.isAnimating.value && !gesture.isDragging.value) {
      surf.style.transform = ''
      surf.style.opacity = ''
      surf.style.boxShadow = ''
      raf = null
      return
    }

    surf.style.transform = `translate3d(${x}px, 0, 0)`
    const ratio = Math.min(1, Math.max(0, x) / w)
    surf.style.opacity = String(1 - ratio * 0.12)
    if (options.showShadow !== false && x > 0) {
      const intensity = Math.min(0.3, 0.06 + ratio * 0.24)
      surf.style.boxShadow = `-22px 0 40px -10px rgba(0, 0, 0, ${intensity.toFixed(3)})`
    } else {
      surf.style.boxShadow = ''
    }

    if (xSpring.isAnimating.value || gesture.isDragging.value || x !== 0) {
      raf = requestAnimationFrame(tick)
    } else {
      raf = null
    }
  }

  watch([xSpring.isAnimating, gesture.isDragging], () => {
    if (raf == null) raf = requestAnimationFrame(tick)
  })

  onMounted(() => {
    const surf = surfaceRef.value
    if (!surf) return
    surf.style.willChange = 'transform, opacity, box-shadow'
    surf.style.backfaceVisibility = 'hidden'
  })

  onBeforeUnmount(() => {
    const surf = surfaceRef.value
    if (!surf) return
    surf.style.transform = ''
    surf.style.opacity = ''
    surf.style.boxShadow = ''
    surf.style.willChange = ''
  })

  const translateX = ref(0)
  watch(xSpring.value, (v) => { translateX.value = v })

  return {
    isDragging: gesture.isDragging,
    translateX,
    cancel: () => {
      gesture.cancel()
      xSpring.set(0)
    },
  }
}
