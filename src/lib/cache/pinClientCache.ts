/**
 * Cache pour flux (1re page) et détails pin — mémoire + localStorage (lecture hors ligne / après refresh).
 * Vidé au logout avec les autres caches client.
 */
import type { FeedItem, Pin } from '../../types'
import { isFeedPin, isSponsoredAd } from '../../types'
import { clearEntityClientCaches } from './entityClientCache'

/** Aligné sur la rétention Vue Query / persister : revisite sans refetch réseau dans la session. */
const PIN_DETAIL_TTL_MS = 7 * 24 * 60 * 60 * 1000 /* 7 jours */
const FEED_FIRST_PAGE_TTL_MS = 15 * 60 * 1000 /* 15 min — première page des flux */

const PIN_DETAIL_DISK_KEY = 'pinova_disk_pin_detail_blob_v1'
const FEED_P1_DISK_KEY = 'pinova_disk_feed_p1_blob_v1'
const PROFILE_CREATION_DISK_PREFIX = 'pinova_disk_profile_created_v1:'
const SAVED_PINS_DISK_PREFIX = 'pinova_disk_saved_pins_v1:'

const MAX_PIN_DETAIL_DISK_SLUGS = 100
const MAX_FEED_P1_DISK_KEYS = 18

const pinDetailBySlug = new Map<string, { t: number; pin: Pin }>()
const feedFirstPage = new Map<
  string,
  { t: number; items: FeedItem[]; hasNextPage: boolean }
>()

/** Première page « pins créés » par profil (clé username|lang) — évite un refetch à chaque entrée sur la page profil. */
const profileCreatedFirstPageByKey = new Map<
  string,
  { t: number; pins: Pin[]; hasMore: boolean; nextPage: number }
>()

function readJsonBlob<T>(lsKey: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(lsKey)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJsonBlob(lsKey: string, value: unknown): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(lsKey, JSON.stringify(value))
  } catch {
    /* quota */
  }
}

type PinDetailDiskBlob = { bySlug: Record<string, { t: number; pin: Pin }> }

function readPinDetailDisk(): PinDetailDiskBlob {
  const parsed = readJsonBlob<PinDetailDiskBlob>(PIN_DETAIL_DISK_KEY)
  if (parsed?.bySlug && typeof parsed.bySlug === 'object') return parsed
  return { bySlug: {} }
}

function prunePinDetailDisk(store: PinDetailDiskBlob): void {
  const entries = Object.entries(store.bySlug)
  if (entries.length <= MAX_PIN_DETAIL_DISK_SLUGS) return
  entries.sort((a, b) => a[1].t - b[1].t)
  const drop = entries.length - MAX_PIN_DETAIL_DISK_SLUGS
  for (let i = 0; i < drop; i++) {
    delete store.bySlug[entries[i][0]]
  }
}

function persistPinDetailDiskSlug(slug: string, t: number, pin: Pin): void {
  const store = readPinDetailDisk()
  store.bySlug[slug] = { t, pin: { ...pin } }
  prunePinDetailDisk(store)
  writeJsonBlob(PIN_DETAIL_DISK_KEY, store)
}

function removePinDetailDiskSlug(slug: string): void {
  const store = readPinDetailDisk()
  if (!store.bySlug[slug]) return
  delete store.bySlug[slug]
  writeJsonBlob(PIN_DETAIL_DISK_KEY, store)
}

type FeedP1DiskBlob = { entries: Record<string, { t: number; items: FeedItem[]; hasNextPage: boolean }> }

function readFeedP1Disk(): FeedP1DiskBlob {
  const parsed = readJsonBlob<FeedP1DiskBlob>(FEED_P1_DISK_KEY)
  if (parsed?.entries && typeof parsed.entries === 'object') return parsed
  return { entries: {} }
}

function pruneFeedP1Disk(store: FeedP1DiskBlob): void {
  const ent = Object.entries(store.entries)
  if (ent.length <= MAX_FEED_P1_DISK_KEYS) return
  ent.sort((a, b) => a[1].t - b[1].t)
  const drop = ent.length - MAX_FEED_P1_DISK_KEYS
  for (let i = 0; i < drop; i++) {
    delete store.entries[ent[i][0]]
  }
}

function cloneFeedItem(item: FeedItem): FeedItem {
  return isSponsoredAd(item) ? { ...item } : { ...item }
}

function persistFeedP1Disk(
  cacheKey: string,
  t: number,
  items: FeedItem[],
  hasNextPage: boolean,
): void {
  const store = readFeedP1Disk()
  store.entries[cacheKey] = {
    t,
    items: items.map(cloneFeedItem),
    hasNextPage,
  }
  pruneFeedP1Disk(store)
  writeJsonBlob(FEED_P1_DISK_KEY, store)
}

/** Ancien format disque (pins uniquement, sans pubs). */
function feedItemsFromDiskEntry(entry: {
  items?: FeedItem[]
  pins?: Pin[]
}): FeedItem[] {
  if (Array.isArray(entry.items) && entry.items.length) {
    return entry.items.map((x) =>
      isSponsoredAd(x as FeedItem) || isFeedPin(x as FeedItem) ? cloneFeedItem(x as FeedItem) : (x as FeedItem),
    )
  }
  if (Array.isArray(entry.pins)) {
    return entry.pins.map((p) => ({ ...p }))
  }
  return []
}

function profileCreatedDiskLsKey(cacheKey: string): string {
  return PROFILE_CREATION_DISK_PREFIX + encodeURIComponent(cacheKey)
}

function savedPinsDiskLsKey(username: string, lang: string): string {
  const u = String(username || '')
    .trim()
    .toLowerCase()
  const l = String(lang || '')
    .trim()
    .toLowerCase()
  return SAVED_PINS_DISK_PREFIX + encodeURIComponent(`${u}|${l}`)
}

function removeAllDiskKeysWithPrefixes(prefixes: string[]): void {
  if (typeof window === 'undefined') return
  try {
    const toRemove: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (!k) continue
      if (prefixes.some((p) => k.startsWith(p))) toRemove.push(k)
    }
    for (const k of toRemove) window.localStorage.removeItem(k)
  } catch {
    /* ignore */
  }
}

export function clearPinClientCaches(): void {
  pinDetailBySlug.clear()
  feedFirstPage.clear()
  profileCreatedFirstPageByKey.clear()
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(PIN_DETAIL_DISK_KEY)
      window.localStorage.removeItem(FEED_P1_DISK_KEY)
      removeAllDiskKeysWithPrefixes([PROFILE_CREATION_DISK_PREFIX, SAVED_PINS_DISK_PREFIX])
    } catch {
      /* ignore */
    }
  }
  clearEntityClientCaches()
}

export function invalidatePinDetailClientCache(slug: string): void {
  if (slug) {
    pinDetailBySlug.delete(slug)
    removePinDetailDiskSlug(slug)
  }
}

export function getCachedPinDetail(slug: string): Pin | null {
  const hit = pinDetailBySlug.get(slug)
  if (hit && Date.now() - hit.t <= PIN_DETAIL_TTL_MS) {
    return { ...hit.pin }
  }
  if (hit) pinDetailBySlug.delete(slug)

  const disk = readPinDetailDisk().bySlug[slug]
  if (disk && Date.now() - disk.t <= PIN_DETAIL_TTL_MS) {
    pinDetailBySlug.set(slug, { t: disk.t, pin: { ...disk.pin } })
    return { ...disk.pin }
  }
  if (disk) removePinDetailDiskSlug(slug)
  return null
}

export function setCachedPinDetail(slug: string, pin: Pin): void {
  const t = Date.now()
  pinDetailBySlug.set(slug, { t, pin: { ...pin } })
  persistPinDetailDiskSlug(slug, t, pin)
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

export function getCachedFeedFirstPage(key: string): { items: FeedItem[]; hasNextPage: boolean } | null {
  const hit = feedFirstPage.get(key)
  if (hit && Date.now() - hit.t <= FEED_FIRST_PAGE_TTL_MS) {
    return { items: hit.items.map(cloneFeedItem), hasNextPage: hit.hasNextPage }
  }
  if (hit) feedFirstPage.delete(key)

  const fd = readFeedP1Disk().entries[key] as
    | { t: number; items?: FeedItem[]; pins?: Pin[]; hasNextPage: boolean }
    | undefined
  if (fd && Date.now() - fd.t <= FEED_FIRST_PAGE_TTL_MS) {
    const items = feedItemsFromDiskEntry(fd)
    feedFirstPage.set(key, { t: fd.t, items, hasNextPage: fd.hasNextPage })
    return { items: items.map(cloneFeedItem), hasNextPage: fd.hasNextPage }
  }
  return null
}

export function setCachedFeedFirstPage(key: string, items: FeedItem[], hasNextPage: boolean): void {
  const t = Date.now()
  const cloned = items.map(cloneFeedItem)
  feedFirstPage.set(key, { t, items: cloned, hasNextPage })
  persistFeedP1Disk(key, t, cloned, hasNextPage)
}

export function clearFeedFirstPageClientCache(): void {
  feedFirstPage.clear()
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(FEED_P1_DISK_KEY)
    } catch {
      /* ignore */
    }
  }
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
  if (hit && Date.now() - hit.t <= PIN_DETAIL_TTL_MS) {
    return {
      pins: hit.pins.map((p) => ({ ...p })),
      hasMore: hit.hasMore,
      nextPage: hit.nextPage,
    }
  }
  if (hit) profileCreatedFirstPageByKey.delete(key)

  if (typeof window === 'undefined' || !key) return null
  try {
    const raw = window.localStorage.getItem(profileCreatedDiskLsKey(key))
    if (!raw) return null
    const parsed = JSON.parse(raw) as {
      t?: number
      pins?: Pin[]
      hasMore?: boolean
      nextPage?: number
    }
    if (
      typeof parsed.t !== 'number' ||
      !Array.isArray(parsed.pins) ||
      typeof parsed.hasMore !== 'boolean' ||
      typeof parsed.nextPage !== 'number'
    ) {
      return null
    }
    if (Date.now() - parsed.t > PIN_DETAIL_TTL_MS) {
      window.localStorage.removeItem(profileCreatedDiskLsKey(key))
      return null
    }
    profileCreatedFirstPageByKey.set(key, {
      t: parsed.t,
      pins: parsed.pins.map((p) => ({ ...p })),
      hasMore: parsed.hasMore,
      nextPage: parsed.nextPage,
    })
    return {
      pins: parsed.pins.map((p) => ({ ...p })),
      hasMore: parsed.hasMore,
      nextPage: parsed.nextPage,
    }
  } catch {
    return null
  }
}

export function setCachedProfileCreatedFirstPage(
  key: string,
  pins: Pin[],
  hasMore: boolean,
  nextPage: number,
): void {
  if (!key) return
  const t = Date.now()
  profileCreatedFirstPageByKey.set(key, {
    t,
    pins: pins.map((p) => ({ ...p })),
    hasMore,
    nextPage,
  })
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        profileCreatedDiskLsKey(key),
        JSON.stringify({
          t,
          pins: pins.map((p) => ({ ...p })),
          hasMore,
          nextPage,
        }),
      )
    } catch {
      /* quota */
    }
  }
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
  if (typeof window !== 'undefined') {
    try {
      const toRemove: string[] = []
      for (let i = 0; i < window.localStorage.length; i++) {
        const full = window.localStorage.key(i)
        if (!full || !full.startsWith(PROFILE_CREATION_DISK_PREFIX)) continue
        const enc = full.slice(PROFILE_CREATION_DISK_PREFIX.length)
        try {
          const decoded = decodeURIComponent(enc)
          if (decoded.startsWith(prefix)) toRemove.push(full)
        } catch {
          /* ignore */
        }
      }
      for (const rm of toRemove) window.localStorage.removeItem(rm)
    } catch {
      /* ignore */
    }
  }
}

export type SavedPinsPageDisk = {
  t: number
  pins: Pin[]
  hasMore: boolean
  nextPage: number
}

export function getSavedPinsPageFromDisk(username: string, lang: string): SavedPinsPageDisk | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(savedPinsDiskLsKey(username, lang))
    if (!raw) return null
    const parsed = JSON.parse(raw) as SavedPinsPageDisk
    if (
      typeof parsed.t !== 'number' ||
      !Array.isArray(parsed.pins) ||
      typeof parsed.hasMore !== 'boolean' ||
      typeof parsed.nextPage !== 'number'
    ) {
      return null
    }
    if (Date.now() - parsed.t > PIN_DETAIL_TTL_MS) {
      window.localStorage.removeItem(savedPinsDiskLsKey(username, lang))
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function setSavedPinsPageToDisk(
  username: string,
  lang: string,
  data: Omit<SavedPinsPageDisk, 't'>,
): void {
  if (typeof window === 'undefined') return
  try {
    const payload: SavedPinsPageDisk = {
      t: Date.now(),
      pins: data.pins.map((p) => ({ ...p })),
      hasMore: data.hasMore,
      nextPage: data.nextPage,
    }
    window.localStorage.setItem(savedPinsDiskLsKey(username, lang), JSON.stringify(payload))
  } catch {
    /* quota */
  }
}

export function invalidateSavedPinsDiskForUser(username: string, lang: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(savedPinsDiskLsKey(username, lang))
  } catch {
    /* ignore */
  }
}
