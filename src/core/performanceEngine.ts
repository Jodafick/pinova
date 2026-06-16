/**
 * Performance Engine — façade unifiée pour la santé runtime Fotoce.
 *
 *  Objectif : un seul point d'entrée pour mesurer & piloter les performances,
 *  pendant que les sous-systèmes (perfMonitor, motionBudget, memoryManager,
 *  domBudget, renderScheduler, observerRegistry, swrCache) restent
 *  indépendants et utilisables individuellement.
 *
 *  iOS Safari = priorité — toutes les heuristiques sont calibrées pour
 *  éviter les écueils typiques :
 *    - memory leaks (observers oubliés) → observerRegistry
 *    - tab reload crash → memoryManager (pagehide / freeze)
 *    - jank scroll → renderScheduler (throttleRaf, batchWrite)
 *    - GPU overload → quality mode adaptatif (data-fotoce-quality)
 *
 *  Adaptive Quality Mode :
 *    - `high`   : full effects, blur libre, springs heavy, preload agressif
 *    - `medium` : blur réduit, durations -25%, preload modéré
 *    - `low`    : blur off, motion saver, transitions courtes, preload minimal
 *
 *  La qualité s'auto-ajuste sur :
 *    - FPS rolling avg (3s) : <38 → low, <50 → medium, ≥55 → high
 *    - Memory pressure : critical / frozen → low
 *    - Device tier initial (low = floor à 'medium', jamais 'high' par défaut)
 *    - prefers-reduced-motion : floor à 'medium' (jamais blur lourd)
 *
 *  Côté CSS, l'attribut `data-fotoce-quality` est posé sur `<html>` et
 *  consommé dans `style.css` pour neutraliser blur / box-shadow / glow.
 */

import { computed, readonly, ref, type ComputedRef, type Ref } from 'vue'
import {
  enablePerfMonitor,
  getPerfStore,
  snapshotPerf,
  initPerfMonitor,
} from './perfMonitor'
import {
  detectDeviceTier,
  initMotionBudget,
  motionDeviceTier,
  motionSaver,
  setMotionSaver,
} from './motionBudget'
import {
  getMemoryPressure,
  memoryPressure,
  reclaim,
  reclaimCritical,
  registerReclaimable,
  type MemoryPressure,
} from './memoryManager'
import { snapshotBudget } from './domBudget'

/* ───────────────────────── Quality mode ───────────────────────── */

export type QualityMode = 'low' | 'medium' | 'high'

const qualityRef = ref<QualityMode>('high')
/** Verrou manuel — si l'utilisateur force un niveau, on désactive l'auto. */
const qualityLocked = ref(false)
/** Reason du dernier changement (debug). */
const lastReason = ref<string>('init')

/* Hystérésis : on ne remonte la qualité que si stable plusieurs secondes. */
let recoveryHits = 0
const RECOVERY_REQUIRED_HITS = 3 /* 3 secondes consécutives de fluidité */
let degradeHits = 0
const DEGRADE_REQUIRED_HITS = 2 /* 2 secondes consécutives de jank */

function syncQualityToDocument(mode: QualityMode): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.fotoceQuality = mode
  /* Bascule du saver pour les composants qui n'écoutent que ça. */
  if (mode === 'low' && !motionSaver.value) {
    setMotionSaver(true)
  } else if (mode !== 'low' && motionSaver.value && !qualityLocked.value) {
    /* On ne réactive PAS le motion saver automatiquement si on est en
       prefers-reduced-motion : motionBudget l'a posé pour a11y, il reste. */
    if (typeof window !== 'undefined') {
      let prefersReduced = false
      try {
        prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      } catch {
        /* ignore */
      }
      if (!prefersReduced) setMotionSaver(false)
    }
  }
}

function applyQuality(next: QualityMode, reason: string): void {
  if (qualityRef.value === next) return
  qualityRef.value = next
  lastReason.value = reason
  syncQualityToDocument(next)
}

/** Lecture seule. */
export const qualityMode: Readonly<Ref<QualityMode>> = readonly(qualityRef)

export function getQualityMode(): QualityMode {
  return qualityRef.value
}

/**
 * Force manuellement un niveau de qualité. Désactive l'auto-degrade jusqu'à
 * `releaseQualityMode()`. Utile depuis un menu Settings ou un toast système.
 */
export function setQualityMode(mode: QualityMode, reason = 'manual'): void {
  qualityLocked.value = true
  applyQuality(mode, reason)
}

/** Réactive l'auto-degrade. */
export function releaseQualityMode(): void {
  qualityLocked.value = false
  recoveryHits = 0
  degradeHits = 0
  /* On laisse la boucle ré-évaluer au prochain tick. */
}

/* ───────────────────────── Public API ───────────────────────── */

/**
 * Mesure le FPS courant (instantané + moyenne ring buffer).
 * Le monitor est démarré paresseusement si pas déjà actif.
 */
export function measureFPS(): { fps: number; avg: number } {
  enablePerfMonitor()
  const store = getPerfStore()
  return { fps: store.fps.value, avg: store.fpsAvg.value }
}

/**
 * Snapshot mémoire (best-effort — `performance.memory` non standard).
 *  - Chrome / Edge : valeurs exactes
 *  - Safari iOS    : null (pas exposé)
 */
export interface MemorySnapshot {
  /** Heap utilisée (MB) ou null. */
  usedMB: number | null
  /** Limite heap (MB) ou null. */
  limitMB: number | null
  /** Ratio used/limit ∈ [0..1] ou null. */
  ratio: number | null
  /** Pression actuelle (idle / active / frozen / critical). */
  pressure: MemoryPressure
}

export function trackMemory(): MemorySnapshot {
  enablePerfMonitor()
  const store = getPerfStore()
  const used = store.heapUsedMB.value
  const limit = store.heapLimitMB.value
  return {
    usedMB: used,
    limitMB: limit,
    ratio: used != null && limit ? +(used / limit).toFixed(3) : null,
    pressure: getMemoryPressure(),
  }
}

/** Tier device détecté (re-export pour API unifiée). */
export { detectDeviceTier }
export const deviceTier: Readonly<Ref<'low' | 'mid' | 'high'>> = motionDeviceTier

/**
 * Pilote globalement les animations.
 *  - `'off'`  : libère le frein, qualité = auto
 *  - `'soft'` : qualité = medium (transitions raccourcies, blur léger)
 *  - `'hard'` : qualité = low (motion saver, blur off)
 */
export function throttleAnimations(level: 'off' | 'soft' | 'hard' = 'soft'): void {
  if (level === 'off') {
    releaseQualityMode()
    return
  }
  setQualityMode(level === 'hard' ? 'low' : 'medium', `throttleAnimations:${level}`)
}

/* ───────────────────────── Auto-degrade loop ───────────────────────── */

let tickTimer: ReturnType<typeof setInterval> | null = null

function tick(): void {
  if (qualityLocked.value) return
  const { avg } = measureFPS()
  const pressure = getMemoryPressure()

  /* Pression mémoire critique = bascule immédiate. */
  if (pressure === 'critical' || pressure === 'frozen') {
    degradeHits = 0
    recoveryHits = 0
    applyQuality('low', `memoryPressure:${pressure}`)
    return
  }

  const tier = motionDeviceTier.value
  /* Floor selon tier : un low ne devrait jamais monter à high par défaut. */
  const ceiling: QualityMode = tier === 'low' ? 'medium' : 'high'

  /* On accepte que `avg === 0` au tout début (rien échantillonné encore). */
  if (avg === 0) return

  if (avg < 38) {
    degradeHits += 1
    recoveryHits = 0
    if (degradeHits >= DEGRADE_REQUIRED_HITS) {
      applyQuality('low', `fps<38 avg=${avg}`)
    }
    return
  }
  if (avg < 50) {
    degradeHits = 0
    recoveryHits = 0
    /* Medium si on n'est pas déjà low (low reste plus sûr). */
    if (qualityRef.value === 'high') applyQuality('medium', `fps<50 avg=${avg}`)
    return
  }

  /* avg ≥ 50 : on tente la remontée si stable. */
  degradeHits = 0
  if (avg >= 55) {
    recoveryHits += 1
    if (recoveryHits >= RECOVERY_REQUIRED_HITS) {
      applyQuality(ceiling, `fps≥55 avg=${avg}`)
      recoveryHits = 0
    }
  } else {
    recoveryHits = 0
  }
}

function startAutoLoop(): void {
  if (tickTimer != null) return
  /* Période 1s : suffisamment réactif sans bloquer le main thread. */
  tickTimer = setInterval(tick, 1_000)
}

function stopAutoLoop(): void {
  if (tickTimer == null) return
  clearInterval(tickTimer)
  tickTimer = null
}

/* ───────────────────────── Reclaimable handlers ───────────────────────── */

let reclaimerRegistered = false
function ensureReclaimer(): void {
  if (reclaimerRegistered) return
  reclaimerRegistered = true
  registerReclaimable({
    name: 'performance-engine',
    priority: 5,
    reclaim(pressure) {
      if (pressure === 'critical' || pressure === 'frozen') {
        applyQuality('low', `reclaim:${pressure}`)
      }
    },
  })
}

/* ───────────────────────── Snapshot / Debug ───────────────────────── */

export interface PerformanceSnapshot {
  quality: QualityMode
  qualityLocked: boolean
  qualityReason: string
  fps: number
  fpsAvg: number
  longTasksLastSec: number
  layoutShiftsLastSec: number
  heapUsedMB: number | null
  heapLimitMB: number | null
  gestureLatencyMs: number
  pressure: MemoryPressure
  deviceTier: 'low' | 'mid' | 'high'
  motionSaver: boolean
  budget: ReturnType<typeof snapshotBudget>
}

export function performanceSnapshot(): PerformanceSnapshot {
  const perf = snapshotPerf()
  return {
    quality: qualityRef.value,
    qualityLocked: qualityLocked.value,
    qualityReason: lastReason.value,
    ...perf,
    pressure: getMemoryPressure(),
    deviceTier: motionDeviceTier.value,
    motionSaver: motionSaver.value,
    budget: snapshotBudget(),
  }
}

/** Computed unique pour bindings UI (e.g. debug overlay). */
export const performanceSummary: ComputedRef<{
  quality: QualityMode
  fps: number
  pressure: MemoryPressure
}> = computed(() => ({
  quality: qualityRef.value,
  fps: getPerfStore().fps.value,
  pressure: memoryPressure.value,
}))

/* ───────────────────────── Init ───────────────────────── */

let initialised = false

/**
 * Initialise le moteur de performance. Idempotent.
 *
 * À appeler depuis `main.ts` après `initMemoryManager()` et `initMotionBudget()`
 * (qui sont, eux, indépendants — l'engine va simplement les chaîner).
 */
export function initPerformanceEngine(): void {
  if (initialised) return
  initialised = true
  /* Sous-systèmes idempotents : safe d'appeler à nouveau ici. */
  initMotionBudget()
  initPerfMonitor()
  enablePerfMonitor()
  ensureReclaimer()

  /* Quality initiale conservatrice : high uniquement si tier high explicite (Chrome desktop). */
  const tier = motionDeviceTier.value
  if (tier === 'low') {
    applyQuality('low', 'init:tier=low')
  } else if (tier === 'high') {
    applyQuality('high', 'init:tier=high')
  } else {
    applyQuality('medium', 'init:tier=mid')
  }

  /* prefers-reduced-motion → floor à medium (a11y avant performances). */
  if (typeof window !== 'undefined') {
    try {
      const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
      if (mql.matches) {
        applyQuality('low', 'init:reducedMotion')
      }
      mql.addEventListener?.('change', () => {
        if (mql.matches) applyQuality('low', 'reducedMotion:change')
      })
    } catch {
      /* ignore */
    }
  }

  startAutoLoop()

  /* Hooks page visibility : on relance les FPS au foreground et on reclaim
     fortement en background — le memoryManager le fait déjà, on enchaîne
     simplement la bascule quality. */
  if (typeof document !== 'undefined') {
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.visibilityState === 'hidden') {
          applyQuality('low', 'visibility:hidden')
        } else {
          /* On laisse l'auto-loop décider à la prochaine itération. */
          recoveryHits = 0
        }
      },
      { passive: true },
    )
  }
}

/** Stoppe la boucle auto (tests / teardown). */
export function disposePerformanceEngine(): void {
  stopAutoLoop()
  initialised = false
}

/* ───────────────────────── Public re-exports utiles ───────────────────────── */

export { reclaim, reclaimCritical }
