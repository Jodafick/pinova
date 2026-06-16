/**
 * Cache léger pour `fotos/active-stories` — évite un refetch à chaque navigation /
 * réactivation de page tant que le TTL n’est pas dépassé.
 * Rafraîchissement explicite (bouton ↻) doit passer `force: true`.
 */

import type { Foto } from '../types'

const DEFAULT_TTL_MS = 3 * 60 * 1000

/** Bandeau home : une entrée globale (endpoint sans username). */
let homeStripCache: { groups: HomeStoriesGroupsCache; at: number } | null = null

export type HomeStoriesGroupsCache = Array<{
  username: string
  display_name: string
  avatar_url: string
  avatar_color: string
  cover_image_url: string
  pins: Foto[]
}>

const profileStoriesCache = new Map<string, { pins: Foto[]; at: number }>()
const homeStripRefreshListeners = new Set<() => void>()

export function subscribeHomeStoriesRefresh(listener: () => void): () => void {
  homeStripRefreshListeners.add(listener)
  return () => homeStripRefreshListeners.delete(listener)
}

function normUser(u: string) {
  return u.trim().toLowerCase()
}

export function getCachedHomeStoriesGroups(
  ttlMs: number = DEFAULT_TTL_MS,
): HomeStoriesGroupsCache | null {
  if (!homeStripCache) return null
  if (Date.now() - homeStripCache.at > ttlMs) return null
  return homeStripCache.groups
}

export function setCachedHomeStoriesGroups(groups: HomeStoriesGroupsCache) {
  homeStripCache = { groups, at: Date.now() }
}

export function invalidateHomeStoriesCache() {
  homeStripCache = null
  for (const fn of [...homeStripRefreshListeners]) {
    try {
      fn()
    } catch {
      /* noop */
    }
  }
}

export function getCachedProfileActiveStories(
  username: string,
  ttlMs: number = DEFAULT_TTL_MS,
): Foto[] | null {
  const key = normUser(username)
  if (!key) return null
  const e = profileStoriesCache.get(key)
  if (!e) return null
  if (Date.now() - e.at > ttlMs) return null
  return e.pins
}

export function setCachedProfileActiveStories(username: string, pins: Foto[]) {
  const key = normUser(username)
  if (!key) return
  profileStoriesCache.set(key, { fotos, at: Date.now() })
}

export function invalidateProfileActiveStories(username?: string) {
  if (username) profileStoriesCache.delete(normUser(username))
  else profileStoriesCache.clear()
}
