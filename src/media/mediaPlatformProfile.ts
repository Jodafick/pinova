/**
 * Media Platform Profile — paramétrage adaptatif du moteur média.
 *
 * Combine :
 *  - le `motionLanguage` du `adaptiveNavigator` (ios / material / desktop)
 *  - le tier perf du `motionBudget` (low / mid / high)
 *  - les hints réseau (`navigator.connection.saveData / effectiveType`)
 *
 * Et expose un profil unique consommé par `mediaEngine.ts`, `ProgressiveImage`,
 * `SmartVideo`, `ImmersiveMediaViewer` etc.
 *
 *  iOS    : aggressive preload, decode instantané, autoplay agressif.
 *  Material : équilibré, ripple inutile ici, autoplay quand visible.
 *  Desktop : bandwidth-aware, large preload distance, autoplay conditionnel.
 *
 * Le profil est réactif (recalculé sur changement de motionLanguage / save-data).
 */

import { computed, type ComputedRef } from 'vue'
import { adaptiveProfile, type MotionLanguage } from '../navigation/adaptiveNavigator'
import { motionDeviceTier } from '../core/motionBudget'

export interface MediaPlatformProfile {
  /** Mode actif (`ios` | `material` | `desktop`). */
  mode: MotionLanguage
  /** Tier perf hérité du `motionBudget`. */
  perfTier: 'low' | 'mid' | 'high'
  /** Connexion économe (`saveData`) ou réseau lent (`2g`). */
  bandwidthConstrained: boolean

  /* ───────── Images ───────── */
  /** `Image.decode()` concurrents max. */
  decodeConcurrency: number
  /** Taille LRU du cache d'images décodées. */
  imageCacheSize: number
  /** Marge IntersectionObserver pour preload anticipé (px). */
  preloadMarginPx: number
  /** Nombre de voisins à précharger dans un carrousel/feed (par côté). */
  neighborPreloadCount: number
  /** Stratégie : `aggressive` (iOS) | `balanced` (Android) | `bandwidth-aware` (Desktop). */
  imageStrategy: 'aggressive' | 'balanced' | 'bandwidth-aware'

  /* ───────── Vidéos ───────── */
  /** Valeur de `<video>.preload` par défaut. */
  videoPreload: 'none' | 'metadata' | 'auto'
  /** Démarrage auto quand visible. */
  autoplayWhenVisible: boolean
  /** Pool size max (vidéos `<video>` simultanées dans le DOM). */
  videoPoolLimit: number

  /* ───────── Misc ───────── */
  /** Respect `prefers-reduced-data` (saveData). */
  respectSaveData: boolean
  /** Décode hors thread si possible (`createImageBitmap`). */
  asyncDecode: boolean
}

interface NetworkInfo {
  saveData?: boolean
  effectiveType?: string
}

function readNetworkInfo(): NetworkInfo {
  if (typeof navigator === 'undefined') return {}
  const conn = (navigator as Navigator & { connection?: NetworkInfo }).connection
  return conn ?? {}
}

function isBandwidthConstrained(): boolean {
  const net = readNetworkInfo()
  if (net.saveData) return true
  if (net.effectiveType && /^(2g|slow-2g)$/i.test(net.effectiveType)) return true
  return false
}

/**
 * Calcule un profil synchrone à partir du contexte courant.
 * Pure : pas d'effets de bord, safe SSR (defaults raisonnables).
 */
export function computeMediaPlatformProfile(): MediaPlatformProfile {
  const mode = adaptiveProfile.value.motionLanguage
  const perfTier = motionDeviceTier.value
  const bandwidth = isBandwidthConstrained()

  /* Base par mode. */
  let p: MediaPlatformProfile = {
    mode,
    perfTier,
    bandwidthConstrained: bandwidth,
    decodeConcurrency: 3,
    imageCacheSize: 90,
    preloadMarginPx: 300,
    neighborPreloadCount: 1,
    imageStrategy: 'balanced',
    videoPreload: 'metadata',
    autoplayWhenVisible: true,
    videoPoolLimit: 6,
    respectSaveData: true,
    asyncDecode: typeof createImageBitmap !== 'undefined',
  }

  if (mode === 'ios') {
    p = {
      ...p,
      decodeConcurrency: 4,
      imageCacheSize: 140,
      preloadMarginPx: 400,
      neighborPreloadCount: 2,
      imageStrategy: 'aggressive',
      videoPreload: 'auto',
      autoplayWhenVisible: true,
      videoPoolLimit: 6,
    }
  } else if (mode === 'material') {
    p = {
      ...p,
      decodeConcurrency: 3,
      imageCacheSize: 100,
      preloadMarginPx: 280,
      neighborPreloadCount: 1,
      imageStrategy: 'balanced',
      videoPreload: 'metadata',
      autoplayWhenVisible: true,
      videoPoolLimit: 6,
    }
  } else {
    /* desktop */
    p = {
      ...p,
      decodeConcurrency: 5,
      imageCacheSize: 200,
      preloadMarginPx: 900,
      neighborPreloadCount: 3,
      imageStrategy: 'bandwidth-aware',
      videoPreload: 'metadata',
      autoplayWhenVisible: true,
      videoPoolLimit: 12,
    }
  }

  /* Modulation par perfTier (low device = on coupe les ambitions). */
  if (perfTier === 'low') {
    p = {
      ...p,
      decodeConcurrency: Math.max(1, p.decodeConcurrency - 2),
      imageCacheSize: Math.floor(p.imageCacheSize * 0.55),
      preloadMarginPx: Math.floor(p.preloadMarginPx * 0.55),
      neighborPreloadCount: Math.max(0, p.neighborPreloadCount - 1),
      videoPreload: 'metadata',
      videoPoolLimit: Math.max(3, Math.floor(p.videoPoolLimit * 0.6)),
    }
  } else if (perfTier === 'mid') {
    p = {
      ...p,
      decodeConcurrency: Math.max(2, p.decodeConcurrency - 1),
      imageCacheSize: Math.floor(p.imageCacheSize * 0.8),
      preloadMarginPx: Math.floor(p.preloadMarginPx * 0.8),
    }
  }

  /* Modulation par bandwidth. */
  if (bandwidth) {
    p = {
      ...p,
      decodeConcurrency: Math.max(1, p.decodeConcurrency - 1),
      imageCacheSize: Math.max(40, Math.floor(p.imageCacheSize * 0.5)),
      preloadMarginPx: Math.max(80, Math.floor(p.preloadMarginPx * 0.4)),
      neighborPreloadCount: 0,
      imageStrategy: 'bandwidth-aware',
      videoPreload: 'none',
      autoplayWhenVisible: false,
    }
  }

  return p
}

/** Composable Vue : profil réactif (recalcule sur changements amont). */
export function useMediaPlatformProfile(): ComputedRef<MediaPlatformProfile> {
  return computed(() => {
    /* Le `computed` se réabonne aux deux refs amont automatiquement. */
    void adaptiveProfile.value.motionLanguage
    void motionDeviceTier.value
    return computeMediaPlatformProfile()
  })
}

/** Snapshot sans réactivité (consommateur impératif comme `mediaEngine`). */
export function getMediaPlatformProfile(): MediaPlatformProfile {
  return computeMediaPlatformProfile()
}
