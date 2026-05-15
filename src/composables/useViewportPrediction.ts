/**
 * useViewportPrediction — prédit les prochains médias à précharger.
 *
 * Stratégie inspirée de TikTok / Pinterest :
 *  - Observe la vitesse + direction du scroll
 *  - Calcule un "lookahead distance" en fonction (plus tu scrolles vite,
 *    plus on précharge loin)
 *  - Identifie les index dans une liste qui vont entrer dans le viewport
 *    dans les ~600ms à venir
 *  - Émet un callback avec les `idsToPreheat` à preheat
 *
 * Le composant consommateur (PinVirtualGrid, MediaCarousel, StoryViewer)
 * applique ensuite ces preheats via `useImagePreheat` ou `<video preload>`.
 *
 * Toutes les heuristiques sont conservatrices : on évite de saturer le
 * réseau mobile (preload abusif → throttling cellulaire iOS).
 *
 * Usage :
 *
 *   const { onScrollUpdate } = useViewportPrediction({
 *     items: () => pins.value,
 *     getOffset: (item) => itemOffsetMap.get(item.id),
 *     itemHeight: 280,
 *     onPreheat: (ids) => preheatPinImages(ids),
 *   })
 */

import { onBeforeUnmount, ref } from 'vue'

export interface UseViewportPredictionOptions<T> {
  /** Reactive items getter. */
  items: () => T[] | Readonly<T[]>
  /** Hauteur (ou largeur si horizontal) approximative de chaque item. */
  itemSize: number
  /** Axe : 'y' (default) ou 'x'. */
  axis?: 'x' | 'y'
  /** ID unique d'un item. */
  getId?: (item: T) => string | number
  /** Lookahead minimal (px). */
  minLookahead?: number
  /** Lookahead maximal (px) — coupe les preheats trop loin. */
  maxLookahead?: number
  /** Multiplicateur de velocity. Plus haut = preheat plus aggressif. */
  velocityFactor?: number
  /** Quantité max d'items preheat simultanés. */
  maxConcurrent?: number
  /** Hook : appelé avec les ids à preheat. */
  onPreheat?: (ids: Array<string | number>) => void
}

export function useViewportPrediction<T>(options: UseViewportPredictionOptions<T>) {
  /* Axis option réservée pour future extension horizontal carousel ; pour
     l'instant on calcule en single-axis (le caller donne `scrollPos` brut). */
  void options.axis
  const minLookahead = options.minLookahead ?? 600
  const maxLookahead = options.maxLookahead ?? 2400
  const velocityFactor = options.velocityFactor ?? 12
  const maxConcurrent = options.maxConcurrent ?? 6

  const lastScroll = ref(0)
  const lastTime = ref(0)
  const velocity = ref(0)

  function onScrollUpdate(scrollPos: number) {
    const now = performance.now()
    const dt = lastTime.value ? now - lastTime.value : 16
    if (dt > 0) {
      /* Smooth exponential moving average — évite jitter. */
      const instantVel = (scrollPos - lastScroll.value) / dt
      velocity.value = velocity.value * 0.6 + instantVel * 0.4
    }
    lastScroll.value = scrollPos
    lastTime.value = now

    /* Lookahead = clamp(min, |velocity| * factor * 100, max) */
    const lookahead = Math.min(maxLookahead, Math.max(minLookahead, Math.abs(velocity.value) * velocityFactor * 100))

    const items = options.items()
    if (!items || items.length === 0) return

    /* On scroll vers le bas (vy > 0) → preheat ahead.
       On scroll vers le haut (vy < 0) → preheat behind. */
    const direction = velocity.value >= 0 ? 1 : -1
    const startPos = direction > 0 ? scrollPos + lookahead * 0.3 : scrollPos - lookahead
    const endPos = direction > 0 ? scrollPos + lookahead : scrollPos - lookahead * 0.3

    const startIdx = Math.floor(Math.min(startPos, endPos) / options.itemSize)
    const endIdx = Math.ceil(Math.max(startPos, endPos) / options.itemSize)

    const ids: Array<string | number> = []
    for (let i = Math.max(0, startIdx); i < Math.min(items.length, endIdx + 1); i++) {
      if (ids.length >= maxConcurrent) break
      const item = items[i]
      if (!item) continue
      const id = options.getId ? options.getId(item) : i
      ids.push(id)
    }

    if (ids.length > 0) options.onPreheat?.(ids)
  }

  onBeforeUnmount(() => {
    /* No internal listeners — caller drives onScrollUpdate. */
  })

  return {
    onScrollUpdate,
    velocity,
  }
}
