import { describe, expect, it } from 'vitest'

import { scrubSentryEvent, SENTRY_REDACTED } from './sentryScrub'

describe('scrubSentryEvent', () => {
  it('redacts tokens and emails', () => {
    const event = {
      request: {
        headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig' },
        data: { email: 'alice@test.invalid', refresh: 'refresh-secret' },
      },
      user: { email: 'alice@test.invalid', id: '1' },
      breadcrumbs: [{ message: 'contact alice@test.invalid', data: { access: 'tok' } }],
    }
    const out = scrubSentryEvent(event)
    expect(out?.request?.headers?.Authorization).toContain(SENTRY_REDACTED)
    expect((out?.request as { data: { email: string } }).data.email).toBe(SENTRY_REDACTED)
    expect((out?.request as { data: { refresh: string } }).data.refresh).toBe(SENTRY_REDACTED)
    expect(out?.user?.email).toBe(SENTRY_REDACTED)
    expect(out?.breadcrumbs?.[0]?.message).not.toContain('@test.invalid')
  })
})
