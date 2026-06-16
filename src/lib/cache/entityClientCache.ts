/**
 * Cache mémoire longue durée pour profils et tableaux (aligné sur la rétention foto détail).
 * Vidé au logout avec les autres caches client.
 */
import type { Foto, User } from '../../types'

export type BoardDetailSnapshot = {
  boardName: string
  ownerUsername: string
  boardDescription: string
  viewerCanManage: boolean
  boardIsPrivate: boolean
  boardIsOwner: boolean
  boardFotos: Foto[]
}

const ENTITY_TTL_MS = 7 * 24 * 60 * 60 * 1000 /* 7 jours */
const PROFILE_LS_PREFIX = 'fotoce_entity_profile_v1:'
const PROFILE_LS_MAX_ENTRIES = 48
const BOARD_LS_PREFIX = 'fotoce_entity_board_v1:'
const BOARD_LS_MAX_ENTRIES = 32

function boardLocalStorageKey(cacheKey: string): string {
  return BOARD_LS_PREFIX + encodeURIComponent(cacheKey)
}

function pruneBoardLocalStorage(): void {
  if (typeof window === 'undefined') return
  try {
    const entries: { key: string; t: number }[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (!key || !key.startsWith(BOARD_LS_PREFIX)) continue
      const raw = window.localStorage.getItem(key)
      if (!raw) continue
      try {
        const parsed = JSON.parse(raw) as { t?: number }
        if (typeof parsed.t === 'number') entries.push({ key, t: parsed.t })
      } catch {
        /* ignore */
      }
    }
    if (entries.length <= BOARD_LS_MAX_ENTRIES) return
    entries.sort((a, b) => a.t - b.t)
    const excess = entries.length - BOARD_LS_MAX_ENTRIES
    for (let i = 0; i < excess; i++) {
      window.localStorage.removeItem(entries[i].key)
    }
  } catch {
    /* quota */
  }
}

function persistBoardSnapshotToStorage(cacheKey: string, snapshot: BoardDetailSnapshot): void {
  if (typeof window === 'undefined' || !cacheKey) return
  try {
    const lsKey = boardLocalStorageKey(cacheKey)
    window.localStorage.setItem(lsKey, JSON.stringify({ t: Date.now(), snapshot }))
    pruneBoardLocalStorage()
  } catch {
    /* quota */
  }
}

function readBoardSnapshotFromStorage(cacheKey: string): { t: number; snapshot: BoardDetailSnapshot } | null {
  if (typeof window === 'undefined' || !cacheKey) return null
  try {
    const raw = window.localStorage.getItem(boardLocalStorageKey(cacheKey))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { t?: number; snapshot?: BoardDetailSnapshot }
    if (
      typeof parsed.t !== 'number' ||
      !parsed.snapshot ||
      typeof parsed.snapshot !== 'object'
    ) {
      return null
    }
    if (Date.now() - parsed.t > ENTITY_TTL_MS) {
      window.localStorage.removeItem(boardLocalStorageKey(cacheKey))
      return null
    }
    return { t: parsed.t, snapshot: parsed.snapshot }
  } catch {
    return null
  }
}

function removeBoardSnapshotFromStorage(cacheKey: string): void {
  if (typeof window === 'undefined' || !cacheKey) return
  try {
    window.localStorage.removeItem(boardLocalStorageKey(cacheKey))
  } catch {
    /* ignore */
  }
}

function profileLocalStorageKey(cacheKey: string): string {
  return PROFILE_LS_PREFIX + encodeURIComponent(cacheKey)
}

function pruneProfileLocalStorage(): void {
  if (typeof window === 'undefined') return
  try {
    const entries: { key: string; t: number }[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (!key || !key.startsWith(PROFILE_LS_PREFIX)) continue
      const raw = window.localStorage.getItem(key)
      if (!raw) continue
      try {
        const parsed = JSON.parse(raw) as { t?: number }
        if (typeof parsed.t === 'number') entries.push({ key, t: parsed.t })
      } catch {
        /* ignore */
      }
    }
    if (entries.length <= PROFILE_LS_MAX_ENTRIES) return
    entries.sort((a, b) => a.t - b.t)
    const excess = entries.length - PROFILE_LS_MAX_ENTRIES
    for (let i = 0; i < excess; i++) {
      window.localStorage.removeItem(entries[i].key)
    }
  } catch {
    /* quota / accès */
  }
}

function persistProfileUserToStorage(cacheKey: string, user: User): void {
  if (typeof window === 'undefined' || !cacheKey) return
  try {
    const lsKey = profileLocalStorageKey(cacheKey)
    window.localStorage.setItem(lsKey, JSON.stringify({ t: Date.now(), user }))
    pruneProfileLocalStorage()
  } catch {
    /* quota */
  }
}

function readProfileUserFromStorage(cacheKey: string): { t: number; user: User } | null {
  if (typeof window === 'undefined' || !cacheKey) return null
  try {
    const raw = window.localStorage.getItem(profileLocalStorageKey(cacheKey))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { t?: number; user?: User }
    if (typeof parsed.t !== 'number' || !parsed.user || typeof parsed.user !== 'object') return null
    if (Date.now() - parsed.t > ENTITY_TTL_MS) {
      window.localStorage.removeItem(profileLocalStorageKey(cacheKey))
      return null
    }
    return { t: parsed.t, user: parsed.user }
  } catch {
    return null
  }
}

function removeProfileUserFromStorage(cacheKey: string): void {
  if (typeof window === 'undefined' || !cacheKey) return
  try {
    window.localStorage.removeItem(profileLocalStorageKey(cacheKey))
  } catch {
    /* ignore */
  }
}

const profileByKey = new Map<string, { t: number; user: User }>()
const boardByKey = new Map<string, { t: number; snapshot: BoardDetailSnapshot }>()

export function clearEntityClientCaches(): void {
  profileByKey.clear()
  boardByKey.clear()
  if (typeof window !== 'undefined') {
    try {
      const toRemove: string[] = []
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i)
        if (k && (k.startsWith(PROFILE_LS_PREFIX) || k.startsWith(BOARD_LS_PREFIX))) toRemove.push(k)
      }
      for (const k of toRemove) {
        window.localStorage.removeItem(k)
      }
    } catch {
      /* ignore */
    }
  }
}

export function profileDetailCacheKey(username: string, share: string): string {
  const u = String(username || '')
    .trim()
    .toLowerCase()
  const s = String(share || '').trim()
  return `${u}|${s}`
}

export function boardDetailCacheKey(boardId: number, share: string): string {
  const s = String(share || '').trim()
  return `${boardId}|${s}`
}

export function getCachedProfileUser(key: string): User | null {
  const hit = profileByKey.get(key)
  if (hit && Date.now() - hit.t <= ENTITY_TTL_MS) {
    return { ...hit.user }
  }
  if (hit) profileByKey.delete(key)

  const fromDisk = readProfileUserFromStorage(key)
  if (fromDisk) {
    profileByKey.set(key, { t: fromDisk.t, user: { ...fromDisk.user } })
    return { ...fromDisk.user }
  }
  return null
}

export function setCachedProfileUser(key: string, user: User): void {
  if (!key) return
  profileByKey.set(key, { t: Date.now(), user: { ...user } })
  persistProfileUserToStorage(key, user)
}

export function invalidateProfileDetailCache(key: string): void {
  if (key) profileByKey.delete(key)
  removeProfileUserFromStorage(key)
}

export function getCachedBoardDetail(key: string): BoardDetailSnapshot | null {
  const hit = boardByKey.get(key)
  if (hit && Date.now() - hit.t <= ENTITY_TTL_MS) {
    return {
      ...hit.snapshot,
      boardFotos: hit.snapshot.boardFotos.map((p) => ({ ...p })),
    }
  }
  if (hit) boardByKey.delete(key)

  const fromDisk = readBoardSnapshotFromStorage(key)
  if (fromDisk) {
    boardByKey.set(key, { t: fromDisk.t, snapshot: { ...fromDisk.snapshot } })
    return {
      ...fromDisk.snapshot,
      boardFotos: fromDisk.snapshot.boardFotos.map((p) => ({ ...p })),
    }
  }
  return null
}

export function setCachedBoardDetail(key: string, snapshot: BoardDetailSnapshot): void {
  if (!key) return
  boardByKey.set(key, {
    t: Date.now(),
    snapshot: {
      ...snapshot,
      boardFotos: snapshot.boardFotos.map((p) => ({ ...p })),
    },
  })
  persistBoardSnapshotToStorage(key, {
    ...snapshot,
    boardFotos: snapshot.boardFotos.map((p) => ({ ...p })),
  })
}

export function invalidateBoardDetailCache(key: string): void {
  if (key) boardByKey.delete(key)
  removeBoardSnapshotFromStorage(key)
}
