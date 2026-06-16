<script setup lang="ts">
import { computed, ref, watch, onActivated, onDeactivated } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { PropType } from 'vue'
import api from '../api/index'
import type { FeedItem, Foto, User, SponsoredAd } from '../types'
import { isFeedFoto, isSponsoredAd } from '../types'
import { findFeedOverlayIndex, siblingFeedItem } from '../utils/feedOverlayNavigation'
import { useAuth, DEFAULT_AVATAR_COLOR_CLASS } from '../composables/useAuth'
import { useFotos, getFullMediaUrl, isAlreadyReportedError } from '../composables/useFotos'
import { getCachedFotoDetail } from '../lib/cache/fotoClientCache'
import {
  moderationScanImageFile,
  moderationScanText,
} from '../composables/useModeration'
import {
  sensitiveMediaBlurredByDefault,
  viewerCanRevealSensitiveMedia,
} from '../composables/moderationPolicy'
import { useDataSaver } from '../composables/useDataSaver'
import { useAppModal } from '../composables/useAppModal'
import { useI18n } from '../i18n'
import { formatDrfErrorMessages } from '../utils/apiValidationErrors'
import { consumePinOverlayOrigin, type PinOverlayOriginRect } from '../utils/pinOverlayOrigin'
import { shareUrlWithFallback } from '../utils/shareFallback'
import { safeHttpUrl } from '../utils/safeHttpUrl'
import { useGuestAuthGate } from '../composables/useGuestAuthGate'
import FotoDetailMobileFullscreen from './FotoDetailMobileFullscreen.vue'
import FotoDetailDesktopModal from './FotoDetailDesktopModal.vue'
import SponsoredDetailMobileFullscreen from './SponsoredDetailMobileFullscreen.vue'
import SponsoredDetailDesktopModal from './SponsoredDetailDesktopModal.vue'
import ReportContentModal from './ReportContentModal.vue'
import StoryLikersModal from './StoryLikersModal.vue'
import PromoteFotoSheet from './PromoteFotoSheet.vue'

type CommentSubmitPayload = {
  text: string
  gif?: string | null
  mediaFile?: File | null
  replyTo?: string | null
  parentId?: number
}

type UiComment = {
  id: number
  user: string
  username: string
  avatarColor: string
  avatarUrl: string
  text: string
  translatedText?: string
  gif?: string | null
  media?: string | null
  createdAt: string
  liked?: boolean
  likes: number
  translated?: boolean
  originalLang?: string
  replies?: UiComment[]
  repliesNextPage?: number | null
  repliesCount?: number
  contentMasked?: boolean
  hiddenByOwner?: boolean
  moderationHidden?: boolean
  viewerHasReported?: boolean
}

const props = defineProps({
  feedItems: { type: Array as PropType<FeedItem[]>, default: () => [] },
})

const fotos = computed(() => props.feedItems.filter(isFeedFoto))

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { showAlert, showPrompt, showConfirm } = useAppModal()
const { currentUser, isAuthenticated, toggleSavePin, fetchCurrentUser } = useAuth()
const { promptGuest } = useGuestAuthGate()
/**
 * Plusieurs pages utilisent KeepAlive et embarquent chacune un FotoDetailOverlayHost.
 * Elles partagent la même `route` : sans garde, TOUTES afficheraient l’overlay pour `?foto=`.
 */
const pinOverlayHostPageActive = ref(true)

onActivated(() => {
  pinOverlayHostPageActive.value = true
})

onDeactivated(() => {
  pinOverlayHostPageActive.value = false
})
const {
  fetchFotoBySlug,
  fetchComments,
  fetchCommentReplies,
  addComment,
  translateComment,
  toggleCommentLike,
  translateFotoDescription,
  moderateFotoComment,
  deleteFotoComment,
  reportFoto,
  reportComment,
  toggleFollow,
  getFotoDownload,
  trackFotoView,
  formatCount,
} = useFotos()
const { detailVideoPreload, isLowDataMode } = useDataSaver()

const overlaySlug = computed(() => {
  const raw = route.query.foto
  return typeof raw === 'string' && raw.trim() ? raw.trim() : ''
})
const overlaySponsoredId = computed(() => {
  const raw = route.query.sponsored
  return typeof raw === 'string' && raw.trim() ? raw.trim() : ''
})
const open = computed(() => !!overlaySlug.value || !!overlaySponsoredId.value)
const propPin = computed(() => fotos.value.find((p) => p.slug === overlaySlug.value) ?? null)
const fetchedPin = ref<Foto | null>(null)

/** Grille (aperçu) + réponse `fotos/:slug/` : l’API écrase les champs enrichis. */
function mergeListPinWithDetail(list: Foto | null, detail: Foto | null): Foto | null {
  if (list && detail) return { ...list, ...detail }
  return list ?? detail
}

const foto = computed(() => {
  const slug = overlaySlug.value
  const detail = fetchedPin.value?.slug === slug ? fetchedPin.value : null
  return mergeListPinWithDetail(propPin.value, detail)
})
const activePin = computed(() => foto.value)
const activeSponsoredAd = computed((): SponsoredAd | null => {
  const id = overlaySponsoredId.value
  if (!id) return null
  const row = props.feedItems.find((item) => isSponsoredAd(item) && item.id === id)
  return row && isSponsoredAd(row) ? row : null
})
const showPinOverlayUi = computed(
  () => open.value && !!activePin.value && pinOverlayHostPageActive.value,
)
const showSponsoredOverlayUi = computed(
  () => open.value && !!activeSponsoredAd.value && pinOverlayHostPageActive.value,
)
const showOverlayLoading = computed(
  () =>
    open.value &&
    !!overlaySlug.value &&
    !activePin.value &&
    pinOverlayHostPageActive.value,
)
const activeFeedIndex = computed(() =>
  findFeedOverlayIndex(props.feedItems, {
    foto: overlaySlug.value,
    sponsored: overlaySponsoredId.value,
  }),
)
const hasPreviousFeed = computed(() => activeFeedIndex.value > 0)
const hasNextFeed = computed(() => {
  const idx = activeFeedIndex.value
  return idx >= 0 && idx < props.feedItems.length - 1
})
const previousPin = computed(() => {
  const prev = siblingFeedItem(props.feedItems, activeFeedIndex.value, -1)
  return prev && isFeedFoto(prev) ? prev : null
})
const nextPin = computed(() => {
  const n = siblingFeedItem(props.feedItems, activeFeedIndex.value, 1)
  return n && isFeedFoto(n) ? n : null
})

const detailImageFetchPriority = computed(() => (isLowDataMode.value ? 'low' : 'high'))
const viewerCanRevealSensitive = computed(() =>
  viewerCanRevealSensitiveMedia(isAuthenticated.value, currentUser.value?.birthDate),
)
const blurSensitiveByDefault = computed(() =>
  sensitiveMediaBlurredByDefault(
    isAuthenticated.value,
    currentUser.value?.birthDate,
    currentUser.value?.subscription?.plan,
    currentUser.value?.subscription?.sensitiveMediaBlurByDefault,
  ),
)
const isPinOwner = computed(() => !!(currentUser.value && activePin.value && usernamesMatch(currentUser.value.username, activePin.value.username)))
const viewerCanComment = computed(() => activePin.value?.canComment !== false)
const targetLang = computed(() => currentUser.value?.preferredLanguage || navigator.language?.split('-')[0] || 'fr')

const richComments = ref<UiComment[]>([])
const commentsTotalCount = ref(0)
const commentsPage = ref(1)
const commentsHasNext = ref(false)
const commentsLoadingMore = ref(false)
const descriptionText = ref('')
const descriptionTranslated = ref(false)
const highlightedCommentId = computed<number | null>(() => {
  const raw = route.query.commentId
  if (typeof raw !== 'string') return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
})
const likingPin = ref(false)
const savingPin = ref(false)
const downloadingPin = ref(false)
const followingAuthor = ref(false)
const translatingDescription = ref(false)
const submittingComment = ref(false)
const reportModalOpen = ref(false)
const reportTarget = ref<'foto' | 'comment'>('foto')
const reportCommentId = ref<number | null>(null)
const promoteSheetOpen = ref(false)

function openPromoteBoost() {
  if (!isPinOwner.value || !activePin.value?.slug) return
  promoteSheetOpen.value = true
}
const storyLikersOpen = ref(false)
const openingOriginRect = ref<PinOverlayOriginRect | null>(null)

function usernamesMatch(a?: string | null, b?: string | null) {
  return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()
}

function replaceOverlaySlug(slug: string) {
  const nextQuery: Record<string, string | string[] | undefined> = { ...route.query, foto: slug }
  delete nextQuery.sponsored
  router.replace({ path: route.path, query: nextQuery })
}

function replaceOverlaySponsored(id: string) {
  const nextQuery: Record<string, string | string[] | undefined> = { ...route.query, sponsored: id }
  delete nextQuery.pin
  delete nextQuery.commentId
  router.replace({ path: route.path, query: nextQuery })
}

function closeOverlay() {
  const nextQuery = { ...route.query }
  delete nextQuery.pin
  delete nextQuery.sponsored
  delete nextQuery.commentId
  router.replace({ path: route.path, query: nextQuery })
}

function mapComment(comment: any): UiComment {
  const repliesPayload = Array.isArray(comment.replies)
    ? comment.replies
    : Array.isArray(comment.replies?.results)
      ? comment.replies.results
      : []
  return {
    id: comment.id,
    user: comment.display_name || comment.username,
    username: comment.username,
    avatarColor: comment.avatar_color || DEFAULT_AVATAR_COLOR_CLASS,
    avatarUrl: getFullMediaUrl(comment.avatar_url ?? ''),
    text: comment.text || '',
    translatedText: comment.translated_text || '',
    gif: comment.gif_url || null,
    media: comment.media || null,
    createdAt:
      typeof comment.created_at === 'string'
        ? comment.created_at
        : comment.created_at != null
          ? new Date(comment.created_at).toISOString()
          : '',
    likes: comment.likes_count || 0,
    liked: !!comment.is_liked,
    translated: false,
    originalLang: comment.original_language || undefined,
    contentMasked: !!comment.content_masked,
    hiddenByOwner: !!comment.hidden_by_owner,
    moderationHidden: !!comment.moderation_hidden,
    viewerHasReported: !!comment.viewer_has_reported,
    replies: repliesPayload.map(mapComment),
    repliesNextPage: comment.replies_next_page || comment.replies?.next_page || null,
    repliesCount: comment.replies_count || repliesPayload.length,
  }
}

async function loadComments(reset = true) {
  if (!overlaySlug.value) return
  if (reset) {
    commentsPage.value = 1
    commentsHasNext.value = false
    richComments.value = []
  }
  const pageToFetch = commentsPage.value
  const response = await fetchComments(overlaySlug.value, pageToFetch, 'recent', highlightedCommentId.value)
  const mapped = (response.results || []).map(mapComment)
  richComments.value = reset ? mapped : [...richComments.value, ...mapped]
  commentsTotalCount.value = response.count || 0
  commentsHasNext.value = !!response.next
  if (response.next) commentsPage.value = pageToFetch + 1
}

async function resolveOverlayFoto(slug: string) {
  const fromList = fotos.value.find((p) => p.slug === slug) ?? null
  const fromCache = getCachedFotoDetail(slug)
  fetchedPin.value = fromCache ?? null
  const mergedPreview = mergeListPinWithDetail(fromList, fromCache)
  descriptionText.value = mergedPreview?.description || ''
  descriptionTranslated.value = false
  richComments.value = []
  commentsTotalCount.value = 0
  void trackFotoView(slug)
  const commentsTask = loadComments(true).catch((e) => {
    console.error('Erreur commentaires overlay', e)
  })
  try {
    const full = await fetchFotoBySlug(slug, { force: false })
    if (overlaySlug.value === slug) {
      fetchedPin.value = full
      descriptionText.value = full.description ?? descriptionText.value
    }
  } catch (err) {
    console.error('Erreur chargement overlay foto', err)
    const detail = fetchedPin.value?.slug === slug ? fetchedPin.value : null
    if (!mergeListPinWithDetail(fromList, detail)) closeOverlay()
  }
  await commentsTask
}

watch(
  () => [overlaySlug.value, pinOverlayHostPageActive.value] as const,
  ([slug, active]) => {
    if (!slug || !active) return
    openingOriginRect.value = consumePinOverlayOrigin(slug)
    void resolveOverlayFoto(slug)
  },
  { immediate: true },
)

function siblingFeed(direction: 1 | -1): FeedItem | null {
  return siblingFeedItem(props.feedItems, activeFeedIndex.value, direction)
}

function handleAdjacent(direction: 1 | -1) {
  const next = siblingFeed(direction)
  if (!next) return
  if (isFeedFoto(next)) replaceOverlaySlug(next.slug)
  else if (isSponsoredAd(next)) replaceOverlaySponsored(next.id)
}

async function handleLike() {
  const p = activePin.value
  if (!p) return
  if (!isAuthenticated.value) {
    promptGuest('like', { resourceId: p.slug })
    return
  }
  const previousLiked = !!p.liked
  const previousReactions = p.stats.reactions || 0
  p.liked = !previousLiked
  p.stats.reactions = Math.max(0, previousReactions + (p.liked ? 1 : -1))
  likingPin.value = true
  try {
    const response = await api.post(`fotos/${encodeURIComponent(p.slug)}/like/`)
    p.liked = response.data.status === 'liked'
    p.stats.reactions = response.data.likes_count
  } catch (err) {
    p.liked = previousLiked
    p.stats.reactions = previousReactions
    console.error('Erreur like foto overlay', err)
  } finally {
    likingPin.value = false
  }
}

function handleDoubleLike() {
  const p = activePin.value
  if (!p) return
  if (!isAuthenticated.value) {
    promptGuest('like', { resourceId: p.slug })
    return
  }
  if (p.liked) return
  void handleLike()
}

async function handleSave() {
  const p = activePin.value
  if (!p) return
  if (!isAuthenticated.value) {
    promptGuest('save', { resourceId: p.slug })
    return
  }
  const previousSaved = !!p.saved
  const previousSaves = p.stats.saves || 0
  p.saved = !previousSaved
  p.stats.saves = Math.max(0, previousSaves + (p.saved ? 1 : -1))
  toggleSaveFoto(p.id)
  savingPin.value = true
  try {
    const response = await api.post(`fotos/${encodeURIComponent(p.slug)}/save/`)
    p.saved = response.data.status === 'saved'
    p.stats.saves = response.data.saves_count
    void fetchCurrentUser({ force: true, silent: true })
  } catch (err) {
    p.saved = previousSaved
    p.stats.saves = previousSaves
    toggleSaveFoto(p.id)
    console.error('Erreur sauvegarde overlay foto', err)
  } finally {
    savingPin.value = false
  }
}

async function handleFollow() {
  const p = activePin.value
  if (!p?.username) return
  if (!isAuthenticated.value) {
    promptGuest('follow', { resourceId: p.username })
    return
  }
  const username = p.username
  const affected = fotos.value.filter((row) => row.username === username)
  const previous = affected.map((row) => row.isFollowing)
  affected.forEach((row) => {
    row.isFollowing = !row.isFollowing
  })
  followingAuthor.value = true
  try {
    await toggleFollow(username)
  } catch (err) {
    affected.forEach((row, index) => {
      row.isFollowing = previous[index]
    })
    console.error('Erreur follow overlay foto', err)
  } finally {
    followingAuthor.value = false
  }
}

async function handleShare() {
  const p = activePin.value
  if (!p) return
  const shareTarget = new URL(route.fullPath, window.location.origin)
  shareTarget.searchParams.set('foto', p.slug)
  await shareUrlWithFallback(
    { showAlert, showPrompt },
    {
      url: shareTarget.toString(),
      title: p.title || 'Fotoce',
      text: (p.description || '').slice(0, 280),
      copiedMessage: t('foto.share.copied'),
      copyErrorMessage: t('profile.share.copyError'),
      copyErrorTitle: t('modal.errorTitle'),
      manualTitle: t('foto.share.manualTitle'),
      manualBody: t('foto.share.manualBody'),
    },
  )
  if (isAuthenticated.value) {
    try {
      const response = await api.post(`fotos/${encodeURIComponent(p.slug)}/record-share/`)
      p.stats.shares = response.data?.shares_count ?? (p.stats.shares || 0) + 1
    } catch (err) {
      console.warn('Erreur compteur partage overlay foto', err)
    }
  }
}

async function handleDownload() {
  const p = activePin.value
  if (!p) return
  if (!isAuthenticated.value) {
    promptGuest('generic')
    return
  }
  downloadingPin.value = true
  try {
    const plan = currentUser.value?.subscription?.plan || 'free'
    const quality = plan === 'pro' ? 'hd' : 'standard'
    const result = await getFotoDownload(p.slug, quality)
    const dl = safeHttpUrl(result.download_url)
    if (!dl) {
      await showAlert(t('foto.download.error'), { variant: 'danger', title: t('modal.errorTitle') })
      return
    }
    window.open(dl, '_blank', 'noopener,noreferrer')
  } catch (err) {
    console.error('Erreur téléchargement overlay foto', err)
    await showAlert(t('foto.download.error'), { variant: 'danger', title: t('modal.errorTitle') })
  } finally {
    downloadingPin.value = false
  }
}

async function handleTranslateDescription() {
  const p = activePin.value
  if (!p) return
  if (!isAuthenticated.value) {
    promptGuest('translate', {
      resourceId: p.slug,
      metadata: { target: 'description', lang: targetLang.value, fotoSlug: p.slug },
    })
    return
  }
  if (descriptionTranslated.value) {
    descriptionText.value = p.description
    descriptionTranslated.value = false
    return
  }
  translatingDescription.value = true
  try {
    const result = await translateFotoDescription(p.slug, targetLang.value)
    descriptionText.value = result?.translated || p.description
    descriptionTranslated.value = !!result?.translated && result.translated.trim() !== p.description.trim()
  } finally {
    translatingDescription.value = false
  }
}

async function handleRichSubmit(payload: CommentSubmitPayload) {
  const p = activePin.value
  if (!p || !isAuthenticated.value) {
    if (!p) return
    if (payload.mediaFile) {
      promptGuest('comment', { resourceId: p.slug })
      return
    }
    promptGuest('comment', {
      resourceId: p.slug,
      metadata: {
        text: payload.text,
        parentId: payload.parentId ?? null,
        gif: payload.gif ?? null,
      },
    })
    return
  }
  if (p.canComment === false) {
    await showAlert(
      p.commentsPolicy === 'closed' ? t('foto.comments.closedBanner') : t('foto.comments.followersOnlyBanner'),
      { variant: 'info' },
    )
    return
  }
  const profanityOk = await moderationScanText([payload.text])
  if (!profanityOk.ok) {
    await showAlert(t('moderation.textInappropriate'), { variant: 'warning' })
    return
  }
  if (payload.mediaFile?.type.startsWith('image/')) {
    try {
      const imgR = await moderationScanImageFile(payload.mediaFile, {
        birthDate: currentUser.value?.birthDate,
        isAuthenticated: isAuthenticated.value,
      })
      if (imgR.level === 'block') {
        await showAlert(t('moderation.imageSensitiveBlocked'), { variant: 'danger', title: t('modal.errorTitle') })
        return
      }
      if (imgR.level === 'blur') await showAlert(t('moderation.imageSensitiveBlurTier'), { variant: 'warning' })
    } catch (err) {
      console.warn('Scan image commentaire overlay', err)
    }
  }
  submittingComment.value = true
  try {
    const formData = new FormData()
    formData.append('text', payload.text || '')
    if (payload.gif) formData.append('gif', payload.gif)
    if (payload.parentId) formData.append('parentId', String(payload.parentId))
    if (payload.mediaFile) formData.append('media', payload.mediaFile)
    await addComment(p.slug, formData)
    await loadComments(true)
  } catch (err: unknown) {
    const ax = err as { response?: { data?: unknown } }
    const msgs = formatDrfErrorMessages(ax.response?.data)
    await showAlert(msgs.slice(0, 6).join('\n') || t('comment.submitError'), {
      variant: 'danger',
      title: t('modal.errorTitle'),
    })
  } finally {
    submittingComment.value = false
  }
}

function handleLikeComment(id: number) {
  if (!isAuthenticated.value) {
    promptGuest('like', {
      resourceId: String(id),
      metadata: { scope: 'comment', fotoSlug: activePin.value?.slug },
    })
    return
  }
  const updateCommentById = (comments: UiComment[]): boolean => {
    for (const comment of comments) {
      if (comment.id === id) {
        const previousLiked = !!comment.liked
        const previousLikes = comment.likes
        comment.liked = !previousLiked
        comment.likes = Math.max(0, previousLikes + (comment.liked ? 1 : -1))
        richComments.value = [...richComments.value]
        toggleCommentLike(id)
          .then((result) => {
            comment.liked = result.status === 'liked'
            comment.likes = result.likes_count
            richComments.value = [...richComments.value]
          })
          .catch(() => {
            comment.liked = previousLiked
            comment.likes = previousLikes
            richComments.value = [...richComments.value]
          })
        return true
      }
      if (comment.replies && updateCommentById(comment.replies)) return true
    }
    return false
  }
  updateCommentById(richComments.value)
}

async function handleTranslateComment(id: number) {
  if (!isAuthenticated.value) {
    const slug = activePin.value?.slug
    if (!slug) return
    promptGuest('translate', {
      resourceId: String(id),
      metadata: { target: 'comment', commentId: id, lang: targetLang.value, fotoSlug: slug },
    })
    return
  }
  const updateCommentById = (comments: UiComment[], commentId: number, updater: (comment: UiComment) => void): boolean => {
    for (const comment of comments) {
      if (comment.id === commentId) {
        updater(comment)
        return true
      }
      if (comment.replies && updateCommentById(comment.replies, commentId, updater)) return true
    }
    return false
  }
  const existing = richComments.value
  let alreadyTranslated = false
  updateCommentById(existing, id, (comment) => {
    alreadyTranslated = !!comment.translated
  })
  if (alreadyTranslated) {
    updateCommentById(existing, id, (comment) => {
      comment.translated = false
    })
    richComments.value = [...existing]
    return
  }
  const result = await translateComment(id, targetLang.value)
  updateCommentById(existing, id, (comment) => {
    comment.translatedText = result?.translated || ''
    comment.translated = true
    if (result?.original_language) comment.originalLang = result.original_language
  })
  richComments.value = [...existing]
}

async function handleLoadMoreComments() {
  if (!commentsHasNext.value || commentsLoadingMore.value) return
  commentsLoadingMore.value = true
  try {
    await loadComments(false)
  } finally {
    commentsLoadingMore.value = false
  }
}

async function handleLoadMoreReplies(commentId: number) {
  const parent = richComments.value.find((comment) => comment.id === commentId)
  if (!parent?.repliesNextPage) return
  const response = await fetchCommentReplies(commentId, parent.repliesNextPage, 'recent', highlightedCommentId.value)
  const mappedReplies = (response.results || []).map(mapComment)
  parent.replies = [...(parent.replies || []), ...mappedReplies]
  parent.repliesNextPage = response.next ? parent.repliesNextPage + 1 : null
  richComments.value = [...richComments.value]
}

async function handleModerateComment(commentId: number, hidden: boolean) {
  const p = activePin.value
  if (!p) return
  try {
    await moderateFotoComment(p.slug, commentId, hidden)
    await loadComments(true)
  } catch {
    await showAlert(t('comment.moderation.error'), { variant: 'danger', title: t('modal.errorTitle') })
  }
}

function openReportFoto() {
  if (!activePin.value || !isAuthenticated.value) {
    promptGuest('generic')
    return
  }
  if (isPinOwner.value) {
    void showAlert(t('moderation.reportOwnDisabled'), { variant: 'info' })
    return
  }
  reportTarget.value = 'foto'
  reportCommentId.value = null
  reportModalOpen.value = true
}

function handleReportComment(commentId: number) {
  if (!isAuthenticated.value) {
    promptGuest('generic')
    return
  }
  reportTarget.value = 'comment'
  reportCommentId.value = commentId
  reportModalOpen.value = true
}

async function handleSubmitReport(payload: { category: string; details: string }) {
  const p = activePin.value
  if (!p) return
  try {
    if (reportTarget.value === 'foto') {
      await reportFoto(p.slug, payload)
      p.viewerHasReported = true
    } else if (reportCommentId.value != null) {
      await reportComment(reportCommentId.value, payload)
      await loadComments(true)
    }
    reportModalOpen.value = false
    await showAlert(t('moderation.reportSent'), { variant: 'success' })
  } catch (err) {
    if (isAlreadyReportedError(err)) {
      p.viewerHasReported = true
      reportModalOpen.value = false
      await showAlert(t('moderation.reportAlready'), { variant: 'info' })
    } else {
      await showAlert(t('moderation.reportError'), { variant: 'danger', title: t('modal.errorTitle') })
    }
  }
}

async function handleDeleteComment(commentId: number) {
  const p = activePin.value
  if (!p || !isAuthenticated.value) {
    promptGuest('generic')
    return
  }
  const ok = await showConfirm({
    title: t('comment.delete.confirmTitle'),
    message: t('comment.delete.confirmBody'),
    variant: 'danger',
  })
  if (!ok) return
  try {
    await deleteFotoComment(p.slug, commentId)
    await loadComments(true)
  } catch {
    await showAlert(t('comment.delete.error'), { variant: 'danger', title: t('modal.errorTitle') })
  }
}
</script>

<template>
  <Teleport to="body">
  <div
    v-if="showOverlayLoading"
    class="fixed inset-0 z-[var(--fotoce-z-foto-overlay,80)] flex items-center justify-center bg-black/85"
    aria-busy="true"
    :aria-label="t('common.loading')"
  >
    <FotoceIcon name="progress_activity" spin class="text-4xl text-white/90 animate-spin" />
  </div>
  </Teleport>

    <FotoDetailMobileFullscreen
      v-if="showPinOverlayUi && activePin"
      :pin="activePin"
    :previous-pin="previousPin"
    :next-pin="nextPin"
    :can-navigate-previous="hasPreviousFeed"
    :can-navigate-next="hasNextFeed"
    :opening-origin-rect="openingOriginRect"
    :current-user="currentUser as User | null"
    :is-authenticated="isAuthenticated"
    :is-foto-owner="isPinOwner"
    :viewer-can-comment="viewerCanComment"
    :viewer-can-reveal-sensitive="viewerCanRevealSensitive"
    :blur-sensitive-by-default="blurSensitiveByDefault"
    :description-text="descriptionText"
    :comments="richComments"
    :comments-total-count="commentsTotalCount"
    :comments-has-next="commentsHasNext"
    :comments-loading-more="commentsLoadingMore"
    :highlighted-comment-id="highlightedCommentId"
    :detail-video-preload="detailVideoPreload"
    :detail-image-fetch-priority="detailImageFetchPriority"
    :format-count="formatCount"
    :liking-pin="likingPin"
    :saving-pin="savingPin"
    :downloading-pin="downloadingPin"
    :following-author="followingAuthor"
    :translating-description="translatingDescription"
    :submitting-comment="submittingComment"
    @back="closeOverlay"
    @like="handleLike"
    @double-like="handleDoubleLike"
    @save="handleSave"
    @share="handleShare"
    @download="handleDownload"
    @report="openReportPin"
    @boost="openPromoteBoost"
    @follow="handleFollow"
    @translate-description="handleTranslateDescription"
    @open-likers="storyLikersOpen = true"
    @comment-add="handleRichSubmit"
    @comment-like="handleLikeComment"
    @comment-translate="handleTranslateComment"
    @load-more-comments="handleLoadMoreComments"
    @load-more-replies="handleLoadMoreReplies"
    @moderate-comment="handleModerateComment"
    @report-comment="handleReportComment"
    @delete-comment="handleDeleteComment"
    @next-pin="handleAdjacent(1)"
    @prev-pin="handleAdjacent(-1)"
  />

    <FotoDetailDesktopModal
      v-if="showPinOverlayUi && activePin"
      :pin="activePin"
    :can-navigate-previous="hasPreviousFeed"
    :can-navigate-next="hasNextFeed"
    :current-user="currentUser as User | null"
    :is-authenticated="isAuthenticated"
    :is-foto-owner="isPinOwner"
    :viewer-can-comment="viewerCanComment"
    :viewer-can-reveal-sensitive="viewerCanRevealSensitive"
    :blur-sensitive-by-default="blurSensitiveByDefault"
    :description-text="descriptionText"
    :comments="richComments"
    :comments-total-count="commentsTotalCount"
    :comments-has-next="commentsHasNext"
    :comments-loading-more="commentsLoadingMore"
    :highlighted-comment-id="highlightedCommentId"
    :detail-video-preload="detailVideoPreload"
    :detail-image-fetch-priority="detailImageFetchPriority"
    :format-count="formatCount"
    :liking-pin="likingPin"
    :saving-pin="savingPin"
    :downloading-pin="downloadingPin"
    :following-author="followingAuthor"
    :translating-description="translatingDescription"
    :submitting-comment="submittingComment"
    @close="closeOverlay"
    @like="handleLike"
    @double-like="handleDoubleLike"
    @save="handleSave"
    @share="handleShare"
    @download="handleDownload"
    @report="openReportPin"
    @boost="openPromoteBoost"
    @follow="handleFollow"
    @translate-description="handleTranslateDescription"
    @open-likers="storyLikersOpen = true"
    @comment-add="handleRichSubmit"
    @comment-like="handleLikeComment"
    @comment-translate="handleTranslateComment"
    @load-more-comments="handleLoadMoreComments"
    @load-more-replies="handleLoadMoreReplies"
    @moderate-comment="handleModerateComment"
    @report-comment="handleReportComment"
    @delete-comment="handleDeleteComment"
    @prev-pin="handleAdjacent(-1)"
    @next-pin="handleAdjacent(1)"
  />

    <SponsoredDetailMobileFullscreen
      v-if="showSponsoredOverlayUi && activeSponsoredAd"
      :item="activeSponsoredAd"
      :has-previous="hasPreviousFeed"
      :has-next="hasNextFeed"
      @back="closeOverlay"
      @prev="handleAdjacent(-1)"
      @next="handleAdjacent(1)"
    />

    <SponsoredDetailDesktopModal
      v-if="showSponsoredOverlayUi && activeSponsoredAd"
      :item="activeSponsoredAd"
      :has-previous="hasPreviousFeed"
      :has-next="hasNextFeed"
      @close="closeOverlay"
      @prev="handleAdjacent(-1)"
      @next="handleAdjacent(1)"
    />

  <StoryLikersModal
    v-model="storyLikersOpen"
    :pin-slug="storyLikersOpen ? (activePin?.slug ?? null) : null"
  />

  <ReportContentModal
    v-model="reportModalOpen"
    :context-label="activePin?.title || ''"
    @submit="handleSubmitReport"
  />

  <PromoteFotoSheet
    v-if="activePin"
    :open="promoteSheetOpen"
    :pin-slug="activePin.slug"
    initial-mode="boost"
    @close="promoteSheetOpen = false"
  />
</template>
