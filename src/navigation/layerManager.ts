/**
 * Layer Navigation Manager — store singleton réactif.
 *
 * - Stack ordonné de couches (fond → sommet)
 * - Push / pop / popTo / replace / popAll
 * - Snapshot du scroll au push (restauré au pop)
 * - Lock du scroll body quand au moins une couche est ouverte
 * - Synchronisation URL via History API (pas Vue Router) pour les couches
 *   route-bound : le retour navigateur ferme la couche
 * - Z-index automatique stratifié
 * - Détection des couches profondes recouvertes (freeze pour économiser CPU)
 */

import { computed, readonly, ref, type ComputedRef, type Ref } from 'vue'
import {
  DEFAULT_DISMISS_STRATEGY,
  LAYER_Z_INDEX_BASE,
  LAYER_Z_INDEX_STEP,
  type Layer,
  type LayerDismissStrategy,
  type LayerId,
  type LayerPresentation,
  type LayerPushOptions,
  type ScrollSnapshot,
} from './layerTypes'
import { emitLayerCloseFeedback, emitLayerOpenFeedback } from '../composables/useMicroFeedback'
import { trackBudget } from '../core/domBudget'
import { getAppScrollRoot } from '../utils/appScrollRoot'

/** Map des disposers DOM budget par layer id pour pouvoir décrémenter au pop. */
const budgetDisposers = new Map<LayerId, () => void>()

/* Intensité haptique selon le type de couche (cf. Prompt 5). */
function isHeavyLayerOpen(presentation: LayerPresentation): boolean {
  return presentation === 'fullscreen'
}

const stackRef: Ref<Layer[]> = ref([])

/** Compteur monotone pour générer des IDs uniques courts. */
let nextLayerSeq = 1

function generateLayerId(prefix = 'l'): LayerId {
  nextLayerSeq += 1
  return `${prefix}_${Date.now().toString(36)}_${nextLayerSeq.toString(36)}`
}

function captureScrollSnapshot(): ScrollSnapshot {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { rootX: 0, rootY: 0 }
  }
  const scrollers: Record<string, { x: number; y: number }> = {}
  /* On ne snapshote que les scrollers explicitement marqués pour ne pas crawler tout le DOM. */
  const els = document.querySelectorAll<HTMLElement>('[data-scroll-id]')
  els.forEach((el) => {
    const id = el.getAttribute('data-scroll-id')
    if (!id) return
    scrollers[id] = { x: el.scrollLeft, y: el.scrollTop }
  })
  const root = getAppScrollRoot()
  return {
    rootX: root.scrollLeft,
    rootY: root.scrollTop,
    scrollers,
  }
}

function restoreScrollSnapshot(snap: ScrollSnapshot | null) {
  if (!snap) return
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  /* On reporte à 2 rAF pour laisser le router-view se remonter avant scroll. */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        const root = getAppScrollRoot()
        root.scrollTo({ left: snap.rootX, top: snap.rootY, behavior: 'instant' as ScrollBehavior })
      } catch {
        const root = getAppScrollRoot()
        root.scrollLeft = snap.rootX
        root.scrollTop = snap.rootY
      }
      if (snap.scrollers) {
        Object.entries(snap.scrollers).forEach(([id, pos]) => {
          const el = document.querySelector<HTMLElement>(`[data-scroll-id="${CSS.escape(id)}"]`)
          if (!el) return
          el.scrollLeft = pos.x
          el.scrollTop = pos.y
        })
      }
    })
  })
}

/** Verrouille le scroll body pendant qu'au moins une couche bloquante est ouverte. */
function syncBodyScrollLock() {
  if (typeof document === 'undefined') return
  const html = document.documentElement
  /* Une couche page / fullscreen / modal / sheet bloque le scroll body. Pas les overlays transparents. */
  const blocking = stackRef.value.some(
    (l) => l.presentation !== 'transparentOverlay' && l.presentation !== 'floatingCard',
  )
  html.classList.toggle('pinova-layer-scroll-lock', blocking)
}

/** Met à jour la couleur de la status bar en fonction de la couche au sommet. */
function syncStatusBar() {
  if (typeof document === 'undefined') return
  const top = stackRef.value[stackRef.value.length - 1] ?? null
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) return
  const dark = document.documentElement.classList.contains('dark')
  /* Choix par défaut système : noir en dark, blanc en light. Override par layer.statusBar. */
  let target = dark ? '#0a0a0a' : '#ffffff'
  if (top) {
    const want = top.statusBar
    if (want === 'light') target = '#ffffff'
    else if (want === 'dark') target = '#0a0a0a'
    /* 'auto' : laisse target système. */
    /* Surcharge : sur fullscreen immersif (PinDetail), on reste noir pour matcher le canevas. */
    if (top.presentation === 'fullscreen') target = '#000000'
  }
  if (meta.getAttribute('content') !== target) meta.setAttribute('content', target)
}

/** Marque "frozen" les couches recouvertes par une couche opaque au-dessus. */
function syncFrozenState() {
  /* Une couche est gelée si une couche opaque (page / fullscreen) est strictement au-dessus d'elle. */
  let opaqueAbove = false
  for (let i = stackRef.value.length - 1; i >= 0; i -= 1) {
    const layer = stackRef.value[i]
    if (opaqueAbove && layer.preserveBackground) {
      layer.frozen = true
    } else {
      layer.frozen = false
    }
    if (layer.presentation === 'page' || layer.presentation === 'fullscreen') {
      opaqueAbove = true
    }
  }
}

function resolveDismissStrategy(
  presentation: LayerPresentation,
  override?: Partial<LayerDismissStrategy>,
): LayerDismissStrategy {
  const base = DEFAULT_DISMISS_STRATEGY[presentation]
  return {
    backdrop: override?.backdrop ?? base.backdrop,
    escape: override?.escape ?? base.escape,
    swipeDown: override?.swipeDown ?? base.swipeDown,
    swipeFromHeaderOnly: override?.swipeFromHeaderOnly ?? base.swipeFromHeaderOnly,
    edgeBack: override?.edgeBack ?? base.edgeBack,
  }
}

/* ───────────────────────── URL sync via History API ───────────────────────── */
/**
 * On gère un mini-état dans `history.state.__layerId` : chaque push d'URL pour
 * une couche pose un marqueur. Si l'utilisateur clique "retour" navigateur,
 * popstate vérifie si l'entrée précédente contient un id de couche connu et
 * la dépile.
 *
 * Ne pas confondre avec Vue Router : on délègue à history natif pour les
 * route-bound layers (l'URL change mais Vue Router n'a pas besoin de naviguer).
 */
const urlLayerEntries = new Map<LayerId, { backUrl: string }>()

function pushUrlForLayer(layerId: LayerId, url: string) {
  if (typeof window === 'undefined') return
  const backUrl = window.location.pathname + window.location.search + window.location.hash
  urlLayerEntries.set(layerId, { backUrl })
  const state = { ...(window.history.state ?? {}), __pinovaLayer: layerId }
  window.history.pushState(state, '', url)
}

function popUrlForLayer(layerId: LayerId, options: { skipHistory?: boolean } = {}) {
  const entry = urlLayerEntries.get(layerId)
  urlLayerEntries.delete(layerId)
  if (!entry || options.skipHistory) return
  if (typeof window === 'undefined') return
  /* On revient à l'URL précédente sans recharger. */
  try {
    window.history.replaceState({}, '', entry.backUrl)
  } catch {
    /* ignore */
  }
}

let popstateBound = false

function onPopState() {
  /*
   * L'utilisateur a cliqué "retour" navigateur.
   * On regarde si la couche au sommet a un id qui n'est PLUS référencé dans
   * l'état d'history (donc le navigateur a sauté avant le marqueur de cette couche).
   * Si oui, on ferme cette couche logiquement (sans toucher à history puisque
   * c'est déjà fait par le navigateur).
   */
  const top = stackRef.value[stackRef.value.length - 1] ?? null
  if (!top) return
  const stateLayerId = (window.history.state && (window.history.state as { __pinovaLayer?: string }).__pinovaLayer) || null
  if (!top.url) return
  if (stateLayerId !== top.id) {
    /* On ferme la couche sans repush history (déjà fait par le navigateur). */
    popInternal(top.id, undefined, { skipHistory: true })
  }
}

function bindPopState() {
  if (popstateBound || typeof window === 'undefined') return
  window.addEventListener('popstate', onPopState)
  popstateBound = true
}

/* ───────────────────────── API publique ───────────────────────── */

export function push<P = Record<string, unknown>>(options: LayerPushOptions<P>): LayerId {
  bindPopState()
  const presentation: LayerPresentation = options.presentation ?? 'modal'
  const id: LayerId = options.id ?? generateLayerId(presentation === 'page' ? 'pg' : presentation.slice(0, 3))

  /* Déduplication par group : si le group existe déjà, on retourne l'id existant sans repush. */
  if (options.group) {
    const existing = stackRef.value.find((l) => l.group === options.group)
    if (existing) return existing.id
  }

  const zIndex = LAYER_Z_INDEX_BASE + stackRef.value.length * LAYER_Z_INDEX_STEP

  const layer: Layer = {
    id,
    presentation,
    component: options.component,
    componentProps: (options.componentProps as Record<string, unknown>) ?? {},
    url: options.url ?? null,
    dismissStrategy: resolveDismissStrategy(presentation, options.dismissStrategy),
    preserveBackground: options.preserveBackground ?? true,
    statusBar: options.statusBar ?? 'auto',
    disableEdgeBack: options.disableEdgeBack ?? false,
    originRect: options.originRect ?? null,
    zIndex,
    createdAt: Date.now(),
    group: options.group ?? null,
    scrollSnapshot: captureScrollSnapshot(),
    frozen: false,
    onClose: options.onClose ?? null,
  }

  if (layer.url) pushUrlForLayer(id, layer.url)

  stackRef.value = [...stackRef.value, layer]
  /* DOM budget : les couches bloquantes comptent comme overlays. */
  if (presentation !== 'transparentOverlay') {
    budgetDisposers.set(id, trackBudget('overlays'))
  }
  syncFrozenState()
  syncBodyScrollLock()
  syncStatusBar()
  /* Haptic feedback (silencieux si reduced motion ou opt-out). */
  emitLayerOpenFeedback(isHeavyLayerOpen(presentation))
  return id
}

/** Implémentation interne du pop (avec contrôle history). */
function popInternal(
  id: LayerId | undefined,
  result: unknown,
  options: { skipHistory?: boolean } = {},
): boolean {
  const stack = stackRef.value
  if (stack.length === 0) return false
  const targetId = id ?? stack[stack.length - 1].id
  const idx = stack.findIndex((l) => l.id === targetId)
  if (idx < 0) return false

  const layer = stack[idx]
  const toRestore = layer.scrollSnapshot
  /* Si on dépile une couche au milieu, on remonte les ids des couches au-dessus
     pour les fermer aussi (FIFO inversé). */
  const toClose = stack.slice(idx)
  const next = stack.slice(0, idx)
  stackRef.value = next

  /* History cleanup. */
  toClose.forEach((l) => {
    if (l.url) popUrlForLayer(l.id, options)
    const dispose = budgetDisposers.get(l.id)
    if (dispose) {
      dispose()
      budgetDisposers.delete(l.id)
    }
  })

  /* Callbacks de fermeture. */
  toClose.reverse().forEach((l) => {
    try {
      l.onClose?.(l.id === targetId ? result : undefined)
    } catch (e) {
      console.warn('[layerManager] onClose error', e)
    }
  })

  syncFrozenState()
  syncBodyScrollLock()
  syncStatusBar()
  /* Restauration scroll du contexte sous-jacent uniquement si plus aucune
     couche bloquante n'est ouverte (sinon on attend). */
  const stillBlocking = stackRef.value.some(
    (l) => l.presentation !== 'transparentOverlay' && l.presentation !== 'floatingCard',
  )
  if (!stillBlocking) {
    restoreScrollSnapshot(toRestore)
  }
  /* Haptic de fermeture (uniformément light). */
  emitLayerCloseFeedback()
  return true
}

/** Ferme une couche (par défaut celle du sommet). */
export function pop(id?: LayerId, result?: unknown): boolean {
  return popInternal(id, result)
}

/** Ferme toutes les couches au-dessus de `id` (incluse `id` reste). */
export function popTo(id: LayerId): boolean {
  const stack = stackRef.value
  const idx = stack.findIndex((l) => l.id === id)
  if (idx < 0) return false
  while (stackRef.value.length > idx + 1) {
    const top = stackRef.value[stackRef.value.length - 1]
    popInternal(top.id, undefined)
  }
  return true
}

/** Ferme toutes les couches. */
export function popAll(): void {
  while (stackRef.value.length > 0) {
    const top = stackRef.value[stackRef.value.length - 1]
    popInternal(top.id, undefined)
  }
}

/** Remplace la couche au sommet par une nouvelle (sans animation back). */
export function replace<P = Record<string, unknown>>(options: LayerPushOptions<P>): LayerId {
  if (stackRef.value.length > 0) {
    const top = stackRef.value[stackRef.value.length - 1]
    popInternal(top.id, undefined)
  }
  return push(options)
}

/** Stack en lecture seule. */
export const stack: ComputedRef<readonly Layer[]> = computed(() => readonly(stackRef.value) as readonly Layer[])

/** Couche au sommet (ou null). */
export const topLayer: ComputedRef<Layer | null> = computed(
  () => stackRef.value[stackRef.value.length - 1] ?? null,
)

/** Existe-t-il au moins une couche ouverte ? */
export const hasLayers: ComputedRef<boolean> = computed(() => stackRef.value.length > 0)

/** Récupérer une couche par id. */
export function findLayer(id: LayerId): Layer | null {
  return stackRef.value.find((l) => l.id === id) ?? null
}

/**
 * Helper bas niveau : indique si une couche du groupe `group` est ouverte.
 * Utile pour éviter d'ouvrir deux fois la même modale (ex: AppAlert).
 */
export function hasGroup(group: string): boolean {
  return stackRef.value.some((l) => l.group === group)
}

export const layerManager = {
  push,
  pop,
  popTo,
  popAll,
  replace,
  stack,
  topLayer,
  hasLayers,
  findLayer,
  hasGroup,
}

export type LayerManager = typeof layerManager
