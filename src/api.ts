import axios from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { API_URL } from './env';
import { scheduleNotificationRefreshFromApi } from './notificationRefresh';

export const AUTH_INVALIDATED_EVENT = 'pinova-auth-invalidated'

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
