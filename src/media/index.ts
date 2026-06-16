/**
 * Fotoce Unified Media System — barrel export.
 *
 *   import { loadImage, preloadImage, playVideo, mediaProfile } from '@/media'
 *
 * Le moteur s'initialise via `initMediaEngine()` dans `main.ts`.
 */

export * from './mediaEngine'
export * from './mediaPlatformProfile'
export {
  imageCacheStats,
  isImageCached,
  clearImageCache,
  loadCachedImage,
  preloadCachedImage,
  releaseCachedImage,
} from './imageCache'
export {
  cacheMediaForOffline,
  clearOfflineMemoryCaches,
  clearRuntimeMediaCache,
  getCachedMediaResponse,
  getFallbackThumbnail,
  getOfflineMediaUrl,
  getStaleVideoPreview,
  offlineMediaStats,
  prefetchFotosMediaForOffline,
  rememberVideoPoster,
  releaseFallbackThumbnail,
  setFallbackThumbnail,
} from './offlineCache'
