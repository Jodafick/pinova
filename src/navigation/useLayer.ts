/**
 * Composable utilisable DEPUIS un composant rendu en tant que couche.
 *
 * - `currentLayer` : la couche en cours
 * - `close(result?)` : ferme cette couche
 * - `isTop` : est-elle au sommet du stack ?
 * - `depth` : 0 = sommet, 1 = juste en dessous, etc.
 *
 * Utilise `provide/inject` côté `LayerHost.vue` pour transmettre le contexte.
 */

import { computed, inject, type ComputedRef, type InjectionKey } from 'vue'
import { layerManager } from './layerManager'
import type { Layer } from './layerTypes'

export interface LayerContext {
  layer: ComputedRef<Layer | null>
  /** Ferme la couche locale. */
  close: (result?: unknown) => void
}

export const LAYER_CONTEXT_KEY: InjectionKey<LayerContext> = Symbol('PinovaLayerContext')

export interface UseLayerReturn extends LayerContext {
  /** La couche est-elle au sommet du stack ? */
  isTop: ComputedRef<boolean>
  /** Profondeur depuis le sommet (0 = sommet, 1 = juste en-dessous). */
  depth: ComputedRef<number>
  /** Pousser une nouvelle couche par-dessus. */
  push: typeof layerManager.push
  /** Fermer toutes les couches. */
  popAll: typeof layerManager.popAll
}

/**
 * À appeler dans `setup()` d'un composant rendu via `<LayerHost />`.
 *
 * Si appelé HORS contexte couche, `layer` vaut `null` et `close` est un no-op
 * (composant peut donc fonctionner aussi en mode "page directe").
 */
export function useLayer(): UseLayerReturn {
  const ctx = inject(LAYER_CONTEXT_KEY, null)

  const layer = ctx?.layer ?? computed<Layer | null>(() => null)
  const close = ctx?.close ?? ((_result?: unknown) => undefined)

  const isTop = computed(() => {
    const top = layerManager.topLayer.value
    const cur = layer.value
    return !!cur && !!top && top.id === cur.id
  })

  const depth = computed(() => {
    const cur = layer.value
    if (!cur) return -1
    const list = layerManager.stack.value
    const idx = list.findIndex((l) => l.id === cur.id)
    if (idx < 0) return -1
    return list.length - 1 - idx
  })

  return {
    layer,
    close,
    isTop,
    depth,
    push: layerManager.push,
    popAll: layerManager.popAll,
  }
}
