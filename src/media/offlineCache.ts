/**
 * Offline Media Cache — best-effort persistence des médias importants.
 *
 *  1. **Cache API** (`caches.open('fotoce-media-v1')`) — la PWA enregistrée via
 *     `virtual:pwa-register` (vite-plugin-pwa) gère déjà les assets statiques.
 *     Ici on ajoute un cache runtime pour les médias **dynamiques** :
 *     - thumbnails de fotos (small) → toujours mis en cache si possible
 *     - vidéos → on cache uniquement le **poster** + first chunk (cf. `cacheVideoPoster`)
 *  2. **Fallback thumbnails in-memory** — map `src → dataUrl` pour servir
 *     instantanément un placeholder pendant que le réseau revient.
 *  3. **Stale video preview** — quand une vidéo n'est pas encore lue, on
 *     expose le poster connu (`getStaleVideoPreview`).
 *
 *  Volontairement minimaliste : on ne réinvente pas Workbox. Les opérations
 *  réseau sont **non-bloquantes** (best-effort). Les erreurs sont silencieuses
 *  car offline-first ne doit JAMAIS faire planter une vue.
 */

import {
  isPwaLightPerfMode,
  isPwaStandalone,
  navigatorSaveDataEnabled,
} from '../utils/pwaPerformance'

const RUNTIME_CACHE = 'fotoce-media-v1'
const MAX_RUNTIME_ENTRIES = isPwaStandalone() ? 96 : 200
const PREFETCH_MAX_PINS = isPwaStandalone() ? 4 : 14
const PREFETCH_MAX_URLS = isPwaStandalone() ? 8 : 28

const fallbackThumbnails = new Map<string, string>()
const stalePosters = new Map<string, string>()

/* ───────────────────────── Cache API (runtime) ───────────────────────── */

function cachesAvailable(): boolean {
  return typeof caches !== 'undefined'
}

async function trimRuntimeCache(): Promise<void> {
  if (!cachesAvailable()) return
  try {
    const cache = await caches.open(RUNTIME_CACHE)
    const keys = await cache.keys()
    if (keys.length <= MAX_RUNTIME_ENTRIES) return
    const overflow = keys.length - MAX_RUNTIME_ENTRIES
    for (let i = 0; i < overflow; i++) {
      await cache.delete(keys[i])
    }
  } catch {
    /* ignore */
  }
}

/**
 * Cache un média (image small, video poster, etc.) pour usage offline.
 * Idempotent. Ne JAMAIS jeter — best-effort.
 */
export async function cacheMediaForOffline(url: string): Promise<void> {
  if (!url || !cachesAvailable()) return
  try {
    const cache = await caches.open(RUNTIME_CACHE)
    const existing = await cache.match(url)
    if (existing) return
    /* `no-cors` pour les CDN images sans CORS — request stockée opaque. */
    const req = new Request(url, { mode: 'no-cors', credentials: 'omit' })
    const res = await fetch(req)
    if (!res || (res.status !== 200 && res.type !== 'opaque')) return
    await cache.put(url, res.clone())
    /* Trim async (fire and forget). */
    void trimRuntimeCache()
  } catch {
    /* ignore */
  }
}

/** Retourne une `Response` mise en cache si dispo, sinon `null`. */
export async function getCachedMediaResponse(url: string): Promise<Response | null> {
  if (!url || !cachesAvailable()) return null
  try {
    const cache = await caches.open(RUNTIME_CACHE)
    const res = await cache.match(url)
    return res ?? null
  } catch {
    return null
  }
}

/**
 * Si une réponse est en cache, retourne une URL blob locale qu'un `<img>`
 * peut consommer offline. Sinon null.
 */
export async function getOfflineMediaUrl(url: string): Promise<string | null> {
  const res = await getCachedMediaResponse(url)
  if (!res) return null
  try {
    const blob = await res.blob()
    return URL.createObjectURL(blob)
  } catch {
    return null
  }
}

/* ───────────────────────── Fallback thumbnails (in-memory) ─────────────── */

/**
 * Enregistre un thumbnail (dataUrl ou URL blob) à servir si le réseau échoue.
 * Idéal pour stocker le blurhash décodé localement comme dernier recours.
 */
export function setFallbackThumbnail(src: string, dataUrl: string): void {
  if (!src || !dataUrl) return
  fallbackThumbnails.set(src, dataUrl)
}

/** Lecture (null si rien). */
export function getFallbackThumbnail(src: string): string | null {
  return fallbackThumbnails.get(src) ?? null
}

/** Supprime un fallback (ex : image bien chargée → on peut libérer le dataUrl). */
export function releaseFallbackThumbnail(src: string): void {
  fallbackThumbnails.delete(src)
}

/* ───────────────────────── Stale video preview ───────────────────────── */

/**
 * Mémorise le `poster` d'une vidéo pour pouvoir l'afficher comme aperçu
 * même si la vidéo n'a pas encore été chargée (transition feed → viewer).
 */
export function rememberVideoPoster(videoSrc: string, posterUrl: string | undefined | null): void {
  if (!videoSrc || !posterUrl) return
  stalePosters.set(videoSrc, posterUrl)
}

/** Récupère le poster connu, sinon null. */
export function getStaleVideoPreview(videoSrc: string): string | null {
  return stalePosters.get(videoSrc) ?? null
}

/* ───────────────────────── Maintenance ───────────────────────── */

export function clearOfflineMemoryCaches(): void {
  fallbackThumbnails.clear()
  stalePosters.clear()
}

/** Pour debug / urgence : purge le runtime cache (mais pas le cache PWA core). */
export async function clearRuntimeMediaCache(): Promise<void> {
  if (!cachesAvailable()) return
  try {
    await caches.delete(RUNTIME_CACHE)
  } catch {
    /* ignore */
  }
}

export function offlineMediaStats(): {
  fallbackThumbnails: number
  stalePosters: number
} {
  return {
    fallbackThumbnails: fallbackThumbnails.size,
    stalePosters: stalePosters.size,
  }
}

/* ───────────────────────── Prefetch listes de fotos (PWA offline) ──────────── */

export type OfflineMediaPinLike = {
  imageUrl?: string
  storyVideoUrl?: string
  userAvatarUrl?: string
}

/**
 * Télécharge en tâche de fond les médias des fotos pour le Cache API (vignettes, avatars, vidéos story).
 * Best-effort : les fichiers volumineux ne seront mis en cache que si le réseau y parvient.
 */
export function prefetchFotosMediaForOffline(pins: readonly OfflineMediaPinLike[]): void {
  if (typeof window === 'undefined' || !pins.length) return
  if (navigatorSaveDataEnabled()) return
  const lightPwa = isPwaLightPerfMode()
  if (lightPwa && typeof navigator !== 'undefined' && !navigator.onLine) return

  const slice = fotos.slice(0, PREFETCH_MAX_PINS)
  const seen = new Set<string>()
  let queued = 0
  const push = (u: string | undefined) => {
    if (queued >= PREFETCH_MAX_URLS) return
    const s = (u || '').trim()
    if (!s || seen.has(s)) return
    seen.add(s)
    queued += 1
    void cacheMediaForOffline(s)
  }
  for (const p of slice) {
    push(p.imageUrl)
    if (!lightPwa) push(p.userAvatarUrl)
    if (!lightPwa) push(p.storyVideoUrl)
  }
}
