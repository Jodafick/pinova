/**
 * Messages utilisateur à partir des réponses d’erreur API (DRF, non_field_errors, etc.).
 */
export function formatDrfErrorMessages(data: unknown): string[] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return []

  const out: string[] = []

  const pushValue = (v: unknown) => {
    if (v == null || v === '') return
    if (Array.isArray(v)) {
      for (const item of v) {
        if (item != null && item !== '') out.push(String(item))
      }
      return
    }
    if (typeof v === 'object') {
      out.push(...formatDrfErrorMessages(v))
      return
    }
    out.push(String(v))
  }

  for (const v of Object.values(data as Record<string, unknown>)) {
    pushValue(v)
  }

  return out
}

/** Indique si la réponse d’erreur DRF concerne au moins un des champs nommés (clés racine). */
export function drfErrorTouchesFields(
  data: unknown,
  fieldKeys: ReadonlySet<string>,
): boolean {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false
  return Object.keys(data as Record<string, unknown>).some((k) => fieldKeys.has(k))
}

export type DrfFieldErrors = Record<string, string[]>

export function extractDrfFieldErrors(data: unknown): DrfFieldErrors {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
  const source = data as Record<string, unknown>
  const out: DrfFieldErrors = {}
  for (const [key, value] of Object.entries(source)) {
    if (key === 'non_field_errors' || key === 'detail' || key === 'code') continue
    if (typeof value === 'string' && value.trim()) {
      out[key] = [value.trim()]
      continue
    }
    if (Array.isArray(value)) {
      const rows = value.map((x) => String(x ?? '').trim()).filter(Boolean)
      if (rows.length) out[key] = rows
    }
  }
  return out
}

export function firstErroredField(
  fieldErrors: DrfFieldErrors,
  preferredOrder: readonly string[],
): string | null {
  for (const key of preferredOrder) {
    if (fieldErrors[key]?.length) return key
  }
  return Object.keys(fieldErrors)[0] ?? null
}
