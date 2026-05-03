import { ref, computed } from 'vue'
import type { Pin, PinLikersResponse } from '../types'
import api from '../api'
import { API_BASE_URL } from '../env'
import { useI18n } from '../i18n'
import { DEFAULT_AVATAR_COLOR_CLASS } from './useAuth'

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

export function getFullMediaUrl(url: string | null): string {
  if (!url) return ''
  if (url.startsWith('http')) return url
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`
}

// Mapper pour convertir les données Django vers le format attendu par le Frontend
export function mapDjangoPinToFrontend(djangoPin: any): Pin {
  const author = djangoPin.author_profile || {}
  return {
    id: djangoPin.id,
    slug: djangoPin.slug,
    title: djangoPin.title,
    description: djangoPin.description,
    imageUrl: djangoPin.image ? getFullMediaUrl(djangoPin.image) : '',
    storyVideoUrl: djangoPin.story_video_url ? getFullMediaUrl(djangoPin.story_video_url) : '',
    user: author.display_name || author.username || 'Inconnu',
    username: author.username || 'inconnu',
    userId: author.id,
    userAvatarUrl: getFullMediaUrl(author.avatar),
    userAvatarColor: author.avatar_color || DEFAULT_AVATAR_COLOR_CLASS,
    authorTipsEnabled: !!author.tips_enabled,
    authorTipsUrl: author.tips_url || '',
    link: djangoPin.link || '',
    stats: { 
      saves: djangoPin.saves_count || 0, 
      reactions: djangoPin.likes_count || 0 
    },
    topic: (djangoPin.topic_meta?.originalName ?? djangoPin.topic) || 'Général',
    topicDisplay: (djangoPin.topic_meta?.name ?? djangoPin.topic) || 'Général',
    visibility: djangoPin.visibility || 'public',
    commentsPolicy: djangoPin.comments_policy || 'open',
    canComment: djangoPin.can_comment !== false,
    hashtags: djangoPin.hashtags || [],
    privateTags: djangoPin.private_tags || [],
    boards: (djangoPin.boards || []).map((board: any) => ({
      id: board.id,
      name: board.name,
      isPrivate: !!board.is_private,
      position: typeof board.position === 'number' ? board.position : undefined,
      ownerUsername: board.owner_username || djangoPin.author_profile?.username || undefined,
    })),
    scheduledPublishAt: djangoPin.scheduled_publish_at || null,
    createdAt: djangoPin.created_at,
    liked:
      djangoPin.is_liked === true ||
      djangoPin.is_liked === 1 ||
      djangoPin.isLiked === true,
    saved: djangoPin.is_saved || false,
    isFollowing: author.is_following || false,
    authorFollowersCount: typeof author.followers_count === 'number' ? author.followers_count : 0,
    isStory: !!djangoPin.is_story,
    /** Story Plus/Pro sans pin en grille après 24 h (purge serveur). */
    storyEphemeral: !!djangoPin.story_ephemeral,
    storyExpiresAt: djangoPin.story_expires_at ?? undefined,
    mediaSensitiveBlur: !!djangoPin.media_sensitive_blur,
    viewerHasReported: !!djangoPin.viewer_has_reported,
  }
}

export function isAlreadyReportedError(err: unknown): boolean {
  const ax = err as { response?: { status?: number; data?: { error?: string } } }
  return ax.response?.status === 409 || ax.response?.data?.error === 'already_reported'
}

export function usePins() {
  const { currentLang } = useI18n()
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
    const counts = new Map<string, { count: number; label: string }>()
    pins.value.forEach((pin) => {
      const canonical = pin.topic
      const label = pin.topicDisplay ?? pin.topic
      const prev = counts.get(canonical)
      counts.set(canonical, {
        count: (prev?.count ?? 0) + 1,
        label: prev?.label ?? label,
      })
    })
    return Array.from(counts.entries())
      .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
      .slice(0, 10)
      .map(([canonical, v]) => ({ canonical, label: v.label }))
  })

  const loadPinCollection = async (
    endpoint: string,
    reset = false,
    extraParams: Record<string, string | number | null | undefined> = {},
  ) => {
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
      const response = await api.get(endpoint, {
        params: {
          page: currentPage.value,
          lang: currentLang.value,
          ...extraParams,
        },
      })
      const pinsData = response.data.results || response.data
      const next = response.data.next
      if (Array.isArray(pinsData) && pinsData.length > 0) {
        const newPins = pinsData.map(mapDjangoPinToFrontend)
        pins.value = [...pins.value, ...newPins]
        currentPage.value += 1
        hasNextPage.value = !!next
      } else {
        hasNextPage.value = false
      }
    } catch (err) {
      hasNextPage.value = false
      throw err
    } finally {
      loading.value = false
      isFetchingNextPage.value = false
    }
  }

  async function fetchPins(reset = false, topic?: string | null) {
    try {
      await loadPinCollection('pins/', reset, topic ? { topic } : {})
    } catch (err) {
      console.warn('❌ Erreur lors de la récupération des pins.')
    }
  }

  async function fetchPinBySlug(slug: string) {
    const response = await api.get(`pins/${slug}/`, {
      params: { lang: currentLang.value },
    })
    const mapped = mapDjangoPinToFrontend(response.data)
    const idx = pins.value.findIndex((p) => p.slug === slug)
    if (idx >= 0) {
      pins.value[idx] = { ...pins.value[idx], ...mapped }
    } else {
      pins.value.push(mapped)
    }
    return mapped
  }

  async function patchPinCommentsPolicy(slug: string, commentsPolicy: 'open' | 'followers_only' | 'closed') {
    const response = await api.patch(`pins/${slug}/`, { comments_policy: commentsPolicy })
    const mapped = mapDjangoPinToFrontend(response.data)
    const idx = pins.value.findIndex((p) => p.slug === slug)
    if (idx >= 0) {
      pins.value[idx] = { ...pins.value[idx], ...mapped }
    }
    return mapped
  }

  async function moderatePinComment(pinSlug: string, commentId: number, hidden: boolean) {
    const response = await api.post(`pins/${pinSlug}/comments/${commentId}/moderate/`, { hidden })
    return response.data
  }

  async function deletePinComment(pinSlug: string, commentId: number) {
    await api.delete(`pins/${pinSlug}/comments/${commentId}/`)
  }

  async function reportPin(pinSlug: string, payload: { category: string; details: string }) {
    const response = await api.post(`pins/${encodeURIComponent(pinSlug)}/report/`, payload)
    return response.data
  }

  async function reportComment(commentId: number, payload: { category: string; details: string }) {
    const response = await api.post(`pins/comments/${commentId}/report/`, payload)
    return response.data
  }

  async function reportProfile(username: string, payload: { category: string; details: string }) {
    const response = await api.post(`profiles/${encodeURIComponent(username)}/report/`, payload)
    return response.data
  }

  async function blockUser(username: string) {
    const res = await api.post('blocks/', { username })
    return res.data as { id: number; username: string; display_name: string; created_at: string }
  }

  async function unblockUser(blockId: number) {
    await api.delete(`blocks/${blockId}/`)
  }

  async function fetchRecommendations(reset = false) {
    try {
      await loadPinCollection('pins/recommendations/', reset)
    } catch (err) {
      console.warn('Error fetching recommendations, falling back to all pins')
      await fetchPins(reset)
    }
  }

  async function fetchHomeFeed(reset = false, topic?: string | null) {
    try {
      await loadPinCollection('pins/home-feed/', reset, topic ? { topic } : {})
    } catch (err) {
      console.warn('Error fetching home feed, fallback to recommendations')
      await fetchRecommendations(reset)
    }
  }

  async function fetchDiscoverPins(reset = false, topic?: string | null, textQuery?: string | null) {
    try {
      const extra: Record<string, string> = {}
      if (topic) extra.topic = topic
      const tq = (textQuery ?? '').trim()
      if (tq) extra.q = tq
      await loadPinCollection('pins/discover/', reset, extra)
    } catch (err) {
      console.warn('Error fetching discover pins, fallback to public pins')
      await fetchPins(reset, topic)
    }
  }

  async function fetchFollowingPins(reset = false) {
    try {
      await loadPinCollection('pins/following/', reset)
    } catch (err) {
      console.warn('Error fetching following pins')
      if (reset) {
        pins.value = []
        hasNextPage.value = false
      }
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
    payload: FormData | { text: string; gif?: string | null; parentId?: number | null },
  ) {
    try {
      const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData
      const response = await api.post(`pins/${pinSlug}/comments/`, payload, isFormData ? {
        headers: { 'Content-Type': 'multipart/form-data' },
      } : undefined)
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

  async function getPinDownload(pinSlug: string, quality: 'standard' | 'hd' | '4k' = 'standard') {
    const response = await api.get(`pins/${pinSlug}/download/`, {
      params: { quality },
    })
    return response.data
  }

  async function fetchCreatorWeeklyStats(days = 7) {
    const response = await api.get('pins/creator-weekly-stats/', { params: { days } })
    return response.data
  }

  async function fetchCreatorStats() {
    const response = await api.get('pins/creator-stats/')
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

  async function updatePin(slug: string, pinData: FormData) {
    loading.value = true
    try {
      const response = await api.patch(`pins/${slug}/`, pinData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      const mapped = mapDjangoPinToFrontend(response.data)
      const idx = pins.value.findIndex((p) => p.slug === slug)
      if (idx >= 0) {
        pins.value[idx] = mapped
      } else {
        pins.value.push(mapped)
      }
      return mapped
    } catch (err) {
      console.error('Erreur lors de la mise à jour du pin:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function deletePin(slug: string) {
    await api.delete(`pins/${slug}/`)
    pins.value = pins.value.filter((p) => p.slug !== slug)
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

  async function trackPinView(pinSlug: string) {
    try {
      await api.post(`pins/${pinSlug}/view/`)
    } catch (err) {
      // non-blocking analytics call
    }
  }

  async function trackSearchInteraction(query: string) {
    try {
      await api.post('pins/search-interactions/', { query })
    } catch (err) {
      // non-blocking analytics call
    }
  }

  async function fetchPinLikers(pinSlug: string): Promise<PinLikersResponse> {
    const res = await api.get(`pins/${encodeURIComponent(pinSlug)}/likes/`)
    return res.data as PinLikersResponse
  }

  return {
    pins,
    topics,
    loading,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchPins,
    fetchPinBySlug,
    patchPinCommentsPolicy,
    moderatePinComment,
    deletePinComment,
    reportPin,
    reportComment,
    reportProfile,
    blockUser,
    unblockUser,
    fetchRecommendations,
    fetchHomeFeed,
    fetchDiscoverPins,
    fetchFollowingPins,
    addPin,
    updatePin,
    deletePin,
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
    getPinDownload,
    fetchCreatorStats,
    fetchCreatorWeeklyStats,
    fetchProvenance,
    fetchPrivateTags,
    savePrivateTags,
    trackPinView,
    trackSearchInteraction,
    fetchPinLikers,
    formatCount,
  }
}
