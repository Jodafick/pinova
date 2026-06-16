/**
 * Query Persister — hydrate le QueryClient depuis localStorage au boot.
 *
 *  Stratégie :
 *   - Storage : `localStorage` (synchrone, ~5MB, OK pour métadata feeds + user).
 *   - Buster : version manuelle bumpée si le shape des entries change.
 *   - MaxAge : 7 jours (aligné `gcTime`).
 *   - Throttle : 1.5s entre 2 saves (évite spam I/O).
 *   - DehydrateOptions : ne persiste QUE les queries `success` (pas error/loading).
 *
 *  Note iOS : Safari peut purger `localStorage` dans certains modes Privacy ;
 *  le persister bascule alors en no-op silencieux (le cache mémoire continue).
 */

import { persistQueryClient } from '@tanstack/query-persist-client-core'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { queryClient } from './queryClient'

const STORAGE_KEY = 'fotoce-query-cache-v1'
const MAX_AGE_MS  = 7 * 24 * 60 * 60 * 1000 /* 7 jours */
const THROTTLE_MS = 1500

let installed = false

/** Détecte si on peut écrire dans localStorage (Safari privé bloque). */
function canUseLocalStorage(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const k = '__fotoce_probe__'
    window.localStorage.setItem(k, '1')
    window.localStorage.removeItem(k)
    return true
  } catch {
    return false
  }
}

/**
 * Branche la persistance localStorage sur le QueryClient. Idempotent.
 * Retourne `true` si la persistance est active, `false` si elle a été skippée
 * (no-storage / SSR / mode privé).
 */
export function installQueryPersister(): boolean {
  if (installed) return true
  if (!canUseLocalStorage()) return false
  installed = true

  const persister = createSyncStoragePersister({
    storage: window.localStorage,
    key: STORAGE_KEY,
    throttleTime: THROTTLE_MS,
    serialize: (data) => {
      try { return JSON.stringify(data) } catch { return '{}' }
    },
    deserialize: (cached) => {
      try { return JSON.parse(cached) } catch { return undefined }
    },
  })

  persistQueryClient({
    queryClient,
    persister,
    maxAge: MAX_AGE_MS,
    /* Buster : changer cette string force un purge complet du cache persisté. */
    buster: 'fotoce.v1',
    dehydrateOptions: {
      shouldDehydrateQuery: (query) => query.state.status === 'success',
      shouldDehydrateMutation: () => false,
    },
  })

  return true
}
