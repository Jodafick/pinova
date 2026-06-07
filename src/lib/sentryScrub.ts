/** Filtre données sensibles avant envoi Sentry (tokens, emails, secrets). */

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g
const JWT_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g
const BEARER_RE = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi
const SENSITIVE_KEY = /token|password|secret|authorization|cookie|refresh|access|otp|api[_-]?key|pinova_token/i

export const SENTRY_REDACTED = '[Filtered]'

function scrubString(value: string): string {
  return value
    .replace(JWT_RE, SENTRY_REDACTED)
    .replace(BEARER_RE, `Bearer ${SENTRY_REDACTED}`)
    .replace(EMAIL_RE, SENTRY_REDACTED)
}

function scrubValue(value: unknown): unknown {
  if (typeof value === 'string') return scrubString(value)
  if (Array.isArray(value)) return value.map(scrubValue)
  if (value && typeof value === 'object') return scrubObject(value as Record<string, unknown>)
  return value
}

function scrubObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(obj)) {
    if (SENSITIVE_KEY.test(key)) {
      out[key] = SENTRY_REDACTED
      continue
    }
    out[key] = scrubValue(val)
  }
  return out
}

/** Compatible @sentry/vue / @sentry/react-native Event type (structure minimale). */
export function scrubSentryEvent<T extends { request?: unknown; extra?: unknown; breadcrumbs?: unknown[]; user?: unknown }>(
  event: T,
): T | null {
  if (event.request && typeof event.request === 'object') {
    event.request = scrubObject(event.request as Record<string, unknown>)
  }
  if (event.extra && typeof event.extra === 'object') {
    event.extra = scrubObject(event.extra as Record<string, unknown>)
  }
  if (event.user && typeof event.user === 'object') {
    const user = { ...(event.user as Record<string, unknown>) }
    if (typeof user.email === 'string') user.email = SENTRY_REDACTED
    event.user = user
  }
  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs.map((bc) => {
      if (!bc || typeof bc !== 'object') return bc
      const crumb = { ...(bc as Record<string, unknown>) }
      if (crumb.data && typeof crumb.data === 'object') {
        crumb.data = scrubObject(crumb.data as Record<string, unknown>)
      }
      if (typeof crumb.message === 'string') crumb.message = scrubString(crumb.message)
      return crumb
    })
  }
  return event
}
