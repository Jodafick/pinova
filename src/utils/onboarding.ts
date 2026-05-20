import type { User } from '../types'

export function userNeedsOnboarding(user: User | null | undefined): boolean {
  if (!user) return false
  return !user.onboardingCompletedAt
}
