/**
 * Layer Lifecycle — états enrichis d'une couche du Layer Navigation System.
 *
 * Le `layerManager` gère `frozen: boolean` (couverte). On enrichit ici avec
 * un état explicite à 4 niveaux :
 *
 *  - 'mounted' : visible / interactive (couche au sommet OU non recouverte)
 *  - 'frozen'  : recouverte par une couche opaque, montée mais inactive
 *               (transform: none, pointer-events: none, animations off)
 *  - 'sleeping': recouverte depuis longtemps (> 30s) — on libère les ressources
 *               lourdes (observers, vidéos, gros caches) mais on garde le squelette
 *  - 'released': hors stack (la couche a été pop) — le composant est démonté
 *
 * Les composants consomment via `useLayerLifecycle()` :
 *
 *   const { state } = useLayerLifecycle()
 *   watch(state, (s) => {
 *     if (s === 'sleeping') stopVideo()
 *   })
 *
 * Synchronisation : un watcher central observe le stack et met à jour les
 * états selon `frozen` + ancienneté.
 */

import { computed, inject, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { layerManager } from '../navigation/layerManager'
import { LAYER_CONTEXT_KEY } from '../navigation/useLayer'

export type LayerLifecycleState = 'mounted' | 'frozen' | 'sleeping' | 'released'

const SLEEP_AFTER_FROZEN_MS = 30_000

/** Map id → state. Centralisée pour debugging. */
const stateById = new Map<string, Ref<LayerLifecycleState>>()
/** Map id → timestamp frozen depuis. */
const frozenSince = new Map<string, number>()

/** Tick mark : recalcule sleeping toutes les 10s. */
let sleepTicker: ReturnType<typeof setInterval> | null = null

function ensureState(id: string): Ref<LayerLifecycleState> {
  let s = stateById.get(id)
  if (!s) {
    s = ref<LayerLifecycleState>('mounted')
    stateById.set(id, s)
  }
  return s
}

function syncStatesFromStack(): void {
  const stack = layerManager.stack.value
  const aliveIds = new Set<string>()
  const now = Date.now()
  for (const layer of stack) {
    aliveIds.add(layer.id)
    const s = ensureState(layer.id)
    if (layer.frozen) {
      if (!frozenSince.has(layer.id)) frozenSince.set(layer.id, now)
      const fromMs = frozenSince.get(layer.id) ?? now
      s.value = (now - fromMs) >= SLEEP_AFTER_FROZEN_MS ? 'sleeping' : 'frozen'
    } else {
      frozenSince.delete(layer.id)
      s.value = 'mounted'
    }
  }
  /* Cleanup : marque "released" tout id absent du stack. */
  for (const [id, s] of stateById) {
    if (!aliveIds.has(id)) {
      s.value = 'released'
      /* Supprime au prochain tick pour laisser le watcher des consommateurs lire la transition. */
      setTimeout(() => stateById.delete(id), 0)
    }
  }
}

let initialized = false
export function initLayerLifecycle(): void {
  if (initialized) return
  initialized = true
  watch(
    () => layerManager.stack.value.map((l) => `${l.id}:${l.frozen ? 'f' : 'm'}`).join('|'),
    () => syncStatesFromStack(),
    { immediate: true },
  )
  /* Tick : convertit frozen → sleeping après délai. */
  sleepTicker = setInterval(syncStatesFromStack, 10_000)
}

export function teardownLayerLifecycle(): void {
  if (sleepTicker != null) clearInterval(sleepTicker)
  sleepTicker = null
  initialized = false
  stateById.clear()
  frozenSince.clear()
}

/** Hook : retourne l'état lifecycle de la couche courante (depuis `provide` du presenter). */
export function useLayerLifecycle() {
  const ctx = inject(LAYER_CONTEXT_KEY, null)
  const fallback = ref<LayerLifecycleState>('mounted')

  if (!ctx) {
    return {
      state: fallback as Readonly<Ref<LayerLifecycleState>>,
      isActive: computed(() => true),
      isFrozen: computed(() => false),
      isSleeping: computed(() => false),
    }
  }

  /* La couche peut être null si le composant est rendu hors d'un presenter (ex. page racine). */
  const state = computed<LayerLifecycleState>(() => {
    const layer = ctx.layer.value
    if (!layer) return 'mounted'
    const s = stateById.get(layer.id)
    return s?.value ?? 'mounted'
  })

  return {
    state,
    isActive: computed(() => state.value === 'mounted'),
    isFrozen: computed(() => state.value === 'frozen' || state.value === 'sleeping'),
    isSleeping: computed(() => state.value === 'sleeping'),
  }
}

/* Helper hors composant Vue : observer l'état d'un id arbitraire. */
export function getLayerLifecycleState(id: string): LayerLifecycleState {
  return stateById.get(id)?.value ?? 'released'
}

/**
 * Helper composant : appelle `onSleep` quand la couche entre en sleeping,
 * `onWake` quand elle ressort. Démontage automatique.
 */
export function useLayerSleepHooks(handlers: {
  onSleep?: () => void
  onWake?: () => void
}) {
  const { state } = useLayerLifecycle()
  let stopWatch: (() => void) | null = null
  onMounted(() => {
    stopWatch = watch(state, (next, prev) => {
      if (prev !== 'sleeping' && next === 'sleeping') handlers.onSleep?.()
      if (prev === 'sleeping' && next !== 'sleeping') handlers.onWake?.()
    })
  })
  onBeforeUnmount(() => {
    stopWatch?.()
  })
}
