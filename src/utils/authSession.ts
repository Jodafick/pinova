import api from '../api'

export function persistAuthTokens(access: string | undefined, refresh: string | undefined) {
  if (typeof window === 'undefined') return
  if (access) {
    window.localStorage.setItem('pinova_token', access)
    api.defaults.headers.common.Authorization = `Bearer ${access}`
  }
  if (refresh) window.localStorage.setItem('pinova_refresh_token', refresh)
}
