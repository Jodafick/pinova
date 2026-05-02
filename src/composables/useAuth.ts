import { ref, computed } from 'vue'
import type { User } from '../types'
import api, { AUTH_INVALIDATED_EVENT } from '../api'
import { devLog } from '../devLog'
import { API_BASE_URL } from '../env'

const defaultUser: User = {
  id: 1,
  username: 'admin',
  displayName: 'Admin Pinova',
  email: 'admin@pinova.local',
  preferredLanguage: 'fr',
  preferredCurrency: 'XOF',
  privateProfile: false,
  discoverableProfile: true,
  notificationsFollowers: true,
  notificationsSaves: true,
  notificationsRecommendations: false,
  avatarColor: 'bg-pink-500',
  bio: 'Développeur et passionné de design.',
  followers: 120,
  following: 85,
  savedPins: [],
  subscription: {
    plan: 'free',
    renewalAt: null,
    translationQuotaMonthly: 5,
    translationUsedMonthly: 0,
    trialEligible: false,
    trialConsumedAt: null,
    digestCreatorWeekly: true,
  },
  birthDate: null,
}

const currentUser = ref<User | null>(null)
const isAuthenticated = computed(() => currentUser.value !== null)
const isInitializing = ref(true)
const inMemoryAccessToken = ref<string | null>(
  typeof window !== 'undefined' ? window.localStorage.getItem('pinova_token') : null,
)
let hasAuthInvalidationListener = false

function getFullMediaUrl(url: string | null): string | undefined {
  if (!url) return undefined
  if (url.startsWith('http')) return url
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`
}

function mapDjangoUserToFrontend(djangoUser: any): User {
  if (!djangoUser) return defaultUser
  const profile = djangoUser.profile || djangoUser || {}
  // On utilise l'ID du profile pour être cohérent avec l'API follow
  return {
    id: profile.id || djangoUser.id,
    username: djangoUser.username,
    displayName: profile.display_name || djangoUser.username,
    email: djangoUser.email ?? '',
    preferredLanguage: profile.preferred_language || 'fr',
    preferredCurrency: profile.preferred_currency || 'XOF',
    countryCode: profile.country_code || '',
    privateProfile: !!profile.private_profile,
    discoverableProfile: profile.discoverable_profile ?? true,
    notificationsFollowers: profile.notifications_followers ?? true,
    notificationsSaves: profile.notifications_saves ?? true,
    notificationsRecommendations: profile.notifications_recommendations ?? false,
    avatarUrl: getFullMediaUrl(profile.avatar),
    avatarColor: profile.avatar_color || 'bg-pink-500',
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
      adAdsEnabled: djangoUser.subscription?.ad_ads_enabled ?? profile.ad_ads_enabled ?? true,
      partnerAdsEnabled: djangoUser.subscription?.partner_ads_enabled ?? profile.partner_ads_enabled ?? true,
      tipsEnabled: djangoUser.subscription?.tips_enabled ?? profile.tips_enabled ?? false,
      tipsUrl: djangoUser.subscription?.tips_url ?? profile.tips_url ?? '',
      cancelAtPeriodEnd: djangoUser.subscription?.cancel_at_period_end ?? profile.subscription_cancel_at_period_end ?? false,
      scheduledPlan: djangoUser.subscription?.scheduled_plan ?? profile.subscription_scheduled_plan ?? null,
      trialEligible: djangoUser.subscription?.trial_eligible ?? false,
      trialConsumedAt: djangoUser.subscription?.trial_consumed_at ?? profile.subscription_trial_consumed_at ?? null,
      digestCreatorWeekly: djangoUser.subscription?.digest_creator_weekly ?? true,
    },
    boards: djangoUser.boards || [],
    birthDate: profile.birth_date ?? null,
  }
}

export function useAuth() {
  function clearAuthState() {
    inMemoryAccessToken.value = null
    delete api.defaults.headers.common.Authorization
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('pinova_token')
      window.localStorage.removeItem('pinova_refresh_token')
    }
    currentUser.value = null
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

  async function fetchCurrentUser() {
    isInitializing.value = true
    devLog('📡 Fetching user from API...')
    try {
      const response = await api.get('me/')
      if (response.data) {
        devLog('✅ User received:', response.data.username)
        currentUser.value = mapDjangoUserToFrontend(response.data)
      }
    } catch (err) {
      if (!currentUser.value) {
        currentUser.value = null
      }
      console.warn('❌ Session absente ou expirée.')
    } finally {
      isInitializing.value = false
    }
  }

  async function fetchUserProfile(username: string, opts?: { share?: string | null }): Promise<User | null> {
    try {
      const params = opts?.share ? { share: opts.share } : {}
      const response = await api.get(`profiles/${username}/`, { params })
      return mapDjangoUserToFrontend(response.data)
    } catch (err) {
      console.error(`❌ Erreur lors du chargement du profil ${username}:`, err)
      return null
    }
  }

  async function toggleFollow(username: string) {
    try {
      const response = await api.post(`profiles/${username}/follow/`)
      return response.data
    } catch (err) {
      console.error('Error toggling follow:', err)
      throw err
    }
  }

  async function updateProfile(data: { displayName?: string, bio?: string, email?: string, avatar?: File, preferredLanguage?: string, preferredCurrency?: string, birthDate?: string | null, adAdsEnabled?: boolean, partnerAdsEnabled?: boolean, tipsEnabled?: boolean, tipsUrl?: string, privateProfile?: boolean, discoverableProfile?: boolean, notificationsFollowers?: boolean, notificationsSaves?: boolean, notificationsRecommendations?: boolean, notificationsDigestCreatorWeekly?: boolean }) {
    try {
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
      if (data.adAdsEnabled !== undefined) formData.append('ad_ads_enabled', data.adAdsEnabled ? 'true' : 'false')
      if (data.partnerAdsEnabled !== undefined) formData.append('partner_ads_enabled', data.partnerAdsEnabled ? 'true' : 'false')
      if (data.tipsEnabled !== undefined) formData.append('tips_enabled', data.tipsEnabled ? 'true' : 'false')
      if (data.tipsUrl !== undefined) formData.append('tips_url', data.tipsUrl)
      if (data.privateProfile !== undefined) formData.append('private_profile', data.privateProfile ? 'true' : 'false')
      if (data.discoverableProfile !== undefined) formData.append('discoverable_profile', data.discoverableProfile ? 'true' : 'false')
      if (data.notificationsFollowers !== undefined) formData.append('notifications_followers', data.notificationsFollowers ? 'true' : 'false')
      if (data.notificationsSaves !== undefined) formData.append('notifications_saves', data.notificationsSaves ? 'true' : 'false')
      if (data.notificationsRecommendations !== undefined) formData.append('notifications_recommendations', data.notificationsRecommendations ? 'true' : 'false')
      if (data.notificationsDigestCreatorWeekly !== undefined) {
        formData.append('notifications_digest_creator_weekly', data.notificationsDigestCreatorWeekly ? 'true' : 'false')
      }

      const response = await api.patch('me/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      if (response.data) {
        currentUser.value = mapDjangoUserToFrontend(response.data)
      }
      return response.data
    } catch (err) {
      console.error('Error updating profile:', err)
      throw err
    }
  }

  async function login(email: string, password: string) {
    try {
      const response = await api.post('auth/login/', { email, password })
      if (response.data?.access) {
        applyAccessToken(response.data.access)
      }
      if (response.data?.refresh && typeof window !== 'undefined') {
        window.localStorage.setItem('pinova_refresh_token', response.data.refresh)
      }
      if (response.data?.user) {
        currentUser.value = mapDjangoUserToFrontend(response.data.user)
      }
      
      // Get full user profile after login
      await fetchCurrentUser()
      return { 
        success: true,
        access: response.data?.access,
        refresh: response.data?.refresh,
      }
    } catch (err: any) {
      console.error('Login error:', err)
      clearAuthState()
      const errorMsg = err.response?.data?.non_field_errors?.[0] || 'Identifiants incorrects.'
      return { success: false, error: errorMsg }
    }
  }

  async function register(data: any) {
    try {
      const payload = {
        email: data.email,
        username: data.email.split('@')[0], // Utilise le début de l'email comme username
        password1: data.password,
        password2: data.password,
        display_name: data.displayName
      }
      await api.post('auth/registration/', payload)
      // Ne pas stocker le token immédiatement car l'email doit être vérifié via OTP
      return { success: true }
    } catch (err: any) {
      console.error('Register error:', err)
      const errorMsg = Object.values(err.response?.data || {}).flat()[0] as string
      return { success: false, error: errorMsg || 'Erreur lors de la création du compte.' }
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

      const response = await api.post(`auth/social/${provider}/`, payload)
      if (response.data?.access) {
        applyAccessToken(response.data.access)
      }
      if (response.data?.refresh && typeof window !== 'undefined') {
        window.localStorage.setItem('pinova_refresh_token', response.data.refresh)
      }
      if (response.data?.user) {
        currentUser.value = mapDjangoUserToFrontend(response.data.user)
      }
      await fetchCurrentUser()
      return { 
        success: true, 
        access: response.data?.access, 
        refresh: response.data?.refresh, 
      }
    } catch (err: any) {
      console.error(`${provider} login error:`, err)
      clearAuthState()
      return { success: false, error: `Erreur lors de la connexion avec ${provider}.` }
    }
  }

  function logout() {
    const hadToken = !!inMemoryAccessToken.value
    const refreshToken = typeof window !== 'undefined' ? window.localStorage.getItem('pinova_refresh_token') : null
    clearAuthState()
    if (hadToken) {
      api.post('auth/logout/', refreshToken ? { refresh: refreshToken } : undefined).catch(() => undefined)
    }
    devLog('🚪 Logged out successfully.')
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

  async function fetchMyBoards() {
    const response = await api.get('boards/')
    const raw = response.data?.results ?? response.data
    const list = Array.isArray(raw) ? raw : []
    return list.map((b: Record<string, unknown>) => ({
      id: Number(b.id),
      name: String(b.name ?? ''),
      is_private: !!(b.is_private ?? b.isPrivate),
      /** Absent avant backend : défaut réservé (true). */
      is_owner: b.is_owner === undefined ? true : !!b.is_owner,
      pin_count: Number(b.pin_count ?? b.pinCount ?? 0),
      collaborator_count: Number(b.collaborator_count ?? b.collaboratorCount ?? 0),
      preview_images: (b.preview_images as string[] | undefined) ?? (b.previewImages as string[] | undefined) ?? [],
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
    await fetchCurrentUser()
    return response.data
  }

  async function startPlusTrial() {
    const response = await api.post('subscription/trial/start/')
    await fetchCurrentUser()
    return response.data
  }

  async function fetchSubscriptionInvoices() {
    const response = await api.get('subscription/invoices/')
    return response.data?.results || []
  }

  async function fetchSupportTickets() {
    const response = await api.get('support/tickets/')
    return response.data?.results || []
  }

  async function createSupportTicket(subject: string, message: string) {
    const response = await api.post('support/tickets/', { subject, message })
    return response.data
  }

  return {
    currentUser,
    isAuthenticated,
    isInitializing,
    login,
    register,
    logout,
    updateProfile,
    forgotPassword,
    resetPassword,
    socialLogin,
    toggleSavePin,
    toggleFollow,
    fetchCurrentUser,
    fetchUserProfile,
    createBoard,
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
    fetchSupportTickets,
    createSupportTicket,
  }
}
