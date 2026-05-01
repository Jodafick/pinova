import { ref, computed } from 'vue'
import type { User } from '../types'
import api, { AUTH_INVALIDATED_EVENT } from '../api'
import { API_BASE_URL } from '../env'

const defaultUser: User = {
  id: 1,
  username: 'admin',
  displayName: 'Admin Pinova',
  email: 'admin@pinova.local',
  preferredLanguage: 'fr',
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
  },
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
    email: djangoUser.email,
    preferredLanguage: profile.preferred_language || 'fr',
    avatarUrl: getFullMediaUrl(profile.avatar),
    avatarColor: profile.avatar_color || 'bg-pink-500',
    bio: profile.bio || '',
    followers: profile.followers_count || 0,
    following: profile.following_count || 0,
    isFollowing: profile.is_following || false,
    savedPins: djangoUser.saved_pins || [],
    subscription: {
      plan: djangoUser.subscription?.plan || profile.subscription_plan || 'free',
      renewalAt: djangoUser.subscription?.renewal_at || profile.subscription_renewal_at || null,
      translationQuotaMonthly: djangoUser.subscription?.translation_quota_monthly || profile.translation_quota_monthly || 5,
      translationUsedMonthly: djangoUser.subscription?.translation_used_monthly || profile.translation_used_monthly || 0,
    },
    boards: djangoUser.boards || [],
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
    console.log('📡 Fetching user from API...')
    try {
      const response = await api.get('me/')
      if (response.data) {
        console.log('✅ User received:', response.data.username)
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

  async function fetchUserProfile(username: string): Promise<User | null> {
    try {
      const response = await api.get(`profiles/${username}/`)
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

  async function updateProfile(data: { displayName?: string, bio?: string, email?: string, avatar?: File, preferredLanguage?: string }) {
    try {
      const formData = new FormData()
      if (data.displayName) formData.append('display_name', data.displayName)
      if (data.bio !== undefined) formData.append('bio', data.bio)
      if (data.email) formData.append('email', data.email)
      if (data.avatar) formData.append('avatar', data.avatar)
      if (data.preferredLanguage) formData.append('preferred_language', data.preferredLanguage)
      
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
    console.log('🚪 Logged out successfully.')
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
    return response.data?.results || response.data || []
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
  }
}
