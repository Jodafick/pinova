import { ref, computed } from 'vue'
import type { FeedItem, PartnerAd, Foto, FotoLikersResponse, FotoPromo, SponsoredAd } from '../types'
import { isFeedFoto } from '../types'
import api from '../api/index'
import { trackEvent, trackOnce } from '../lib/analytics'
import { API_BASE_URL } from '../config/env'
import { useI18n } from '../i18n'
import {
  feedFirstPageCacheKey,
  getCachedFeedFirstPage,
  setCachedFeedFirstPage,
  getCachedFotoDetail,
  setCachedFotoDetail,
  invalidateFotoDetailClientCache,
  clearFeedFirstPageClientCache,
  invalidateProfileCreatedFotosCacheForUsername,
} from '../lib/cache/fotoClientCache'
import { prefetchFotosMediaForOffline } from '../media/offlineCache'
import { DEFAULT_AVATAR_COLOR_CLASS } from '../constants/avatar'
import { fetchCurrentUser } from './useAuth'
import { runBackground, shallowJsonEqual } from '../lib/cache/staleRevalidate'

type PaginatedResponse<T> = {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

/** Ne pas utiliser `results || data` : `[]` est falsy et casserait le parsing paginé. */
function extractFeedPageRows(data: unknown): { rows: unknown[]; next: unknown } {
  if (data == null) return { rows: [], next: null }
  if (Array.isArray(data)) return { rows: data, next: null }
  if (typeof data !== 'object') return { rows: [], next: null }
  const d = data as Record<string, unknown>
  if (Array.isArray(d.results)) return { rows: d.results, next: d.next ?? null }
  return { rows: [], next: d.next ?? null }
}

export function getFullMediaUrl(url: string | null): string {
  if (!url) return ''
  if (url.startsWith('http')) return url
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`
}

// Mapper pour convertir les données Django vers le format attendu par le Frontend
export function mapPartnerAdFromApi(raw: Record<string, unknown>): PartnerAd {
  return {
    feedType: 'partner_ad',
    id: String(raw.id ?? `partner-ad-${raw.campaign_id}`),
    campaignId: Number(raw.campaign_id ?? 0),
    title: String(raw.title ?? ''),
    body: String(raw.body ?? ''),
    sponsorName: String(raw.sponsor_name ?? ''),
    imageUrl: getFullMediaUrl(String(raw.image_url ?? '')),
    ctaLabel: String(raw.cta_label ?? 'En savoir plus'),
    ctaUrl: String(raw.cta_url ?? '#'),
  }
}

export function mapFotoPromoFromApi(raw: Record<string, unknown>): FotoPromo {
  return {
    feedType: 'foto_promo',
    id: String(raw.id ?? `foto-promo-${raw.campaign_id}`),
    campaignId: Number(raw.campaign_id ?? 0),
    fotoSlug: String(raw.foto_slug ?? ''),
    fotoId: Number(raw.foto_id ?? 0),
    title: String(raw.title ?? ''),
    body: String(raw.body ?? ''),
    sponsorName: String(raw.sponsor_name ?? ''),
    username: String(raw.username ?? ''),
    imageUrl: getFullMediaUrl(String(raw.media_url ?? raw.image_url ?? '')),
    mediaUrl: getFullMediaUrl(String(raw.media_url ?? raw.image_url ?? '')),
    mediaType: (raw.media_type === 'video' ? 'video' : 'image') as 'image' | 'video',
    ctaLabel: String(raw.cta_label ?? 'Voir le foto'),
    ctaUrl: String(raw.cta_url ?? ''),
    topic: String(raw.topic ?? ''),
  }
}

export function mapSponsoredFromApi(raw: Record<string, unknown>): SponsoredAd | null {
  const ft = String(raw.feed_type ?? '')
  if (ft === 'partner_ad') return mapPartnerAdFromApi(raw)
  if (ft === 'foto_promo') return mapFotoPromoFromApi(raw)
  return null
}

export function mapFeedRow(raw: Record<string, unknown>): FeedItem | null {
  if (raw == null || typeof raw !== 'object') return null
  const ft = String(raw.feed_type ?? 'foto')
  if (ft === 'partner_ad') return mapPartnerAdFromApi(raw)
  if (ft === 'foto_promo') return mapFotoPromoFromApi(raw)
  try {
    return mapDjangoFotoToFrontend(raw)
  } catch {
    return null
  }
}

export function feedFotosOnly(items: FeedItem[]): Foto[] {
  return items.filter((x): x is Foto => isFeedFoto(x))
}

export function mapDjangoFotoToFrontend(djangoFoto: any): Foto {
  const author = djangoFoto.author_profile || {}
  const isStory = !!djangoFoto.is_story
  const storyDisplayRaw =
    isStory && djangoFoto.story_display_image_url ? String(djangoFoto.story_display_image_url).trim() : ''
  const mainImageRaw = djangoFoto.image ? String(djangoFoto.image).trim() : ''
  const imageUrl = storyDisplayRaw
    ? getFullMediaUrl(storyDisplayRaw)
    : mainImageRaw
      ? getFullMediaUrl(mainImageRaw)
      : ''
  const feedRaw = djangoFoto.feed_image_url ? String(djangoFoto.feed_image_url).trim() : ''
  const feedImageUrl = feedRaw ? getFullMediaUrl(feedRaw) : imageUrl || undefined
  return {
    id: djangoFoto.id,
    slug: djangoFoto.slug,
    title: djangoFoto.title,
    description: djangoFoto.description,
    imageUrl,
    feedImageUrl,
    storyVideoUrl: djangoFoto.story_video_url ? getFullMediaUrl(djangoFoto.story_video_url) : '',
    user: author.display_name || author.username || 'Inconnu',
    username: author.username || 'inconnu',
    userId: author.id,
    userAvatarUrl: getFullMediaUrl(author.avatar),
    userAvatarColor: author.avatar_color || DEFAULT_AVATAR_COLOR_CLASS,
    authorTipsInternalEnabled: !!author.tips_internal_enabled,
    link: djangoFoto.link || '',
    stats: { 
      saves: djangoFoto.saves_count || 0, 
      reactions: djangoFoto.likes_count || 0,
      shares: djangoFoto.shares_count || djangoFoto.share_count || 0,
    },
    topic: (djangoFoto.topic_meta?.originalName ?? djangoFoto.topic) || 'Général',
    topicDisplay: (djangoFoto.topic_meta?.name ?? djangoFoto.topic) || 'Général',
    visibility: djangoFoto.visibility || 'public',
    commentsPolicy: djangoFoto.comments_policy || 'open',
    canComment: djangoFoto.can_comment !== false,
    hashtags: djangoFoto.hashtags || [],
    privateTags: djangoFoto.private_tags || [],
    boards: (djangoFoto.boards || []).map((board: any) => ({
      id: board.id,
      name: board.name,
      isPrivate: !!board.is_private,
      position: typeof board.position === 'number' ? board.position : undefined,
      ownerUsername: board.owner_username || djangoFoto.author_profile?.username || undefined,
    })),
    scheduledPublishAt: djangoFoto.scheduled_publish_at || null,
    createdAt: djangoFoto.created_at,
    liked:
      djangoFoto.is_liked === true ||
      djangoFoto.is_liked === 1 ||
      djangoFoto.isLiked === true,
    saved: djangoFoto.is_saved || false,
    isFollowing: author.is_following || false,
    authorFollowersCount: typeof author.followers_count === 'number' ? author.followers_count : 0,
    isStory: !!djangoFoto.is_story,
    /** Story Plus/Pro sans foto en grille après 24 h (purge serveur). */
    storyEphemeral: !!djangoFoto.story_ephemeral,
    storyExpiresAt: djangoFoto.story_expires_at ?? undefined,
    mediaSensitiveBlur: !!djangoFoto.media_sensitive_blur,
    viewerHasReported: !!djangoFoto.viewer_has_reported,
    isBoosted: !!djangoFoto.is_boosted,
  }
}

export function isAlreadyReportedError(err: unknown): boolean {
  const ax = err as { response?: { status?: number; data?: { error?: string } } }
  return ax.response?.status === 409 || ax.response?.data?.error === 'already_reported'
}

/** Une seule requête `fotos/:slug/` à la fois par slug (évite doublons au swipe / remount). */
const fotoDetailInFlight = new Map<string, Promise<Foto>>()

export function useFotos() {
  const { currentLang } = useI18n()
  // État local par instance de composant/page.
  // Évite les fuites d'état cross-page avec KeepAlive (feeds qui se remplacent mutuellement).
  const fotos = ref<FeedItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const currentPage = ref(1)
  const hasNextPage = ref(true)
  const isFetchingNextPage = ref(false)
  const savePendingBySlug = ref<Record<string, boolean>>({})
  const likePendingBySlug = ref<Record<string, boolean>>({})
  const followPendingByUsername = ref<Record<string, boolean>>({})

  const setPendingFlag = (store: Record<string, boolean>, key: string, value: boolean) => {
    if (!key) return
    if (value) {
      store[key] = true
      return
    }
    delete store[key]
  }

  const isFotoSavePending = (slug: string) => !!savePendingBySlug.value[slug]
  const isFotoLikePending = (slug: string) => !!likePendingBySlug.value[slug]
  const isAuthorFollowPending = (username: string) => !!followPendingByUsername.value[username]

  /** Incrémenté à chaque `reset` — ignore les réponses HTTP obsolètes (courses / changement de topic). */
  let feedLoadGeneration = 0

  const topics = computed(() => {
    const counts = new Map<string, { count: number; label: string }>()
    feedFotosOnly(fotos.value).forEach((foto) => {
      const canonical = foto.topic
      const label = foto.topicDisplay ?? foto.topic
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

  const loadFotoCollection = async (
    endpoint: string,
    reset = false,
    extraParams: Record<string, string | number | null | undefined> = {},
    opts?: { bypassCache?: boolean; backgroundOnly?: boolean; revalidate?: boolean },
  ) => {
    const lang = currentLang.value
    const feedKey = feedFirstPageCacheKey(endpoint, lang, extraParams)

    if (reset && !opts?.backgroundOnly && !opts?.revalidate) {
      feedLoadGeneration += 1
    }
    if (opts?.revalidate) {
      feedLoadGeneration += 1
    }
    const ticket = feedLoadGeneration

    const applyFirstPage = (items: FeedItem[], next: boolean) => {
      fotos.value = items.slice()
      currentPage.value = 2
      hasNextPage.value = next
      loading.value = false
      isFetchingNextPage.value = false
      error.value = null
    }

    const fetchFirstPageFromNetwork = async (): Promise<boolean> => {
      try {
        const response = await api.get(endpoint, {
          params: {
            page: 1,
            lang,
            ...extraParams,
          },
        })
        if (ticket !== feedLoadGeneration) return false

        const { rows: pinsData, next } = extractFeedPageRows(response.data)
        const newFotos: FeedItem[] = []
        for (const raw of pinsData) {
          if (raw == null || typeof raw !== 'object') continue
          const mapped = mapFeedRow(raw as Record<string, unknown>)
          if (mapped) newFotos.push(mapped)
        }

        if (newFotos.length > 0 || pinsData.length === 0) {
          setCachedFeedFirstPage(feedKey, newFotos.slice(), !!next)
          if (!shallowJsonEqual(newFotos, fotos.value)) {
            applyFirstPage(newFotos, !!next)
          } else {
            hasNextPage.value = !!next
            currentPage.value = 2
          }
        }
        return true
      } catch {
        return false
      }
    }

    if (reset && !opts?.bypassCache && !opts?.backgroundOnly && !opts?.revalidate) {
      const cached = getCachedFeedFirstPage(feedKey)
      if (cached) {
        applyFirstPage(cached.items.slice(), cached.hasNextPage)
        runBackground(async () => {
          await fetchFirstPageFromNetwork()
        })
        return
      }
      currentPage.value = 1
      hasNextPage.value = true
      fotos.value = []
    }

    if (opts?.revalidate) {
      loading.value = false
      await fetchFirstPageFromNetwork()
      return
    }

    if (opts?.backgroundOnly) {
      await fetchFirstPageFromNetwork()
      return
    }

    if (!hasNextPage.value) return
    if (!reset && (loading.value || isFetchingNextPage.value)) return
    loading.value = currentPage.value === 1
    isFetchingNextPage.value = currentPage.value > 1
    error.value = null
    const pageAtStart = currentPage.value
    try {
      const response = await api.get(endpoint, {
        params: {
          page: currentPage.value,
          lang,
          ...extraParams,
        },
      })
      if (ticket !== feedLoadGeneration) return

      const { rows: pinsData, next } = extractFeedPageRows(response.data)
      const newFotos: FeedItem[] = []
      for (const raw of pinsData) {
        if (raw == null || typeof raw !== 'object') continue
        const mapped = mapFeedRow(raw as Record<string, unknown>)
        if (mapped) newFotos.push(mapped)
        else console.warn('[useFotos] Ligne de flux ignorée (mapping)')
      }

      if (newFotos.length > 0) {
        fotos.value = [...fotos.value, ...newFotos]
        currentPage.value += 1
        hasNextPage.value = !!next
        if (pageAtStart === 1) {
          setCachedFeedFirstPage(feedKey, fotos.value.slice(), !!next)
        }
      } else {
        hasNextPage.value =
          pinsData.length > 0 && newFotos.length === 0 ? false : !!next
      }
    } catch (err) {
      hasNextPage.value = false
      throw err
    } finally {
      if (ticket === feedLoadGeneration) {
        loading.value = false
        isFetchingNextPage.value = false
      }
    }
  }

  async function fetchFotos(
    reset = false,
    topic?: string | null,
    opts?: { bypassCache?: boolean },
  ) {
    try {
      await loadFotoCollection('fotos/', reset, topic ? { topic } : {}, opts)
    } catch (err) {
      console.warn('❌ Erreur lors de la récupération des fotos.')
    }
  }

  async function fetchFotoBySlug(slug: string, options?: { force?: boolean }) {
    if (!slug) throw new Error('fetchFotoBySlug: slug vide')
    if (!options?.force) {
      const hit = getCachedFotoDetail(slug)
      if (hit) {
        const idx = fotos.value.findIndex((p) => isFeedFoto(p) && p.slug === slug)
        if (idx >= 0 && isFeedFoto(fotos.value[idx])) {
          fotos.value[idx] = { ...fotos.value[idx], ...hit }
        } else {
          fotos.value.push(hit)
        }
        runBackground(async () => {
          try {
            const response = await api.get(`fotos/${encodeURIComponent(slug)}/`, {
              params: { lang: currentLang.value },
            })
            const mapped = mapDjangoFotoToFrontend(response.data)
            if (shallowJsonEqual(mapped, hit)) return
            setCachedFotoDetail(slug, mapped)
            prefetchFotosMediaForOffline([mapped])
            const liveIdx = fotos.value.findIndex((p) => isFeedFoto(p) && p.slug === slug)
            if (liveIdx >= 0 && isFeedFoto(fotos.value[liveIdx])) {
              fotos.value[liveIdx] = { ...fotos.value[liveIdx], ...mapped }
            }
          } catch {
            /* revalidation silencieuse */
          }
        })
        return hit
      }
      const inflight = fotoDetailInFlight.get(slug)
      if (inflight) return inflight
    } else {
      invalidateFotoDetailClientCache(slug)
      fotoDetailInFlight.delete(slug)
    }

    const run = (async () => {
      try {
        const response = await api.get(`fotos/${encodeURIComponent(slug)}/`, {
          params: { lang: currentLang.value },
        })
        const mapped = mapDjangoFotoToFrontend(response.data)
        setCachedFotoDetail(slug, mapped)
        prefetchFotosMediaForOffline([mapped])
        const idx = fotos.value.findIndex((p) => isFeedFoto(p) && p.slug === slug)
        if (idx >= 0 && isFeedFoto(fotos.value[idx])) {
          fotos.value[idx] = { ...fotos.value[idx], ...mapped }
        } else {
          fotos.value.push(mapped)
        }
        return mapped
      } finally {
        fotoDetailInFlight.delete(slug)
      }
    })()

    fotoDetailInFlight.set(slug, run)
    return run
  }

  async function patchFotoCommentsPolicy(slug: string, commentsPolicy: 'open' | 'followers_only' | 'closed') {
    const response = await api.patch(`fotos/${slug}/`, { comments_policy: commentsPolicy })
    const mapped = mapDjangoFotoToFrontend(response.data)
    invalidateFotoDetailClientCache(slug)
    setCachedFotoDetail(slug, mapped)
    prefetchFotosMediaForOffline([mapped])
    const idx = fotos.value.findIndex((p) => isFeedFoto(p) && p.slug === slug)
    if (idx >= 0 && isFeedFoto(fotos.value[idx])) {
      fotos.value[idx] = { ...fotos.value[idx], ...mapped }
    }
    return mapped
  }

  async function moderateFotoComment(fotoSlug: string, commentId: number, hidden: boolean) {
    const response = await api.post(`fotos/${fotoSlug}/comments/${commentId}/moderate/`, { hidden })
    return response.data
  }

  async function deleteFotoComment(fotoSlug: string, commentId: number) {
    await api.delete(`fotos/${fotoSlug}/comments/${commentId}/`)
  }

  async function reportFoto(fotoSlug: string, payload: { category: string; details: string }) {
    const response = await api.post(`fotos/${encodeURIComponent(fotoSlug)}/report/`, payload)
    return response.data
  }

  async function reportComment(commentId: number, payload: { category: string; details: string }) {
    const response = await api.post(`fotos/comments/${commentId}/report/`, payload)
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

  async function fetchRecommendations(reset = false, opts?: { bypassCache?: boolean }) {
    try {
      await loadFotoCollection('fotos/recommendations/', reset, {}, opts)
    } catch (err) {
      console.warn('Error fetching recommendations, falling back to all pins')
      await fetchFotos(reset, null, opts)
    }
  }

  async function fetchHomeFeed(
    reset = false,
    topic?: string | null,
    opts?: { bypassCache?: boolean; revalidate?: boolean },
  ) {
    try {
      await loadFotoCollection('fotos/home-feed/', reset, topic ? { topic } : {}, opts)
    } catch (err) {
      console.warn('Error fetching home feed, fallback to recommendations')
      await fetchRecommendations(reset, opts)
    }
  }

  async function fetchDiscoverFotos(
    reset = false,
    topic?: string | null,
    textQuery?: string | null,
    opts?: { bypassCache?: boolean; revalidate?: boolean },
  ) {
    try {
      const extra: Record<string, string> = {}
      if (topic) extra.topic = topic
      const tq = (textQuery ?? '').trim()
      if (tq) extra.q = tq
      await loadFotoCollection('fotos/discover/', reset, extra, opts)
    } catch (err) {
      console.warn('Error fetching discover fotos, fallback to public pins')
      await fetchFotos(reset, topic, opts)
    }
  }

  async function fetchFollowingFotos(
    reset = false,
    opts?: { bypassCache?: boolean; revalidate?: boolean },
  ) {
    try {
      await loadFotoCollection('fotos/following/', reset, {}, opts)
    } catch (err) {
      console.warn('Error fetching following pins')
      if (reset) {
        fotos.value = []
        hasNextPage.value = false
      }
    }
  }

  async function toggleLike(fotoSlug: string) {
    const foto = fotos.value.find((p): p is Foto => isFeedFoto(p) && p.slug === fotoSlug)
    const previousLiked = foto?.liked ?? false
    const previousReactions = foto?.stats.reactions ?? 0
    if (foto) {
      foto.liked = !previousLiked
      foto.stats.reactions = Math.max(0, previousReactions + (pin.liked ? 1 : -1))
    }
    setPendingFlag(likePendingBySlug.value, fotoSlug, true)
    try {
      const response = await api.post(`fotos/${fotoSlug}/like/`)
      if (foto) {
        foto.liked = response.data.status === 'liked'
        foto.stats.reactions = response.data.likes_count
      }
      if (response.data.status === 'liked') {
        trackEvent('foto_liked', { foto_slug: fotoSlug })
        trackOnce('first_like', { foto_slug: fotoSlug })
      }
      invalidateFotoDetailClientCache(fotoSlug)
      return response.data
    } catch (err) {
      if (foto) {
        foto.liked = previousLiked
        foto.stats.reactions = previousReactions
      }
      console.error('Error toggling like:', err)
      throw err
    } finally {
      setPendingFlag(likePendingBySlug.value, fotoSlug, false)
    }
  }

  async function fetchComments(
    fotoSlug: string,
    page = 1,
    sort: 'recent' | 'relevant' = 'recent',
    highlightCommentId?: number | null,
  ) {
    try {
      const response = await api.get(`fotos/${fotoSlug}/comments/`, {
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
      const response = await api.get(`fotos/comments/${commentId}/replies/`, {
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
    fotoSlug: string,
    payload: FormData | { text: string; gif?: string | null; parentId?: number | null },
  ) {
    try {
      /** Ne pas fixer `Content-Type` à la main sur FormData : axios ajoute le boundary requis ; sinon `parentId` / médias sont ignorés côté Django. */
      const response = await api.post(`fotos/${fotoSlug}/comments/`, payload)
      const foto = fotos.value.find((p): p is Foto => isFeedFoto(p) && p.slug === fotoSlug)
      if (foto) {
        foto.stats.reactions += 0 // On pourrait mettre à jour le count ici si on l'avait séparément
      }
      return response.data
    } catch (err) {
      console.error('Error adding comment:', err)
      throw err
    }
  }

  async function translateFotoDescription(fotoSlug: string, targetLang = 'fr') {
    const response = await api.post(`fotos/${fotoSlug}/translate-description/`, {
      target_lang: targetLang,
    })
    return response.data
  }

  async function translateComment(commentId: number, targetLang = 'fr') {
    const response = await api.post(`fotos/comments/${commentId}/translate/`, {
      target_lang: targetLang,
    })
    return response.data
  }

  async function toggleCommentLike(commentId: number) {
    const response = await api.post(`fotos/comments/${commentId}/like/`)
    return response.data
  }

  async function getFotoDownload(fotoSlug: string, quality: 'standard' | 'hd' | '4k' = 'standard') {
    const response = await api.get(`fotos/${fotoSlug}/download/`, {
      params: { quality },
    })
    return response.data
  }

  async function fetchCreatorWeeklyStats(
    days = 7,
    params?: { page?: number; page_size?: number },
  ) {
    const response = await api.get('fotos/creator-weekly-stats/', {
      params: { days, ...params },
    })
    return response.data
  }

  async function fetchCreatorStats(
    params?: { top_page?: number; top_page_size?: number; totalsOnly?: boolean },
  ) {
    const { totalsOnly, ...rest } = params || {}
    const response = await api.get('fotos/creator-stats/', {
      params: {
        ...rest,
        ...(totalsOnly ? { totals_only: true } : {}),
      },
    })
    return response.data
  }

  async function fetchCreatorEngagement(params: {
    action: 'likes' | 'saves' | 'comments' | 'views'
    days?: number
    limit?: number
  }) {
    const response = await api.get('fotos/creator-engagement/', {
      params: {
        action: params.action,
        days: params.days ?? 30,
        limit: params.limit ?? 30,
      },
    })
    return response.data
  }

  async function fetchCreatorRecentFotos(params?: { page?: number; page_size?: number }) {
    const response = await api.get('fotos/creator-recent-fotos/', { params })
    return response.data
  }

  async function fetchCreatorCommentInbox(params?: { limit?: number; offset?: number }) {
    const response = await api.get('fotos/creator-comment-inbox/', { params })
    return response.data
  }

  async function downloadCreatorStatsCsv(): Promise<Blob> {
    const response = await api.get('fotos/creator-stats-export/', { responseType: 'blob' })
    return response.data as Blob
  }

  async function fetchProvenance(fotoSlug: string) {
    const response = await api.get(`fotos/${fotoSlug}/provenance/`)
    return response.data
  }

  async function fetchPrivateTags(fotoSlug: string) {
    const response = await api.get(`fotos/${fotoSlug}/private-tags/`)
    return response.data.tags || []
  }

  async function savePrivateTags(fotoSlug: string, tags: string[]) {
    const response = await api.post(`fotos/${fotoSlug}/private-tags/`, { tags })
    return response.data.tags || []
  }

  async function addFoto(fotoData: FormData) {
    loading.value = true
    try {
      // Pour Django, on envoie un FormData car il y a une image
      const response = await api.post('fotos/', fotoData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      const newFoto = mapDjangoFotoToFrontend(response.data)
      fotos.value.unshift(newFoto)
      clearFeedFirstPageClientCache()
      invalidateProfileCreatedFotosCacheForUsername(newFoto.username)
      setCachedFotoDetail(newFoto.slug, newFoto)
      return newFoto
    } catch (err) {
      console.error('Erreur lors de l\'ajout du foto:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updateFoto(slug: string, fotoData: FormData) {
    loading.value = true
    try {
      const response = await api.patch(`fotos/${slug}/`, fotoData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      const mapped = mapDjangoFotoToFrontend(response.data)
      invalidateFotoDetailClientCache(slug)
      clearFeedFirstPageClientCache()
      invalidateProfileCreatedFotosCacheForUsername(mapped.username)
      const idx = fotos.value.findIndex((p) => isFeedFoto(p) && p.slug === slug)
      if (idx >= 0 && isFeedFoto(fotos.value[idx])) {
        fotos.value[idx] = mapped
      } else {
        fotos.value.push(mapped)
      }
      setCachedFotoDetail(mapped.slug, mapped)
      return mapped
    } catch (err) {
      console.error('Erreur lors de la mise à jour du foto:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function deleteFoto(slug: string) {
    const victim = fotos.value.find((p): p is Foto => isFeedFoto(p) && p.slug === slug)
    const authorU = victim?.username
    await api.delete(`fotos/${slug}/`)
    fotos.value = fotos.value.filter((p) => !isFeedFoto(p) || p.slug !== slug)
    invalidateFotoDetailClientCache(slug)
    clearFeedFirstPageClientCache()
    if (authorU) invalidateProfileCreatedFotosCacheForUsername(authorU)
  }

  /** Hydrate le store `fotos` depuis le cache détail si besoin (évite un flash skeleton sur `/foto/:slug`). */
  function seedFotoDetailCacheIntoStore(slug: string): Foto | undefined {
    if (!slug) return undefined
    const existing = fotos.value.find((p): p is Foto => isFeedFoto(p) && p.slug === slug)
    if (existing) return existing
    const hit = getCachedFotoDetail(slug)
    if (hit) {
      fotos.value.push({ ...hit })
      return hit
    }
    return undefined
  }

  function getFoto(slug: string): Foto | undefined {
    return fotos.value.find((p): p is Foto => isFeedFoto(p) && p.slug === slug)
  }

  async function toggleSave(slug: string) {
    const foto = fotos.value.find((p): p is Foto => isFeedFoto(p) && p.slug === slug)
    const previousSaved = foto?.saved ?? false
    const previousSaves = foto?.stats.saves ?? 0
    if (foto) {
      foto.saved = !previousSaved
      foto.stats.saves = Math.max(0, previousSaves + (pin.saved ? 1 : -1))
    }
    setPendingFlag(savePendingBySlug.value, slug, true)
    try {
      const response = await api.post(`fotos/${slug}/save/`)
      if (foto) {
        foto.saved = response.data.status === 'saved'
        foto.stats.saves = response.data.saves_count
      }
      if (response.data.status === 'saved') {
        trackEvent('foto_saved', { foto_slug: slug })
        trackOnce('first_save', { foto_slug: slug })
        const { recordEngagementMoment } = await import('../utils/engagementMoments')
        recordEngagementMoment('foto_saved')
      }
      void fetchCurrentUser({ force: true, silent: true })
      invalidateFotoDetailClientCache(slug)
      return response.data
    } catch (err) {
      if (foto) {
        foto.saved = previousSaved
        foto.stats.saves = previousSaves
      }
      console.error('Error toggling save:', err)
      throw err
    } finally {
      setPendingFlag(savePendingBySlug.value, slug, false)
    }
  }

  async function toggleFollow(username: string) {
    const affectedFotos = fotos.value.filter(
      (foto): foto is Foto => isFeedFoto(foto) && foto.username === username,
    )
    const previousFollowState = affectedFotos.map((foto) => foto.isFollowing)
    affectedFotos.forEach((foto) => {
      foto.isFollowing = !pin.isFollowing
    })
    setPendingFlag(followPendingByUsername.value, username, true)
    try {
      const response = await api.post(`profiles/${username}/follow/`)
      const isFollowed = response.data.status === 'followed'

      // Update all fotos from this author
      fotos.value.forEach((item) => {
        if (isFeedFoto(item) && item.username === username) {
          item.isFollowing = isFollowed
        }
      })

      void fetchCurrentUser({ force: true, silent: true })

      return response.data
    } catch (err) {
      affectedFotos.forEach((pin, index) => {
        foto.isFollowing = previousFollowState[index]
      })
      console.error('Error toggling follow:', err)
      throw err
    } finally {
      setPendingFlag(followPendingByUsername.value, username, false)
    }
  }

  function formatCount(count: number): string {
    const n = Number(count)
    if (!Number.isFinite(n) || n <= 0) return '0'
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B'
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
    return String(Math.floor(n))
  }

  async function trackFotoView(fotoSlug: string) {
    trackEvent('foto_viewed', { foto_slug: fotoSlug })
    try {
      await api.post(`fotos/${fotoSlug}/view/`)
    } catch (err) {
      // non-blocking analytics call
    }
  }

  async function trackSearchInteraction(query: string) {
    trackEvent('search_performed', { query: query.trim().slice(0, 120) })
    try {
      await api.post('fotos/search-interactions/', { query })
    } catch (err) {
      // non-blocking analytics call
    }
  }

  async function fetchFotoLikers(fotoSlug: string): Promise<FotoLikersResponse> {
    const res = await api.get(`fotos/${encodeURIComponent(fotoSlug)}/likes/`)
    return res.data as FotoLikersResponse
  }

  return {
    fotos,
    topics,
    loading,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchFotos,
    fetchFotoBySlug,
    patchFotoCommentsPolicy,
    moderateFotoComment,
    deleteFotoComment,
    reportFoto,
    reportComment,
    reportProfile,
    blockUser,
    unblockUser,
    fetchRecommendations,
    fetchHomeFeed,
    fetchDiscoverFotos,
    fetchFollowingFotos,
    addFoto,
    updateFoto,
    deleteFoto,
    getFoto,
    seedFotoDetailCacheIntoStore,
    toggleSave,
    toggleLike,
    toggleFollow,
    isFotoSavePending,
    isFotoLikePending,
    isAuthorFollowPending,
    fetchComments,
    fetchCommentReplies,
    addComment,
    translateFotoDescription,
    translateComment,
    toggleCommentLike,
    getFotoDownload,
    fetchCreatorStats,
    fetchCreatorWeeklyStats,
    fetchCreatorEngagement,
    fetchCreatorRecentFotos,
    fetchCreatorCommentInbox,
    downloadCreatorStatsCsv,
    fetchProvenance,
    fetchPrivateTags,
    savePrivateTags,
    trackFotoView,
    trackSearchInteraction,
    fetchFotoLikers,
    formatCount,
  }
}
