/**
 * Image Cache — cache LRU global d'images décodées (singleton app-lifetime).
 *
 * Différences vs `useImagePreheat` (qui reste un composable lifetime-bound) :
 *  - Vit pour toute la durée de l'app (pas démonté avec un composant).
 *  - Exposé impérativement par `mediaEngine` (loadImage / preloadImage).
 *  - Stratégie d'éviction : LRU bornée par `imageCacheSize` (depuis le profil).
 *  - Decode async via `HTMLImageElement.decode()` (ou `createImageBitmap` si
 *    dispo, pour décharger le thread principal — surtout iOS Safari).
 *  - Concurrence bornée (decodeConcurrency) pour ne pas écraser le réseau.
 *  - S'enregistre auprès du `memoryManager` (vide tout sur `critical/frozen`).
 *
 * Le cache stocke deux représentations :
 *   - `HTMLImageElement` (réutilisable dans un `<img src=...>` car le browser
 *     l'a déjà mis dans son cache HTTP/decoded).
 *   - `ImageBitmap` (optionnel, si décodé via createImageBitmap).
 *
 * Public API consommée uniquement par `mediaEngine.ts` (n'importer cette
 * lib directement que pour des tests).
 */

import { registerReclaimable } from '../core/memoryManager'
import { getMediaPlatformProfile } from './mediaPlatformProfile'

export interface CachedImage {
  src: string
  img: HTMLImageElement
  /** Bitmap décodé hors-thread (optionnel — null si pas supporté). */
  bitmap: ImageBitmap | null
  /** Timestamp de dernière utilisation (ms perf.now). */
  lastUsed: number
  /** `true` quand le decode est terminé. */
  decoded: boolean
  /** Bytes estimés (width × height × 4) — utilisé pour pression mémoire. */
  estimatedBytes: number
}

type DecodeOptions = {
  priority?: 'high' | 'auto' | 'low'
  crossOrigin?: 'anonymous' | 'use-credentials' | null
  /** Si false, on retourne l'image sans appeler `decode()` (utile pour preload léger). */
  decode?: boolean
  /** `referrerpolicy` HTTP. */
  referrerPolicy?: ReferrerPolicy
}

/* ───────────────────────── État ───────────────────────── */

const cache = new Map<string, CachedImage>()
const pendingDecodes = new Map<string, Promise<HTMLImageElement>>()
const queue: { src: string; opts: DecodeOptions; resolve: (v: HTMLImageElement) => void; reject: (e: Error) => void }[] = []
let inFlight = 0

/* Estimation : couleur intégrale. Si on connait width/height on remplace. */
function estimateBytes(img: HTMLImageElement): number {
  const w = img.naturalWidth || img.width || 1
  const h = img.naturalHeight || img.height || 1
  return w * h * 4
}

function maxCacheSize(): number {
  return getMediaPlatformProfile().imageCacheSize
}

function maxConcurrency(): number {
  return getMediaPlatformProfile().decodeConcurrency
}

function asyncDecodeEnabled(): boolean {
  return getMediaPlatformProfile().asyncDecode
}

/** Éviction LRU au-delà du seuil. */
function evictIfNeeded(): void {
  const limit = maxCacheSize()
  if (cache.size <= limit) return
  /* Map garde l'ordre d'insertion ; on évince le moins récemment utilisé. */
  const sorted = Array.from(cache.values()).sort((a, b) => a.lastUsed - b.lastUsed)
  while (cache.size > limit && sorted.length > 0) {
    const entry = sorted.shift()
    if (!entry) break
    /* Libère la ref native (Safari peut garder le bitmap dans GPU mem). */
    try { entry.bitmap?.close() } catch { /* ignore */ }
    entry.img.src = ''
    cache.delete(entry.src)
  }
}

function touch(src: string): CachedImage | null {
  const entry = cache.get(src)
  if (!entry) return null
  entry.lastUsed = performance.now()
  return entry
}

function processQueue(): void {
  while (inFlight < maxConcurrency() && queue.length > 0) {
    const item = queue.shift()
    if (!item) break
    inFlight += 1
    decodeNow(item.src, item.opts).then(item.resolve, item.reject).finally(() => {
      inFlight = Math.max(0, inFlight - 1)
      processQueue()
    })
  }
}

async function decodeNow(src: string, opts: DecodeOptions): Promise<HTMLImageElement> {
  const img = new Image()
  if (opts.crossOrigin !== null) {
    img.crossOrigin = opts.crossOrigin ?? 'anonymous'
  }
  /* `fetchpriority` est new-ish — guard. */
  type ImgWithPriority = HTMLImageElement & { fetchPriority?: string; decoding?: string }
  ;(img as ImgWithPriority).fetchPriority = opts.priority ?? 'auto'
  ;(img as ImgWithPriority).decoding = 'async'
  if (opts.referrerPolicy) img.referrerPolicy = opts.referrerPolicy
  img.src = src

  /* Attend `load` ; on tolère que decode() jette (cas CORS canvas). */
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = (err) => reject(err instanceof Error ? err : new Error(`Image load failed: ${src}`))
  })

  const entry: CachedImage = {
    src,
    img,
    bitmap: null,
    lastUsed: performance.now(),
    decoded: false,
    estimatedBytes: estimateBytes(img),
  }
  cache.set(src, entry)

  if (opts.decode === false) {
    entry.decoded = true
    evictIfNeeded()
    return img
  }

  try {
    if (asyncDecodeEnabled() && typeof createImageBitmap === 'function') {
      /* Décode hors-thread : Safari iOS 15+ supporte sur HTMLImageElement. */
      try {
        entry.bitmap = await createImageBitmap(img)
      } catch {
        /* Fallback decode standard. */
        await img.decode?.()
      }
    } else if (typeof img.decode === 'function') {
      await img.decode()
    }
  } catch {
    /* Si decode échoue (CORS canvas restriction par ex.), on garde quand
       même l'image en cache — le browser l'a load(). */
  }

  entry.decoded = true
  evictIfNeeded()
  return img
}

/* ───────────────────────── API publique ───────────────────────── */

/**
 * Charge ou réutilise une image décodée. Idempotent : appels multiples sur
 * le même `src` se mutualisent.
 */
export function loadCachedImage(src: string, opts: DecodeOptions = {}): Promise<HTMLImageElement> {
  if (!src) return Promise.reject(new Error('loadCachedImage: empty src'))
  const existing = touch(src)
  if (existing && existing.decoded) {
    return Promise.resolve(existing.img)
  }
  const pending = pendingDecodes.get(src)
  if (pending) return pending

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    queue.push({ src, opts, resolve, reject })
    processQueue()
  })
  pendingDecodes.set(src, promise)
  promise.finally(() => pendingDecodes.delete(src)).catch(() => undefined)
  return promise
}

/** Fire-and-forget. Pas d'erreur propagée (preload est non-bloquant). */
export function preloadCachedImage(src: string, opts: DecodeOptions = {}): void {
  if (!src) return
  if (cache.has(src) || pendingDecodes.has(src)) {
    touch(src)
    return
  }
  loadCachedImage(src, { ...opts, priority: opts.priority ?? 'low' }).catch(() => undefined)
}

/** Libère une entrée précise (utile si l'app sait qu'un media ne reviendra plus). */
export function releaseCachedImage(src: string): void {
  const entry = cache.get(src)
  if (!entry) return
  try { entry.bitmap?.close() } catch { /* ignore */ }
  entry.img.src = ''
  cache.delete(src)
}

/** `true` si l'image est cache-resident et décodée. */
export function isImageCached(src: string): boolean {
  const entry = cache.get(src)
  return !!entry && entry.decoded
}

/** Récupère le bitmap décodé si dispo (sinon null). */
export function getImageBitmap(src: string): ImageBitmap | null {
  const entry = cache.get(src)
  if (!entry || !entry.bitmap) return null
  entry.lastUsed = performance.now()
  return entry.bitmap
}

/** Stats lecture-seule (debug / overlay perf). */
export function imageCacheStats(): {
  size: number
  pending: number
  inFlight: number
  queued: number
  estimatedBytes: number
} {
  let bytes = 0
  for (const e of cache.values()) bytes += e.estimatedBytes
  return {
    size: cache.size,
    pending: pendingDecodes.size,
    inFlight,
    queued: queue.length,
    estimatedBytes: bytes,
  }
}

/** Vide intégralement (urgence mémoire). */
export function clearImageCache(): void {
  for (const entry of cache.values()) {
    try { entry.bitmap?.close() } catch { /* ignore */ }
    entry.img.src = ''
  }
  cache.clear()
  queue.length = 0
}

/* ───────────────────────── Lifecycle ───────────────────────── */

let reclaimerRegistered = false

export function initImageCache(): void {
  if (reclaimerRegistered) return
  reclaimerRegistered = true
  registerReclaimable({
    name: 'image-cache',
    priority: 35,
    reclaim(pressure) {
      if (pressure === 'critical' || pressure === 'frozen') {
        clearImageCache()
      } else if (pressure === 'idle') {
        /* On retire la moitié la plus ancienne. */
        const target = Math.floor(cache.size / 2)
        const sorted = Array.from(cache.values()).sort((a, b) => a.lastUsed - b.lastUsed)
        for (let i = 0; i < target; i++) {
          const entry = sorted[i]
          if (!entry) break
          releaseCachedImage(entry.src)
        }
      }
    },
  })
}
