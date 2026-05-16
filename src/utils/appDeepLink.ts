import type { RouteLocationNormalized } from 'vue-router'

const APP_DEEP_LINK_SCHEME = (
  (import.meta.env.VITE_APP_DEEP_LINK_SCHEME as string | undefined)?.trim() || 'pinova'
).replace(/:\/\//g, '').replace(/:$/g, '')

const APP_DEEP_LINK_TIMEOUT_MS = 1200

/** iPhone / iPad / iPod : éviter `location.href = pinova://…` (Safari affiche souvent « adresse invalide » si l’app n’est pas installée). */
function isIosMobileUa(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/i.test(navigator.userAgent || '')
}

/**
 * Ouvre un deep link custom sans quitter la page WebKit (réduit les alertes Safari « adresse invalide »).
 */
function openCustomSchemeViaHiddenFrame(url: string): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return
  try {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.tabIndex = -1
    Object.assign(iframe.style, {
      position: 'fixed',
      width: '1px',
      height: '1px',
      opacity: '0',
      pointerEvents: 'none',
      border: '0',
      top: '0',
      left: '0',
    })
    iframe.src = url
    document.body.appendChild(iframe)
    window.setTimeout(() => {
      try {
        iframe.remove()
      } catch {
        /* ignore */
      }
    }, 2000)
  } catch {
    /* ignore */
  }
}

/**
 * Navigation vers une URL absolue https ou vers un schéma custom (ex. `pinova://`).
 * Sur iOS, les schémas custom passent par une iframe cachée pour limiter l’alerte Safari « adresse invalide ».
 */
export function openMobileDeepLink(url: string): void {
  if (typeof window === 'undefined') return
  const s = String(url || '').trim()
  if (!s) return
  try {
    const u = new URL(s)
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      window.location.href = u.href
      return
    }
    if (isIosMobileUa()) {
      openCustomSchemeViaHiddenFrame(u.href)
    } else {
      window.location.href = u.href
    }
  } catch {
    /* URL invalide — ne pas naviguer */
  }
}

function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
}

function getRouteParam(
  params: RouteLocationNormalized['params'],
  key: string,
): string | null {
  const value = params[key]
  if (typeof value === 'string' && value.trim()) return value.trim()
  return null
}

function buildScreenPath(route: RouteLocationNormalized): string | null {
  switch (route.name) {
    case 'home':
      return 'home'
    case 'notifications':
      return 'notifications'
    case 'contest-notifications':
      return 'contest/notifications'
    case 'explore':
      return 'explore'
    case 'explore-boards':
      return 'explore/boards'
    case 'following':
      return 'following'
    case 'pin-detail': {
      const slug = getRouteParam(route.params, 'slug')
      return slug ? `pin/${encodeURIComponent(slug)}` : null
    }
    case 'edit-pin': {
      const slug = getRouteParam(route.params, 'slug')
      return slug ? `pin/${encodeURIComponent(slug)}/edit` : null
    }
    case 'create':
      return 'create'
    case 'create-standalone-story':
      return 'story/create'
    case 'board': {
      const username = getRouteParam(route.params, 'username')
      const boardId = getRouteParam(route.params, 'boardId')
      return username && boardId
        ? `profile/${encodeURIComponent(username)}/board/${encodeURIComponent(boardId)}`
        : null
    }
    case 'profile': {
      const username = getRouteParam(route.params, 'username')
      return username ? `profile/${encodeURIComponent(username)}` : 'profile'
    }
    case 'settings':
      return 'settings'
    case 'billing':
      return 'billing'
    case 'premium':
      return 'premium'
    case 'creator':
      return 'creator'
    case 'contest-live':
      return 'contest/live'
    case 'contest-history':
      return 'contest/history'
    case 'referral-contest-live':
      return 'referrals/contest'
    case 'referral-invite':
      return 'referrals/invite'
    case 'referral-history':
      return 'referrals/history'
    case 'referral-notifications':
      return 'referrals/notifications'
    case 'login':
      return 'login'
    case 'register':
      return 'register'
    case 'forgot-password':
      return 'forgot-password'
    case 'verify-otp':
      return 'verify-otp'
    case 'verify-email': {
      const key = getRouteParam(route.params, 'key')
      return key ? `verify-email/${encodeURIComponent(key)}` : null
    }
    case 'password-reset-confirm': {
      const uid = getRouteParam(route.params, 'uid')
      const token = getRouteParam(route.params, 'token')
      return uid && token
        ? `password-reset-confirm/${encodeURIComponent(uid)}/${encodeURIComponent(token)}`
        : null
    }
    default:
      return null
  }
}

function hasTruthyQueryFlag(
  route: RouteLocationNormalized,
  key: string,
): boolean {
  const value = route.query[key]
  if (Array.isArray(value)) return value.some((v) => `${v}` === '1')
  return `${value ?? ''}` === '1'
}

function buildDeepLink(route: RouteLocationNormalized): string | null {
  const screenPath = buildScreenPath(route)
  if (!screenPath) return null

  const query = new URLSearchParams()
  for (const [key, rawValue] of Object.entries(route.query)) {
    if (key === 'openApp' || key === 'web') continue
    if (Array.isArray(rawValue)) {
      rawValue.forEach((value) => {
        if (value != null) query.append(key, String(value))
      })
      continue
    }
    if (rawValue != null) query.append(key, String(rawValue))
  }

  const qs = query.toString()
  return `${APP_DEEP_LINK_SCHEME}://${screenPath}${qs ? `?${qs}` : ''}`
}

export function maybeRedirectWebToApp(route: RouteLocationNormalized): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  if (!isMobileBrowser()) return
  if (hasTruthyQueryFlag(route, 'web')) return

  const explicitOpen = hasTruthyQueryFlag(route, 'openApp')

  const deepLink = buildDeepLink(route)
  if (!deepLink) return

  try {
    const probe = new URL(deepLink)
    const expectedScheme = `${APP_DEEP_LINK_SCHEME.toLowerCase()}:`
    if (probe.protocol.toLowerCase() !== expectedScheme) return
  } catch {
    return
  }

  const cacheKey = `pinova:web-to-app-skip:${String(route.name ?? route.path)}`
  if (!explicitOpen && window.sessionStorage.getItem(cacheKey) === '1') return

  let didHide = false
  const onVisibilityChange = () => {
    if (document.hidden) didHide = true
  }

  document.addEventListener('visibilitychange', onVisibilityChange)

  openMobileDeepLink(deepLink)

  window.setTimeout(() => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    if (!didHide) {
      // Evite de re-tenter en boucle si l'app n'est pas installée.
      window.sessionStorage.setItem(cacheKey, '1')
    }
  }, APP_DEEP_LINK_TIMEOUT_MS)
}
