/**
 * URL absolue http(s) utilisable pour navigation (Safari refuse les chaînes mal formées / schémas exotiques).
 */
export function safeHttpUrl(raw: unknown, baseOrigin?: string): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const base =
    baseOrigin ||
    (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'https://invalid.invalid')
  try {
    const u = /^https?:\/\//i.test(trimmed) ? new URL(trimmed) : new URL(trimmed, base)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.href
  } catch {
    return null
  }
}
