/**
 * SWR Cache — Stale-While-Revalidate + déduplication de requêtes.
 *
 * Objectifs :
 *  - Servir un cache "stale" instantanément (UI réactive < 50ms)
 *  - Re-fetcher en arrière-plan pour rafraîchir, sans bloquer l'UI
 *  - Dédupliquer les requêtes concurrentes vers la même clé
 *  - Borner la taille du cache (LRU) → memory safety
 *  - Purger sous pression mémoire
 *
 * Pas de dépendance à un client HTTP : on prend juste un `fetcher: () => Promise<T>`.
 * Peut être enrobé autour d'axios, fetch, GraphQL, etc.
 *
 * Usage :
 *
 *   const { data, error, refresh } = useSWR(
 *     ['pins', 'feed', 'home'],
 *     () => api.get('/pins/feed/').then(r => r.data),
 *     { ttl: 30_000, staleTime: 5_000 },
 *   )
 *
 * Le composant lit `data.value` qui se peuple instantanément depuis le cache
 * si présent, puis se met à jour quand la revalidation aboutit.
 */

import { onBeforeUnmount, ref, shallowRef, watch, type Ref } from 'vue'
import { registerReclaimable } from './memoryManager'

interface CacheEntry<T> {
  data: T
  /** Timestamp ms du fetch. */
  fetchedAt: number
  /** Timestamp ms du dernier accès (LRU). */
  lastAccess: number
}

const cache = new Map<string, CacheEntry<unknown>>()
const inFlight = new Map<string, Promise<unknown>>()
const MAX_ENTRIES = 200

function makeKey(key: string | readonly unknown[]): string {
  if (typeof key === 'string') return key
  return JSON.stringify(key)
}

function touch(k: string): void {
  const entry = cache.get(k)
  if (!entry) return
  entry.lastAccess = Date.now()
}

function evictLruIfNeeded(): void {
  while (cache.size > MAX_ENTRIES) {
    let oldestKey: string | null = null
    let oldestAccess = Infinity
    for (const [k, e] of cache) {
      if (e.lastAccess < oldestAccess) {
        oldestAccess = e.lastAccess
        oldestKey = k
      }
    }
    if (oldestKey == null) break
    cache.delete(oldestKey)
  }
}

/* ────────── API impérative ────────── */

/** Lit directement la donnée en cache (sans déclencher de fetch). */
export function readCache<T>(key: string | readonly unknown[]): T | null {
  const k = makeKey(key)
  const entry = cache.get(k)
  if (!entry) return null
  touch(k)
  return entry.data as T
}

/** Écrit / met à jour le cache. */
export function writeCache<T>(key: string | readonly unknown[], value: T): void {
  const k = makeKey(key)
  cache.set(k, { data: value, fetchedAt: Date.now(), lastAccess: Date.now() })
  evictLruIfNeeded()
}

/** Invalide une clé. */
export function invalidateCache(key: string | readonly unknown[]): void {
  cache.delete(makeKey(key))
}

/** Invalide toutes les clés qui commencent par `prefix` (string-form). */
export function invalidatePrefix(prefix: string | readonly unknown[]): void {
  const p = makeKey(prefix)
  const root = p.startsWith('[') ? p.slice(0, -1) : p
  for (const k of Array.from(cache.keys())) {
    if (k.startsWith(root)) cache.delete(k)
  }
}

/**
 * Exécute un fetch dédupliqué : si une requête est déjà en cours pour la
 * même clé, on retourne sa promise.
 */
export function dedupedFetch<T>(
  key: string | readonly unknown[],
  fetcher: () => Promise<T>,
): Promise<T> {
  const k = makeKey(key)
  const existing = inFlight.get(k) as Promise<T> | undefined
  if (existing) return existing
  const p = fetcher()
    .then((value) => {
      writeCache(k, value)
      return value
    })
    .finally(() => {
      inFlight.delete(k)
    })
  inFlight.set(k, p)
  return p
}

/* ────────── Hook réactif Vue ────────── */

export interface UseSWROptions<T> {
  /** Durée (ms) après laquelle on considère le cache "stale" — revalidate. Default 30s. */
  staleTime?: number
  /** Durée (ms) après laquelle on n'utilise plus le cache et on attend la fresh fetch. Default ∞. */
  ttl?: number
  /** Refetch automatique au focus de l'onglet. Default true. */
  revalidateOnFocus?: boolean
  /** Refetch au retour online. Default true. */
  revalidateOnReconnect?: boolean
  /** Valeur initiale si pas en cache. */
  initialData?: T
  /** Active / désactive le hook (clé conditionnelle). */
  enabled?: () => boolean
}

export interface UseSWRReturn<T> {
  data: Ref<T | null>
  error: Ref<unknown>
  isLoading: Ref<boolean>
  isValidating: Ref<boolean>
  refresh: () => Promise<T | null>
  mutate: (value: T) => void
}

export function useSWR<T>(
  key: string | readonly unknown[],
  fetcher: () => Promise<T>,
  options: UseSWROptions<T> = {},
): UseSWRReturn<T> {
  const staleTime = options.staleTime ?? 30_000
  const ttl = options.ttl ?? Infinity
  const revalidateOnFocus = options.revalidateOnFocus ?? true
  const revalidateOnReconnect = options.revalidateOnReconnect ?? true

  const k = makeKey(key)
  const data = shallowRef<T | null>(null)
  const error = ref<unknown>(null)
  const isLoading = ref(false)
  const isValidating = ref(false)

  function readFromCache(): T | null {
    const entry = cache.get(k) as CacheEntry<T> | undefined
    if (!entry) return null
    const age = Date.now() - entry.fetchedAt
    if (age > ttl) return null
    touch(k)
    return entry.data
  }

  async function fetchInternal(force = false): Promise<T | null> {
    if (options.enabled && !options.enabled()) return data.value
    isValidating.value = true
    try {
      const cached = force ? null : readFromCache()
      if (cached != null) {
        data.value = cached
        const age = Date.now() - (cache.get(k)?.fetchedAt ?? 0)
        if (age < staleTime) {
          isValidating.value = false
          return cached
        }
      } else if (data.value == null) {
        isLoading.value = true
      }
      const fresh = await dedupedFetch(k, fetcher)
      data.value = fresh
      error.value = null
      return fresh
    } catch (e) {
      error.value = e
      return null
    } finally {
      isLoading.value = false
      isValidating.value = false
    }
  }

  function refresh(): Promise<T | null> {
    return fetchInternal(true)
  }

  function mutate(value: T): void {
    writeCache(k, value)
    data.value = value
  }

  /* Initial : seed depuis cache puis lance la revalidation. */
  const seed = readFromCache()
  if (seed != null) {
    data.value = seed
  } else if (options.initialData !== undefined) {
    data.value = options.initialData
  }

  /* Premier fetch — sans bloquer le render. */
  void fetchInternal()

  /* Refetch on focus. */
  function onFocus() {
    void fetchInternal()
  }
  function onOnline() {
    void fetchInternal()
  }

  if (typeof window !== 'undefined') {
    if (revalidateOnFocus) {
      window.addEventListener('focus', onFocus, { passive: true })
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') onFocus()
      })
    }
    if (revalidateOnReconnect) {
      window.addEventListener('online', onOnline, { passive: true })
    }
  }

  onBeforeUnmount(() => {
    if (typeof window === 'undefined') return
    window.removeEventListener('focus', onFocus)
    window.removeEventListener('online', onOnline)
  })

  /* Re-fetch quand la clé change (key réactive). */
  watch(
    () => makeKey(key),
    () => {
      void fetchInternal()
    },
  )

  return { data, error, isLoading, isValidating, refresh, mutate }
}

/* ────────── Memory pressure handling ────────── */

registerReclaimable({
  name: 'swr-cache',
  priority: 50,
  reclaim(pressure) {
    if (pressure === 'idle') return
    if (pressure === 'frozen' || pressure === 'critical') {
      cache.clear()
      inFlight.clear()
      return
    }
    /* Active : on supprime simplement les entrées trop vieilles. */
    const now = Date.now()
    for (const [k, e] of cache) {
      if (now - e.lastAccess > 5 * 60_000) cache.delete(k)
    }
  },
})
