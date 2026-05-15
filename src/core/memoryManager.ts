/**
 * Memory Manager — orchestrateur central pour la santé mémoire iOS Safari.
 *
 * Objectif : empêcher Safari iOS de tuer la page après une longue session,
 * en libérant proactivement les ressources non-essentielles dès que :
 *  - la page passe en arrière-plan (`visibilitychange`)
 *  - l'utilisateur reste inactif quelques minutes
 *  - on détecte une pression mémoire (heuristique JS heap > seuil)
 *  - la couche au sommet recouvre les couches précédentes (freeze)
 *
 * Architecture :
 *  - Modules s'enregistrent via `registerReclaimable({ name, reclaim })`
 *  - Le manager appelle `reclaim(pressure)` quand nécessaire
 *  - `pressure` ∈ ['idle','active','frozen','critical'] indique le niveau
 *  - L'API publique expose aussi des helpers ad-hoc (`releaseMedia()`, ...)
 *
 * Aucune dépendance hors `vue` minimale (ref). Aucune mutation du DOM ici :
 * chaque consommateur sait comment se libérer (videos, images, observers).
 *
 * Singleton — un seul orchestrateur pour toute l'application.
 */

import { ref, type Ref } from 'vue'

/** Niveau de pression mémoire signalé aux reclaimables. */
export type MemoryPressure = 'idle' | 'active' | 'frozen' | 'critical'

/** Contrat d'un module qui sait libérer ses ressources. */
export interface Reclaimable {
  /** Identifiant lisible (debug uniquement). */
  name: string
  /**
   * Libère les ressources non-essentielles. Doit être idempotent.
   * @param pressure Niveau actuel. `frozen` = page en arrière-plan, `critical` = urgence.
   */
  reclaim: (pressure: MemoryPressure) => void | Promise<void>
  /** Priorité (plus petit = libère en premier). Default 100. */
  priority?: number
}

interface ReclaimableEntry extends Reclaimable {
  id: number
}

/* ────────── État interne ────────── */

let nextId = 1
const reclaimables = new Map<number, ReclaimableEntry>()

/** Pression mémoire courante (réactive si dev veut l'observer). */
const currentPressure: Ref<MemoryPressure> = ref('active')

/** Timestamp dernier reclaim. Évite les rafales. */
let lastReclaimAt = 0
const RECLAIM_THROTTLE_MS = 4_000

/** Seuils du heap JS (en bytes). Heuristique pour signaler "critical". */
const HEAP_CRITICAL_RATIO = 0.85
const HEAP_HIGH_RATIO = 0.7

/* ────────── API publique ────────── */

/**
 * Enregistre un module qui sait libérer ses ressources sous pression.
 * Retourne un disposer à appeler dans `onBeforeUnmount`.
 */
export function registerReclaimable(r: Reclaimable): () => void {
  const id = nextId
  nextId += 1
  reclaimables.set(id, { id, priority: 100, ...r })
  return () => {
    reclaimables.delete(id)
  }
}

/** Liste actuelle (debug). */
export function listReclaimables(): ReadonlyArray<{ id: number; name: string; priority: number }> {
  return Array.from(reclaimables.values()).map(({ id, name, priority }) => ({
    id,
    name,
    priority: priority ?? 100,
  }))
}

/** Pression mémoire actuelle (lecture seule). */
export function getMemoryPressure(): MemoryPressure {
  return currentPressure.value
}

export const memoryPressure: Readonly<Ref<MemoryPressure>> = currentPressure

/**
 * Déclenche un cycle de récupération. Throttlé.
 * `force=true` ignore le throttle (appel manuel en urgence).
 */
export function reclaim(pressure: MemoryPressure = currentPressure.value, force = false): void {
  const now = Date.now()
  if (!force && now - lastReclaimAt < RECLAIM_THROTTLE_MS) return
  lastReclaimAt = now
  currentPressure.value = pressure

  /* Ordre : priority asc (les plus prioritaires libèrent en premier). */
  const ordered = Array.from(reclaimables.values()).sort(
    (a, b) => (a.priority ?? 100) - (b.priority ?? 100),
  )

  for (const entry of ordered) {
    try {
      const ret = entry.reclaim(pressure)
      if (ret && typeof (ret as Promise<unknown>).then === 'function') {
        ;(ret as Promise<unknown>).catch((err) =>
          console.warn(`[memoryManager] reclaim "${entry.name}" rejected`, err),
        )
      }
    } catch (err) {
      console.warn(`[memoryManager] reclaim "${entry.name}" threw`, err)
    }
  }
}

/** Force "critical" — utile depuis un toast "Mémoire faible". */
export function reclaimCritical(): void {
  reclaim('critical', true)
}

/* ────────── Détecteurs / déclencheurs ────────── */

interface PerformanceMemory {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}

function readHeap(): PerformanceMemory | null {
  if (typeof performance === 'undefined') return null
  const m = (performance as Performance & { memory?: PerformanceMemory }).memory
  if (!m || typeof m.usedJSHeapSize !== 'number') return null
  return m
}

/** Estime un ratio used/limit. Null si non supporté (Safari). */
export function getHeapUsageRatio(): number | null {
  const m = readHeap()
  if (!m || !m.jsHeapSizeLimit) return null
  return m.usedJSHeapSize / m.jsHeapSizeLimit
}

/* ────────── Activity tracking (inactive freeze) ────────── */

const INACTIVITY_THRESHOLD_MS = 120_000 /* 2 min sans interaction → idle reclaim */
let lastUserActivityAt = Date.now()
let inactivityTimer: ReturnType<typeof setTimeout> | null = null

function markActivity(): void {
  lastUserActivityAt = Date.now()
  if (currentPressure.value === 'idle') {
    currentPressure.value = 'active'
  }
  scheduleInactivityCheck()
}

function scheduleInactivityCheck(): void {
  if (inactivityTimer) clearTimeout(inactivityTimer)
  inactivityTimer = setTimeout(() => {
    const elapsed = Date.now() - lastUserActivityAt
    if (elapsed >= INACTIVITY_THRESHOLD_MS) {
      reclaim('idle')
    }
    /* On reschedule pour le prochain check (pas en boucle dense). */
    scheduleInactivityCheck()
  }, INACTIVITY_THRESHOLD_MS + 250)
}

/* ────────── Heap watchdog (Chrome devtool ; pas Safari) ────────── */

let heapWatchdogTimer: ReturnType<typeof setInterval> | null = null

function startHeapWatchdog(): void {
  if (heapWatchdogTimer != null) return
  /* On lit toutes les 15s, c'est volontairement peu fréquent : performance.memory
     est non-standard et bruyant. */
  heapWatchdogTimer = setInterval(() => {
    const ratio = getHeapUsageRatio()
    if (ratio == null) return
    if (ratio >= HEAP_CRITICAL_RATIO) {
      reclaim('critical', true)
    } else if (ratio >= HEAP_HIGH_RATIO) {
      reclaim('active')
    }
  }, 15_000)
}

/* ────────── Page lifecycle hooks ────────── */

let bound = false

function onVisibility() {
  if (typeof document === 'undefined') return
  if (document.visibilityState === 'hidden') {
    /* Safari peut purger l'onglet pendant qu'il est en arrière-plan : on
       libère préventivement vidéos / caches volumineux. */
    reclaim('frozen', true)
  } else {
    currentPressure.value = 'active'
    markActivity()
  }
}

function onPageHide(e: PageTransitionEvent) {
  /* Cas iOS Safari "page mise en cache (bfcache)" : on libère les ressources
     lourdes mais sans bloquer la mise en cache. */
  if (e.persisted) {
    reclaim('frozen', true)
  } else {
    reclaim('critical', true)
  }
}

function onMemoryWarning() {
  /* Web Memory Pressure API (origin trial Chrome). Pas Safari. */
  reclaim('critical', true)
}

/**
 * Initialise le memory manager (à appeler depuis `main.ts`).
 * Idempotent : safe d'appeler plusieurs fois.
 */
export function initMemoryManager(): void {
  if (bound) return
  bound = true
  if (typeof document === 'undefined') return
  try {
    document.addEventListener('visibilitychange', onVisibility, { passive: true })
    window.addEventListener('pagehide', onPageHide as EventListener, { passive: true })
    /* Activité utilisateur : on n'écoute QUE des events passifs. */
    const activityEvents = ['pointerdown', 'keydown', 'touchstart', 'scroll', 'wheel'] as const
    for (const ev of activityEvents) {
      window.addEventListener(ev, markActivity, { passive: true, capture: true })
    }
    /* Memory pressure events (non-standard, mais best-effort). */
    type MemAPI = EventTarget & {
      addEventListener: (type: 'pressure', cb: () => void) => void
    }
    const memEt = (
      (navigator as Navigator & { memory?: MemAPI }).memory as MemAPI | undefined
    )
    memEt?.addEventListener?.('pressure', onMemoryWarning)
    scheduleInactivityCheck()
    startHeapWatchdog()
  } catch (err) {
    console.warn('[memoryManager] init failed', err)
  }
}

/* ────────── Helpers ad-hoc (raccourcis convenance) ────────── */

/**
 * Vide les vidéos hors viewport ; appelle `drain()` sur le pool global si pression critique.
 * Le pool est récupéré dynamiquement pour éviter une dépendance circulaire au boot.
 */
export async function releaseInactiveVideos(): Promise<void> {
  try {
    const mod = await import('../composables/useVideoPool')
    const pool = mod.useVideoPool()
    pool.drain()
  } catch {
    /* ignore */
  }
}

/** Force un GC hint (Chrome devtools only). No-op en prod. */
export function gcHint(): void {
  const g = globalThis as { gc?: () => void }
  if (typeof g.gc === 'function') {
    try {
      g.gc()
    } catch {
      /* ignore */
    }
  }
}
