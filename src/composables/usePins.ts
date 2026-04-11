import { ref, computed } from 'vue'
import type { Pin } from '../types'
import api from '../api'
import { API_BASE_URL } from '../env'

const pins = ref<Pin[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const currentPage = ref(1)
const hasNextPage = ref(true)
const isFetchingNextPage = ref(false)

function getFullMediaUrl(url: string | null): string {
  if (!url) return ''
  if (url.startsWith('http')) return url
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`
}

// Mapper pour convertir les données Django vers le format attendu par le Frontend
function mapDjangoPinToFrontend(djangoPin: any): Pin {
  const author = djangoPin.author_profile || {}
  return {
    id: djangoPin.id,
    title: djangoPin.title,
    description: djangoPin.description,
    imageUrl: getFullMediaUrl(djangoPin.image),
    user: author.display_name || author.username || 'Inconnu',
    userId: author.id,
    userAvatarUrl: getFullMediaUrl(author.avatar),
    userAvatarColor: author.avatar_color || 'bg-gray-400',
    link: '',
    stats: { 
      saves: djangoPin.saves_count || 0, 
      reactions: djangoPin.likes_count || 0 
    },
    topic: djangoPin.topic || 'Général',
    createdAt: djangoPin.created_at,
    liked: djangoPin.is_liked || false,
    saved: djangoPin.is_saved || false,
    isFollowing: author.is_following || false,
  }
}

export function usePins() {
  const topics = computed(() => {
    const set = new Set<string>()
    pins.value.forEach((pin) => set.add(pin.topic))
    return Array.from(set).sort()
  })

  async function fetchPins(reset = false) {
    if (reset) {
      currentPage.value = 1
      hasNextPage.value = true
      pins.value = []
    }
    
    if (!hasNextPage.value || loading.value || isFetchingNextPage.value) return

    loading.value = currentPage.value === 1
    isFetchingNextPage.value = currentPage.value > 1
    error.value = null
    
    console.log(`📡 Fetching pins page ${currentPage.value}...`)
    try {
      const response = await api.get('pins/', {
        params: { page: currentPage.value }
      })
      
      const pinsData = response.data.results || response.data
      const next = response.data.next
      
      if (Array.isArray(pinsData) && pinsData.length > 0) {
        const newPins = pinsData.map(mapDjangoPinToFrontend)
        pins.value = [...pins.value, ...newPins]
        currentPage.value++
        hasNextPage.value = !!next
      } else {
        hasNextPage.value = false
      }
    } catch (err) {
      console.warn('❌ Erreur lors de la récupération des pins.')
      hasNextPage.value = false
    } finally {
      loading.value = false
      isFetchingNextPage.value = false
    }
  }

  async function fetchRecommendations(reset = false) {
    if (reset) {
      currentPage.value = 1
      hasNextPage.value = true
      pins.value = []
    }

    if (!hasNextPage.value || loading.value || isFetchingNextPage.value) return

    loading.value = currentPage.value === 1
    isFetchingNextPage.value = currentPage.value > 1
    error.value = null
    
    try {
      const response = await api.get('pins/recommendations/', {
        params: { page: currentPage.value }
      })
      
      const pinsData = response.data.results || response.data
      const next = response.data.next

      if (Array.isArray(pinsData) && pinsData.length > 0) {
        const newPins = pinsData.map(mapDjangoPinToFrontend)
        pins.value = [...pins.value, ...newPins]
        currentPage.value++
        hasNextPage.value = !!next
      } else {
        hasNextPage.value = false
      }
    } catch (err) {
      console.warn('Error fetching recommendations, falling back to all pins')
      await fetchPins(reset)
    } finally {
      loading.value = false
      isFetchingNextPage.value = false
    }
  }

  async function toggleLike(pinId: number) {
    try {
      const response = await api.post(`pins/${pinId}/like/`)
      const pin = pins.value.find(p => p.id === pinId)
      if (pin) {
        pin.liked = response.data.status === 'liked'
        pin.stats.reactions = response.data.likes_count
      }
      return response.data
    } catch (err) {
      console.error('Error toggling like:', err)
      throw err
    }
  }

  async function fetchComments(pinId: number) {
    try {
      const response = await api.get(`pins/${pinId}/comments/`)
      return response.data
    } catch (err) {
      console.error('Error fetching comments:', err)
      return []
    }
  }

  async function addComment(pinId: number, text: string) {
    try {
      const response = await api.post(`pins/${pinId}/comments/`, { text })
      const pin = pins.value.find(p => p.id === pinId)
      if (pin) {
        pin.stats.reactions += 0 // On pourrait mettre à jour le count ici si on l'avait séparément
      }
      return response.data
    } catch (err) {
      console.error('Error adding comment:', err)
      throw err
    }
  }

  async function addPin(pinData: FormData) {
    loading.value = true
    try {
      // Pour Django, on envoie un FormData car il y a une image
      const response = await api.post('pins/', pinData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      const newPin = mapDjangoPinToFrontend(response.data)
      pins.value.unshift(newPin)
      return newPin
    } catch (err) {
      console.error('Erreur lors de l\'ajout du pin:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  function getPin(id: number): Pin | undefined {
    return pins.value.find((p) => p.id === id)
  }

  async function toggleSave(id: number) {
    try {
      const response = await api.post(`pins/${id}/save/`)
      const pin = pins.value.find((p) => p.id === id)
      if (pin) {
        pin.saved = response.data.status === 'saved'
        pin.stats.saves = response.data.saves_count
        
        // Cache image proactively if saved
        if (pin.saved && pin.imageUrl && 'caches' in window) {
          try {
            const cache = await caches.open('local-media-cache')
            const response = await fetch(pin.imageUrl, { mode: 'no-cors' })
            if (response.ok || response.type === 'opaque') {
              await cache.put(pin.imageUrl, response)
              console.log('✅ Image cached for offline:', pin.imageUrl)
            }
          } catch (e) {
            console.warn('Failed to proactively cache image:', e)
          }
        }
      }
      return response.data
    } catch (err) {
      console.error('Error toggling save:', err)
      throw err
    }
  }

  async function toggleFollow(profileId: number) {
    try {
      const response = await api.post(`profiles/${profileId}/follow/`)
      const isFollowed = response.data.status === 'followed'
      
      // Update all pins from this author
      pins.value.forEach(pin => {
        if (pin.userId === profileId) {
          pin.isFollowing = isFollowed
        }
      })
      
      return response.data
    } catch (err) {
      console.error('Error toggling follow:', err)
      throw err
    }
  }

  function formatCount(count: number): string {
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M'
    if (count >= 1000) return (count / 1000).toFixed(1) + 'k'
    return count.toString()
  }

  return {
    pins,
    topics,
    loading,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchPins,
    fetchRecommendations,
    addPin,
    getPin,
    toggleSave,
    toggleLike,
    toggleFollow,
    fetchComments,
    addComment,
    formatCount,
  }
}
