/** Branche les événements uxOrchestrator (nav / layers) vers PostHog. */
import { uxOrchestrator } from '../core/uxOrchestrator'
import { trackEvent, trackPageview } from './analytics'

export function initAnalyticsBridge(): void {
  uxOrchestrator.on('nav:end', ({ to, from, direction }) => {
    trackPageview(to, { from, direction })
    trackEvent('ux_nav_end', { to, from, direction })
  })

  uxOrchestrator.on('layer:push', ({ id, presentation, depth }) => {
    trackEvent('ux_layer_push', { layer_id: id, presentation, depth })
  })

  uxOrchestrator.on('layer:pop', ({ id, depth }) => {
    trackEvent('ux_layer_pop', { layer_id: id, depth })
  })
}
