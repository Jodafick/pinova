import { userNeedsOnboarding } from '@fotoce/shared'
import type { User } from '../types'

export { userNeedsOnboarding }

/** Destination après connexion / inscription (Google, e-mail, etc.). */
export function getPostAuthRouteName(user: User | null | undefined): 'onboarding' | 'home' {
  return userNeedsOnboarding(user) ? 'onboarding' : 'home'
}
