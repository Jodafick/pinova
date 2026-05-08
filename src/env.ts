export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://pinova-backend-4dt4.onrender.com'
export const API_URL = `${API_BASE_URL.replace(/\/$/, '')}/api/`

/** E-mail affiché sur la page Contact (surcharge `VITE_CONTACT_EMAIL`). */
export const CONTACT_EMAIL = (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim() || 'contact@pinova.app'

/** Client OAuth public Google — surcharger avec `VITE_GOOGLE_CLIENT_ID` en prod. */
export const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '274683910451-u52eib3lr7t5qehu23bhnafn85ovaub3.apps.googleusercontent.com'

/** Google OAuth — aligné backend : openid + userinfo.email + userinfo.profile uniquement. */
export const GOOGLE_SIGN_IN_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ')
