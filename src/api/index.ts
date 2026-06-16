import axios from 'axios';
import { API_URL } from '../config/env';
import { getCurrentWebLang } from '../i18n';
import { ensureDeviceBindingId } from '../utils/deviceBinding';
import {
  API_DEVICE_BINDING_HEADER,
  API_LANG_HEADER,
  API_UNREAD_NOTIFICATIONS_HEADER,
} from '../constants/apiHeaders';
import {
  clearAccessTokens,
  readAccessToken,
  writeRefreshToken,
} from '../utils/authStorage';
import {
  buildRefreshRequestBody,
  canAttemptCookieRefresh,
  clearStoredRefreshToken,
  readStoredRefreshToken,
  shouldPersistRotatedRefresh,
  storeRefreshToken,
} from '../utils/authSession';
import {
  applyUnreadCountFromResponseHeader,
  UNREAD_NOTIFICATION_RESPONSE_HEADER,
} from '../lib/notificationRefresh';
import { createRequestId, REQUEST_ID_HEADER } from '../lib/requestId';
import { setSentryRequestId } from '../lib/sentry';

export const AUTH_INVALIDATED_EVENT = 'fotoce-auth-invalidated'

const REFRESH_LEEWAY_SEC = 120
let refreshInFlightPromise: Promise<string | null> | null = null

function decodeJwtExp(token: string): number | null {
  try {
    const parts = token.split('.')
    const payload = parts[1]
    if (parts.length !== 3 || !payload) return null
    let b64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4
    if (pad) b64 += '='.repeat(4 - pad)
    const json = JSON.parse(atob(b64)) as { exp?: number }
    return typeof json.exp === 'number' ? json.exp : null
  } catch {
    return null
  }
}

function readUnreadCountHeader(headers: unknown): string | undefined {
  if (!headers || typeof headers !== 'object') return undefined
  if (typeof (headers as { get?: (key: string) => unknown }).get === 'function') {
    const g = (headers as { get: (key: string) => unknown }).get.bind(headers) as (
      key: string,
    ) => unknown
    const v =
      g(UNREAD_NOTIFICATION_RESPONSE_HEADER) ??
      g(API_UNREAD_NOTIFICATIONS_HEADER)
    return typeof v === 'string' ? v : undefined
  }
  const h = headers as Record<string, string>
  return (
    h[UNREAD_NOTIFICATION_RESPONSE_HEADER] ?? h[API_UNREAD_NOTIFICATIONS_HEADER] ?? undefined
  )
}

/** Évite un chargement infini si l’API ne répond pas (pas de timeout par défaut dans axios). */
const API_REQUEST_TIMEOUT_MS = 45_000

const api = axios.create({
  baseURL: API_URL,
  timeout: API_REQUEST_TIMEOUT_MS,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

function clearStoredTokens() {
  if (typeof window === 'undefined') return
  clearAccessTokens()
  clearStoredRefreshToken()
  delete api.defaults.headers.common.Authorization
  window.dispatchEvent(new Event(AUTH_INVALIDATED_EVENT))
}

/** Comme Fotoce-Mobile : évite de tout effacer après un lag réseau / 5xx sur POST refresh. */
function shouldClearAuthAfterRefreshError(error: unknown): boolean {
  const e = error as { code?: unknown; message?: unknown; response?: { status?: number } }
  const status = e.response?.status
  const code = String(e.code || '')
  const message = String(e.message || '').toLowerCase()
  if (status === 400 || status === 401) return true
  if (status !== undefined && status >= 500) return false
  if (
    code === 'ECONNABORTED' ||
    code === 'ETIMEDOUT' ||
    code === 'ERR_TIMEOUT' ||
    code === 'ERR_NETWORK' ||
    message.includes('timeout') ||
    message.includes('network')
  ) {
    return false
  }
  return false
}

async function refreshAccessWithSingleFlight(refreshToken: string | null): Promise<string | null> {
  if (!refreshToken && !canAttemptCookieRefresh()) return null
  if (refreshInFlightPromise) return refreshInFlightPromise
  refreshInFlightPromise = (async () => {
    try {
      const deviceId = typeof window !== 'undefined' ? ensureDeviceBindingId() : ''
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (deviceId) headers[API_DEVICE_BINDING_HEADER] = deviceId
      const lc = getCurrentWebLang()
      headers[API_LANG_HEADER] = lc
      headers['Accept-Language'] =
        lc === 'en' ? 'en, fr;q=0.82' : lc === 'fon' ? 'fon, fr;q=0.92' : 'fr, en;q=0.6'
      headers[REQUEST_ID_HEADER] = createRequestId()

      const { data } = await axios.post<{ access?: string; refresh?: string }>(
        `${API_URL}auth/token/refresh/`,
        buildRefreshRequestBody(refreshToken),
        {
          headers,
          timeout: API_REQUEST_TIMEOUT_MS,
          withCredentials: true,
        },
      )
      const newAccess = data?.access
      const newRefresh = data?.refresh
      if (!newAccess) {
        clearStoredTokens()
        return null
      }
      if (typeof window !== 'undefined') {
        writeAccessToken(newAccess)
        if (newRefresh && shouldPersistRotatedRefresh()) {
          storeRefreshToken(newRefresh)
        }
      }
      api.defaults.headers.common.Authorization = `Bearer ${newAccess}`
      return newAccess
    } catch (error) {
      if (shouldClearAuthAfterRefreshError(error)) {
        clearStoredTokens()
      }
      return null
    } finally {
      refreshInFlightPromise = null
    }
  })()
  return refreshInFlightPromise
}

/**
 * Avant le premier `me/`, rafraîchit l’accès si le JWT est absent, expiré ou proche de l’expiration.
 * Utilise une requête axios « nue » pour éviter une boucle avec l’intercepteur 401.
 */
export async function proactiveRefreshIfStale(): Promise<void> {
  if (typeof window === 'undefined') return
  const refresh = readStoredRefreshToken()
  if (!refresh && !canAttemptCookieRefresh()) return

  const access = readAccessToken()
  const now = Math.floor(Date.now() / 1000)
  const exp = access ? decodeJwtExp(access) : null
  if (access && exp !== null && exp > now + REFRESH_LEEWAY_SEC) return

  await refreshAccessWithSingleFlight(refresh)
}

api.interceptors.request.use((config) => {
  const lc = getCurrentWebLang()
  config.headers = config.headers ?? {}
  const hdr = config.headers as Record<string, string>
  hdr[API_LANG_HEADER] = lc
  hdr['Accept-Language'] =
    lc === 'en' ? 'en, fr;q=0.82' : lc === 'fon' ? 'fon, fr;q=0.92' : 'fr, en;q=0.6'

  const requestId = createRequestId()
  hdr[REQUEST_ID_HEADER] = requestId
  setSentryRequestId(requestId)

  const method = String(config.method || 'get').toLowerCase()
  if (method === 'get') {
    const params = (config.params || {}) as Record<string, unknown>
    if (params.lang == null || params.lang === '') {
      config.params = { ...params, lang: getCurrentWebLang() }
    }
  }

  /** FormData + `Content-Type: application/json` (défaut axios) = pas de boundary multipart → champs ignorés (ex. `parentId`). */
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    const h = config.headers
    if (h && typeof (h as { delete?: (key: string) => void }).delete === 'function') {
      ;(h as { delete: (key: string) => void }).delete('Content-Type')
      ;(h as { delete: (key: string) => void }).delete('content-type')
    } else if (h && typeof h === 'object') {
      delete (h as Record<string, unknown>)['Content-Type']
      delete (h as Record<string, unknown>)['content-type']
    }
  }

  const existingAuth = config.headers?.Authorization
  if (existingAuth) return config

  let token = typeof window !== 'undefined' ? readAccessToken() : null
  if (token) {
    const exp = decodeJwtExp(token)
    const now = Math.floor(Date.now() / 1000)
    const expired = exp !== null && exp <= now
    if (expired) {
      const refresh = readStoredRefreshToken()
      if (!refresh && !canAttemptCookieRefresh()) {
        if (typeof window !== 'undefined') {
          clearAccessTokens()
        }
        token = null
      }
    }
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  const deviceId = typeof window !== 'undefined' ? ensureDeviceBindingId() : ''
  if (deviceId) {
    config.headers[API_DEVICE_BINDING_HEADER] = deviceId
  }
  return config
})

api.interceptors.response.use(
  (response) => {
    const rid =
      response.headers?.[REQUEST_ID_HEADER] ??
      response.headers?.['x-request-id']
    if (typeof rid === 'string' && rid) setSentryRequestId(rid)
    const hc = readUnreadCountHeader(response.headers)
    applyUnreadCountFromResponseHeader(hc)
    return response
  },
  async (error) => {
    const status = error?.response?.status
    const code = error?.response?.data?.code

    if (status === 401 && code === 'user_not_found') {
      clearStoredTokens()
      return Promise.reject(error)
    }

    const originalRequest = error?.config || {}
    const requestUrl =
      `${String(originalRequest.baseURL ?? '')}${String(originalRequest.url ?? '')}`
    const isRefreshRequest = requestUrl.includes('auth/token/refresh/')
    const isRetried = !!originalRequest._retry
    const isAnonRetried = !!originalRequest._retryAnon
    const skipRefreshRetry =
      requestUrl.includes('auth/login/') ||
      requestUrl.includes('auth/registration/') ||
      requestUrl.includes('token/verify/')
    if (
      status === 401 &&
      !isRefreshRequest &&
      !isRetried &&
      !isAnonRetried &&
      !skipRefreshRetry
    ) {
      const refreshToken = readStoredRefreshToken()
      if (!refreshToken && !canAttemptCookieRefresh()) {
        if (!originalRequest._retryAnon) {
          originalRequest._retryAnon = true
          clearStoredTokens()
          originalRequest.headers = originalRequest.headers || {}
          delete originalRequest.headers.Authorization
          delete (originalRequest.headers as Record<string, unknown>)['authorization']
          try {
            return await api.request(originalRequest)
          } catch (anonErr) {
            return Promise.reject(anonErr)
          }
        }
        clearStoredTokens()
        return Promise.reject(error)
      }

      originalRequest._retry = true
      const newAccess = await refreshAccessWithSingleFlight(refreshToken)
      if (!newAccess) {
        return Promise.reject(error)
      }
      try {
        originalRequest.headers = originalRequest.headers || {}
        originalRequest.headers.Authorization = `Bearer ${newAccess}`
        return api.request(originalRequest)
      } catch (retryErr) {
        const st = (retryErr as { response?: { status?: number } })?.response?.status
        if (st === 401) clearStoredTokens()
        return Promise.reject(retryErr)
      }
    }

    return Promise.reject(error)
  },
)

export default api;
