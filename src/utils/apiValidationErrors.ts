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
