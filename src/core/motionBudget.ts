/**
 * Motion Budget Manager — limite globale d'animations concurrentes.
 *
 * Sur Safari iOS, empiler trop d'animations en parallèle (springs, blurs animés,
 * keyframes opacity) cause :
 *  - frame drops visibles
 *  - décharge batterie excessive
 *  - "thermal throttling" qui dégrade tout
 *
 * Ce manager :
 *  - compte le nombre d'animations actives par catégorie
 *  - expose un helper `canStartAnimation(category)` consultable AVANT de lancer
 *  - quand un seuil est dépassé : il faut soit attendre, soit dégrader (skip frames, durée 1ms)
 *  - bascule en mode "saver" si :
 *      - reducedMotion système est on
 *      - le tier device détecté est `low`
 *      - le memoryManager émet 'critical'
 *
 * Singleton.
 */

import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { registerReclaimable } from './memoryManager'

export type MotionCategory =
  /** Springs physiques (gestures, sheets, scroll inertie). */
  | 'spring'
  /** Transitions UI (opacity, transform sur layers). */
  | 'transition'
  /** Effets visuels lourds : blur animé, gradient shimmer, glow pulse. */
  | 'heavy'
  /** Animations de feedback ponctuelles (press, haptic pulse). */
  | 'feedback'

interface BudgetEntry {
  active: Ref<number>
  /** Plafond "soft" : au-delà on demande la dégradation. */
  soft: number
  /** Plafond "hard" : on refuse de démarrer. */
  hard: number
}

const ENTRIES: Record<MotionCategory, BudgetEntry> = {
  spring:     { active: ref(0), soft: 6, hard: 12 },
  transition: { active: ref(0), soft: 8, hard: 16 },
  heavy:      { active: ref(0), soft: 2, hard: 4 },
  feedback:   { active: ref(0), soft: 8, hard: 20 },
}

/** Mode "saver" global : toutes les animations s'auto-dégradent. */
const saverMode = ref(false)

/** Tier device estimé (cf. `detectDeviceTier`). Lu par les consommateurs. */
const deviceTier = ref<'low' | 'mid' | 'high'>('high')

/* ────────── API publique ────────── */

/** Est-on autorisé à démarrer une animation de cette catégorie ? */
export function canStartAnimation(category: MotionCategory): boolean {
  if (saverMode.value && (category === 'heavy' || category === 'spring')) return false
  const entry = ENTRIES[category]
  return entry.active.value < entry.hard
}

/** Faut-il dégrader la qualité (durée plus courte, sans blur, etc.) ? */
export function shouldDegradeAnimation(category: MotionCategory): boolean {
  if (saverMode.value) return true
  const entry = ENTRIES[category]
  return entry.active.value >= entry.soft
}

/**
 * Réserve un slot. Retourne un disposer à appeler quand l'animation se termine.
 * Si on est au-delà du hard cap, retourne un disposer no-op (caller doit alors
 * soit skipper, soit jouer "instantanément" via `shouldDegradeAnimation`).
 */
export function acquireMotionSlot(category: MotionCategory): () => void {
  if (!canStartAnimation(category)) {
    return () => undefined
  }
  const entry = ENTRIES[category]
  entry.active.value += 1
  let released = false
  return () => {
    if (released) return
    released = true
    entry.active.value = Math.max(0, entry.active.value - 1)
  }
}

/** Indique si on doit afficher des effets visuels coûteux (blur, glow animés). */
export const heavyEffectsEnabled: ComputedRef<boolean> = computed(
  () => !saverMode.value && deviceTier.value !== 'low',
)

/** Lecture seule du mode saver. */
export const motionSaver: Readonly<Ref<boolean>> = saverMode

/** Bascule le mode saver. */
export function setMotionSaver(value: boolean): void {
  saverMode.value = value
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('fotoce-motion-saver', value)
  }
}

/** Snapshot pour debug. */
export function snapshotMotion(): Record<MotionCategory, { active: number; soft: number; hard: number }> {
  const out = {} as Record<MotionCategory, { active: number; soft: number; hard: number }>
  ;(Object.keys(ENTRIES) as MotionCategory[]).forEach((k) => {
    out[k] = { active: ENTRIES[k].active.value, soft: ENTRIES[k].soft, hard: ENTRIES[k].hard }
  })
  return out
}

/* ────────── Détection device tier ────────── */

/**
 * Heuristique de détection :
 *  - low  : iPhone < 11 ou Android low-end (deviceMemory ≤ 2)
 *  - mid  : appareils mémoire 3–4Go ou hardwareConcurrency ≤ 4
 *  - high : reste
 *
 * Conservateur : on suppose `mid` par défaut, on remonte vers `high` seulement
 * si on a des indicateurs explicites.
 */
function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const isAppleMobile = /iPhone|iPad|iPod/i.test(ua)
  const isTouchMac = /Macintosh/i.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document
  return isAppleMobile || isTouchMac
}

/** iPhone ≤ 11 / SE : 2–4 cœurs effectifs côté Safari. */
function isLegacyIosDevice(): boolean {
  if (!isIosSafari() || typeof window === 'undefined') return false
  const w = Math.min(window.screen.width, window.screen.height)
  const h = Math.max(window.screen.width, window.screen.height)
  if (w <= 320 && h <= 568) return true /* SE 1 */
  if (w <= 375 && h <= 667) return true /* 6/7/8 */
  if (w <= 414 && h <= 736) return true /* Plus pré–X */
  return false
}

export function detectDeviceTier(): 'low' | 'mid' | 'high' {
  if (typeof navigator === 'undefined') return 'mid'
  const nav = navigator as Navigator & {
    deviceMemory?: number
    hardwareConcurrency?: number
  }
  const memory = nav.deviceMemory
  const cores = nav.hardwareConcurrency

  if (isLegacyIosDevice()) return 'low'

  if (memory != null) {
    if (memory <= 2) return 'low'
    if (memory <= 4) return 'mid'
    return 'high'
  }

  /* Safari iOS : pas de deviceMemory — rester conservateur (jamais high par défaut). */
  if (isIosSafari()) {
    if (typeof cores === 'number' && cores <= 4) return 'low'
    return 'mid'
  }

  if (typeof cores === 'number') {
    if (cores <= 4) return 'mid'
    if (cores >= 8) return 'high'
  }
  return 'mid'
}

/**
 * Initialise le motion budget : détecte le tier, écoute prefers-reduced-motion,
 * bascule saver automatique. Idempotent.
 */
let initialized = false
export function initMotionBudget(): void {
  if (initialized) return
  initialized = true
  deviceTier.value = detectDeviceTier()

  if (typeof window !== 'undefined') {
    try {
      const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
      const sync = () => {
        if (mql.matches) setMotionSaver(true)
      }
      sync()
      mql.addEventListener?.('change', sync)
    } catch {
      /* ignore */
    }
  }

  /* En mode low + pression mémoire = saver. */
  registerReclaimable({
    name: 'motion-budget',
    priority: 30,
    reclaim(pressure) {
      if (pressure === 'critical' || pressure === 'frozen') {
        setMotionSaver(true)
      }
    },
  })
}

/** Tier device lecture seule. */
export const motionDeviceTier: Readonly<Ref<'low' | 'mid' | 'high'>> = deviceTier
