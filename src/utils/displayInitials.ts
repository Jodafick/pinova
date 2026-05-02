/** Initiales pour avatar (prénom + nom ou 2 premiers caractères du pseudo). */
export function displayInitials(displayName: string | undefined | null, fallback = '?'): string {
  const raw = (displayName ?? '').trim()
  if (!raw) return fallback
  const parts = raw.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const a = (parts[0]?.[0] ?? '').toUpperCase()
    const b = (parts[parts.length - 1]?.[0] ?? '').toUpperCase()
    const pair = `${a}${b}`.trim()
    return pair || fallback
  }
  const compact = raw.slice(0, 2).toUpperCase()
  return compact || fallback
}
