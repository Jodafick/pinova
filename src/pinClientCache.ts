/**
 * Cache léger en mémoire (TTL court) pour éviter de recharger trop souvent les mêmes flux / détails.
 * Vidé au logout (compte suivant ne voit pas les pins du précédent).
 */
import type { Pin } from './types'

const PIN_DETAIL_TTL_MS = 50_000
const FEED_FIRST_PAGE_TTL_MS = 28_000

const pinDetailBySlug = new Map<string, { t: number; pin: Pin }>()
const feedFirstPage = new Map<
  string,
  { t: number; pins: Pin[]; hasNextPage: boolean }
>()

export function clearPinClientCaches(): void {
  pinDetailBySlug.clear()
  feedFirstPage.clear()
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
