const DEFAULT_PROD_API = 'https://fotoce-backend-8mlq.onrender.com'

/** En e2e Playwright : requêtes same-origin `/api/` proxifiées par Vite. */
export const API_BASE_URL =
  import.meta.env.VITE_E2E_LOCAL_API === 'true' || import.meta.env.MODE === 'e2e'
    ? ''
    : import.meta.env.VITE_API_BASE_URL || DEFAULT_PROD_API
export const API_URL = API_BASE_URL ? `${API_BASE_URL.replace(/\/$/, '')}/api/` : '/api/'

/** E-mail affiché sur la page Contact (surcharge `VITE_CONTACT_EMAIL`). */
export const CONTACT_EMAIL = (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim() || 'contact@fotoce.app'

/** Client OAuth public Google — surcharger avec `VITE_GOOGLE_CLIENT_ID` en prod. */
export const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '274683910451-u52eib3lr7t5qehu23bhnafn85ovaub3.apps.googleusercontent.com'

/** PostHog EU — analytics produit (`VITE_POSTHOG_KEY` requis en prod). */
export const POSTHOG_KEY = (import.meta.env.VITE_POSTHOG_KEY as string | undefined)?.trim() || ''
export const POSTHOG_HOST =
  (import.meta.env.VITE_POSTHOG_HOST as string | undefined)?.trim() || 'https://eu.i.posthog.com'

/** Sentry — crash reporting (`VITE_SENTRY_DSN` requis en prod). */
export const SENTRY_DSN = (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim() || ''
export const SENTRY_RELEASE = (import.meta.env.VITE_SENTRY_RELEASE as string | undefined)?.trim() || ''

/** Google OAuth — aligné backend : openid + userinfo.email + userinfo.profile uniquement. */
export const GOOGLE_SIGN_IN_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ')
