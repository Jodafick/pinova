/**
 * useVideoPool — pool de réutilisation d'éléments `<video>` (TikTok-style).
 *
 * Pourquoi ?
 *  - Safari iOS limite le nombre de `<video>` simultanés (≤ 16 sur iPhone).
 *  - Au-delà, les nouveaux `<video>.play()` rejettent silencieusement.
 *  - Créer/détruire un `<video>` est coûteux (allouage GPU decode buffer).
 *  - Solution Pinterest/TikTok : pool global d'éléments réutilisés.
 *
 * Stratégie :
 *  - Pool LRU bornée (max 6 sur mobile, 12 sur desktop)
 *  - `acquire(src)` retourne un `<video>` initialisé (depuis pool ou frais)
 *  - `release(el)` rend l'élément au pool (pause, sourcebuffer, mute)
 *  - Eviction LRU automatique quand on dépasse le quota
 *
 * Note : ce pool ne crée PAS d'éléments dans le DOM — il les recycle entre
 * composants. Chaque composant `<SmartVideo>` consomme le pool via la
 * directive `v-smart-video` ou en montant un `<video>` qu'il release au
 * démontage.
 *
 * Singleton — un seul pool partagé pour toute l'app.
 */

import { registerReclaimable } from '../core/memoryManager'
import { trackBudget } from '../core/domBudget'

const POOL_LIMIT_MOBILE = 6
const POOL_LIMIT_DESKTOP = 12

function detectLimit(): number {
  if (typeof navigator === 'undefined') return POOL_LIMIT_DESKTOP
  /* maxTouchPoints > 0 → tactile (mobile/tablette) */
  const isTouch = (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 0
  return isTouch ? POOL_LIMIT_MOBILE : POOL_LIMIT_DESKTOP
}

interface PoolEntry {
  el: HTMLVideoElement
  inUse: boolean
  lastUsed: number
  src: string
  /** Disposer du DOM budget si la vidéo est attachée. */
  budgetDispose: (() => void) | null
}

const pool: PoolEntry[] = []
const limit = detectLimit()

/* S'enregistre auprès du memory manager : sous pression critique, on vide le pool. */
let reclaimerRegistered = false
function ensureReclaimer(): void {
  if (reclaimerRegistered) return
  reclaimerRegistered = true
  registerReclaimable({
    name: 'video-pool',
    priority: 20,
    reclaim(pressure) {
      if (pressure === 'critical' || pressure === 'frozen') {
        for (const entry of pool) {
          if (!entry.inUse) resetEntry(entry)
        }
      }
    },
  })
}
ensureReclaimer()

/**
 * Crée un `<video>` configuré pour pinova (iOS-safe defaults).
 */
function makeVideoElement(): HTMLVideoElement {
  const v = document.createElement('video')
  /* iOS Safari : sans `playsinline` la vidéo prend le viewer plein écran natif. */
  v.setAttribute('playsinline', '')
  v.setAttribute('webkit-playsinline', '')
  /* Désactive le PiP iOS automatique sur lecture (sinon UX brisée). */
  v.disablePictureInPicture = true
  /* `muted` par défaut — nécessaire pour autoplay sur Safari sans interaction. */
  v.muted = true
  /* `preload=metadata` : on ne charge que les premiers bytes (taille + duration). */
  v.preload = 'metadata'
  /* Anti-leak : pas de download au long-press. */
  v.setAttribute('controlslist', 'nodownload')
  v.setAttribute('disableremoteplayback', '')
  v.crossOrigin = 'anonymous'
  return v
}

/**
 * Recherche un slot libre dans le pool, OU en évince un (LRU) si plein.
 */
function ensureSlot(): PoolEntry {
  /* Slot libre ? */
  const free = pool.find((e) => !e.inUse)
  if (free) return free

  /* Slot disponible (pool pas plein) ? */
  if (pool.length < limit) {
    const fresh: PoolEntry = {
      el: makeVideoElement(),
      inUse: false,
      lastUsed: 0,
      src: '',
      budgetDispose: null,
    }
    pool.push(fresh)
    return fresh
  }

  /* Plein : évincer le moins récemment utilisé. */
  pool.sort((a, b) => a.lastUsed - b.lastUsed)
  const evicted = pool[0]
  /* Reset complet — release proprement. */
  resetEntry(evicted)
  return evicted
}

function resetEntry(entry: PoolEntry) {
  try {
    entry.el.pause()
    entry.el.removeAttribute('src')
    /* Free le decoded buffer (Safari iOS sinon retient ~50MB par video). */
    entry.el.load()
  } catch { /* ignore */ }
  entry.src = ''
  entry.inUse = false
  entry.lastUsed = 0
  if (entry.budgetDispose) {
    entry.budgetDispose()
    entry.budgetDispose = null
  }
}

/* ───────────────────────── Public API ───────────────────────── */

export interface UseVideoPool {
  /**
   * Acquiert un élément vidéo configuré avec le `src` donné.
   * L'élément n'est PAS dans le DOM — c'est au caller de l'appendChild.
   *
   * @param src URL de la vidéo
   * @returns L'élément ou null si erreur
   */
  acquire: (src: string) => HTMLVideoElement | null

  /**
   * Rend l'élément au pool. À appeler dans onBeforeUnmount du composant
   * consommateur, ou quand l'élément sort durablement du viewport.
   */
  release: (el: HTMLVideoElement) => void

  /**
   * Stats pour debug. */
  stats: () => { size: number; inUse: number; limit: number }

  /** Vide intégralement le pool (urgences mémoire). */
  drain: () => void
}

export function useVideoPool(): UseVideoPool {
  function acquire(src: string): HTMLVideoElement | null {
    if (typeof document === 'undefined') return null
    const slot = ensureSlot()
    /* Si le slot a déjà ce src en cache, on le réutilise tel quel. */
    if (slot.src !== src) {
      try {
        slot.el.src = src
        slot.el.load()
        slot.src = src
      } catch (err) {
        console.warn('[useVideoPool] acquire failed:', err)
        return null
      }
    }
    slot.inUse = true
    slot.lastUsed = performance.now()
    if (!slot.budgetDispose) slot.budgetDispose = trackBudget('mountedVideos')
    return slot.el
  }

  function release(el: HTMLVideoElement) {
    const entry = pool.find((e) => e.el === el)
    if (!entry) return
    try {
      el.pause()
    } catch { /* ignore */ }
    entry.inUse = false
    entry.lastUsed = performance.now()
    /* On garde src en mémoire (cache) pour éviter re-decode si réutilisé bientôt.
       Si le slot est évincé plus tard, resetEntry purge proprement. */
  }

  function stats() {
    return {
      size: pool.length,
      inUse: pool.filter((e) => e.inUse).length,
      limit,
    }
  }

  function drain() {
    for (const entry of pool) resetEntry(entry)
    pool.length = 0
  }

  return { acquire, release, stats, drain }
}
