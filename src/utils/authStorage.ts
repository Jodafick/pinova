/** Clés localStorage auth — dual pinova/fotoce le temps de la transition infra. */
const ACCESS_TOKEN_KEYS = ['fotoce_token', 'pinova_token'] as const
const REFRESH_TOKEN_KEYS = ['fotoce_refresh_token', 'pinova_refresh_token'] as const

export function readAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  for (const key of ACCESS_TOKEN_KEYS) {
    const value = window.localStorage.getItem(key)
    if (value) return value
  }
  return null
}

export function writeAccessToken(token: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem('fotoce_token', token)
  window.localStorage.setItem('pinova_token', token)
}

export function clearAccessTokens(): void {
  if (typeof window === 'undefined') return
  for (const key of ACCESS_TOKEN_KEYS) {
    window.localStorage.removeItem(key)
  }
}

export function readRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  for (const key of REFRESH_TOKEN_KEYS) {
    const value = window.localStorage.getItem(key)
    if (value) return value
  }
  return null
}

export function writeRefreshToken(token: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem('fotoce_refresh_token', token)
  window.localStorage.setItem('pinova_refresh_token', token)
}

export function clearRefreshTokens(): void {
  if (typeof window === 'undefined') return
  for (const key of REFRESH_TOKEN_KEYS) {
    window.localStorage.removeItem(key)
  }
}
