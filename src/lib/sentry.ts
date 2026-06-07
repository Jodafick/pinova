/**
 * Sentry crash reporting — web (@sentry/vue).
 * No-op si VITE_SENTRY_DSN absent.
 */
import * as Sentry from '@sentry/vue'
import type { App } from 'vue'
import type { Router } from 'vue-router'

import { registerLongTaskReporter } from '../core/perfMonitor'
import { scrubSentryEvent } from './sentryScrub'

const DSN = (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim() || ''
const RELEASE = (import.meta.env.VITE_SENTRY_RELEASE as string | undefined)?.trim() || undefined

let initialized = false

export function setSentryRequestId(requestId: string | null | undefined): void {
  if (!initialized || !requestId) return
  Sentry.setTag('request_id', requestId)
}

export function initSentry(app: App, router: Router): void {
  if (initialized || !DSN) return
  initialized = true

  Sentry.init({
    app,
    dsn: DSN,
    environment: import.meta.env.MODE,
    release: RELEASE,
    integrations: [
      Sentry.browserTracingIntegration({ router }),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1,
    replaysSessionSampleRate: import.meta.env.PROD ? 0.05 : 0,
    replaysOnErrorSampleRate: import.meta.env.PROD ? 1 : 0,
    beforeSend(event) {
      return scrubSentryEvent(event)
    },
  })

  registerLongTaskReporter((durationMs, name) => {
    Sentry.addBreadcrumb({
      category: 'performance.longtask',
      message: name ? `longtask:${name}` : 'longtask',
      level: durationMs >= 100 ? 'warning' : 'info',
      data: { duration_ms: Math.round(durationMs) },
    })
  })
}

export function setSentryUser(user: { id: number; username?: string } | null): void {
  if (!initialized) return
  if (!user) {
    Sentry.setUser(null)
    return
  }
  Sentry.setUser({ id: String(user.id), username: user.username })
}

export { Sentry }
