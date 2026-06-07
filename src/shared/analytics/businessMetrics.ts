/** Helpers propriétés PostHog — funnels business & KPIs. */

export type SignupPlatform = 'web' | 'mobile'
export type SignupChannel = 'web' | 'mobile' | 'referral' | 'organic'

export function resolveSignupChannel(
  platform: SignupPlatform,
  refCode?: string | null,
): SignupChannel {
  if (refCode?.trim()) return 'referral'
  return platform
}

export function buildRegisterAnalyticsProps(opts: {
  platform: SignupPlatform
  refCode?: string | null
  guestConversion?: Record<string, unknown>
}): Record<string, unknown> {
  const ref = opts.refCode?.trim() || ''
  return {
    ...(opts.guestConversion || {}),
    signup_platform: opts.platform,
    signup_channel: resolveSignupChannel(opts.platform, ref),
    ref_code: ref || undefined,
    has_ref_code: !!ref,
  }
}

export function buildReferralLinkOpenedProps(refCode: string, source?: string): Record<string, unknown> {
  return {
    ref_code: refCode,
    referral_source: source || 'link',
  }
}

export function buildLandingViewedProps(path = '/'): Record<string, unknown> {
  return { path, page: 'home_landing' }
}

/** checkout_success côté client — ne pas utiliser pour ARPU (filtrer revenue_source=fedapay_webhook). */
export function buildCheckoutSuccessClientProps(
  flow: string,
  funnelProps: Record<string, string | number>,
  platform: SignupPlatform,
): Record<string, unknown> {
  return {
    ...funnelProps,
    flow,
    tracking_role: 'funnel',
    revenue_source: 'client_estimate',
    signup_platform: platform,
  }
}

export type RetentionCohortContext = {
  dateJoinedIso?: string | null
  signupPlatform?: SignupPlatform
  signupChannel?: SignupChannel
  refCode?: string | null
}

export type RetentionCohortProps = {
  signup_date: string
  days_since_signup: number
  retention_cohort_j1: boolean
  retention_cohort_j7: boolean
  retention_cohort_j30: boolean
  signup_platform?: SignupPlatform
  signup_channel?: SignupChannel
  ref_code?: string
}

function daysSince(isoDate: string): number {
  const joined = new Date(isoDate)
  if (Number.isNaN(joined.getTime())) return 0
  return Math.max(0, Math.floor((Date.now() - joined.getTime()) / 86_400_000))
}

export function buildRetentionCohortProps(ctx: RetentionCohortContext): RetentionCohortProps | null {
  const iso = ctx.dateJoinedIso?.trim()
  if (!iso) return null
  const days = daysSince(iso)
  const channel =
    ctx.signupChannel ||
    (ctx.signupPlatform ? resolveSignupChannel(ctx.signupPlatform, ctx.refCode) : undefined)
  return {
    signup_date: iso,
    days_since_signup: days,
    retention_cohort_j1: days >= 1,
    retention_cohort_j7: days >= 7,
    retention_cohort_j30: days >= 30,
    signup_platform: ctx.signupPlatform,
    signup_channel: channel,
    ref_code: ctx.refCode?.trim() || undefined,
  }
}

export function retentionCohortEventProps(props: RetentionCohortProps): Record<string, unknown> {
  return {
    days_since_signup: props.days_since_signup,
    signup_platform: props.signup_platform,
    signup_channel: props.signup_channel,
    ref_code: props.ref_code,
  }
}

/** Émet les events retention_cohort_* (once) via le tracker plateforme. */
export function syncRetentionCohortEvents(
  ctx: RetentionCohortContext,
  trackOnce: (event: string, props: Record<string, unknown>) => void,
): RetentionCohortProps | null {
  const props = buildRetentionCohortProps(ctx)
  if (!props) return null
  const eventProps = retentionCohortEventProps(props)
  if (props.retention_cohort_j1) {
    trackOnce('retention_cohort_j1', eventProps)
  }
  if (props.retention_cohort_j7) {
    trackOnce('retention_cohort_j7', eventProps)
  }
  if (props.retention_cohort_j30) {
    trackOnce('retention_cohort_j30', eventProps)
  }
  return props
}
