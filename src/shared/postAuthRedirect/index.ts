import type { PendingIntent } from '../pendingIntent/index.js'
import { userNeedsOnboarding, type OnboardingUser } from '../profileExtended/index.js'

export function isSafeInternalPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//')
}

export type WebPostAuthResolveInput = {
  user?: OnboardingUser | null
  pendingIntent?: PendingIntent | null
  redirectQuery?: string | null | undefined
  defaultPath: string
  onboardingPath: string
}

/** Résout la destination post-auth web (chemin interne uniquement). */
export function resolveWebPostAuthPath(input: WebPostAuthResolveInput): string {
  if (userNeedsOnboarding(input.user)) {
    return input.onboardingPath
  }

  const pendingReturn = input.pendingIntent?.metadata?.returnPath?.trim()
  if (pendingReturn && isSafeInternalPath(pendingReturn)) {
    return pendingReturn
  }

  const raw = typeof input.redirectQuery === 'string' ? input.redirectQuery.trim() : ''
  if (raw) {
    try {
      const path = decodeURIComponent(raw)
      if (isSafeInternalPath(path)) return path
    } catch {
      /* ignore */
    }
  }

  return input.defaultPath
}

export type MobilePostAuthRoute =
  | { kind: 'onboarding' }
  | { kind: 'contest' }
  | { kind: 'follow'; username: string }
  | { kind: 'pin'; slug: string }
  | { kind: 'feed' }

export function resolveMobilePostAuthRoute(
  user: OnboardingUser | null | undefined,
  pending: PendingIntent | null,
): MobilePostAuthRoute {
  if (userNeedsOnboarding(user)) return { kind: 'onboarding' }
  if (pending?.type === 'contest') return { kind: 'contest' }
  if (pending?.type === 'follow') return { kind: 'follow', username: pending.resourceId }

  const pinSlug = pending?.metadata?.pinSlug || pending?.resourceId
  if (pinSlug && pending) return { kind: 'pin', slug: pinSlug }

  return { kind: 'feed' }
}

export function guestConversionPropsFromIntent(
  pending: PendingIntent | null | undefined,
): Record<string, unknown> {
  if (!pending) return { from_guest_conversion: false }
  return {
    from_guest_conversion: true,
    guest_action: pending.type,
    guest_resource_id: pending.resourceId,
  }
}
