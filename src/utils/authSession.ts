/**
 * Stratégie refresh JWT web :
 * - prod (`import.meta.env.PROD`) : refresh HttpOnly cookie (backend JWT_AUTH_HTTPONLY=True)
 * - dev : fallback localStorage `fotoce_refresh_token` (backend JWT_AUTH_HTTPONLY=False)
 */

import {
  clearRefreshTokens,
  readRefreshToken,
  writeRefreshToken,
} from './authStorage'

export const USE_HTTPONLY_REFRESH_COOKIE = import.meta.env.PROD

export function readStoredRefreshToken(): string | null {
  if (USE_HTTPONLY_REFRESH_COOKIE || typeof window === 'undefined') return null
  return readRefreshToken()
}

export function storeRefreshToken(refresh: string | undefined | null): void {
  if (USE_HTTPONLY_REFRESH_COOKIE || !refresh || typeof window === 'undefined') return
  writeRefreshToken(refresh)
}

export function clearStoredRefreshToken(): void {
  if (typeof window === 'undefined') return
  clearRefreshTokens()
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
