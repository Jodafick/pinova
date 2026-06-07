/**
 * Stratégie refresh JWT web :
 * - prod (`import.meta.env.PROD`) : refresh HttpOnly cookie (backend JWT_AUTH_HTTPONLY=True)
 * - dev : fallback localStorage `pinova_refresh_token` (backend JWT_AUTH_HTTPONLY=False)
 */

export const USE_HTTPONLY_REFRESH_COOKIE = import.meta.env.PROD

const REFRESH_KEY = 'pinova_refresh_token'

export function readStoredRefreshToken(): string | null {
  if (USE_HTTPONLY_REFRESH_COOKIE || typeof window === 'undefined') return null
  return window.localStorage.getItem(REFRESH_KEY)
}

export function storeRefreshToken(refresh: string | undefined | null): void {
  if (USE_HTTPONLY_REFRESH_COOKIE || !refresh || typeof window === 'undefined') return
  window.localStorage.setItem(REFRESH_KEY, refresh)
}

export function clearStoredRefreshToken(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(REFRESH_KEY)
}

export function canAttemptCookieRefresh(): boolean {
  return USE_HTTPONLY_REFRESH_COOKIE
}

/** Corps POST refresh : cookie seul en prod, body en dev si token présent. */
export function buildRefreshRequestBody(refreshToken: string | null): Record<string, string> {
  if (refreshToken) return { refresh: refreshToken }
  return {}
}

export function shouldPersistRotatedRefresh(): boolean {
  return !USE_HTTPONLY_REFRESH_COOKIE
}
