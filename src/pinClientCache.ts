/**
 * Cache en mémoire pour flux (1re page) et détails pin — TTL aligné sur une revisite sans spam réseau.
 * Vidé au logout (compte suivant ne voit pas les données du précédent).
 */
import type { Pin } from './types'
import { clearEntityClientCaches } from './entityClientCache'

/** Aligné sur la rétention Vue Query / persister : revisite sans refetch réseau dans la session. */
const PIN_DETAIL_TTL_MS = 7 * 24 * 60 * 60 * 1000 /* 7 jours */
const FEED_FIRST_PAGE_TTL_MS = 15 * 60 * 1000 /* 15 min — première page des flux */

const pinDetailBySlug = new Map<string, { t: number; pin: Pin }>()
const feedFirstPage = new Map<
  string,
  { t: number; pins: Pin[]; hasNextPage: boolean }
>()

/** Première page « pins créés » par profil (clé username|lang) — évite un refetch à chaque entrée sur la page profil. */
const profileCreatedFirstPageByKey = new Map<
  string,
  { t: number; pins: Pin[]; hasMore: boolean; nextPage: number }
>()

export function clearPinClientCaches(): void {
  pinDetailBySlug.clear()
  feedFirstPage.clear()
  profileCreatedFirstPageByKey.clear()
  clearEntityClientCaches()
}

export function invalidatePinDetailClientCache(slug: string): void {
  if (slug) pinDetailBySlug.delete(slug)
}

export function getCachedPinDetail(slug: string): Pin | null {
  const hit = pinDetailBySlug.get(slug)
  if (!hit || Date.now() - hit.t > PIN_DETAIL_TTL_MS) return null
  return hit.pin
}

export function setCachedPinDetail(slug: string, pin: Pin): void {
  pinDetailBySlug.set(slug, { t: Date.now(), pin })
}

export function stableFeedCacheExtraKey(
  extraParams: Record<string, string | number | null | undefined>,
): string {
  return Object.entries(extraParams)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')
}

export function feedFirstPageCacheKey(
  endpoint: string,
  lang: string,
  extraParams: Record<string, string | number | null | undefined>,
): string {
  return `${endpoint}|${lang}|${stableFeedCacheExtraKey(extraParams)}`
}

export function getCachedFeedFirstPage(key: string): { pins: Pin[]; hasNextPage: boolean } | null {
  const hit = feedFirstPage.get(key)
  if (!hit || Date.now() - hit.t > FEED_FIRST_PAGE_TTL_MS) return null
  return { pins: hit.pins.map((p) => ({ ...p })), hasNextPage: hit.hasNextPage }
}

export function setCachedFeedFirstPage(
  key: string,
  pins: Pin[],
  hasNextPage: boolean,
): void {
  feedFirstPage.set(key, {
    t: Date.now(),
    pins: pins.map((p) => ({ ...p })),
    hasNextPage,
  })
}

export function clearFeedFirstPageClientCache(): void {
  feedFirstPage.clear()
}

export function profileCreatedPinsCacheKey(username: string, lang: string): string {
  const u = String(username || '')
    .trim()
    .toLowerCase()
  const l = String(lang || '')
    .trim()
    .toLowerCase()
  return `${u}|${l}`
}

export function getCachedProfileCreatedFirstPage(key: string): {
  pins: Pin[]
  hasMore: boolean
  nextPage: number
} | null {
  const hit = profileCreatedFirstPageByKey.get(key)
  if (!hit || Date.now() - hit.t > PIN_DETAIL_TTL_MS) return null
  return {
    pins: hit.pins.map((p) => ({ ...p })),
    hasMore: hit.hasMore,
    nextPage: hit.nextPage,
  }
}

export function setCachedProfileCreatedFirstPage(
  key: string,
  pins: Pin[],
  hasMore: boolean,
  nextPage: number,
): void {
  if (!key) return
  profileCreatedFirstPageByKey.set(key, {
    t: Date.now(),
    pins: pins.map((p) => ({ ...p })),
    hasMore,
    nextPage,
  })
}

/** Invalide toutes les entrées de cache « créations » pour un auteur (ex. après création / suppression pin). */
export function invalidateProfileCreatedPinsCacheForUsername(username: string): void {
  const u = String(username || '')
    .trim()
    .toLowerCase()
  if (!u) return
  const prefix = `${u}|`
  for (const k of profileCreatedFirstPageByKey.keys()) {
    if (k.startsWith(prefix)) profileCreatedFirstPageByKey.delete(k)
  }
}
