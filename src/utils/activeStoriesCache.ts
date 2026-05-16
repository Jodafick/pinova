/**
 * Cache léger pour `pins/active-stories` — évite un refetch à chaque navigation /
 * réactivation de page tant que le TTL n’est pas dépassé.
 * Rafraîchissement explicite (bouton ↻) doit passer `force: true`.
 */

import type { Pin } from '../types'

const DEFAULT_TTL_MS = 3 * 60 * 1000

/** Bandeau home : une entrée globale (endpoint sans username). */
let homeStripCache: { groups: HomeStoriesGroupsCache; at: number } | null = null

export type HomeStoriesGroupsCache = Array<{
  username: string
  display_name: string
  avatar_url: string
  avatar_color: string
  cover_image_url: string
  pins: Pin[]
}>

const profileStoriesCache = new Map<string, { pins: Pin[]; at: number }>()

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
}

export function getCachedProfileActiveStories(
  username: string,
  ttlMs: number = DEFAULT_TTL_MS,
): Pin[] | null {
  const key = normUser(username)
  if (!key) return null
  const e = profileStoriesCache.get(key)
  if (!e) return null
  if (Date.now() - e.at > ttlMs) return null
  return e.pins
}

export function setCachedProfileActiveStories(username: string, pins: Pin[]) {
  const key = normUser(username)
  if (!key) return
  profileStoriesCache.set(key, { pins, at: Date.now() })
}

export function invalidateProfileActiveStories(username?: string) {
  if (username) profileStoriesCache.delete(normUser(username))
  else profileStoriesCache.clear()
}
