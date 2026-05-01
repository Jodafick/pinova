import axios from 'axios';
import { API_URL } from './env';

export const AUTH_INVALIDATED_EVENT = 'pinova-auth-invalidated'

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const PUBLIC_AUTH_PATH_PREFIXES = [
  'auth/login/',
  'auth/registration/',
  'auth/registration/verify-email/',
  'auth/social/',
  'auth/password/reset/',
  'auth/password/reset/confirm/',
  'verify-otp/',
  'resend-otp/',
]

const PRIVATE_GET_PATH_PREFIXES = [
  'me/',
  'boards/',
  'notifications/',
  'conversations/',
  'pins/recommendations/',
]

function shouldSkipBearerForRequest(url?: string, method?: string) {
  if (!url) return false
  if (!PUBLIC_AUTH_PATH_PREFIXES.some((prefix) => url.includes(prefix))) {
    return false
  }
  return method !== 'post' || !url.includes('auth/logout/')
}

function shouldAttachBearer(url?: string, method?: string) {
  if (!url) return false
  if (method && ['post', 'put', 'patch', 'delete'].includes(method)) return true
  if (url.includes('/private-tags/')) return true
  return PRIVATE_GET_PATH_PREFIXES.some((prefix) => url.includes(prefix))
}

api.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase()

  if (shouldSkipBearerForRequest(config.url, method) || !shouldAttachBearer(config.url, method)) {
    if (config.headers?.Authorization) {
      delete config.headers.Authorization
    }
    return config
  }

  const existingAuth = config.headers?.Authorization
  if (existingAuth) return config

  const token = typeof window !== 'undefined' ? window.localStorage.getItem('pinova_token') : null
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status
    const code = error?.response?.data?.code

    if (status === 401 && code === 'user_not_found' && typeof window !== 'undefined') {
      window.localStorage.removeItem('pinova_token')
      window.localStorage.removeItem('pinova_refresh_token')
      delete api.defaults.headers.common.Authorization
      window.dispatchEvent(new Event(AUTH_INVALIDATED_EVENT))
    }

    return Promise.reject(error)
  },
)

export default api;
