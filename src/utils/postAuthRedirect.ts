import type { Router } from 'vue-router'
import type { User } from '../types'
import { peekPendingIntent } from '../lib/pendingIntentStorage'
import { getPostAuthRouteName } from './onboarding'
import { resolveWebPostAuthPath } from '@pinova/shared'

const SKIP_SPLASH_FLAG = 'pinova-skip-splash'

/**
 * Après connexion / inscription : navigation pleine page (pas de transition SPA)
 * pour réinitialiser l’état Vue Query, le splash et les guards avec les tokens frais.
 */
export function redirectAfterAuth(
  router: Router,
  opts: { user?: User | null; redirectQuery?: string | null | undefined },
): void {
  if (typeof window === 'undefined') return

  const defaultPath = router.resolve({ name: getPostAuthRouteName(opts.user) }).href
  const onboardingPath = router.resolve({ name: 'onboarding' }).href
  const href = resolveWebPostAuthPath({
    user: opts.user,
    pendingIntent: peekPendingIntent(),
    redirectQuery: opts.redirectQuery,
    defaultPath,
    onboardingPath,
  })

  try {
    sessionStorage.setItem(SKIP_SPLASH_FLAG, '1')
  } catch {
    /* ignore */
  }
  window.location.assign(href)
}
