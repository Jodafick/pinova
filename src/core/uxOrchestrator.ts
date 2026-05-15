/**
 * UX Orchestrator — couche d'orchestration globale (App feeling final layer).
 *
 *  Rôle : harmoniser, sans dupliquer, l'ensemble des sous-systèmes Pinova
 *  pour donner une expérience cohérente « app native premium » :
 *
 *    - navigation       : router + layerManager (transitions, retour Android)
 *    - motion           : motionBudget + adaptiveNavigator (springs / fade)
 *    - modales          : layerManager (push/pop/replace, freeze)
 *    - media            : mediaEngine (decode async, autoplay visible)
 *    - performance      : performanceEngine (quality auto-degrade)
 *    - platform         : adaptiveNavigator (ios / material / desktop)
 *    - haptics          : useMicroFeedback (intent → vibration + visual)
 *    - perception       : perceiveInstant (anim first, data after)
 *    - state continuity : sessionStorage namespaced + scroll preservation
 *
 *  Architecture : un seul bus d'événements typé, des wrappers de haut niveau
 *  pour les interactions utilisateur, et des helpers de continuité d'état.
 *
 *  Aucun composant n'a besoin d'importer ce module pour fonctionner —
 *  il est passif. Les consommateurs avancés (analytics, sound design,
 *  debug tools) peuvent s'y abonner.
 */

import { watch } from 'vue'
import type { Router } from 'vue-router'
import { layerManager } from '../navigation/layerManager'
import type { LayerId, LayerPresentation } from '../navigation/layerTypes'
import { adaptiveProfile, type InputKind, type MotionLanguage } from '../navigation/adaptiveNavigator'
import { memoryPressure, type MemoryPressure } from './memoryManager'
import { qualityMode, type QualityMode } from './performanceEngine'
import { emitMicroFeedback, type FeedbackIntent } from '../composables/useMicroFeedback'
import { idleCallback, nextFrame } from './renderScheduler'

/* ───────────────────────── Event Bus typé ───────────────────────── */

/**
 * Carte d'événements typés. Toute nouvelle catégorie d'événement doit
 * ajouter sa clé ici pour bénéficier du typing strict sur `on()` / `emit()`.
 */
export interface UxEventMap {
  /* Navigation router (Vue Router). */
  'nav:start':       { from: string; to: string; direction: 'forward' | 'back' }
  'nav:end':         { from: string; to: string; direction: 'forward' | 'back' }
  'nav:back':        { to: string }

  /* Layers (modals / sheets / fullscreen). */
  'layer:push':      { id: LayerId; presentation: LayerPresentation; depth: number }
  'layer:pop':       { id: LayerId; depth: number }
  'layer:replace':   { id: LayerId; presentation: LayerPresentation; depth: number }

  /* Media (informatif — émis par les composants concernés). */
  'media:loaded':    { src: string }
  'media:error':     { src: string; error?: unknown }
  'media:play':      { src: string }
  'media:pause':     { src: string }

  /* Feedback (haptic / micro-pulse — utile pour analytics & sound design). */
  'feedback:emit':   { intent: FeedbackIntent }

  /* Performance & système. */
  'quality:change':  { mode: QualityMode }
  'memory:pressure': { pressure: MemoryPressure }
  'app:pause':       Record<string, never>
  'app:resume':      Record<string, never>
  'system:online':   Record<string, never>
  'system:offline':  Record<string, never>

  /* Adaptation. */
  'platform:change': { mode: MotionLanguage; input: InputKind }
}

export type UxEventName = keyof UxEventMap
export type UxEventPayload<E extends UxEventName> = UxEventMap[E]

type Listener<P> = (payload: P) => void
const bus: Map<UxEventName, Set<Listener<unknown>>> = new Map()

/**
 * S'abonne à un événement. Retourne un disposer.
 *
 *   const off = uxOrchestrator.on('layer:push', (p) => console.log(p))
 *   onBeforeUnmount(off)
 */
export function on<E extends UxEventName>(
  event: E,
  fn: Listener<UxEventPayload<E>>,
): () => void {
  let set = bus.get(event)
  if (!set) {
    set = new Set()
    bus.set(event, set)
  }
  set.add(fn as Listener<unknown>)
  return () => {
    set?.delete(fn as Listener<unknown>)
  }
}

/** Émet un événement. Tous les listeners reçoivent la payload (ordre non garanti). */
export function emit<E extends UxEventName>(event: E, payload: UxEventPayload<E>): void {
  const set = bus.get(event)
  if (!set || set.size === 0) return
  for (const fn of set) {
    try {
      ;(fn as Listener<UxEventPayload<E>>)(payload)
    } catch (err) {
      console.warn(`[uxOrchestrator] listener for "${event}" threw`, err)
    }
  }
}

/** Retire TOUS les listeners d'un event (tests / hot reload). */
export function off(event: UxEventName): void {
  bus.delete(event)
}

/* ───────────────────────── Global Interaction Model ───────────────────────── */

export interface InteractionSpec {
  /** Intention sémantique (utilisée pour haptic + analytics). */
  intent?: FeedbackIntent
  /**
   * Réponse visuelle IMMÉDIATE. Exécuté avant tout `await`. À utiliser pour
   * lancer une animation / mettre à jour un compteur local.
   */
  apply?: () => void
  /**
   * Mise à jour optimiste du store (état que l'utilisateur veut). Reverté
   * automatiquement via `onError` si `sync` échoue.
   */
  optimistic?: () => void
  /** Promise de synchronisation (API call, persist). */
  sync?: () => Promise<unknown>
  /** Callback success après sync OK. */
  onSuccess?: () => void
  /** Callback error — utiliser pour revert optimistic. */
  onError?: (err: unknown) => void
  /** Skip haptic (ex. tests, opérations silencieuses). */
  silent?: boolean
}

/**
 * Orchestre une interaction utilisateur en 4 temps :
 *  1. **Réponse visuelle synchrone**  (`apply`) — JAMAIS bloquant
 *  2. **Mise à jour optimiste**       (`optimistic`)
 *  3. **Haptic feedback + bus emit**  (`intent`)
 *  4. **Background sync**             (`sync`) — non-bloquant pour l'UI
 *
 *  Garantie : la fonction retourne (et la promise se résout) dès que
 *  l'UI a réagi. Le `sync` continue en tâche de fond, et appelle
 *  `onSuccess` / `onError` de manière isolée.
 */
export function performInteraction(spec: InteractionSpec): Promise<void> {
  /* 1. Apply visuel — synchrone, dans la frame courante. */
  try { spec.apply?.() } catch (err) { console.warn('[uxOrchestrator] apply', err) }

  /* 2. Optimistic state update. */
  try { spec.optimistic?.() } catch (err) { console.warn('[uxOrchestrator] optimistic', err) }

  /* 3. Haptic + bus event. */
  if (!spec.silent && spec.intent) {
    emitMicroFeedback(spec.intent)
    emit('feedback:emit', { intent: spec.intent })
  }

  /* 4. Background sync — détaché du chemin critique. */
  if (!spec.sync) return Promise.resolve()
  return Promise.resolve().then(async () => {
    try {
      await spec.sync!()
      try { spec.onSuccess?.() } catch (err) { console.warn('[uxOrchestrator] onSuccess', err) }
    } catch (err) {
      try { spec.onError?.(err) } catch (e) { console.warn('[uxOrchestrator] onError', e) }
    }
  })
}

/* ───────────────────────── Perception Engine ───────────────────────── */

/**
 * Joue l'animation MAINTENANT, charge les données APRÈS — règle d'or
 * « animation immédiate, données ensuite, jamais bloquer l'UI ».
 *
 *  - `animation()` est appelé synchrone dans la frame courante
 *  - `dataLoad()` est appelé en `idleCallback` (ou setTimeout 0 fallback)
 *
 *  Retourne le résultat de `dataLoad` une fois disponible (ou undefined).
 */
export function perceiveInstant<T>(
  animation: () => void,
  dataLoad?: () => Promise<T>,
): Promise<T | undefined> {
  try { animation() } catch (err) { console.warn('[uxOrchestrator] animation', err) }
  if (!dataLoad) return Promise.resolve(undefined)
  return idleCallback(80).then(() => {
    try { return dataLoad() } catch (err) {
      console.warn('[uxOrchestrator] dataLoad', err)
      return undefined
    }
  })
}

/**
 * Force un repaint propre AVANT d'exécuter une transition.
 * Utile quand on insère un élément qui doit apparaître depuis un état
 * initial — on doit attendre 1 frame avant de toggle la classe finale.
 */
export async function paintThen(fn: () => void): Promise<void> {
  await nextFrame()
  try { fn() } catch (err) { console.warn('[uxOrchestrator] paintThen', err) }
}

/* ───────────────────────── State Continuity ───────────────────────── */

/**
 * Préserve un fragment d'état UI (modal ouverte, onglet actif, filtre…)
 * dans `sessionStorage` (vie de l'onglet). Sérialisation JSON.
 * Cohérent avec le snapshot scroll fait par `layerManager` et
 * `useScrollPreservation`.
 */
const CONTINUITY_PREFIX = 'pinova.ux.'

export function saveAppSnapshot<T>(key: string, data: T): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(CONTINUITY_PREFIX + key, JSON.stringify(data))
  } catch {
    /* Quota / mode privé Safari : on échoue silencieusement. */
  }
}

export function restoreAppSnapshot<T>(key: string): T | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(CONTINUITY_PREFIX + key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function clearAppSnapshot(key: string): void {
  if (typeof sessionStorage === 'undefined') return
  try { sessionStorage.removeItem(CONTINUITY_PREFIX + key) } catch { /* ignore */ }
}

export function clearAllAppSnapshots(): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    const toRemove: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (k && k.startsWith(CONTINUITY_PREFIX)) toRemove.push(k)
    }
    toRemove.forEach((k) => sessionStorage.removeItem(k))
  } catch {
    /* ignore */
  }
}

/* ───────────────────────── Platform Adaptation Layer ───────────────────────── */

export interface AppSurface {
  /** Plateforme détectée. */
  platform: 'ios' | 'android' | 'desktop' | 'unknown'
  /** Langage motion résolu. */
  motionLanguage: MotionLanguage
  /** Input (touch / mouse / mixed). */
  input: InputKind
  /** Mode qualité courant. */
  quality: QualityMode
  /** Pression mémoire courante. */
  memoryPressure: MemoryPressure
  /** Largeur viewport (px). */
  viewportWidth: number
  /** Safe-area utilisable (iOS notch). */
  safeAreaCapable: boolean
}

/**
 * Snapshot synthétique du contexte plateforme — agrège tous les flags
 * utiles à un composant qui veut adapter son rendu sans s'abonner à 5
 * stores différents.
 */
export function appSurface(): AppSurface {
  const p = adaptiveProfile.value
  return {
    platform: p.platform,
    motionLanguage: p.motionLanguage,
    input: p.input,
    quality: qualityMode.value,
    memoryPressure: memoryPressure.value,
    viewportWidth: p.viewportWidth,
    safeAreaCapable: p.safeAreaCapable,
  }
}

/* ───────────────────────── Watchers globaux ───────────────────────── */

let routerHooked = false

function wireRouter(router: Router): void {
  if (routerHooked) return
  routerHooked = true

  let isPop = false
  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', () => { isPop = true }, { passive: true })
  }

  router.beforeEach((to, from) => {
    if (!from.name) return /* navigation initiale, on ne broadcast pas. */
    const dir: 'forward' | 'back' = isPop ? 'back' : 'forward'
    /* Note : `data-pinova-nav-dir` n'est plus posé (View Transitions
       désactivées — la navigation est classique sans animation). */
    emit('nav:start', { from: from.fullPath, to: to.fullPath, direction: dir })
    if (dir === 'back') emit('nav:back', { to: to.fullPath })
  })

  router.afterEach((to, from) => {
    if (!from.name) return
    const dir: 'forward' | 'back' = isPop ? 'back' : 'forward'
    emit('nav:end', { from: from.fullPath, to: to.fullPath, direction: dir })
    isPop = false
  })
}

function wireLayerManager(): void {
  /* Diff sur layerManager.stack pour émettre push / pop.
     Un `replace` se manifeste comme pop(old) + push(new) — c'est l'invariant
     attendu par les consommateurs (le bus reste simple). */
  let prev: ReadonlyArray<{ id: LayerId; presentation: LayerPresentation }> = []
  watch(
    layerManager.stack,
    (next) => {
      const nextLite = next.map((l) => ({ id: l.id, presentation: l.presentation }))
      const prevIds = new Set(prev.map((l) => l.id))
      const nextIds = new Set(nextLite.map((l) => l.id))

      /* Pop d'abord (ordre cohérent : on libère avant de pousser). */
      for (let i = 0; i < prev.length; i++) {
        const layer = prev[i]
        if (!nextIds.has(layer.id)) {
          emit('layer:pop', { id: layer.id, depth: i + 1 })
        }
      }
      /* Push : ID présent dans next mais pas prev. */
      for (let i = 0; i < nextLite.length; i++) {
        const layer = nextLite[i]
        if (!prevIds.has(layer.id)) {
          emit('layer:push', { id: layer.id, presentation: layer.presentation, depth: i + 1 })
        }
      }
      prev = nextLite
    },
    { deep: false },
  )
}

function wireQuality(): void {
  watch(qualityMode, (mode) => {
    emit('quality:change', { mode })
  })
}

function wireMemory(): void {
  watch(memoryPressure, (pressure) => {
    emit('memory:pressure', { pressure })
  })
}

function wirePlatform(): void {
  watch(
    () => ({
      mode: adaptiveProfile.value.motionLanguage,
      input: adaptiveProfile.value.input,
    }),
    (next, prev) => {
      if (!prev || prev.mode !== next.mode || prev.input !== next.input) {
        emit('platform:change', next)
      }
    },
    { deep: true },
  )
}

function wireSystem(): void {
  if (typeof window === 'undefined') return
  window.addEventListener('online', () => emit('system:online', {}), { passive: true })
  window.addEventListener('offline', () => emit('system:offline', {}), { passive: true })
  if (typeof document !== 'undefined') {
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.visibilityState === 'hidden') emit('app:pause', {})
        else emit('app:resume', {})
      },
      { passive: true },
    )
  }
}

/* ───────────────────────── Init ───────────────────────── */

let initialised = false

/**
 * Initialise les watchers globaux. À appeler une fois au boot, après que
 * le `router`, le `layerManager`, le `performanceEngine` et le
 * `mediaEngine` aient été chaînés (cf. `main.ts`).
 *
 * Idempotent.
 */
export function initUxOrchestrator(router?: Router): void {
  if (initialised) return
  initialised = true
  if (router) wireRouter(router)
  wireLayerManager()
  wireQuality()
  wireMemory()
  wirePlatform()
  wireSystem()
}

/* ───────────────────────── Public API ───────────────────────── */

export const uxOrchestrator = {
  on,
  emit,
  off,
  performInteraction,
  perceiveInstant,
  paintThen,
  saveAppSnapshot,
  restoreAppSnapshot,
  clearAppSnapshot,
  clearAllAppSnapshots,
  appSurface,
}

export default uxOrchestrator
