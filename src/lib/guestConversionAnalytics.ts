import { guestConversionPropsFromIntent } from '@pinova/shared'
import { peekPendingIntent } from './pendingIntentStorage'

/** Propriétés PostHog pour relier guest_action_blocked → register_completed. */
export function guestConversionProps(): Record<string, unknown> {
  return guestConversionPropsFromIntent(peekPendingIntent())
}
