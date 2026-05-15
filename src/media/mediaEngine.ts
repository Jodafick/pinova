/**
 * Unified Media Engine — point d'entrée unique pour les médias Pinova.
 *
 * Combine :
 *  - `imageCache`  : cache LRU décodé global + decode async.
 *  - `useVideoPool` : pool d'éléments `<video>` (existant, singleton).
 *  - `offlineCache` : Cache API runtime + fallback thumbnails in-memory.
 *  - `mediaPlatformProfile` : paramétrage adaptatif (iOS / Material / Desktop).
 *
 * API minimale et stable, conçue pour rester valide quand on changera
 * d'implémentation interne (ex: WebCodecs, OffscreenCanvas).
 *
 *  Performance priority — first frame instant :
 *    - decode hors thread quand possible (`createImageBitmap`)
 *    - micro-tasks coalesced (jamais de wait inutile sur UI thread)
 *    - aucune mutation DOM ici (les composants gèrent leur layout)
 *
 *  Memory control — release agressif sous pression mémoire :
 *    - bascule de `imageCache` sur `memoryManager` (priority 35)
 *    - `useVideoPool` bascule aussi (priority 20)
 *    - `recycleMedia()` peut être appelé manuellement depuis un toast système
 *
 *  TikTok-level fluidity — préload voisin + autoplay-when-visible :
 *    - `preloadImages([...])` pour les voisins dans un carousel
 *    - `playVideo()` choisi `mute` automatiquement si autoplay bloqué
 */

import type { UseVideoPool } from '../composables/useVideoPool'
import {
  clearImageCache,
  imageCacheStats,
  initImageCache,
  isImageCached,
  loadCachedImage,
  preloadCachedImage,
  releaseCachedImage,
} from './imageCache'
import {
  cacheMediaForOffline,
  clearOfflineMemoryCaches,
  getFallbackThumbnail,
  getStaleVideoPreview,
  offlineMediaStats,
  rememberVideoPoster,
  releaseFallbackThumbnail,
  setFallbackThumbnail,
} from './offlineCache'
import { getMediaPlatformProfile, type MediaPlatformProfile } from './mediaPlatformProfile'

/* ───────────────────────── Video pool (lazy import) ───────────────────────── */

/* On résout le pool de manière lazy pour éviter de forcer son chargement avant
   que la première vidéo soit demandée. Le pool est un singleton et l'API
   `useVideoPool()` est idempotente — re-importer ne crée pas de doublons. */
let videoPoolRef: UseVideoPool | null = null
function videoPool(): UseVideoPool {
  if (videoPoolRef) return videoPoolRef
  /* `require`-style lazy : on évite l'await pour rester synchrone. */
  /* Vite résout le `import()` de manière synchrone après bundle splitting,
     mais pour rester correct on a un fallback paresseux. */
  throw new Error('mediaEngine: video pool not initialised — call initMediaEngine() at boot')
}

/* ───────────────────────── Image API ───────────────────────── */

export interface LoadImageOptions {
  /** `fetchpriority` HTML5. */
  priority?: 'high' | 'auto' | 'low'
  /** CORS handling. Default `'anonymous'`. */
  crossOrigin?: 'anonymous' | 'use-credentials' | null
  /** Si `false`, on n'appelle pas `decode()` (preload léger). */
  decode?: boolean
  /** `referrerpolicy` HTTP. */
  referrerPolicy?: ReferrerPolicy
  /** Si `true`, on tente aussi un `cacheMediaForOffline()` (best-effort). */
  persistOffline?: boolean
}

/**
 * Charge (et décode) une image en exploitant le cache global. Idempotent :
 * un même `src` ne déclenche qu'un seul decode même si appelé en parallèle.
 */
export function loadImage(src: string, opts: LoadImageOptions = {}): Promise<HTMLImageElement> {
  if (!src) return Promise.reject(new Error('loadImage: empty src'))
  if (opts.persistOffline) void cacheMediaForOffline(src)
  return loadCachedImage(src, {
    priority: opts.priority,
    crossOrigin: opts.crossOrigin,
    decode: opts.decode,
    referrerPolicy: opts.referrerPolicy,
  })
}

/** Fire-and-forget. Marque l'image comme « bientôt requise » (low priority). */
export function preloadImage(src: string, opts: LoadImageOptions = {}): void {
  if (!src) return
  if (opts.persistOffline) void cacheMediaForOffline(src)
  preloadCachedImage(src, {
    priority: opts.priority ?? 'low',
    crossOrigin: opts.crossOrigin,
    decode: opts.decode,
    referrerPolicy: opts.referrerPolicy,
  })
}

/** Batch : préfecthe un ensemble (en gardant l'ordre = priorité décroissante). */
export function preloadImages(srcs: ReadonlyArray<string | null | undefined>, opts: LoadImageOptions = {}): void {
  for (const s of srcs) {
    if (s) preloadImage(s, opts)
  }
}

/** Libère une image précise du cache global. */
export function releaseImage(src: string): void {
  if (!src) return
  releaseCachedImage(src)
  releaseFallbackThumbnail(src)
}

/** `true` si l'image est en cache décodée. */
export { isImageCached }

/* ───────────────────────── Video API ───────────────────────── */

/**
 * Acquiert un `<video>` configuré depuis le pool. Le caller doit l'ajouter
 * au DOM lui-même, puis appeler `releaseVideo(el)` au démontage.
 */
export function acquireVideo(src: string): HTMLVideoElement | null {
  try {
    return videoPool().acquire(src)
  } catch (err) {
    console.warn('[mediaEngine] acquireVideo:', err)
    return null
  }
}

/** Rend l'élément au pool (pause + reset). */
export function releaseVideo(el: HTMLVideoElement): void {
  try {
    videoPool().release(el)
  } catch {
    /* ignore */
  }
}

/**
 * Démarre la lecture en gérant les contraintes iOS Safari :
 *  - mute forcé si autoplay sans interaction
 *  - tolère les rejections (`NotAllowedError`) silencieusement
 *  - bascule en fallback muet si demandé
 */
export async function playVideo(
  el: HTMLVideoElement,
  opts: { mutedFallback?: boolean } = {},
): Promise<void> {
  if (!el) return
  const mutedFallback = opts.mutedFallback ?? true
  try {
    await el.play()
  } catch (err) {
    if (mutedFallback && !el.muted) {
      el.muted = true
      try { await el.play() } catch { /* ignore */ }
    } else {
      console.debug('[mediaEngine] playVideo rejected', err)
    }
  }
}

/** Met en pause sans jeter. */
export function pauseVideo(el: HTMLVideoElement): void {
  if (!el) return
  try { el.pause() } catch { /* ignore */ }
}

/* ───────────────────────── Recycle / Memory ───────────────────────── */

export type RecycleScope = 'all' | 'images' | 'videos' | 'offline'

/**
 * Recycle l'ensemble (ou un scope) des ressources.
 *  - `images`  : vide le cache LRU d'images décodées
 *  - `videos`  : drain du pool `<video>` (release non utilisés + reset)
 *  - `offline` : clear in-memory caches (fallbacks + posters mémorisés)
 *  - `all`     : tout d'un coup (équivalent reclaim `critical`)
 */
export function recycleMedia(scope: RecycleScope = 'all'): void {
  if (scope === 'all' || scope === 'images') clearImageCache()
  if (scope === 'all' || scope === 'videos') {
    try { videoPool().drain() } catch { /* ignore */ }
  }
  if (scope === 'all' || scope === 'offline') clearOfflineMemoryCaches()
}

/* ───────────────────────── Offline helpers ───────────────────────── */

export {
  cacheMediaForOffline,
  getFallbackThumbnail,
  getStaleVideoPreview,
  rememberVideoPoster,
  setFallbackThumbnail,
}

/* ───────────────────────── Profile helpers ───────────────────────── */

export function mediaProfile(): MediaPlatformProfile {
  return getMediaPlatformProfile()
}

/* ───────────────────────── Stats ───────────────────────── */

export interface MediaStats {
  images: ReturnType<typeof imageCacheStats>
  videos: { size: number; inUse: number; limit: number }
  offline: ReturnType<typeof offlineMediaStats>
  profile: MediaPlatformProfile
}

export function mediaStats(): MediaStats {
  let videos = { size: 0, inUse: 0, limit: 0 }
  try { videos = videoPool().stats() } catch { /* not ready */ }
  return {
    images: imageCacheStats(),
    videos,
    offline: offlineMediaStats(),
    profile: getMediaPlatformProfile(),
  }
}

/* ───────────────────────── Init ───────────────────────── */

let initialised = false

/**
 * À appeler une fois au boot (depuis `main.ts`), idéalement APRÈS
 * `initMemoryManager()`, `initMotionBudget()`, `initAdaptiveNavigator()`.
 *
 * Idempotent.
 */
export async function initMediaEngine(): Promise<void> {
  if (initialised) return
  initialised = true
  initImageCache()
  /* On résout le video pool dès maintenant pour que les `acquireVideo`
     synchrones puissent fonctionner sans `await`. */
  try {
    const mod = await import('../composables/useVideoPool')
    videoPoolRef = mod.useVideoPool()
  } catch (err) {
    console.warn('[mediaEngine] video pool import failed', err)
  }
}
