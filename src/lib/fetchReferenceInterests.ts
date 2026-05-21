import api from '../api'
import {
  REFERENCE_INTERESTS,
  type InterestRef,
} from '../data/reference'

let cached: InterestRef[] | null = null
let inflight: Promise<InterestRef[]> | null = null

function mapRow(raw: Record<string, unknown>): InterestRef {
  return {
    slug: String(raw.slug ?? ''),
    icon: String(raw.icon ?? 'category'),
    category: String(raw.category ?? 'general'),
    nameFr: String(raw.nameFr ?? raw.slug ?? ''),
    nameEn: String(raw.nameEn ?? raw.slug ?? ''),
    nameFon: String(raw.nameFon ?? raw.nameFr ?? raw.slug ?? ''),
  }
}

/** Catalogue d'intérêts onboarding — API backend avec repli JSON local. */
export async function fetchReferenceInterests(lang?: string, force = false): Promise<InterestRef[]> {
  if (cached && !force) return cached
  if (inflight && !force) return inflight

  inflight = (async () => {
    try {
      const { data } = await api.get<{ results?: Record<string, unknown>[] }>('reference/interests/', {
        params: lang ? { lang } : undefined,
      })
      const rows = (data?.results ?? []).map(mapRow).filter((r) => r.slug)
      if (rows.length) {
        cached = rows
        return rows
      }
    } catch {
      /* offline / ancien backend */
    }
    cached = REFERENCE_INTERESTS
    return REFERENCE_INTERESTS
  })()

  try {
    return await inflight
  } finally {
    inflight = null
  }
}
