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
