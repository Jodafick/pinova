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
      resourceId: 'test-foto-slug',
      metadata: { fotoSlug: 'test-foto-slug' },
    })

    expect(guestConversionProps()).toEqual({
      from_guest_conversion: true,
      guest_action: 'like',
      guest_resource_id: 'test-foto-slug',
    })
  })

  it('persiste l’intent like pour replay après auth', () => {
    savePendingIntent({
      type: 'like',
      resourceId: 'summer-vibes',
      metadata: { fotoSlug: 'summer-vibes', returnPath: '/foto/summer-vibes' },
    })

    const pending = peekPendingIntent()
    expect(pending?.type).toBe('like')
    expect(pending?.resourceId).toBe('summer-vibes')
    expect(pending?.metadata?.returnPath).toBe('/foto/summer-vibes')
    expect(sessionStorage.getItem(PENDING_INTENT_STORAGE_KEY)).toBeTruthy()
  })

  it('retourne from_guest_conversion false sans intent', () => {
    clearPendingIntent()
    expect(guestConversionProps()).toEqual({ from_guest_conversion: false })
  })
})
