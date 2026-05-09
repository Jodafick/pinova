import { watch } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'

import api from '../api'
import { ensureDeviceBindingId } from '../utils/deviceBinding'

const SESSION_CODE_KEY = 'pinova_referral_pending_code'

function normalizeReferralCode(raw: unknown): string {
  if (raw == null) return ''
  const s = String(raw).trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  return s.slice(0, 16)
}

/**
 * Lit le code referral en attente (sessionStorage), pour l’inscription / OAuth.
 */
export function getStoredReferralCode(): string {
  if (typeof window === 'undefined') return ''
  try {
    return normalizeReferralCode(window.sessionStorage.getItem(SESSION_CODE_KEY))
  } catch {
    return ''
  }
}

export function setStoredReferralCode(code: string) {
  if (typeof window === 'undefined') return
  const c = normalizeReferralCode(code)
  if (!c) return
  try {
    window.sessionStorage.setItem(SESSION_CODE_KEY, c)
  } catch {
    /* ignore quota */
  }
}

export function clearStoredReferralCode() {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(SESSION_CODE_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * `POST /api/referrals/intent/` — session cookie + device pour résolution à l’inscription.
 */
export async function postReferralIntent(code: string): Promise<boolean> {
  const c = normalizeReferralCode(code)
  if (!c) return false
  ensureDeviceBindingId()
  try {
    await api.post('referrals/intent/', {
      code: c,
      ref: c,
      device_binding_id: ensureDeviceBindingId(),
    })
    return true
  } catch {
    return false
  }
}

function readRefFromRoute(route: RouteLocationNormalizedLoaded): string {
  const q = route.query || {}
  const raw = q.ref ?? q.referral_code ?? q.invite
  if (Array.isArray(raw)) return normalizeReferralCode(raw[0])
  return normalizeReferralCode(raw)
}

/**
 * À appeler depuis un composant racine : capte `?ref=` sur toute navigation.
 */
export function watchRouteForReferralIntent(routeRef: () => RouteLocationNormalizedLoaded) {
  watch(
    () => {
      const r = routeRef()
      return readRefFromRoute(r)
    },
    (code) => {
      if (!code) return
      setStoredReferralCode(code)
      void postReferralIntent(code)
    },
    { immediate: true },
  )
}
