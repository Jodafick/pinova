import api from '../api'
import { DEFAULT_AVATAR_COLOR_CLASS } from './useAuth'
import { getFullMediaUrl } from './usePins'

export type SuggestUserRow = {
  username: string
  name: string
  avatarColor: string
  avatarUrl: string
  relation: string
}

export type FetchMentionUsersPageResult = {
  users: SuggestUserRow[]
  nextUrl: string | null
}

function mapMentionUser(user: Record<string, unknown>): SuggestUserRow {
  const username = String(user.username ?? '')
  return {
    username,
    name: String(user.display_name ?? username),
    avatarColor: String(user.avatar_color || DEFAULT_AVATAR_COLOR_CLASS),
    avatarUrl: getFullMediaUrl((user.avatar as string | null | undefined) ?? '') || '',
    relation: String(user.relation ?? ''),
  }
}

/**
 * Réponse paginée de `GET users/mentions/` (tri API : mutuels, abonnements, abonnés, activité de vue).
 */
export async function fetchMentionUsersPage(
  query: string,
  page: number,
  pageSize: number,
): Promise<FetchMentionUsersPageResult> {
  const response = await api.get('users/mentions/', {
    params: { q: query, page, page_size: pageSize },
  })
  const payload = response.data ?? {}
  const raw = Array.isArray(payload) ? payload : (payload.results ?? [])
  const users = (raw as Record<string, unknown>[]).map(mapMentionUser)
  const nextUrl = typeof payload.next === 'string' && payload.next ? payload.next : null
  return { users, nextUrl }
}
