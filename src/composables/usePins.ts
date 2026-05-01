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
const savePendingBySlug = ref<Record<string, boolean>>({})
const likePendingBySlug = ref<Record<string, boolean>>({})
const followPendingByUsername = ref<Record<string, boolean>>({})

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
    boards: (djangoPin.boards || []).map((board: any) => ({
      id: board.id,
      name: board.name,
      isPrivate: !!board.is_private,
    })),
    certifiedCredit: djangoPin.certified_credit || false,
    provenanceRootHash: djangoPin.provenance_root_hash || '',
    createdAt: djangoPin.created_at,
    liked: djangoPin.is_liked || false,
    saved: djangoPin.is_saved || false,
    isFollowing: author.is_following || false,
  }
}

export function usePins() {
  const setPendingFlag = (store: Record<string, boolean>, key: string, value: boolean) => {
    if (!key) return
    if (value) {
      store[key] = true
      return
    }
    delete store[key]
  }

  const isPinSavePending = (slug: string) => !!savePendingBySlug.value[slug]
  const isPinLikePending = (slug: string) => !!likePendingBySlug.value[slug]
  const isAuthorFollowPending = (username: string) => !!followPendingByUsername.value[username]

  const topics = computed(() => {
    const counts = new Map<string, number>()
    pins.value.forEach((pin) => {
      counts.set(pin.topic, (counts.get(pin.topic) || 0) + 1)
    })
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 10)
      .map(([topic]) => topic)
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
    const pin = pins.value.find((p) => p.slug === pinSlug)
    const previousLiked = pin?.liked ?? false
    const previousReactions = pin?.stats.reactions ?? 0
    if (pin) {
      pin.liked = !previousLiked
      pin.stats.reactions = Math.max(0, previousReactions + (pin.liked ? 1 : -1))
    }
    setPendingFlag(likePendingBySlug.value, pinSlug, true)
    try {
      const response = await api.post(`pins/${pinSlug}/like/`)
      if (pin) {
        pin.liked = response.data.status === 'liked'
        pin.stats.reactions = response.data.likes_count
      }
      return response.data
    } catch (err) {
      if (pin) {
        pin.liked = previousLiked
        pin.stats.reactions = previousReactions
      }
      console.error('Error toggling like:', err)
      throw err
    } finally {
      setPendingFlag(likePendingBySlug.value, pinSlug, false)
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
    const pin = pins.value.find((p) => p.slug === slug)
    const previousSaved = pin?.saved ?? false
    const previousSaves = pin?.stats.saves ?? 0
    if (pin) {
      pin.saved = !previousSaved
      pin.stats.saves = Math.max(0, previousSaves + (pin.saved ? 1 : -1))
    }
    setPendingFlag(savePendingBySlug.value, slug, true)
    try {
      const response = await api.post(`pins/${slug}/save/`)
      if (pin) {
        pin.saved = response.data.status === 'saved'
        pin.stats.saves = response.data.saves_count
      }
      return response.data
    } catch (err) {
      if (pin) {
        pin.saved = previousSaved
        pin.stats.saves = previousSaves
      }
      console.error('Error toggling save:', err)
      throw err
    } finally {
      setPendingFlag(savePendingBySlug.value, slug, false)
    }
  }

  async function toggleFollow(username: string) {
    const affectedPins = pins.value.filter((pin) => pin.username === username)
    const previousFollowState = affectedPins.map((pin) => pin.isFollowing)
    affectedPins.forEach((pin) => {
      pin.isFollowing = !pin.isFollowing
    })
    setPendingFlag(followPendingByUsername.value, username, true)
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
      affectedPins.forEach((pin, index) => {
        pin.isFollowing = previousFollowState[index]
      })
      console.error('Error toggling follow:', err)
      throw err
    } finally {
      setPendingFlag(followPendingByUsername.value, username, false)
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
    isPinSavePending,
    isPinLikePending,
    isAuthorFollowPending,
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
