/**
 * Fotoce Query Client — port web de `Fotoce-Mobile/data/query/createAppQueryClient`.
 *
 *  Politiques alignées 1:1 avec le mobile :
 *   - staleTime  : 30 min  (perçu offline-first ; cache client entités pour le détail)
 *   - gcTime     : 7 jours (rétention agressive cache)
 *   - retry      : 2x sur erreurs timeout / offline / server (pas sur 4xx)
 *   - refetchOnMount   : false (on évite les flash skeleton au retour)
 *   - refetchOnWindowFocus : false (cohérent avec mobile, pas de spam reload)
 *   - refetchOnReconnect   : true (récupère après coupure réseau)
 *   - networkMode : 'offlineFirst' (sert le cache même offline)
 *
 *  Usage :
 *
 *    // main.ts
 *    import { VueQueryPlugin } from '@tanstack/vue-query'
 *    import { queryClient, installQueryPersister } from './data/queryClient'
 *    app.use(VueQueryPlugin, { queryClient })
 *    installQueryPersister()  // hydrate depuis localStorage
 *
 *    // dans un composant :
 *    import { useQuery } from '@tanstack/vue-query'
 *    import { qk } from './data/queryKeys'
 *    const { data } = useQuery({
 *      queryKey: qk.feed.home(filters),
 *      queryFn: () => api.fetchHomeFeed(filters),
 *    })
 */

import { QueryClient } from '@tanstack/vue-query'

const STALE_MS = 30 * 60 * 1000           /* 30 min — moins de refetch sur les écrans useQuery */
const GC_MS    = 7 * 24 * 60 * 60 * 1000  /* 7 jours */

/**
 * Heuristique d'erreur : on retry les pannes transitoires, pas les erreurs métier.
 * Implémentation conservative (sans dépendance externe) — peut être enrichie
 * en alignant sur `Fotoce-Mobile/api/errors.getApiErrorKind`.
 */
function isTransientError(err: unknown): boolean {
  if (!err) return false
  if (err instanceof TypeError) return true /* network failure (fetch reject) */
  const anyErr = err as { code?: string; status?: number; message?: string; name?: string }
  /* AbortError : annulation explicite, on ne retry pas. */
  if (anyErr.name === 'AbortError') return false
  /* Status HTTP : 408 / 425 / 429 / 5xx → transient. */
  if (typeof anyErr.status === 'number') {
    return anyErr.status === 408 || anyErr.status === 425 || anyErr.status === 429 || anyErr.status >= 500
  }
  /* Codes axios. */
  if (anyErr.code === 'ECONNABORTED' || anyErr.code === 'ETIMEDOUT' || anyErr.code === 'ERR_NETWORK') return true
  if (typeof anyErr.message === 'string' && /network|timeout|fetch/i.test(anyErr.message)) return true
  return false
}

function retryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false
  return isTransientError(error)
}

export function createFotoceQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_MS,
        gcTime: GC_MS,
        retry: retryQuery,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        networkMode: 'offlineFirst',
      },
      mutations: {
        retry: false,
        networkMode: 'offlineFirst',
      },
    },
  })
}

/** Instance singleton — partagée entre `VueQueryPlugin` et le persister. */
export const queryClient: QueryClient = createFotoceQueryClient()
