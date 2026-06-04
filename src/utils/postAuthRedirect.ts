import type { Router } from 'vue-router'
import type { User } from '../types'
import { getPostAuthRouteName, userNeedsOnboarding } from './onboarding'

const SKIP_SPLASH_FLAG = 'pinova-skip-splash'

function isSafeInternalPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//')
}

/**
 * Après connexion / inscription : navigation pleine page (pas de transition SPA)
 * pour réinitialiser l’état Vue Query, le splash et les guards avec les tokens frais.
 */
export function redirectAfterAuth(
  router: Router,
  opts: { user?: User | null; redirectQuery?: string | null | undefined },
): void {
  if (typeof window === 'undefined') return

  let href = router.resolve({ name: getPostAuthRouteName(opts.user) }).href
  if (userNeedsOnboarding(opts.user)) {
    href = router.resolve({ name: 'onboarding' }).href
  } else {
    const raw = typeof opts.redirectQuery === 'string' ? opts.redirectQuery.trim() : ''
    if (raw) {
      try {
        const path = decodeURIComponent(raw)
        if (isSafeInternalPath(path)) href = path
      } catch {
        /* ignore */
      }
    }
  }

  try {
    sessionStorage.setItem(SKIP_SPLASH_FLAG, '1')
  } catch {
    /* ignore */
  }
  window.location.assign(href)
}
