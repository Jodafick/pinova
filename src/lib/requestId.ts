/** Identifiant de corrélation requête — header X-Request-ID (front → backend → Sentry). */

export function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

export const REQUEST_ID_HEADER = 'X-Request-ID'
