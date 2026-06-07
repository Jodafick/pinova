import { ref } from 'vue'
import { savePendingIntent } from '../lib/pendingIntentStorage'
import { trackEvent } from '../lib/analytics'
import {
  isReplayableGuestIntent,
  type GuestAuthPayload,
} from '../types/pendingIntent'

export type GuestAuthIntent = 'like' | 'save' | 'follow' | 'comment' | 'translate' | 'contest' | 'generic'

const open = ref(false)
const intent = ref<GuestAuthIntent>('generic')

export function useGuestAuthGate() {
  function promptGuest(i: GuestAuthIntent = 'generic', payload?: GuestAuthPayload) {
    intent.value = i
    open.value = true
    if (i !== 'generic') {
      trackEvent('guest_action_blocked', {
        action: i,
        resource_id: payload?.resourceId?.trim() || undefined,
      })
    }
    if (payload?.resourceId?.trim() && isReplayableGuestIntent(i)) {
      const returnPath =
        typeof window !== 'undefined'
          ? `${window.location.pathname}${window.location.search}`
          : undefined
      const resourceId = payload.resourceId.trim()
      const pinScoped = i === 'like' || i === 'save' || i === 'comment' || i === 'translate'
      savePendingIntent({
        type: i,
        resourceId,
        metadata: {
          ...payload.metadata,
          ...(returnPath ? { returnPath } : {}),
          ...(pinScoped && !payload.metadata?.pinSlug ? { pinSlug: resourceId } : {}),
        },
      })
    }
  }

  function closeGuestGate() {
    open.value = false
  }

  return { guestGateOpen: open, guestGateIntent: intent, promptGuest, closeGuestGate }
}
