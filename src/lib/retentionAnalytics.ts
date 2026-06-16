import { trackOnce, type AnalyticsEvent } from './analytics'
import {
  syncRetentionCohortEvents,
  type RetentionCohortContext,
  type RetentionCohortProps,
} from '@fotoce/shared'

export type { RetentionCohortProps }

/** Cohortes J1/J7/J30 — propriétés PostHog + événements once, segmentées par canal. */
export function syncRetentionCohorts(ctx: RetentionCohortContext): RetentionCohortProps | null {
  return syncRetentionCohortEvents(ctx, (event, props) =>
    trackOnce(event as AnalyticsEvent, props),
  )
}
