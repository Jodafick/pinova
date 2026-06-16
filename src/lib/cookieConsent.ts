import api from '../api/index'
import { setAnalyticsConsent } from './analytics'

export const COOKIE_CONSENT_STORAGE_KEY = 'fotoce_cookie_consent_v1'
export const COOKIE_CONSENT_DECIDED_KEY = 'fotoce_cookie_consent_decided'

export type CookieConsentChoice = {
  necessary: boolean
  analytics: boolean
  decidedAt: string
}

export function readLocalCookieConsent(): CookieConsentChoice | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CookieConsentChoice
    if (typeof parsed.analytics !== 'boolean') return null
    return { necessary: true, analytics: parsed.analytics, decidedAt: parsed.decidedAt || '' }
  } catch {
    return null
  }
}

export function hasCookieConsentDecision(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(COOKIE_CONSENT_DECIDED_KEY) === '1'
}

export function getAnonymousConsentId(): string {
  if (typeof window === 'undefined') return ''
  const existing = window.localStorage.getItem('fotoce_analytics_distinct_id')
  if (existing?.trim()) return existing.trim()
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `anon_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  window.localStorage.setItem('fotoce_analytics_distinct_id', id)
  return id
}

export function applyStoredCookieConsent(): void {
  const stored = readLocalCookieConsent()
  setAnalyticsConsent(!!stored?.analytics)
}

export async function persistCookieConsent(analytics: boolean): Promise<void> {
  const payload: CookieConsentChoice = {
    necessary: true,
    analytics,
    decidedAt: new Date().toISOString(),
  }
  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(payload))
  window.localStorage.setItem(COOKIE_CONSENT_DECIDED_KEY, '1')
  setAnalyticsConsent(analytics)

  try {
    await api.post('account/consent/', {
      necessary: true,
      analytics,
      anonymous_id: getAnonymousConsentId(),
    })
  } catch {
    /* consent local conservé même si API indisponible */
  }
}
