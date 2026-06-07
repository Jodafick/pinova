import { trackEvent, trackOnce } from './analytics'
import { getFeatureFlagVariant } from './featureFlags'

export type OnboardingFlowVersion = 'v1' | 'v2'

function baseProps(version: OnboardingFlowVersion) {
  return {
    flow_version: version,
    onboarding_v2: version === 'v2',
    feature_flag_onboarding_v2: getFeatureFlagVariant('onboarding_v2'),
  }
}

export function trackOnboardingStarted(version: OnboardingFlowVersion): void {
  trackOnce('onboarding_started', baseProps(version))
}

export function trackOnboardingStepViewed(
  stepId: string,
  stepIndex: number,
  version: OnboardingFlowVersion,
): void {
  trackEvent('onboarding_step_viewed', {
    step_id: stepId,
    step_index: stepIndex,
    ...baseProps(version),
  })
}

export function trackOnboardingStepCompleted(
  stepId: string,
  stepIndex: number,
  version: OnboardingFlowVersion,
  extra?: Record<string, unknown>,
): void {
  trackEvent('onboarding_step_completed', {
    step_id: stepId,
    step_index: stepIndex,
    ...baseProps(version),
    ...extra,
  })
}

export function trackOnboardingStepSkipped(
  stepId: string,
  stepIndex: number,
  version: OnboardingFlowVersion,
): void {
  trackEvent('onboarding_step_skipped', {
    step_id: stepId,
    step_index: stepIndex,
    ...baseProps(version),
  })
}

export function trackOnboardingCompleted(
  version: OnboardingFlowVersion,
  props: {
    interestsCount: number
    followedCreatorsCount: number
    skippedLocation?: boolean
    deferred?: boolean
  },
): void {
  trackOnce('onboarding_completed', {
    ...baseProps(version),
    interests_count: props.interestsCount,
    followed_creators_count: props.followedCreatorsCount,
    skipped_location: !!props.skippedLocation,
    deferred: !!props.deferred,
  })
}
