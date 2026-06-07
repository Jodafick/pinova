import api from '../api/index'
import { mapDjangoPinToFrontend, getFullMediaUrl } from './usePins'
import type { Pin } from '../types'
import { DEFAULT_AVATAR_COLOR_CLASS } from '../constants/avatar'

export type HeaderSearchUser = {
  username: string
  displayName: string
  avatarUrl: string
  avatarColor: string
}

export type HeaderSearchBoard = {
  id: number
  name: string
  description: string
  pinCount: number
  ownerUsername: string
  coverImageUrl: string
  previewImages: string[]
}

export type HeaderSearchResult = {
  pins: Pin[]
  users: HeaderSearchUser[]
  boards: HeaderSearchBoard[]
  recommendedPins: Pin[]
  query: string
}

function mapUser(row: Record<string, unknown>): HeaderSearchUser {
  const username = String(row.username ?? '')
  const av = row.avatar as string | null | undefined
  return {
    username,
    displayName: String(row.display_name ?? username),
    avatarUrl: av ? getFullMediaUrl(av) : '',
    avatarColor: String(row.avatar_color || DEFAULT_AVATAR_COLOR_CLASS),
  }
}

function mapBoard(row: Record<string, unknown>): HeaderSearchBoard {
  const previewsRaw = row.preview_images
  const previewImages =
    Array.isArray(previewsRaw)
      ? previewsRaw.filter((u): u is string => typeof u === 'string' && !!String(u).trim()).map(String)
      : []
  const cover =
    typeof row.cover_image_url === 'string' && row.cover_image_url.trim()
      ? row.cover_image_url.trim()
      : previewImages[0] ?? ''
  return {
    id: Number(row.id ?? 0),
    name: String(row.name ?? ''),
    description: String(row.description ?? ''),
    pinCount: Number(row.pin_count ?? 0),
    ownerUsername: String(row.owner_username ?? ''),
    coverImageUrl: cover,
    previewImages,
  }
}

/** Recherche unifiée header : pins + utilisateurs + recommandations (API fuzzy côté serveur). */
export async function fetchExploreBoardsPage(opts: {
  q?: string
  page?: number
  pageSize?: number
}): Promise<{ results: HeaderSearchBoard[]; next: string | null; previous: string | null; count: number }> {
  const page = opts.page ?? 1
  const pageSize = opts.pageSize ?? 24
  const trimmed = (opts.q || '').trim()
  const res = await api.get<{
    results?: Record<string, unknown>[]
    next?: string | null
    previous?: string | null
    count?: number
  }>('pins/explore-boards/', {
    params: {
      q: trimmed || undefined,
      page,
      page_size: pageSize,
    },
  })
  const d = res.data ?? {}
  const raw = Array.isArray(d.results) ? d.results : []
  return {
    results: raw.map((b: Record<string, unknown>) => mapBoard(b)),
    next: typeof d.next === 'string' && d.next.trim() ? d.next : null,
    previous: typeof d.previous === 'string' && d.previous.trim() ? d.previous : null,
    count: typeof d.count === 'number' ? d.count : raw.length,
  }
}

export async function fetchHeaderSearch(q: string, limit = 8): Promise<HeaderSearchResult> {
  const trimmed = q.trim()
  const res = await api.get('pins/header-search/', {
    params: { q: trimmed, limit },
  })
  const d = res.data ?? {}
  const pinsRaw = Array.isArray(d.pins) ? d.pins : []
  const usersRaw = Array.isArray(d.users) ? d.users : []
  const boardsRaw = Array.isArray(d.boards) ? d.boards : []
  const recRaw = Array.isArray(d.recommended_pins) ? d.recommended_pins : []
  return {
    pins: pinsRaw.map((p: Record<string, unknown>) => mapDjangoPinToFrontend(p)),
    users: usersRaw.map((u: Record<string, unknown>) => mapUser(u)),
    boards: boardsRaw.map((b: Record<string, unknown>) => mapBoard(b)),
    recommendedPins: recRaw.map((p: Record<string, unknown>) => mapDjangoPinToFrontend(p)),
    query: String(d.query ?? trimmed),
  }
}
