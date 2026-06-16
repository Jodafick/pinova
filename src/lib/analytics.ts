import { createSyncAnalyticsClient, type AnalyticsEvent, type CheckoutFlow, type SubscriptionPlan } from '@fotoce/shared'

export type { AnalyticsEvent, CheckoutFlow, SubscriptionPlan }

const POSTHOG_HOST =
  (import.meta.env.VITE_POSTHOG_HOST as string | undefined)?.trim() || 'https://eu.i.posthog.com'
const POSTHOG_KEY = (import.meta.env.VITE_POSTHOG_KEY as string | undefined)?.trim() || ''

const webStorage =
  typeof window !== 'undefined'
    ? window.localStorage
    : {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      }

const client = createSyncAnalyticsClient(
  { posthogHost: POSTHOG_HOST, posthogKey: POSTHOG_KEY, platform: 'web' },
  webStorage,
)

export const {
  initAnalytics,
  applyPremiumTrackingPolicy,
  setAnalyticsConsent,
  hasAnalyticsConsent,
  identifyUser,
  resetAnalytics,
  trackEvent,
  trackOnce,
  trackPageview,
  isAnalyticsEnabled,
} = client

if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__fotoceAnalyticsTest = {
    trackEvent,
    trackOnce,
    isAnalyticsEnabled,
    hasAnalyticsConsent,
    setAnalyticsConsent,
  }
}
