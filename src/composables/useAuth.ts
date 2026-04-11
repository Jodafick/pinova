import { ref, computed } from 'vue'
import type { User } from '../types'
import api from '../api'

const defaultUser: User = {
  id: 1,
  username: 'admin',
  displayName: 'Admin Pinova',
  email: 'admin@pinova.local',
  avatarColor: 'bg-pink-500',
  bio: 'Développeur et passionné de design.',
  followers: 120,
  following: 85,
  boards: [],
  savedPins: [],
}

const currentUser = ref<User | null>(null)
const isAuthenticated = computed(() => currentUser.value !== null)
const isInitializing = ref(true)
const token = ref<string | null>(localStorage.getItem('pinova_token'))

const API_BASE_URL = 'http://127.0.0.1:8000'

function getFullMediaUrl(url: string | null): string | undefined {
  if (!url) return undefined
  if (url.startsWith('http')) return url
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`
}

function mapDjangoUserToFrontend(djangoUser: any): User {
  if (!djangoUser) return defaultUser
  const profile = djangoUser.profile || {}
  // On utilise l'ID du profile pour être cohérent avec l'API follow
  return {
    id: profile.id || djangoUser.id,
    username: djangoUser.username,
    displayName: profile.display_name || djangoUser.username,
    email: djangoUser.email,
    avatarUrl: getFullMediaUrl(profile.avatar),
    avatarColor: profile.avatar_color || 'bg-pink-500',
    bio: profile.bio || '',
    followers: profile.followers_count || 0,
    following: profile.following_count || 0,
    isFollowing: profile.is_following || false,
    boards: (djangoUser.boards || []).map((b: any) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      coverUrl: '', // Could be the image of the first pin in the board
      pinCount: b.pin_count || 0,
      isPrivate: b.is_private || false
    })),
    savedPins: djangoUser.saved_pins || [],
  }
}

export function useAuth() {
  async function fetchCurrentUser() {
    if (!token.value) {
      isInitializing.value = false
      return
    }
    isInitializing.value = true
    console.log('📡 Fetching user from API...')
    try {
      const response = await api.get('me/')
      if (response.data) {
        console.log('✅ User received:', response.data.username)
        currentUser.value = mapDjangoUserToFrontend(response.data)
      }
    } catch (err) {
      console.warn('❌ Backend injoignable ou token invalide.')
      logout()
    } finally {
      isInitializing.value = false
    }
  }

  async function fetchUserProfile(id: string | number): Promise<User | null> {
    try {
      const response = await api.get(`profiles/${id}/`)
      return mapDjangoUserToFrontend(response.data)
    } catch (err) {
      console.error(`❌ Erreur lors du chargement du profil ${id}:`, err)
      return null
    }
  }

  async function toggleFollow(profileId: number) {
    try {
      const response = await api.post(`profiles/${profileId}/follow/`)
      return response.data
    } catch (err) {
      console.error('Error toggling follow:', err)
      throw err
    }
  }

  async function updateProfile(data: { displayName?: string, bio?: string, email?: string, avatar?: File }) {
    try {
      const formData = new FormData()
      if (data.displayName) formData.append('display_name', data.displayName)
      if (data.bio !== undefined) formData.append('bio', data.bio)
      if (data.email) formData.append('email', data.email)
      if (data.avatar) formData.append('avatar', data.avatar)
      
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
      // dj-rest-auth with JWT returns access and refresh tokens
      token.value = response.data.access
      if (token.value) {
        localStorage.setItem('pinova_token', token.value)
      }
      if (response.data.refresh) {
        localStorage.setItem('pinova_refresh_token', response.data.refresh)
      }
      
      // Get full user profile after login
      await fetchCurrentUser()
      return { success: true }
    } catch (err: any) {
      console.error('Login error:', err)
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
      token.value = response.data.access
      if (token.value) {
        localStorage.setItem('pinova_token', token.value)
      }
      await fetchCurrentUser()
      return { success: true }
    } catch (err: any) {
      console.error(`${provider} login error:`, err)
      return { success: false, error: `Erreur lors de la connexion avec ${provider}.` }
    }
  }

  function logout() {
    currentUser.value = null
    token.value = null
    localStorage.removeItem('pinova_token')
    localStorage.removeItem('pinova_refresh_token')
    console.log('🚪 Logged out successfully.')
  }

  async function createBoard(data: { name: string, description?: string, is_private?: boolean }) {
    try {
      const response = await api.post('boards/', data)
      if (currentUser.value) {
        currentUser.value.boards.push({
          id: response.data.id,
          name: response.data.name,
          description: response.data.description,
          coverUrl: '',
          pinCount: 0,
          isPrivate: response.data.is_private
        })
      }
      return response.data
    } catch (err) {
      console.error('Error creating board:', err)
      throw err
    }
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
    createBoard
  }
}
