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

type PaginatedResponse<T> = {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

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
    slug: djangoPin.slug,
    title: djangoPin.title,
    description: djangoPin.description,
    imageUrl: getFullMediaUrl(djangoPin.image),
    user: author.display_name || author.username || 'Inconnu',
    username: author.username || 'inconnu',
    userId: author.id,
    userAvatarUrl: getFullMediaUrl(author.avatar),
    userAvatarColor: author.avatar_color || 'bg-gray-400',
    link: '',
    stats: { 
      saves: djangoPin.saves_count || 0, 
      reactions: djangoPin.likes_count || 0 
    },
    topic: djangoPin.topic || 'Général',
    visibility: djangoPin.visibility || 'public',
    hashtags: djangoPin.hashtags || [],
    privateTags: djangoPin.private_tags || [],
    certifiedCredit: djangoPin.certified_credit || false,
    provenanceRootHash: djangoPin.provenance_root_hash || '',
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

  async function fetchPins(reset = false, topic?: string | null) {
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
        params: {
          page: currentPage.value,
          ...(topic ? { topic } : {}),
        }
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

  async function toggleLike(pinSlug: string) {
    try {
      const response = await api.post(`pins/${pinSlug}/like/`)
      const pin = pins.value.find(p => p.slug === pinSlug)
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

  async function fetchComments(
    pinSlug: string,
    page = 1,
    sort: 'recent' | 'relevant' = 'recent',
    highlightCommentId?: number | null,
  ) {
    try {
      const response = await api.get(`pins/${pinSlug}/comments/`, {
        params: {
          page,
          sort,
          ...(highlightCommentId ? { highlight_comment_id: highlightCommentId } : {}),
        },
      })
      const data = response.data
      if (Array.isArray(data)) {
        return {
          count: data.length,
          next: null,
          previous: null,
          results: data,
        } as PaginatedResponse<any>
      }
      return data as PaginatedResponse<any>
    } catch (err) {
      console.error('Error fetching comments:', err)
      return { count: 0, next: null, previous: null, results: [] } as PaginatedResponse<any>
    }
  }

  async function fetchCommentReplies(
    commentId: number,
    page = 1,
    sort: 'recent' | 'relevant' = 'recent',
    highlightCommentId?: number | null,
  ) {
    try {
      const response = await api.get(`pins/comments/${commentId}/replies/`, {
        params: {
          page,
          sort,
          ...(highlightCommentId ? { highlight_comment_id: highlightCommentId } : {}),
        },
      })
      const data = response.data
      if (Array.isArray(data)) {
        return {
          count: data.length,
          next: null,
          previous: null,
          results: data,
        } as PaginatedResponse<any>
      }
      return data as PaginatedResponse<any>
    } catch (err) {
      console.error('Error fetching comment replies:', err)
      return { count: 0, next: null, previous: null, results: [] } as PaginatedResponse<any>
    }
  }

  async function addComment(
    pinSlug: string,
    payload: { text: string; gif?: string | null; parentId?: number | null },
  ) {
    try {
      const response = await api.post(`pins/${pinSlug}/comments/`, payload)
      const pin = pins.value.find(p => p.slug === pinSlug)
      if (pin) {
        pin.stats.reactions += 0 // On pourrait mettre à jour le count ici si on l'avait séparément
      }
      return response.data
    } catch (err) {
      console.error('Error adding comment:', err)
      throw err
    }
  }

  async function translatePinDescription(pinSlug: string, targetLang = 'fr') {
    const response = await api.post(`pins/${pinSlug}/translate-description/`, {
      target_lang: targetLang,
    })
    return response.data
  }

  async function translateComment(commentId: number, targetLang = 'fr') {
    const response = await api.post(`pins/comments/${commentId}/translate/`, {
      target_lang: targetLang,
    })
    return response.data
  }

  async function toggleCommentLike(commentId: number) {
    const response = await api.post(`pins/comments/${commentId}/like/`)
    return response.data
  }

  async function fetchProvenance(pinSlug: string) {
    const response = await api.get(`pins/${pinSlug}/provenance/`)
    return response.data
  }

  async function fetchPrivateTags(pinSlug: string) {
    const response = await api.get(`pins/${pinSlug}/private-tags/`)
    return response.data.tags || []
  }

  async function savePrivateTags(pinSlug: string, tags: string[]) {
    const response = await api.post(`pins/${pinSlug}/private-tags/`, { tags })
    return response.data.tags || []
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

  function getPin(slug: string): Pin | undefined {
    return pins.value.find((p) => p.slug === slug)
  }

  async function toggleSave(slug: string) {
    try {
      const response = await api.post(`pins/${slug}/save/`)
      const pin = pins.value.find((p) => p.slug === slug)
      if (pin) {
        pin.saved = response.data.status === 'saved'
        pin.stats.saves = response.data.saves_count
      }
      return response.data
    } catch (err) {
      console.error('Error toggling save:', err)
      throw err
    }
  }

  async function toggleFollow(username: string) {
    try {
      const response = await api.post(`profiles/${username}/follow/`)
      const isFollowed = response.data.status === 'followed'
      
      // Update all pins from this author
      pins.value.forEach(pin => {
        if (pin.username === username) {
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
    fetchCommentReplies,
    addComment,
    translatePinDescription,
    translateComment,
    toggleCommentLike,
    fetchProvenance,
    fetchPrivateTags,
    savePrivateTags,
    formatCount,
  }
}
