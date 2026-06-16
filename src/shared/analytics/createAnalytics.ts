export type AnalyticsEvent =
  | 'guest_action_blocked'
  | 'register_started'
  | 'register_completed'
  | 'otp_verified'
  | 'onboarding_started'
  | 'onboarding_step_viewed'
  | 'onboarding_step_completed'
  | 'onboarding_step_skipped'
  | 'onboarding_completed'
  | 'first_foto_published'
  | 'first_follow'
  | 'first_like'
  | 'first_save'
  | 'premium_viewed'
  | 'checkout_started'
  | 'checkout_returned'
  | 'checkout_success'
  | 'boost_started'
  | 'boost_purchased'
  | 'tip_sent'
  | 'campaign_launched'
  | 'foto_viewed'
  | 'foto_liked'
  | 'foto_saved'
  | 'search_performed'
  | 'ux_nav_end'
  | 'ux_layer_push'
  | 'ux_layer_pop'
  | 'retention_cohort_j1'
  | 'retention_cohort_j7'
  | 'retention_cohort_j30'
  | 'landing_viewed'
  | 'referral_link_opened'
  | 'register_with_ref_code'
  | 'revenue_recorded'
  | 'creator_suggestions_opened'
  | 'creator_followed_after_first_foto'
  | 'creator_level_progressed'
  | 'first_foto_confetti_shown'
  | 'first_foto_started'
  | 'payment_success_animation_shown'
  | 'premium_activated'
  | 'boost_activated'

export type SubscriptionPlan = 'free' | 'plus' | 'pro' | string

export interface AnalyticsStorage {
  getItem(key: string): string | null | Promise<string | null>
  setItem(key: string, value: string): void | Promise<void>
  removeItem(key: string): void | Promise<void>
}

export interface AnalyticsConfig {
  posthogHost: string
  posthogKey: string
  platform?: string
}

const STORAGE_DISTINCT = 'fotoce_analytics_distinct_id'
const STORAGE_ONCE_PREFIX = 'fotoce_analytics_once_'
const STORAGE_OPT_OUT = 'fotoce_analytics_opt_out'
const STORAGE_ANALYTICS_CONSENT = 'fotoce_analytics_consent'

function randomId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `anon_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function isPremiumNoTracking(plan?: SubscriptionPlan, isSeatMember?: boolean): boolean {
  if (isSeatMember) return true
  return plan === 'plus' || plan === 'pro'
}

export function createAnalyticsClient(config: AnalyticsConfig, storage: AnalyticsStorage) {
  let initialized = false
  let optOut = false
  let distinctId = ''
  let platform = config.platform || 'web'

  async function readStorage(key: string): Promise<string | null> {
    try {
      return await storage.getItem(key)
    } catch {
      return null
    }
  }

  async function writeStorage(key: string, value: string): Promise<void> {
    try {
      await storage.setItem(key, value)
    } catch {
      /* noop */
    }
  }

  async function loadDistinctId(): Promise<string> {
    const stored = await readStorage(STORAGE_DISTINCT)
    if (stored?.trim()) return stored.trim()
    const id = randomId()
    await writeStorage(STORAGE_DISTINCT, id)
    return id
  }

  async function postCapture(event: string, properties: Record<string, unknown>): Promise<void> {
    if (!config.posthogKey || optOut) return
    const host = config.posthogHost.replace(/\/$/, '')
    try {
      await fetch(`${host}/capture/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: config.posthogKey,
          event,
          distinct_id: distinctId || (await loadDistinctId()),
          properties: {
            $lib: 'fotoce-analytics',
            platform,
            ...properties,
          },
        }),
        keepalive: true,
      })
    } catch {
      /* analytics non-bloquant */
    }
  }

  async function ensureInit(): Promise<void> {
    if (initialized) return
    distinctId = await loadDistinctId()
    if ((await readStorage(STORAGE_ANALYTICS_CONSENT)) === null) {
      await writeStorage(STORAGE_ANALYTICS_CONSENT, 'denied')
    }
    optOut =
      (await readStorage(STORAGE_ANALYTICS_CONSENT)) !== 'granted' ||
      (await readStorage(STORAGE_OPT_OUT)) === '1'
    initialized = true
  }

  async function hasAnalyticsConsentAsync(): Promise<boolean> {
    return (await readStorage(STORAGE_ANALYTICS_CONSENT)) === 'granted'
  }

  function setAnalyticsConsent(granted: boolean): void {
    void (async () => {
      await writeStorage(STORAGE_ANALYTICS_CONSENT, granted ? 'granted' : 'denied')
      if (!granted) {
        optOut = true
        await writeStorage(STORAGE_OPT_OUT, '1')
        return
      }
      optOut = false
      await writeStorage(STORAGE_OPT_OUT, '0')
    })()
  }

  function initAnalytics(opts?: { platform?: string }): void {
    if (opts?.platform) platform = opts.platform
    void ensureInit()
  }

  function applyPremiumTrackingPolicy(subscription?: {
    plan?: SubscriptionPlan
    isSeatMember?: boolean
  }): void {
    void (async () => {
      if (!(await hasAnalyticsConsentAsync())) {
        optOut = true
        await writeStorage(STORAGE_OPT_OUT, '1')
        return
      }
      const shouldOptOut = isPremiumNoTracking(subscription?.plan, subscription?.isSeatMember)
      optOut = shouldOptOut
      await writeStorage(STORAGE_OPT_OUT, shouldOptOut ? '1' : '0')
    })()
  }

  function identifyUser(user: {
    id: number
    username?: string
    email?: string
    plan?: SubscriptionPlan
    isSeatMember?: boolean
    dateJoined?: string
    signupPlatform?: string
    signupChannel?: string
    referred?: boolean
    refCode?: string | null
    retentionCohorts?: Record<string, string | number | boolean>
  }): void {
    void (async () => {
      await ensureInit()
      distinctId = String(user.id)
      await writeStorage(STORAGE_DISTINCT, distinctId)
      if (!(await hasAnalyticsConsentAsync())) {
        optOut = true
        await writeStorage(STORAGE_OPT_OUT, '1')
        return
      }
      const shouldOptOut = isPremiumNoTracking(user.plan, user.isSeatMember)
      optOut = shouldOptOut
      await writeStorage(STORAGE_OPT_OUT, shouldOptOut ? '1' : '0')
      if (optOut) return
      await postCapture('$identify', {
        $set: {
          username: user.username,
          email: user.email,
          subscription_plan: user.plan || 'free',
          is_seat_member: !!user.isSeatMember,
          ...(user.dateJoined ? { signup_date: user.dateJoined } : {}),
          ...(user.signupPlatform ? { signup_platform: user.signupPlatform } : {}),
          ...(user.signupChannel ? { signup_channel: user.signupChannel } : {}),
          referred: !!user.referred,
          ...(user.refCode ? { ref_code: user.refCode } : {}),
          ...(user.retentionCohorts || {}),
        },
      })
    })()
  }

  function resetAnalytics(): void {
    void (async () => {
      distinctId = randomId()
      await writeStorage(STORAGE_DISTINCT, distinctId)
      optOut = !(await hasAnalyticsConsentAsync())
      await writeStorage(STORAGE_OPT_OUT, optOut ? '1' : '0')
    })()
  }

  function trackEvent(event: AnalyticsEvent, properties?: Record<string, unknown>): void {
    void (async () => {
      await ensureInit()
      if (optOut || !config.posthogKey) return
      await postCapture(event, properties ?? {})
    })()
  }

  function trackOnce(event: AnalyticsEvent, properties?: Record<string, unknown>): void {
    void (async () => {
      await ensureInit()
      const key = `${STORAGE_ONCE_PREFIX}${event}`
      if ((await readStorage(key)) === '1') return
      await writeStorage(key, '1')
      if (optOut || !config.posthogKey) return
      await postCapture(event, properties ?? {})
    })()
  }

  function trackPageview(path: string, properties?: Record<string, unknown>): void {
    void (async () => {
      await ensureInit()
      if (optOut || !config.posthogKey) return
      await postCapture('$pageview', { $current_url: path, path, ...properties })
    })()
  }

  function isAnalyticsEnabled(): boolean {
    return initialized && !!config.posthogKey && !optOut
  }

  return {
    initAnalytics,
    applyPremiumTrackingPolicy,
    setAnalyticsConsent,
    identifyUser,
    resetAnalytics,
    trackEvent,
    trackOnce,
    trackPageview,
    isAnalyticsEnabled,
  }
}

/** Variante synchrone pour le web (localStorage). */
export function createSyncAnalyticsClient(
  config: AnalyticsConfig,
  storage: {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
    removeItem(key: string): void
  },
) {
  let initialized = false
  let optOut = false
  let distinctId = ''
  let platform = config.platform || 'web'

  function readStorage(key: string): string | null {
    try {
      return storage.getItem(key)
    } catch {
      return null
    }
  }

  function writeStorage(key: string, value: string): void {
    try {
      storage.setItem(key, value)
    } catch {
      /* noop */
    }
  }

  function loadDistinctId(): string {
    const stored = readStorage(STORAGE_DISTINCT)
    if (stored?.trim()) return stored.trim()
    const id = randomId()
    writeStorage(STORAGE_DISTINCT, id)
    return id
  }

  async function postCapture(event: string, properties: Record<string, unknown>): Promise<void> {
    if (!config.posthogKey || optOut) return
    const host = config.posthogHost.replace(/\/$/, '')
    try {
      await fetch(`${host}/capture/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: config.posthogKey,
          event,
          distinct_id: distinctId || loadDistinctId(),
          properties: {
            $lib: 'fotoce-analytics',
            platform,
            ...properties,
          },
        }),
        keepalive: true,
      })
    } catch {
      /* analytics non-bloquant */
    }
  }

  function hasAnalyticsConsent(): boolean {
    return readStorage(STORAGE_ANALYTICS_CONSENT) === 'granted'
  }

  function setAnalyticsConsent(granted: boolean): void {
    writeStorage(STORAGE_ANALYTICS_CONSENT, granted ? 'granted' : 'denied')
    if (!granted) {
      optOut = true
      writeStorage(STORAGE_OPT_OUT, '1')
      return
    }
    optOut = false
    writeStorage(STORAGE_OPT_OUT, '0')
  }

  function initAnalytics(opts?: { platform?: string }): void {
    if (initialized) return
    platform = opts?.platform || config.platform || 'web'
    distinctId = loadDistinctId()
    if (readStorage(STORAGE_ANALYTICS_CONSENT) === null) {
      writeStorage(STORAGE_ANALYTICS_CONSENT, 'denied')
    }
    optOut = !hasAnalyticsConsent() || readStorage(STORAGE_OPT_OUT) === '1'
    initialized = true
  }

  function applyPremiumTrackingPolicy(subscription?: {
    plan?: SubscriptionPlan
    isSeatMember?: boolean
  }): void {
    if (!hasAnalyticsConsent()) {
      optOut = true
      writeStorage(STORAGE_OPT_OUT, '1')
      return
    }
    const shouldOptOut = isPremiumNoTracking(subscription?.plan, subscription?.isSeatMember)
    optOut = shouldOptOut
    writeStorage(STORAGE_OPT_OUT, shouldOptOut ? '1' : '0')
  }

  function identifyUser(user: {
    id: number
    username?: string
    email?: string
    plan?: SubscriptionPlan
    isSeatMember?: boolean
    dateJoined?: string
    signupPlatform?: string
    signupChannel?: string
    referred?: boolean
    refCode?: string | null
    retentionCohorts?: Record<string, string | number | boolean>
  }): void {
    if (!initialized) initAnalytics()
    distinctId = String(user.id)
    writeStorage(STORAGE_DISTINCT, distinctId)
    applyPremiumTrackingPolicy({ plan: user.plan, isSeatMember: user.isSeatMember })
    if (optOut) return
    void postCapture('$identify', {
      $set: {
        username: user.username,
        email: user.email,
        subscription_plan: user.plan || 'free',
        is_seat_member: !!user.isSeatMember,
        ...(user.dateJoined ? { signup_date: user.dateJoined } : {}),
        ...(user.signupPlatform ? { signup_platform: user.signupPlatform } : {}),
        ...(user.signupChannel ? { signup_channel: user.signupChannel } : {}),
        referred: !!user.referred,
        ...(user.refCode ? { ref_code: user.refCode } : {}),
        ...(user.retentionCohorts || {}),
      },
    })
  }

  function resetAnalytics(): void {
    distinctId = randomId()
    writeStorage(STORAGE_DISTINCT, distinctId)
    optOut = !hasAnalyticsConsent()
    writeStorage(STORAGE_OPT_OUT, optOut ? '1' : '0')
  }

  function trackEvent(event: AnalyticsEvent, properties?: Record<string, unknown>): void {
    if (!initialized) initAnalytics()
    if (optOut || !config.posthogKey) return
    void postCapture(event, properties ?? {})
  }

  function trackOnce(event: AnalyticsEvent, properties?: Record<string, unknown>): void {
    if (!initialized) initAnalytics()
    const key = `${STORAGE_ONCE_PREFIX}${event}`
    if (readStorage(key) === '1') return
    writeStorage(key, '1')
    trackEvent(event, properties)
  }

  function trackPageview(path: string, properties?: Record<string, unknown>): void {
    if (!initialized) initAnalytics()
    if (optOut || !config.posthogKey) return
    void postCapture('$pageview', { $current_url: path, path, ...properties })
  }

  function isAnalyticsEnabled(): boolean {
    return initialized && !!config.posthogKey && !optOut
  }

  return {
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
  }
}
