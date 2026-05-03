import axios from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { API_URL } from './env';
import { scheduleNotificationRefreshFromApi } from './notificationRefresh';

export const AUTH_INVALIDATED_EVENT = 'pinova-auth-invalidated'

const REFRESH_LEEWAY_SEC = 120

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

/** Ne pas boucler ni surcharger au chargement liste / marquage notifications. */
function shouldRefreshNotificationsAfterResponse(config: InternalAxiosRequestConfig) {
  const url = String(config.url || '')
  if (!url || url.includes('notifications/')) return false
  if (typeof window === 'undefined' || !window.localStorage.getItem('pinova_token')) return false
  return true
}

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

function clearStoredTokens() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem('pinova_token')
  window.localStorage.removeItem('pinova_refresh_token')
  delete api.defaults.headers.common.Authorization
  window.dispatchEvent(new Event(AUTH_INVALIDATED_EVENT))
}

/**
 * Avant le premier `me/`, rafraîchit l’accès si le JWT est absent, expiré ou proche de l’expiration.
 * Utilise une requête axios « nue » pour éviter une boucle avec l’intercepteur 401.
 */
export async function proactiveRefreshIfStale(): Promise<void> {
  if (typeof window === 'undefined') return
  const refresh = window.localStorage.getItem('pinova_refresh_token')
  if (!refresh) return

  const access = window.localStorage.getItem('pinova_token')
  const now = Math.floor(Date.now() / 1000)
  const exp = access ? decodeJwtExp(access) : null
  if (access && exp !== null && exp > now + REFRESH_LEEWAY_SEC) return

  try {
    const { data } = await axios.post<{ access?: string; refresh?: string }>(
      `${API_URL}auth/token/refresh/`,
      { refresh },
      { headers: { 'Content-Type': 'application/json' } },
    )
    const newAccess = data?.access
    const newRefresh = data?.refresh
    if (!newAccess) {
      clearStoredTokens()
      return
    }
    window.localStorage.setItem('pinova_token', newAccess)
    if (newRefresh) {
      window.localStorage.setItem('pinova_refresh_token', newRefresh)
    }
    api.defaults.headers.common.Authorization = `Bearer ${newAccess}`
  } catch {
    clearStoredTokens()
  }
}

api.interceptors.request.use((config) => {
  const existingAuth = config.headers?.Authorization
  if (existingAuth) return config

  const token = typeof window !== 'undefined' ? window.localStorage.getItem('pinova_token') : null
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => {
    if (response.config && shouldRefreshNotificationsAfterResponse(response.config)) {
      scheduleNotificationRefreshFromApi()
    }
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
    const requestUrl = originalRequest.url || ''
    const isRefreshRequest = requestUrl.includes('auth/token/refresh/')
    const isRetried = !!originalRequest._retry

    if (status === 401 && !isRefreshRequest && !isRetried) {
      const refreshToken = typeof window !== 'undefined' ? window.localStorage.getItem('pinova_refresh_token') : null
      if (!refreshToken) {
        clearStoredTokens()
        return Promise.reject(error)
      }

      originalRequest._retry = true
      try {
        const refreshResponse = await api.post('auth/token/refresh/', { refresh: refreshToken })
        const newAccess = refreshResponse.data?.access
        const newRefresh = refreshResponse.data?.refresh

        if (!newAccess) {
          clearStoredTokens()
          return Promise.reject(error)
        }

        if (typeof window !== 'undefined') {
          window.localStorage.setItem('pinova_token', newAccess)
          if (newRefresh) {
            window.localStorage.setItem('pinova_refresh_token', newRefresh)
          }
        }
        api.defaults.headers.common.Authorization = `Bearer ${newAccess}`
        originalRequest.headers = originalRequest.headers || {}
        originalRequest.headers.Authorization = `Bearer ${newAccess}`
        return api.request(originalRequest)
      } catch (refreshError) {
        clearStoredTokens()
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  },
)

export default api;
