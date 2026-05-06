import api from '../api'
import { mapDjangoPinToFrontend, getFullMediaUrl } from './usePins'
import type { Pin } from '../types'
import { DEFAULT_AVATAR_COLOR_CLASS } from './useAuth'

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
  return {
    id: Number(row.id ?? 0),
    name: String(row.name ?? ''),
    description: String(row.description ?? ''),
    pinCount: Number(row.pin_count ?? 0),
    ownerUsername: String(row.owner_username ?? ''),
    coverImageUrl: String(row.cover_image_url ?? ''),
  }
}

/** Recherche unifiée header : pins + utilisateurs + recommandations (API fuzzy côté serveur). */
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
