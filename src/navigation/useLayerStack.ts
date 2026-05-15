/**
 * Composable consommateur (panneau d'inspection / debug / barre statut).
 *
 * - `stack` : liste des couches (fond → sommet)
 * - `top` : couche au sommet
 * - `count` : nombre de couches ouvertes
 * - `closeTop()` : ferme la couche au sommet
 *
 * Utiliser depuis n'importe quel composant (header, debug overlay, etc.).
 * Pour AGIR depuis l'intérieur d'une couche, utiliser `useLayer()` à la place.
 */

import { computed, type ComputedRef } from 'vue'
import { layerManager } from './layerManager'
import type { Layer } from './layerTypes'

export interface UseLayerStackReturn {
  stack: ComputedRef<readonly Layer[]>
  top: ComputedRef<Layer | null>
  count: ComputedRef<number>
  hasLayers: ComputedRef<boolean>
  closeTop: (result?: unknown) => void
  closeAll: () => void
  /** Ferme toutes les couches dont le `group` correspond. */
  closeGroup: (group: string) => void
}

export function useLayerStack(): UseLayerStackReturn {
  const stack = layerManager.stack
  const top = layerManager.topLayer
  const count = computed(() => stack.value.length)
  const hasLayers = layerManager.hasLayers

  return {
    stack,
    top,
    count,
    hasLayers,
    closeTop: (result) => layerManager.pop(undefined, result),
    closeAll: () => layerManager.popAll(),
    closeGroup: (group) => {
      const layer = stack.value.find((l) => l.group === group)
      if (layer) layerManager.pop(layer.id)
    },
  }
}
