import { ref, computed } from 'vue'
import type { User } from '../types'
import api, { AUTH_INVALIDATED_EVENT } from '../api/index'
import { readApiErrorCode } from '../constants/authErrors'
import { clearPinClientCaches } from '../lib/cache/pinClientCache'
import { clearNotificationsClientCache } from '../lib/cache/notificationsClientCache'
import { runBackground, shallowJsonEqual } from '../lib/cache/staleRevalidate'
import {
  getCachedProfileUser,
  profileDetailCacheKey,
  setCachedProfileUser,
} from '../lib/cache/entityClientCache'
import { devLog } from '../lib/devLog'
import { API_BASE_URL } from '../config/env'
import { extractMeHydrationFromApiPayload } from '../utils/mePayload'
import {
  resyncWebPushSubscriptionForCurrentUser,
  unregisterWebPushFromBackend,
} from '../utils/webPushBackendSync'
import { DEFAULT_AVATAR_COLOR_CLASS } from '../constants/avatar'
import { clearStoredReferralCode, getStoredReferralCode } from './useReferralIntent'
import { useI18n } from '../i18n'
import { extractDrfFieldErrors } from '../utils/apiValidationErrors'
import { translatePinovaErrorToken, translatePinovaNonFieldToken } from '../utils/formErrorMessages'
import { mapProfileExtendedFromApi } from '../utils/mapProfileExtended'
import { applyAccentColor, syncAppearanceFromProfile } from './useAppearance'
import { clearPendingIntent } from '../lib/pendingIntentStorage'
import { applyPremiumTrackingPolicy, identifyUser, resetAnalytics, trackOnce } from '../lib/analytics'
import { syncRetentionCohorts } from '../lib/retentionAnalytics'
import { setSentryUser } from '../lib/sentry'
import {
  clearStoredRefreshToken,
  readStoredRefreshToken,
  storeRefreshToken,
  USE_HTTPONLY_REFRESH_COOKIE,
} from '../utils/authSession'

export { DEFAULT_AVATAR_COLOR_CLASS }

const defaultUser: User = {
  id: 1,
  username: 'admin',
  displayName: 'Admin Pinova',
  email: 'admin@pinova.local',
  hasUsablePassword: true,
  preferredLanguage: 'fr',
  preferredCurrency: 'XOF',
  privateProfile: false,
  discoverableProfile: true,
  notificationsFollowers: true,
  notificationsSaves: true,
  notificationsRecommendations: false,
  avatarColor: DEFAULT_AVATAR_COLOR_CLASS,
  bio: 'Développeur et passionné de design.',
  followers: 120,
  following: 85,
  savedPins: [],
  blockedUsernames: [],
  subscription: {
    plan: 'free',
    renewalAt: null,
    translationQuotaMonthly: 5,
    translationUsedMonthly: 0,
    trialEligible: false,
    trialConsumedAt: null,
    digestCreatorWeekly: true,
    activeBillingCycle: null,
    sensitiveMediaBlurByDefault: true,
    hideSensitivePins: false,
  },
  birthDate: null,
}

const currentUser = ref<User | null>(null)
const isAuthenticated = computed(() => currentUser.value !== null)
/** Plus utilisé pour bloquer l’UI ; conservé pour compat éventuelle (toujours false). */
const isInitializing = ref(false)
const inMemoryAccessToken = ref<string | null>(
  typeof window !== 'undefined' ? window.localStorage.getItem('pinova_token') : null,
)
let hasAuthInvalidationListener = false
const CURRENT_USER_CACHE_TTL_MS = 30 * 60 * 1000
/** Au-delà de ce délai, `GET me/` est relancé en arrière-plan (SWR) sans vider l’UI. */
const CURRENT_USER_STALE_MS = 60 * 1000
let currentUserLastFetchAt = 0
let currentUserFetchPromise: Promise<void> | null = null
let updateProfileInFlight:
  | {
      signature: string
      promise: Promise<unknown>
    }
  | null = null

/** Réponse brute `GET me/` pour réhydrater la session hors ligne / avant le premier round-trip. */
const PINOVA_ME_PAYLOAD_KEY = 'pinova_me_payload_v1'

function persistMePayloadFromApi(data: unknown) {
  if (typeof window === 'undefined' || data == null || typeof data !== 'object') return
  try {
    window.localStorage.setItem(PINOVA_ME_PAYLOAD_KEY, JSON.stringify(data))
  } catch {
    /* quota / mode privé */
  }
}

function clearMePayloadCache() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(PINOVA_ME_PAYLOAD_KEY)
  } catch {
    /* ignore */
  }
}

/** Si un JWT existe, restaure le dernier snapshot `me/` pour éviter un écran vide avant le réseau. */
function hydrateCurrentUserFromMeCacheWhenTokenPresent() {
  if (typeof window === 'undefined') return
  try {
    if (!inMemoryAccessToken.value || currentUser.value) return
    const raw = window.localStorage.getItem(PINOVA_ME_PAYLOAD_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && parsed.username != null) {
      currentUser.value = mapDjangoUserToFrontend(parsed)
      /* 0 → prochain fetchCurrentUser revalide en arrière-plan sans flash. */
      currentUserLastFetchAt = 0
    }
  } catch {
    /* JSON invalide */
  }
}

if (typeof window !== 'undefined' && inMemoryAccessToken.value) {
  hydrateCurrentUserFromMeCacheWhenTokenPresent()
}

function getFullMediaUrl(url: string | null): string | undefined {
  if (!url) return undefined
  if (url.startsWith('http')) return url
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`
}

/** URL absolue pour les médias (tableaux, etc.) — chaîne vide si invalide. */
function resolveFullMediaUrlString(url: string | null | undefined): string {
  if (url == null || !String(url).trim()) return ''
  const u = String(url).trim()
  if (/^https?:\/\//i.test(u)) return u
  return `${API_BASE_URL}${u.startsWith('/') ? '' : '/'}${u}`
}

/** Aperçus tableau : `profiles/` et `me/` renvoient `previewImages` ; `boards/` renvoie `preview_images`. */
function normalizeBoardPreviewList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const x of raw) {
    if (typeof x !== 'string' || !x.trim()) continue
    const r = resolveFullMediaUrlString(x.trim())
    if (r) out.push(r)
  }
  return out.slice(0, 8)
}

function mapUserBoardsFromApi(raw: unknown): User['boards'] {
  if (!Array.isArray(raw)) return []
  const rows: NonNullable<User['boards']> = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const b = entry as Record<string, unknown>
    const id = Number(b.id)
    if (!Number.isFinite(id)) continue
    rows.push({
      id,
      name: String(b.name ?? ''),
      pinCount: Number(b.pinCount ?? b.pin_count ?? 0),
      isPrivate: !!(b.isPrivate ?? b.is_private),
      collaboratorCount: Number(b.collaboratorCount ?? b.collaborator_count ?? 0),
      previewImages: normalizeBoardPreviewList(b.preview_images ?? b.previewImages),
      isOwner:
        typeof b.isOwner === 'boolean'
          ? b.isOwner
          : typeof b.is_owner === 'boolean'
            ? b.is_owner
            : undefined,
      ownerUsername:
        typeof b.ownerUsername === 'string'
          ? b.ownerUsername
          : typeof b.owner_username === 'string'
            ? b.owner_username
            : undefined,
      shareToken:
        b.shareToken != null
          ? String(b.shareToken)
          : b.share_token != null
            ? String(b.share_token)
            : undefined,
    })
  }
  return rows
}

/** Date ISO YYYY-MM-DD pour affichage / formulaires ; alignée sur Django DateField. */
export function normalizeBirthDateFromApi(raw: unknown): string | null {
  if (raw == null || raw === '') return null
  const iso = String(raw).trim().split('T')[0]
  const head = (iso ?? '').slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return head
  return null
}

function mapDjangoUserToFrontend(djangoUser: any): User {
  if (!djangoUser) return defaultUser
  const profile = djangoUser.profile || djangoUser || {}
  const birthNormalized = normalizeBirthDateFromApi(profile.birth_date)
  const meBundle = extractMeHydrationFromApiPayload(djangoUser as Record<string, unknown>)
  const boards =
    meBundle != null ? meBundle.boards : mapUserBoardsFromApi(djangoUser.boards)
  // id = clé utilisateur Django (User.pk), indispensable pour payloads cohérents.
  const extended = mapProfileExtendedFromApi(profile as Record<string, unknown>)
  return {
    ...extended,
    id: djangoUser.id,
    isStaff: !!djangoUser.is_staff,
    username: djangoUser.username,
    displayName: profile.display_name || djangoUser.username,
    email: djangoUser.email ?? '',
    coverImageUrl: getFullMediaUrl(profile.cover_image),
    preferredLanguage: profile.preferred_language || 'fr',
    preferredCurrency: profile.preferred_currency || 'XOF',
    countryCode: profile.country_code || '',
    privateProfile: !!profile.private_profile,
    discoverableProfile: profile.discoverable_profile ?? true,
    notificationsFollowers: profile.notifications_followers ?? true,
    notificationsSaves: profile.notifications_saves ?? true,
    notificationsRecommendations: profile.notifications_recommendations ?? false,
    notificationsStreakReminders: profile.notifications_streak_reminders ?? true,
    notificationsReactivationEmails: profile.notifications_reactivation_emails ?? true,
    dateJoined: djangoUser.date_joined ? String(djangoUser.date_joined) : undefined,
    avatarUrl: getFullMediaUrl(profile.avatar),
    avatarColor: profile.avatar_color || DEFAULT_AVATAR_COLOR_CLASS,
    bio: profile.bio || '',
    followers: profile.followers_count || 0,
    following: profile.following_count || 0,
    isFollowing: profile.is_following || false,
    savedPins: djangoUser.saved_pins || [],
    profileShareToken: profile.share_token ? String(profile.share_token) : undefined,
    subscription: {
      plan: djangoUser.subscription?.plan || profile.subscription_plan || 'free',
      renewalAt: djangoUser.subscription?.renewal_at || profile.subscription_renewal_at || null,
      translationQuotaMonthly: djangoUser.subscription?.translation_quota_monthly || profile.translation_quota_monthly || 5,
      translationUsedMonthly: djangoUser.subscription?.translation_used_monthly || profile.translation_used_monthly || 0,
      tipsEnabled: djangoUser.subscription?.tips_enabled ?? profile.tips_enabled ?? false,
      cancelAtPeriodEnd: djangoUser.subscription?.cancel_at_period_end ?? profile.subscription_cancel_at_period_end ?? false,
      scheduledPlan: djangoUser.subscription?.scheduled_plan ?? profile.subscription_scheduled_plan ?? null,
      trialEligible: djangoUser.subscription?.trial_eligible ?? false,
      trialConsumedAt: djangoUser.subscription?.trial_consumed_at ?? profile.subscription_trial_consumed_at ?? null,
      digestCreatorWeekly: djangoUser.subscription?.digest_creator_weekly ?? true,
      adAdsEnabled:
        djangoUser.subscription?.ad_ads_enabled === undefined
          ? true
          : !!djangoUser.subscription.ad_ads_enabled,
      partnerAdsEnabled:
        djangoUser.subscription?.partner_ads_enabled === undefined
          ? true
          : !!djangoUser.subscription.partner_ads_enabled,
      activeBillingCycle: djangoUser.subscription?.active_billing_cycle ?? null,
      hasBillingHistory:
        typeof djangoUser.subscription?.has_billing_history === 'boolean'
          ? djangoUser.subscription.has_billing_history
          : undefined,
      sensitiveMediaBlurByDefault:
        djangoUser.subscription?.sensitive_media_blur_by_default !== undefined
          ? !!djangoUser.subscription.sensitive_media_blur_by_default
          : true,
      hideSensitivePins: !!djangoUser.subscription?.hide_sensitive_pins,
      accountScheduledDeletionAt:
        djangoUser.subscription?.account_scheduled_deletion_at ?? null,
      seatBundle: djangoUser.subscription?.seat_bundle ?? 'solo',
      isSeatMember: !!djangoUser.subscription?.is_seat_member,
      sponsorUsername: djangoUser.subscription?.sponsor_username ?? null,
      seatMaxInvitees: typeof djangoUser.subscription?.seat_max_invitees === 'number'
        ? djangoUser.subscription.seat_max_invitees
        : undefined,
    },
    boards,
    meCreatedPinsPage: meBundle?.createdPinsPage,
    meSavedPinsPage: meBundle?.savedPinsPage,
    birthDate: birthNormalized,
    pinsCount: typeof djangoUser.pins_count === 'number' ? djangoUser.pins_count : undefined,
    blockedUsernames: Array.isArray(djangoUser.blocked_usernames)
      ? djangoUser.blocked_usernames.map((x: unknown) => String(x))
      : [],
    viewerHasReportedProfile: !!djangoUser.viewer_has_reported_profile,
    hasUsablePassword:
      typeof djangoUser.has_usable_password === 'boolean' ? djangoUser.has_usable_password : true,
  }
}

export type FetchUserProfileResult = {
  user: User | null
  /** Statut HTTP en cas d’échec (404, 403, etc.) — absent si succès réseau. */
  httpStatus?: number
  /** True si l’API a renvoyé `code: user_blocked` (profil masqué par blocage). */
  blocked?: boolean
}

/**
 * GET `me/` puis mise à jour de `currentUser`, du cache profil et du snapshot
 * `pinova_me_payload_v1` dans localStorage.
 * Exporté pour les actions hors `useAuth()` (ex. follow depuis `usePins`).
 */
async function fetchCurrentUserFromNetwork(_opts?: { silent?: boolean }) {
  devLog('📡 Fetching user from API...')
  try {
    const response = await api.get('me/')
    if (response.data) {
      devLog('✅ User received:', response.data.username)
      const mapped = mapDjangoUserToFrontend(response.data)
      if (!shallowJsonEqual(mapped, currentUser.value)) {
        currentUser.value = mapped
      }
      persistMePayloadFromApi(response.data)
      currentUserLastFetchAt = Date.now()
      const u = currentUser.value
      if (u) {
        setCachedProfileUser(profileDetailCacheKey(u.username, ''), u)
        syncAppearanceFromProfile(u.themeMode)
        applyAccentColor(u.accentColor || 'rose')
        const apiReferral = response.data?.referral as { received?: unknown } | undefined
        const cohorts = syncRetentionCohorts({
          dateJoinedIso: u.dateJoined,
          signupPlatform: 'web',
          refCode: getStoredReferralCode() || undefined,
        })
        identifyUser({
          id: u.id,
          username: u.username,
          email: u.email,
          plan: u.subscription?.plan,
          isSeatMember: u.subscription?.isSeatMember,
          dateJoined: u.dateJoined,
          signupPlatform: 'web',
          signupChannel: cohorts?.signup_channel,
          referred: !!apiReferral?.received,
          refCode: getStoredReferralCode() || undefined,
          retentionCohorts: cohorts
            ? {
                days_since_signup: cohorts.days_since_signup,
                retention_cohort_j1: cohorts.retention_cohort_j1,
                retention_cohort_j7: cohorts.retention_cohort_j7,
                retention_cohort_j30: cohorts.retention_cohort_j30,
                signup_platform: cohorts.signup_platform,
                signup_channel: cohorts.signup_channel,
              }
            : undefined,
        })
        applyPremiumTrackingPolicy({
          plan: u.subscription?.plan,
          isSeatMember: u.subscription?.isSeatMember,
        })
        setSentryUser({ id: u.id, username: u.username })
      }
      void resyncWebPushSubscriptionForCurrentUser(api).catch(() => undefined)
    }
  } catch (err) {
    if (!currentUser.value) {
      currentUser.value = null
    }
    console.warn('❌ Session absente ou expirée.')
  }
}

export async function fetchCurrentUser(opts?: { silent?: boolean; force?: boolean }) {
  const force = !!opts?.force

  if (!force && currentUser.value && currentUserLastFetchAt > 0) {
    const age = Date.now() - currentUserLastFetchAt
    if (age < CURRENT_USER_STALE_MS) return
    if (age < CURRENT_USER_CACHE_TTL_MS) {
      if (!currentUserFetchPromise) {
        currentUserFetchPromise = fetchCurrentUserFromNetwork(opts).finally(() => {
          currentUserFetchPromise = null
        })
      }
      return
    }
  }

  if (currentUserFetchPromise) {
    await currentUserFetchPromise
    return
  }

  currentUserFetchPromise = fetchCurrentUserFromNetwork(opts).finally(() => {
    currentUserFetchPromise = null
  })
  await currentUserFetchPromise
}

export function useAuth() {
  const { t } = useI18n()
  function buildUpdateProfileSignature(data: {
    displayName?: string
    bio?: string
    email?: string
    avatar?: File
    preferredLanguage?: string
    preferredCurrency?: string
    birthDate?: string | null
    tipsEnabled?: boolean
    privateProfile?: boolean
    discoverableProfile?: boolean
    notificationsFollowers?: boolean
    notificationsSaves?: boolean
    notificationsRecommendations?: boolean
    notificationsStreakReminders?: boolean
    notificationsReactivationEmails?: boolean
    notificationsDigestCreatorWeekly?: boolean
    sensitiveMediaBlurByDefault?: boolean
    hideSensitivePins?: boolean
  }) {
    const avatar = data.avatar
      ? {
          name: data.avatar.name,
          size: data.avatar.size,
          type: data.avatar.type,
          lastModified: data.avatar.lastModified,
        }
      : null
    return JSON.stringify({
      displayName: data.displayName,
      bio: data.bio,
      email: data.email,
      avatar,
      preferredLanguage: data.preferredLanguage,
      preferredCurrency: data.preferredCurrency,
      birthDate: data.birthDate ?? null,
      tipsEnabled: data.tipsEnabled,
      privateProfile: data.privateProfile,
      discoverableProfile: data.discoverableProfile,
      notificationsFollowers: data.notificationsFollowers,
      notificationsSaves: data.notificationsSaves,
      notificationsRecommendations: data.notificationsRecommendations,
      notificationsDigestCreatorWeekly: data.notificationsDigestCreatorWeekly,
      sensitiveMediaBlurByDefault: data.sensitiveMediaBlurByDefault,
      hideSensitivePins: data.hideSensitivePins,
    })
  }

  function clearAuthState() {
    currentUserFetchPromise = null
    currentUserLastFetchAt = 0
    inMemoryAccessToken.value = null
    delete api.defaults.headers.common.Authorization
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('pinova_token')
      clearStoredRefreshToken()
      clearMePayloadCache()
    }
    currentUser.value = null
    isInitializing.value = false
    clearPinClientCaches()
    clearNotificationsClientCache()
  }

  function applyAccessToken(token: string | null) {
    inMemoryAccessToken.value = token
    if (token) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('pinova_token', token)
      }
    } else {
      delete api.defaults.headers.common.Authorization
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('pinova_token')
      }
    }
  }

  if (typeof window !== 'undefined' && !hasAuthInvalidationListener) {
    window.addEventListener(AUTH_INVALIDATED_EVENT, clearAuthState)
    hasAuthInvalidationListener = true
  }

  if (inMemoryAccessToken.value) {
    api.defaults.headers.common.Authorization = `Bearer ${inMemoryAccessToken.value}`
  }

  async function fetchUserProfile(
    username: string,
    opts?: { share?: string | null; force?: boolean },
  ): Promise<FetchUserProfileResult> {
    const shareRaw = typeof opts?.share === 'string' ? opts.share.trim() : ''
    const cacheKey = profileDetailCacheKey(username, shareRaw)
    if (!opts?.force) {
      const warm = getCachedProfileUser(cacheKey)
      if (warm) {
        runBackground(async () => {
          try {
            const params = shareRaw ? { share: shareRaw } : {}
            const response = await api.get(`profiles/${username}/`, { params })
            const user = mapDjangoUserToFrontend(response.data)
            if (!shallowJsonEqual(user, warm)) {
              setCachedProfileUser(cacheKey, user)
            }
          } catch {
            /* revalidation silencieuse */
          }
        })
        return { user: warm }
      }
    }
    try {
      const params = shareRaw ? { share: shareRaw } : {}
      const response = await api.get(`profiles/${username}/`, { params })
      const user = mapDjangoUserToFrontend(response.data)
      setCachedProfileUser(cacheKey, user)
      return { user }
    } catch (err: unknown) {
      const ax = err as { response?: { status?: number; data?: { code?: string } } }
      const status = ax.response?.status
      const blocked = ax.response?.data?.code === 'user_blocked'
      console.error(`❌ Erreur lors du chargement du profil ${username}:`, err)
      return { user: null, httpStatus: status, blocked }
    }
  }

  async function toggleFollow(username: string) {
    try {
      const response = await api.post(`profiles/${username}/follow/`)
      if (response.data?.status === 'followed') {
        trackOnce('first_follow', { username })
      }
      /* Compteurs `following_count` / snapshot offline : même source que GET me/. */
      void fetchCurrentUser({ force: true, silent: true })
      return response.data
    } catch (err) {
      console.error('Error toggling follow:', err)
      throw err
    }
  }

  async function updateProfile(data: { displayName?: string, bio?: string, email?: string, avatar?: File, preferredLanguage?: string, preferredCurrency?: string, birthDate?: string | null, tipsEnabled?: boolean, privateProfile?: boolean, discoverableProfile?: boolean, notificationsFollowers?: boolean, notificationsSaves?: boolean, notificationsRecommendations?: boolean, notificationsStreakReminders?: boolean, notificationsReactivationEmails?: boolean, notificationsDigestCreatorWeekly?: boolean, sensitiveMediaBlurByDefault?: boolean, hideSensitivePins?: boolean }) {
    const signature = buildUpdateProfileSignature(data)
    if (updateProfileInFlight && updateProfileInFlight.signature === signature) {
      return updateProfileInFlight.promise
    }
    try {
      const requestPromise = (async () => {
      const formData = new FormData()
      if (data.displayName) formData.append('display_name', data.displayName)
      if (data.bio !== undefined) formData.append('bio', data.bio)
      if (data.email) formData.append('email', data.email)
      if (data.avatar) formData.append('avatar', data.avatar)
      if (data.preferredLanguage) formData.append('preferred_language', data.preferredLanguage)
      if (data.preferredCurrency) formData.append('preferred_currency', data.preferredCurrency)
      if (data.birthDate !== undefined && data.birthDate !== null && String(data.birthDate).trim() !== '') {
        formData.append('birth_date', String(data.birthDate).trim().slice(0, 10))
      }
      if (data.tipsEnabled !== undefined) formData.append('tips_enabled', data.tipsEnabled ? 'true' : 'false')
      if (data.privateProfile !== undefined) formData.append('private_profile', data.privateProfile ? 'true' : 'false')
      if (data.discoverableProfile !== undefined) formData.append('discoverable_profile', data.discoverableProfile ? 'true' : 'false')
      if (data.notificationsFollowers !== undefined) formData.append('notifications_followers', data.notificationsFollowers ? 'true' : 'false')
      if (data.notificationsSaves !== undefined) formData.append('notifications_saves', data.notificationsSaves ? 'true' : 'false')
      if (data.notificationsRecommendations !== undefined) formData.append('notifications_recommendations', data.notificationsRecommendations ? 'true' : 'false')
      if (data.notificationsStreakReminders !== undefined) {
        formData.append('notifications_streak_reminders', data.notificationsStreakReminders ? 'true' : 'false')
      }
      if (data.notificationsReactivationEmails !== undefined) {
        formData.append('notifications_reactivation_emails', data.notificationsReactivationEmails ? 'true' : 'false')
      }
      if (data.notificationsDigestCreatorWeekly !== undefined) {
        formData.append('notifications_digest_creator_weekly', data.notificationsDigestCreatorWeekly ? 'true' : 'false')
      }

      if (data.sensitiveMediaBlurByDefault !== undefined) {
        formData.append('sensitive_media_blur_by_default', data.sensitiveMediaBlurByDefault ? 'true' : 'false')
      }

      if (data.hideSensitivePins !== undefined) {
        formData.append('hide_sensitive_pins', data.hideSensitivePins ? 'true' : 'false')
      }

      const response = await api.patch('me/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      if (response.data) {
        currentUser.value = mapDjangoUserToFrontend(response.data)
        persistMePayloadFromApi(response.data)
        currentUserLastFetchAt = Date.now()
        const u = currentUser.value
        if (u) {
          setCachedProfileUser(profileDetailCacheKey(u.username, ''), u)
        }
      }
      return response.data
      })()
      updateProfileInFlight = { signature, promise: requestPromise }
      const out = await requestPromise
      return out
    } catch (err) {
      console.error('Error updating profile:', err)
      throw err
    } finally {
      if (updateProfileInFlight?.signature === signature) {
        updateProfileInFlight = null
      }
    }
  }

  async function login(email: string, password: string) {
    try {
      const response = await api.post('auth/login/', { email, password })
      if (response.data?.access) {
        applyAccessToken(response.data.access)
      }
      if (response.data?.refresh) {
        storeRefreshToken(response.data.refresh)
      } else if (!USE_HTTPONLY_REFRESH_COOKIE && typeof window !== 'undefined' && response.data?.access) {
        console.warn(
          '[Pinova auth] Pas de refresh_token dans la réponse login — session courte uniquement ; vérifiez le backend (dj-rest-auth + SIMPLE_JWT).',
        )
      }
      // 1re requête authentifiée : `me/` (évite le TTL qui skip le fetch si on avait posé `user` du login).
      await fetchCurrentUser({ force: true })
      if (!currentUser.value) {
        clearAuthState()
        return { success: false as const, error: 'Impossible de charger le profil.' }
      }
      return {
        success: true as const,
        access: response.data?.access,
        refresh: response.data?.refresh,
      }
    } catch (err: any) {
      console.error('Login error:', err)
      clearAuthState()
      const data = err.response?.data as Record<string, unknown> | undefined
      const fe = extractDrfFieldErrors(data)
      const fieldErrors: { email?: string; password?: string } = {}
      if (fe.email?.[0]) fieldErrors.email = translatePinovaErrorToken(fe.email[0], t)
      if (fe.password?.[0]) fieldErrors.password = translatePinovaErrorToken(fe.password[0], t)

      const nfe = data?.non_field_errors
      let errorMsg = t('login.error.generic')
      if (Array.isArray(nfe) && typeof nfe[0] === 'string' && nfe[0].trim()) {
        errorMsg = translatePinovaNonFieldToken(nfe[0], t)
      } else if (typeof data?.detail === 'string' && data.detail.trim()) {
        errorMsg = data.detail.trim()
      } else if (fe.email?.[0] || fe.password?.[0]) {
        errorMsg = ''
      } else {
        const legacy = err.response?.data?.non_field_errors?.[0]
        if (typeof legacy === 'string' && legacy.trim()) errorMsg = legacy
      }

      if (Object.keys(fieldErrors).length > 0) {
        return { success: false as const, error: errorMsg, fieldErrors }
      }
      return { success: false as const, error: errorMsg }
    }
  }

  async function register(data: any) {
    try {
      const payload: Record<string, unknown> = {
        email: data.email,
        username: data.email.split('@')[0], // Utilise le début de l'email comme username
        password1: data.password,
        password2: data.password,
        display_name: data.displayName || data.email.split('@')[0],
      }
      const refCode = getStoredReferralCode()
      if (refCode) {
        payload.referral_code = refCode
      }
      await api.post('auth/registration/', payload)
      // Ne pas stocker le token immédiatement car l'email doit être vérifié via OTP
      return { success: true as const }
    } catch (err: any) {
      console.error('Register error:', err)
      const body = err.response?.data
      const code = readApiErrorCode(body)
      const nfe = body?.non_field_errors
      const fromNonField = Array.isArray(nfe) && typeof nfe[0] === 'string' ? nfe[0] : ''
      const errorMsg =
        fromNonField ||
        (Object.values(body || {}).flat()[0] as string) ||
        'Erreur lors de la création du compte.'
      return {
        success: false as const,
        error: errorMsg,
        code,
        raw: body,
      }
    }
  }

  async function forgotPassword(email: string) {
    try {
      await api.post('auth/password/reset/', { email })
      return { success: true }
    } catch (err: any) {
      console.error('Forgot password error:', err)
      return { success: false, error: 'Erreur lors de la demande de réinitialisation.' }
    }
  }

  async function resetPassword(data: any) {
    try {
      await api.post('auth/password/reset/confirm/', data)
      return { success: true }
    } catch (err: any) {
      console.error('Reset password error:', err)
      return { success: false, error: 'Erreur lors de la réinitialisation du mot de passe.' }
    }
  }

  async function socialLogin(provider: 'google' | 'facebook', tokenValue: string) {
    try {
      // Pour Google One Tap (ID Token) ou Google Token Client (Access Token)
      // dj-rest-auth accepte access_token pour les deux selon la configuration, 
      // mais on peut essayer de passer id_token si c'est un JWT (One Tap)
      const isIdToken = tokenValue.split('.').length === 3
      const payload: any = {}
      
      if (provider === 'google' && isIdToken) {
        payload.id_token = tokenValue
      } else {
        payload.access_token = tokenValue
      }

      const refCode = getStoredReferralCode()
      if (refCode) {
        payload.referral_code = refCode
      }

      const response = await api.post(`auth/social/${provider}/`, payload)
      if (response.data?.access) {
        applyAccessToken(response.data.access)
      }
      if (response.data?.refresh) {
        storeRefreshToken(response.data.refresh)
      } else if (!USE_HTTPONLY_REFRESH_COOKIE && typeof window !== 'undefined' && response.data?.access) {
        console.warn(
          '[Pinova auth] Pas de refresh_token dans la réponse connexion sociale — vérifiez le backend.',
        )
      }
      await fetchCurrentUser({ force: true })
      if (!currentUser.value) {
        clearAuthState()
        return { success: false as const, error: 'Impossible de charger le profil.' }
      }
      if (refCode) {
        clearStoredReferralCode()
      }
      return {
        success: true as const,
        access: response.data?.access,
        refresh: response.data?.refresh,
      }
    } catch (err: any) {
      console.error(`${provider} login error:`, err)
      clearAuthState()
      return { success: false, error: `Erreur lors de la connexion avec ${provider}.` }
    }
  }

  async function logout() {
    const hadToken = !!inMemoryAccessToken.value
    const refreshToken = readStoredRefreshToken()
    if (hadToken) {
      await unregisterWebPushFromBackend(api).catch(() => undefined)
    }
    clearPendingIntent()
    clearAuthState()
    resetAnalytics()
    setSentryUser(null)
    if (hadToken) {
      api
        .post('auth/logout/', refreshToken ? { refresh: refreshToken } : {})
        .catch(() => undefined)
    }
    devLog('🚪 Logged out successfully.')
  }

  async function logoutAllDevices() {
    const hadToken = !!inMemoryAccessToken.value
    const refreshToken = readStoredRefreshToken()
    if (hadToken) {
      await unregisterWebPushFromBackend(api).catch(() => undefined)
      await api.post('auth/logout-all/', {}).catch(() => undefined)
    }
    clearPendingIntent()
    clearAuthState()
    resetAnalytics()
    setSentryUser(null)
    if (hadToken) {
      api.post('auth/logout/', refreshToken ? { refresh: refreshToken } : {}).catch(() => undefined)
    }
    devLog('🚪 Logged out from all devices.')
  }

  function toggleSavePin(pinId: number) {
    if (!currentUser.value) return
    const index = currentUser.value.savedPins.indexOf(pinId)
    if (index === -1) {
      currentUser.value.savedPins.push(pinId)
    } else {
      currentUser.value.savedPins.splice(index, 1)
    }
  }

  async function createBoard(payload: { name: string; description?: string; isPrivate?: boolean }) {
    const response = await api.post('boards/', {
      name: payload.name,
      description: payload.description || '',
      is_private: !!payload.isPrivate,
    })
    return response.data
  }

  async function updateBoard(
    boardId: number,
    payload: { name?: string; description?: string; isPrivate?: boolean },
  ) {
    const body: Record<string, unknown> = {}
    if (payload.name !== undefined) body.name = payload.name
    if (payload.description !== undefined) body.description = payload.description
    if (payload.isPrivate !== undefined) body.is_private = !!payload.isPrivate
    const response = await api.patch(`boards/${boardId}/`, body)
    return response.data
  }

  async function deleteBoard(boardId: number) {
    await api.delete(`boards/${boardId}/`)
  }

  async function fetchMyBoards() {
    const all: Record<string, unknown>[] = []
    let page = 1
    const page_size = 100
    while (page <= 100) {
      const response = await api.get('boards/', { params: { page, page_size } })
      const data = response.data as { results?: unknown[]; next?: string | null }
      const chunk = data?.results ?? (Array.isArray(data) ? (data as unknown[]) : [])
      if (!Array.isArray(chunk) || chunk.length === 0) break
      all.push(...(chunk as Record<string, unknown>[]))
      if (!data?.next) break
      page += 1
    }
    return all.map((b: Record<string, unknown>) => ({
      id: Number(b.id),
      name: String(b.name ?? ''),
      is_private: !!(b.is_private ?? b.isPrivate),
      /** Absent avant backend : défaut réservé (true). */
      is_owner: b.is_owner === undefined ? true : !!b.is_owner,
      pin_count: Number(b.pin_count ?? b.pinCount ?? 0),
      collaborator_count: Number(b.collaborator_count ?? b.collaboratorCount ?? 0),
      preview_images: normalizeBoardPreviewList(b.preview_images ?? b.previewImages),
      share_token: b.share_token as string | undefined,
      ownerUsername: String((b.owner_username as string | undefined) || '').trim() || undefined,
    }))
  }

  async function fetchPendingBoardInvitations() {
    const response = await api.get('board-invitations/')
    return response.data?.results ?? []
  }

  async function acceptBoardInvitation(inviteId: number) {
    await api.post(`board-invitations/${inviteId}/accept/`)
  }

  async function declineBoardInvitation(inviteId: number) {
    await api.post(`board-invitations/${inviteId}/decline/`)
  }

  async function fetchBoardCollaborators(boardId: number) {
    const response = await api.get(`boards/${boardId}/collaborators/`)
    return response.data?.collaborators || []
  }

  async function addBoardCollaborator(boardId: number, username: string) {
    const response = await api.post(`boards/${boardId}/collaborators/`, { username })
    return response.data
  }

  async function removeBoardCollaborator(boardId: number, username: string) {
    const response = await api.delete(`boards/${boardId}/collaborators/`, { data: { username } })
    return response.data
  }

  async function manageSubscription(
    action: 'cancel' | 'reactivate' | 'downgrade_to_free' | 'schedule_plan_change' | 'cancel_schedule',
    extra?: { target_plan?: 'plus' | 'free' },
  ) {
    const response = await api.post('subscription/manage/', { action, ...extra })
    await fetchCurrentUser({ force: true, silent: true })
    return response.data
  }

  async function startPlusTrial() {
    const response = await api.post('subscription/trial/start/')
    await fetchCurrentUser({ force: true, silent: true })
    return response.data
  }

  async function fetchSubscriptionInvoices() {
    const response = await api.get('subscription/invoices/')
    return response.data?.results || []
  }

  async function fetchSubscriptionInvoiceReceipt(invoiceId: number) {
    const response = await api.get(`subscription/invoices/${invoiceId}/receipt/`)
    return response.data as { invoice_url?: string | null; error?: string; detail?: string }
  }

  async function fetchSupportTickets() {
    const response = await api.get('support/tickets/')
    return response.data?.results || []
  }

  async function createSupportTicket(subject: string, message: string) {
    const response = await api.post('support/tickets/', { subject, message })
    return response.data
  }

  async function applyAuthSession(payload: { access?: string; refresh?: string }) {
    if (payload.access) applyAccessToken(payload.access)
    if (payload.refresh) storeRefreshToken(payload.refresh)
    await fetchCurrentUser({ force: true })
    return currentUser.value
  }

  return {
    currentUser,
    isAuthenticated,
    isInitializing,
    applyAuthSession,
    login,
    register,
    logout,
    logoutAllDevices,
    updateProfile,
    forgotPassword,
    resetPassword,
    socialLogin,
    toggleSavePin,
    toggleFollow,
    fetchCurrentUser,
    fetchUserProfile,
    createBoard,
    updateBoard,
    deleteBoard,
    fetchMyBoards,
    fetchBoardCollaborators,
    addBoardCollaborator,
    removeBoardCollaborator,
    fetchPendingBoardInvitations,
    acceptBoardInvitation,
    declineBoardInvitation,
    manageSubscription,
    startPlusTrial,
    fetchSubscriptionInvoices,
    fetchSubscriptionInvoiceReceipt,
    fetchSupportTickets,
    createSupportTicket,
  }
}
