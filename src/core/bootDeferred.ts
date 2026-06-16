/**
 * Initialisation différée post-first-paint (idle / interaction).
 */
import type { App } from 'vue'
import type { Router } from 'vue-router'
import { initPerfMonitor } from './perfMonitor'
import { initPerformanceEngine } from './performanceEngine'
import { initUxOrchestrator } from './uxOrchestrator'
import { initMediaEngine } from '../media'
import { initAnalytics } from '../lib/analytics'
import { initAnalyticsBridge } from '../lib/initAnalyticsBridge'
import { initSentryDeferred } from '../lib/sentry'
import { markBootPhase } from './bootMarks'

let scheduled = false

export function scheduleDeferredBoot(app: App, router: Router): void {
  if (scheduled) return
  scheduled = true

  const run = () => {
    markBootPhase('deferred_start')
    initPerfMonitor()
    initPerformanceEngine()
    void initMediaEngine().catch((err) => console.warn('[Fotoce] initMediaEngine', err))
    initUxOrchestrator(router)
    initSentryDeferred(app, router)
    initAnalytics({ platform: 'web' })
    initAnalyticsBridge()
    markBootPhase('deferred_done')
  }

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 2800 })
  } else {
    setTimeout(run, 120)
  }
}
