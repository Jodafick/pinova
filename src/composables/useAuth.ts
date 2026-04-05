import { ref, computed } from 'vue'
import type { User } from '../types'

const currentUser = ref<User | null>(null)
const isAuthenticated = computed(() => currentUser.value !== null)

const STORAGE_KEY = 'pinterest_user'
const USERS_KEY = 'pinterest_users'

function loadUser() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    try {
      currentUser.value = JSON.parse(stored)
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }
}

function getUsers(): User[] {
  const stored = localStorage.getItem(USERS_KEY)
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      return []
    }
  }
  return []
}

function saveUsers(users: User[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

const defaultUser: User = {
  id: 1,
  username: 'utilisateur',
  displayName: 'Utilisateur',
  email: 'utilisateur@pinterest.local',
  avatarColor: 'bg-red-500',
  bio: '',
  followers: 12,
  following: 34,
  boards: [
    {
      id: 2,
      name: 'Mes favoris',
      description: 'Pins enregistrés',
      coverUrl: '',
      pinCount: 0,
      isPrivate: false,
    },
  ],
  savedPins: [],
}

export function useAuth() {
  loadUser()
  // Auto-login avec un utilisateur par défaut si personne n'est connecté
  if (!currentUser.value) {
    currentUser.value = defaultUser
  }

  function login(email: string, password: string): { success: boolean; error?: string } {
    const users = getUsers()
    const user = users.find((u) => u.email === email)
    if (!user) {
      return { success: false, error: 'Aucun compte trouvé avec cet email.' }
    }
    const passwords: Record<string, string> = JSON.parse(localStorage.getItem('pinterest_passwords') || '{}')
    if (passwords[email] !== password) {
      return { success: false, error: 'Mot de passe incorrect.' }
    }
    currentUser.value = user
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    return { success: true }
  }

  function register(data: {
    displayName: string
    username: string
    email: string
    password: string
  }): { success: boolean; error?: string } {
    const users = getUsers()
    if (users.find((u) => u.email === data.email)) {
      return { success: false, error: 'Un compte existe déjà avec cet email.' }
    }
    if (users.find((u) => u.username === data.username)) {
      return { success: false, error: "Ce nom d'utilisateur est déjà pris." }
    }

    const avatarColors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500', 'bg-pink-500', 'bg-teal-500']
    const color = avatarColors[Math.floor(Math.random() * avatarColors.length)]!

    const newUser: User = {
      id: Date.now(),
      username: data.username,
      displayName: data.displayName,
      email: data.email,
      avatarColor: color,
      bio: '',
      followers: 0,
      following: 0,
      boards: [
        {
          id: Date.now() + 1,
          name: 'Mes favoris',
          description: 'Pins enregistrés',
          coverUrl: '',
          pinCount: 0,
          isPrivate: false,
        },
      ],
      savedPins: [],
    }

    users.push(newUser)
    saveUsers(users)

    const passwords: Record<string, string> = JSON.parse(localStorage.getItem('pinterest_passwords') || '{}')
    passwords[data.email] = data.password
    localStorage.setItem('pinterest_passwords', JSON.stringify(passwords))

    currentUser.value = newUser
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser))
    return { success: true }
  }

  function logout() {
    currentUser.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  function updateProfile(updates: Partial<Pick<User, 'displayName' | 'bio' | 'username'>>) {
    if (!currentUser.value) return
    Object.assign(currentUser.value, updates)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentUser.value))
    const users = getUsers()
    const idx = users.findIndex((u) => u.id === currentUser.value!.id)
    if (idx !== -1) {
      users[idx] = { ...users[idx]!, ...updates }
      saveUsers(users)
    }
  }

  function toggleSavePin(pinId: number) {
    if (!currentUser.value) return
    const idx = currentUser.value.savedPins.indexOf(pinId)
    if (idx === -1) {
      currentUser.value.savedPins.push(pinId)
    } else {
      currentUser.value.savedPins.splice(idx, 1)
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentUser.value))
  }

  function isPinSaved(pinId: number): boolean {
    return currentUser.value?.savedPins.includes(pinId) ?? false
  }

  return {
    currentUser,
    isAuthenticated,
    login,
    register,
    logout,
    updateProfile,
    toggleSavePin,
    isPinSaved,
  }
}
