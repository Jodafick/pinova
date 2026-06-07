import { describe, expect, it, beforeEach } from 'vitest'
import { guestConversionProps } from '../guestConversionAnalytics'
import {
  clearPendingIntent,
  peekPendingIntent,
  savePendingIntent,
} from '../pendingIntentStorage'
import { PENDING_INTENT_STORAGE_KEY } from '../../types/pendingIntent'

describe('guest conversion funnel', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('expose les propriétés PostHog quand un intent invité est en attente', () => {
    savePendingIntent({
      type: 'like',
      resourceId: 'test-pin-slug',
      metadata: { pinSlug: 'test-pin-slug' },
    })

    expect(guestConversionProps()).toEqual({
      from_guest_conversion: true,
      guest_action: 'like',
      guest_resource_id: 'test-pin-slug',
    })
  })

  it('persiste l’intent like pour replay après auth', () => {
    savePendingIntent({
      type: 'like',
      resourceId: 'summer-vibes',
      metadata: { pinSlug: 'summer-vibes', returnPath: '/pin/summer-vibes' },
    })

    const pending = peekPendingIntent()
    expect(pending?.type).toBe('like')
    expect(pending?.resourceId).toBe('summer-vibes')
    expect(pending?.metadata?.returnPath).toBe('/pin/summer-vibes')
    expect(sessionStorage.getItem(PENDING_INTENT_STORAGE_KEY)).toBeTruthy()
  })

  it('retourne from_guest_conversion false sans intent', () => {
    clearPendingIntent()
    expect(guestConversionProps()).toEqual({ from_guest_conversion: false })
  })
})
