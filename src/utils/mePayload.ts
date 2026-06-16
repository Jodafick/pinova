import { mapDjangoFotoToFrontend, getFullMediaUrl } from '../composables/useFotos'
import type { MeHydrationPinsPage, User } from '../types'

function normalizeBoardPreviews(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const x of raw) {
    if (typeof x !== 'string' || !String(x).trim()) continue
    out.push(getFullMediaUrl(String(x).trim()))
  }
  return out.slice(0, 8)
}

export function mapBoardRowFromBoardsApiRow(
  b: Record<string, unknown>,
): NonNullable<User['boards']>[number] {
  return {
    id: Number(b.id),
    name: String(b.name ?? ''),
    fotoCount: Number(b.pin_count ?? 0),
    isPrivate: !!b.is_private,
    collaboratorCount: Number(b.collaborator_count ?? 0),
    previewImages: normalizeBoardPreviews(b.preview_images),
    isOwner:
      b.is_owner === undefined
        ? true
        : !!b.is_owner,
    ownerUsername: typeof b.owner_username === 'string' ? b.owner_username : undefined,
    shareToken: b.share_token != null ? String(b.share_token) : undefined,
  }
}

function parseMePinsPage(raw: unknown): MeHydrationPinsPage | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const resultsRaw = o.results
  if (!Array.isArray(resultsRaw)) return undefined
  return {
    count: Number(o.count ?? resultsRaw.length ?? 0),
    next:
      typeof o.next === 'string'
        ? o.next
        : o.next === null || o.next === undefined
          ? null
          : String(o.next),
    previous:
      typeof o.previous === 'string'
        ? o.previous
        : o.previous === null || o.previous === undefined
          ? null
          : String(o.previous),
    results: resultsRaw.map((p) => mapDjangoFotoToFrontend(p)),
  }
}

/** Extrait le bundle `_page` ajouté par `GET/PATCH me/` (liste tableaux page 1, fotos créés / enregistrés). */
export function extractMeHydrationFromApiPayload(data: Record<string, unknown> | null | undefined): {
  boards: NonNullable<User['boards']>
  createdPinsPage?: MeHydrationPinsPage
  savedFotosPage?: MeHydrationPinsPage
} | null {
  if (!data || data.me_boards_page == null || typeof data.me_boards_page !== 'object') return null
  const bp = data.me_boards_page as Record<string, unknown>
  const rawBoards = bp.results
  const boards =
    Array.isArray(rawBoards)
      ? (rawBoards as Record<string, unknown>[]).map(mapBoardRowFromBoardsApiRow)
      : []
  const createdPinsPage = parseMePinsPage(data.me_created_pins_page)
  const savedFotosPage = parseMePinsPage(data.me_saved_pins_page)
  return {
    boards,
    createdPinsPage,
    savedFotosPage,
  }
}
