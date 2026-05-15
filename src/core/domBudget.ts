/**
 * DOM Budget — registre central des éléments coûteux montés à un instant T.
 *
 * Pourquoi ?
 *  - Safari iOS dégrade fortement au-delà de quelques milliers de nodes.
 *  - Plus de ~16 `<video>` simultanés = play() rejette silencieusement.
 *  - Trop d'overlays empilés = compositing bursts + memory leaks WebKit.
 *
 * Stratégie : chaque sous-système (virtual grid, layer host, media pool, ...)
 * incrémente / décrémente son compteur ici. Le manager surveille les seuils
 * et émet des events pour que les consommateurs réduisent leur ambition
 * (réduire la fenêtre du virtual scroll, paused les vidéos lointaines, etc.).
 *
 * Singleton. Aucune mutation directe du DOM.
 */

import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { registerReclaimable } from './memoryManager'

export type BudgetKey =
  /** Nombre d'overlays bloquants (modales, sheets, fullscreen) ouverts. */
  | 'overlays'
  /** Nombre d'images "montées" (active dans le viewport ou cache proche). */
  | 'mountedImages'
  /** Nombre de vidéos `<video>` actuellement attachées au DOM. */
  | 'mountedVideos'
  /** Nombre de DOM nodes "lourds" suivis (cartes virtualisées). */
  | 'heavyNodes'
  /** Nombre d'observers actifs (IntersectionObserver, ResizeObserver, etc.). */
  | 'observers'

/** Seuils déclencheurs (au-delà = pressure 'high' diffusée). */
const LIMITS: Record<BudgetKey, { soft: number; hard: number }> = {
  overlays: { soft: 3, hard: 5 },
  mountedImages: { soft: 220, hard: 360 },
  mountedVideos: { soft: 4, hard: 8 },
  heavyNodes: { soft: 600, hard: 1000 },
  observers: { soft: 80, hard: 160 },
}

const counters: Record<BudgetKey, Ref<number>> = {
  overlays: ref(0),
  mountedImages: ref(0),
  mountedVideos: ref(0),
  heavyNodes: ref(0),
  observers: ref(0),
}

type Listener = (key: BudgetKey, value: number, status: BudgetStatus) => void
const listeners = new Set<Listener>()

export type BudgetStatus = 'ok' | 'soft' | 'hard'

function statusFor(key: BudgetKey, value: number): BudgetStatus {
  const lim = LIMITS[key]
  if (value >= lim.hard) return 'hard'
  if (value >= lim.soft) return 'soft'
  return 'ok'
}

/** Incrémente le compteur d'un type. Retourne le disposer décrémentant. */
export function trackBudget(key: BudgetKey, delta = 1): () => void {
  counters[key].value += delta
  emit(key)
  let disposed = false
  return () => {
    if (disposed) return
    disposed = true
    counters[key].value = Math.max(0, counters[key].value - delta)
    emit(key)
  }
}

/** Décrémente directement (rare ; préférer le disposer renvoyé par `trackBudget`). */
export function untrackBudget(key: BudgetKey, delta = 1): void {
  counters[key].value = Math.max(0, counters[key].value - delta)
  emit(key)
}

function emit(key: BudgetKey) {
  const value = counters[key].value
  const status = statusFor(key, value)
  for (const fn of listeners) {
    try {
      fn(key, value, status)
    } catch (err) {
      console.warn('[domBudget] listener error', err)
    }
  }
}

/** S'abonner aux changements de budget. */
export function onBudgetChange(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** Lit la valeur courante d'un compteur. */
export function getBudgetValue(key: BudgetKey): number {
  return counters[key].value
}

/** Lit le status courant d'un compteur. */
export function getBudgetStatus(key: BudgetKey): BudgetStatus {
  return statusFor(key, counters[key].value)
}

/** Statut global synthétique (le pire des compteurs). */
export const globalBudgetStatus: ComputedRef<BudgetStatus> = computed(() => {
  let worst: BudgetStatus = 'ok'
  ;(Object.keys(counters) as BudgetKey[]).forEach((k) => {
    const s = statusFor(k, counters[k].value)
    if (s === 'hard') worst = 'hard'
    else if (s === 'soft' && worst !== 'hard') worst = 'soft'
  })
  return worst
})

/** Snapshot lisible pour debug overlay. */
export function snapshotBudget(): Record<BudgetKey, { value: number; status: BudgetStatus }> {
  const out = {} as Record<BudgetKey, { value: number; status: BudgetStatus }>
  ;(Object.keys(counters) as BudgetKey[]).forEach((k) => {
    out[k] = { value: counters[k].value, status: statusFor(k, counters[k].value) }
  })
  return out
}

/* Sous pression mémoire, on rappelle aux consommateurs de couper leur ambition.
   On ne touche pas au DOM directement : on diffuse simplement via les listeners
   un évènement "hard" sur tous les compteurs pour forcer un recompte. */
registerReclaimable({
  name: 'dom-budget',
  priority: 10,
  reclaim(pressure) {
    if (pressure === 'idle') return
    ;(Object.keys(counters) as BudgetKey[]).forEach((k) => emit(k))
  },
})
