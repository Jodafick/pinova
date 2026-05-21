import type { User } from '../types'

export function userNeedsOnboarding(user: User | null | undefined): boolean {
  if (!user) return false
  return !user.onboardingCompletedAt
}

/** Destination après connexion / inscription (Google, e-mail, etc.). */
export function getPostAuthRouteName(user: User | null | undefined): 'onboarding' | 'home' {
  return userNeedsOnboarding(user) ? 'onboarding' : 'home'
}
