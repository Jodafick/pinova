<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { feedFotosOnly, useFotos, getFullMediaUrl, isAlreadyReportedError } from '../composables/useFotos'
import { isFeedFoto, type Foto } from '../types'
import { useAuth, DEFAULT_AVATAR_COLOR_CLASS } from '../composables/useAuth'
import api from '../api/index'
import { displayInitials } from '../utils/displayInitials'
import FotoGrid from '../components/FotoGrid.vue'
import FotoDetailSkeleton from '../components/FotoDetailSkeleton.vue'
import RichCommentInput from '../components/RichCommentInput.vue'
import CommentThread from '../components/CommentThread.vue'
import { useI18n } from '../i18n'
import { useAppModal } from '../composables/useAppModal'
import {
  moderationScanText,
  moderationScanImageFile,
} from '../composables/useModeration'
import {
  viewerCanRevealSensitiveMedia,
  sensitiveMediaBlurredByDefault,
} from '../composables/moderationPolicy'
import { formatDrfErrorMessages } from '../utils/apiValidationErrors'
import FotoSensitiveMedia from '../components/FotoSensitiveMedia.vue'
import StoryLikersModal from '../components/StoryLikersModal.vue'
import ReportContentModal from '../components/ReportContentModal.vue'
import TipDialog from '../components/TipDialog.vue'
import PromoteFotoSheet from '../components/PromoteFotoSheet.vue'
import AvatarDisc from '../components/AvatarDisc.vue'
import { useDataSaver } from '../composables/useDataSaver'
import { shareUrlWithFallback } from '../utils/shareFallback'
import { safeHttpUrl } from '../utils/safeHttpUrl'
import { useAnchoredDropdown } from '../composables/useAnchoredDropdown'
import { usePointerOutsideDismiss } from '../composables/usePointerOutsideDismiss'
import {
  PIN_MEDIA_ANTI_LEAK_CLASS,
  pinMediaAntiLeakImgBindings,
  pinMediaAntiLeakVideoBindings,
} from '../composables/mediaAntiLeak'
import { useGuestAuthGate } from '../composables/useGuestAuthGate'
import FotoceButton from '../components/ui/FotoceButton.vue'

const { t } = useI18n()
const { showAlert, showPrompt, showConfirm } = useAppModal()

const route = useRoute()
const router = useRouter()

const {
  getFoto,
  toggleSave,
  fotos,
  fetchFotoBySlug,
  seedFotoDetailCacheIntoStore,
  patchFotoCommentsPolicy,
  moderateFotoComment,
  deleteFotoComment,
  formatCount,
  toggleFollow,
  loading: pinsLoading,
  fetchComments,
  fetchCommentReplies,
  addComment,
  translateComment,
  toggleCommentLike,
  translateFotoDescription,
  trackFotoView,
  getFotoDownload,
  reportFoto,
  reportComment,
  deleteFoto,
} = useFotos()
const { currentUser, toggleSaveFoto, isAuthenticated } = useAuth()
const { promptGuest } = useGuestAuthGate()

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

const { detailVideoPreload, isLowDataMode } = useDataSaver()
const detailImageFetchPriority = computed(() => (isLowDataMode.value ? 'low' : 'high'))

const fotoSlug = computed(() => route.params.slug as string)
const foto = computed(() => getFoto(fotoSlug.value))

function initFotoDetailLoadingFromCache(): boolean {
  const s = typeof route.params.slug === 'string' ? route.params.slug : ''
  if (!s) return true
  seedFotoDetailCacheIntoStore(s)
  return !getFoto(s)
}

const pinDetailLoading = ref(initFotoDetailLoadingFromCache())

function usernamesMatch(a?: string | null, b?: string | null) {
  return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()
}

const isPinOwner = computed(() => !!(currentUser.value && foto.value && usernamesMatch(currentUser.value.username, foto.value.username)))
const viewerCanComment = computed(() => {
  const p = foto.value
  if (!p) return false
  return p.canComment !== false
})
const targetLang = computed(() => currentUser.value?.preferredLanguage || navigator.language?.split('-')[0] || 'fr')

const relatedPins = computed(() => {
  if (!pin.value) return []
  return feedFotosOnly(fotos.value).filter(
    (p) => p.topic === foto.value?.topic && p.slug !== foto.value?.slug,
  ).slice(0, 8)
})
const savingPin = ref(false)
const likingPin = ref(false)
const followingAuthor = ref(false)
const tipDialogOpen = ref(false)
const promoteSheetOpen = ref(false)
const pinHeartBurst = ref(false)
const pinHeartBurstKey = ref(0)
let pinHeartBurstHideTimer: number | null = null
const translatingDescription = ref(false)
const submittingComment = ref(false)
const downloadingPin = ref(false)
const commentsPolicySaving = ref(false)
const pinDetailNotFound = ref(false)
const storyLikersOpen = ref(false)

const pinOwnerMenuOpen = ref(false)
const pinOwnerMenuTriggerRef = ref<HTMLElement | null>(null)
const pinOwnerMenuPanelRef = ref<HTMLElement | null>(null)

const { floatingStyles: pinOwnerMenuFloatingStyles } = useAnchoredDropdown(
  pinOwnerMenuTriggerRef,
  pinOwnerMenuPanelRef,
  {
    open: pinOwnerMenuOpen,
    placement: 'bottom-start',
    strategy: 'fixed',
    offsetPx: 8,
  },
)

usePointerOutsideDismiss(() => [
  {
    isOpen: pinOwnerMenuOpen,
    getRoots: () => [pinOwnerMenuTriggerRef.value, pinOwnerMenuPanelRef.value],
    close: () => {
      pinOwnerMenuOpen.value = false
    },
  },
])

let resolvePinGeneration = 0

/** `true` = paysage, `false` = portrait, `null` = pas encore chargé. */
const detailImageLandscape = ref<boolean | null>(null)

function onDetailImageLoad(e: Event) {
  const img = e.target as HTMLImageElement
  if (!img.naturalWidth || !img.naturalHeight) return
  detailImageLandscape.value = img.naturalWidth >= img.naturalHeight
}

function onDetailVideoLoadedMetadata(e: Event) {
  const v = e.target as HTMLVideoElement
  if (!v.videoWidth || !v.videoHeight) return
  detailImageLandscape.value = v.videoWidth >= v.videoHeight
}

async function resolveFotoDetail() {
  const slug = fotoSlug.value
  const generation = ++resolvePinGeneration
  seedFotoDetailCacheIntoStore(slug)
  pinDetailLoading.value = !pin.value
  pinDetailNotFound.value = false
  detailImageLandscape.value = null
  richComments.value = []
  commentsTotalCount.value = 0
  try {
    await fetchFotoBySlug(slug)
  } catch {
    if (generation !== resolvePinGeneration) return
    pinDetailNotFound.value = true
  } finally {
    if (generation === resolvePinGeneration) {
      pinDetailLoading.value = false
    }
  }
  if (generation !== resolvePinGeneration || fotoSlug.value !== slug) return
  if (pin.value && foto.value.slug === slug) {
    pinDetailNotFound.value = false
    descriptionText.value = foto.value.description
    descriptionTranslated.value = false
    void trackFotoView(pin.value.slug)
    try {
      await loadComments(true)
    } catch (err) {
      console.error('Erreur lors du chargement des commentaires', err)
    }
  } else if (generation === resolvePinGeneration && fotoSlug.value === slug) {
    pinDetailNotFound.value = true
  }
}

onMounted(async () => {
  await resolveFotoDetail()
})

watch(fotoSlug, async () => {
  pinOwnerMenuOpen.value = false
  await resolveFotoDetail()
})

watch(
  () => route.query.commentId,
  async () => {
    await focusHighlightedComment()
  },
)

const handleLike = async () => {
  const p = foto.value
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
    console.error('Erreur like foto', err)
  } finally {
    likingPin.value = false
  }
}

function triggerPinHeartBurst() {
  pinHeartBurstKey.value += 1
  pinHeartBurst.value = true
  if (pinHeartBurstHideTimer) clearTimeout(pinHeartBurstHideTimer)
  pinHeartBurstHideTimer = window.setTimeout(() => {
    pinHeartBurst.value = false
    pinHeartBurstHideTimer = null
  }, 980)
}

onBeforeUnmount(() => {
  if (pinHeartBurstHideTimer) clearTimeout(pinHeartBurstHideTimer)
})

const handleMediaDoubleLike = () => {
  const p = foto.value
  if (!p) return
  if (!isAuthenticated.value) {
    promptGuest('like', { resourceId: p.slug })
    return
  }
  triggerPinHeartBurst()
  if (p.liked) return
  void handleLike()
}

const handleSave = () => {
  const currentPin = foto.value
  if (!currentPin) return
  if (!isAuthenticated.value) {
    promptGuest('save', { resourceId: currentPin.slug })
    return
  }
  savingPin.value = true
  toggleSaveFoto(currentPin.id)
  Promise.resolve(toggleSave(currentPin.slug))
    .catch((err) => {
      toggleSaveFoto(currentPin.id)
      console.error('Erreur sauvegarde foto', err)
    })
    .finally(() => {
      savingPin.value = false
    })
}

const handleFollow = async () => {
  const username = foto.value?.username?.trim()
  if (!isAuthenticated.value) {
    if (!username) return
    promptGuest('follow', { resourceId: username })
    return
  }
  if (pin.value && foto.value.username) {
    const previous = !!pin.value.isFollowing
    foto.value.isFollowing = !previous
    followingAuthor.value = true
    try {
      await toggleFollow(pin.value.username)
    } catch (err) {
      foto.value.isFollowing = previous
      console.error('Erreur follow auteur', err)
    } finally {
      followingAuthor.value = false
    }
  }
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

const richComments = ref<UiComment[]>([])
const commentsTotalCount = ref(0)
const commentsPage = ref(1)
const commentsHasNext = ref(false)
const commentsLoadingMore = ref(false)
const descriptionText = ref('')
const descriptionTranslated = ref(false)
const commentSort = ref<'recent' | 'relevant'>(
  typeof window !== 'undefined' && window.localStorage.getItem('fotoce_comment_sort') === 'relevant'
    ? 'relevant'
    : 'recent',
)
const highlightedCommentId = computed<number | null>(() => {
  const raw = route.query.commentId
  if (typeof raw !== 'string') return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
})

const focusHighlightedComment = async () => {
  if (!highlightedCommentId.value) return
  await nextTick()
  const node = document.getElementById(`comment-${highlightedCommentId.value}`)
  if (node) {
    node.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

const mapComment = (comment: any): UiComment => {
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

const loadComments = async (reset = true) => {
  if (!fotoSlug.value) return
  if (reset) {
    commentsPage.value = 1
    commentsHasNext.value = false
    richComments.value = []
  }
  const pageToFetch = commentsPage.value
  const response = await fetchComments(
    fotoSlug.value,
    pageToFetch,
    commentSort.value,
    highlightedCommentId.value,
  )
  const mapped = (response.results || []).map(mapComment)
  if (reset) {
    richComments.value = mapped
  } else {
    richComments.value = [...richComments.value, ...mapped]
  }
  commentsTotalCount.value = response.count || 0
  commentsHasNext.value = !!response.next
  if (response.next) {
    commentsPage.value = pageToFetch + 1
  }
  await focusHighlightedComment()
}

const setCommentSort = async (sort: 'recent' | 'relevant') => {
  if (commentSort.value === sort) return
  commentSort.value = sort
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('fotoce_comment_sort', sort)
  }
  await loadComments(true)
}

const handleRichSubmit = async (
  payload: { text: string; gif?: string | null; mediaFile?: File | null; replyTo?: string | null; parentId?: number },
) => {
  if (!pin.value || !isAuthenticated.value) {
    if (!pin.value) return
    if (payload.mediaFile) {
      promptGuest('comment', { resourceId: foto.value.slug })
      return
    }
    promptGuest('comment', {
      resourceId: foto.value.slug,
      metadata: {
        text: payload.text,
        parentId: payload.parentId ?? null,
        gif: payload.gif ?? null,
      },
    })
    return
  }
  if (pin.value.canComment === false) {
    await showAlert(
      foto.value.commentsPolicy === 'closed' ? t('foto.comments.closedBanner') : t('foto.comments.followersOnlyBanner'),
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
        await showAlert(t('moderation.imageSensitiveBlocked'), {
          variant: 'danger',
          title: t('modal.errorTitle'),
        })
        return
      }
      if (imgR.level === 'blur') {
        await showAlert(t('moderation.imageSensitiveBlurTier'), { variant: 'warning' })
      }
    } catch (err) {
      console.warn('Scan image commentaire', err)
    }
  }
  submittingComment.value = true
  try {
    const formData = new FormData()
    formData.append('text', payload.text || '')
    if (payload.gif) {
      formData.append('gif', payload.gif)
    }
    if (payload.parentId) {
      formData.append('parentId', String(payload.parentId))
    }
    if (payload.mediaFile) {
      formData.append('media', payload.mediaFile)
    }
    await addComment(pin.value.slug, formData)
    await loadComments(true)
  } catch (err: unknown) {
    console.error('Erreur envoi commentaire', err)
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

const handleLikeComment = (id: number) => {
  if (!isAuthenticated.value) {
    promptGuest('like', {
      resourceId: String(id),
      metadata: { scope: 'comment', fotoSlug: foto.value?.slug },
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
          .catch((err) => {
            comment.liked = previousLiked
            comment.likes = previousLikes
            richComments.value = [...richComments.value]
            console.error('Erreur like commentaire', err)
          })
        return true
      }
      if (comment.replies && updateCommentById(comment.replies)) {
        return true
      }
    }
    return false
  }
  updateCommentById(richComments.value)
}

const handleTranslateComment = async (id: number) => {
  if (!isAuthenticated.value) {
    const slug = foto.value?.slug
    if (!slug) return
    promptGuest('translate', {
      resourceId: String(id),
      metadata: { target: 'comment', commentId: id, lang: targetLang.value, fotoSlug: slug },
    })
    return
  }

  const updateCommentById = (
    comments: UiComment[],
    commentId: number,
    updater: (comment: UiComment) => void,
  ): boolean => {
    for (const comment of comments) {
      if (comment.id === commentId) {
        updater(comment)
        return true
      }
      if (comment.replies && updateCommentById(comment.replies, commentId, updater)) {
        return true
      }
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

  let hasLocalTranslation = false
  updateCommentById(existing, id, (comment) => {
    hasLocalTranslation = !!comment.translatedText
  })
  if (hasLocalTranslation) {
    updateCommentById(existing, id, (comment) => {
      comment.translated = true
    })
    richComments.value = [...existing]
    return
  }

  const result = await translateComment(id, targetLang.value)
  updateCommentById(existing, id, (comment) => {
    comment.translatedText = result?.translated || ''
    comment.translated = true
    if (result?.original_language) {
      comment.originalLang = result.original_language
    }
  })
  richComments.value = [...existing]
}

const pinVisibility = computed<'public' | 'followers' | 'private'>(() => {
  return (pin.value?.visibility as 'public' | 'followers' | 'private') || 'public'
})

const handleTranslateDescription = async () => {
  if (!pin.value) return
  if (!isAuthenticated.value) {
    promptGuest('translate', {
      resourceId: foto.value.slug,
      metadata: { target: 'description', lang: targetLang.value, fotoSlug: foto.value.slug },
    })
    return
  }
  if (descriptionTranslated.value) {
    descriptionText.value = foto.value.description
    descriptionTranslated.value = false
    return
  }
  translatingDescription.value = true
  try {
    const result = await translateFotoDescription(pin.value.slug, targetLang.value)
    descriptionText.value = result?.translated || foto.value.description
    descriptionTranslated.value = !!result?.translated && result.translated.trim() !== foto.value.description.trim()
  } finally {
    translatingDescription.value = false
  }
}

const handleToggleSaveRelated = async (slug: string) => {
  if (!isAuthenticated.value) {
    promptGuest('save', { resourceId: slug })
    return
  }
  const relatedPin = fotos.value.find((p): p is Foto => isFeedFoto(p) && p.slug === slug)
  if (relatedPin) {
    toggleSaveFoto(relatedPin.id)
  }
  try {
    await toggleSave(slug)
  } catch (err) {
    if (relatedPin) {
      toggleSaveFoto(relatedPin.id)
    }
    console.error('Erreur sauvegarde foto relié', err)
  }
}

const handleLoadMoreComments = async () => {
  if (!commentsHasNext.value || commentsLoadingMore.value) return
  commentsLoadingMore.value = true
  try {
    await loadComments(false)
  } finally {
    commentsLoadingMore.value = false
  }
}

const handleLoadMoreReplies = async (commentId: number) => {
  const parent = richComments.value.find((comment) => comment.id === commentId)
  if (!parent?.repliesNextPage) return
  const response = await fetchCommentReplies(
    commentId,
    parent.repliesNextPage,
    commentSort.value,
    highlightedCommentId.value,
  )
  const mappedReplies = (response.results || []).map(mapComment)
  parent.replies = [...(parent.replies || []), ...mappedReplies]
  parent.repliesNextPage = response.next ? parent.repliesNextPage + 1 : null
  richComments.value = [...richComments.value]
}

const handleCommentsPolicyChange = async (ev: Event) => {
  const sel = ev.target as HTMLSelectElement
  const next = sel.value as 'open' | 'followers_only' | 'closed'
  if (!pin.value || !isPinOwner.value) return
  commentsPolicySaving.value = true
  try {
    await patchFotoCommentsPolicy(pin.value.slug, next)
  } catch {
    await showAlert(t('foto.comments.policySaveError'), { variant: 'danger', title: t('modal.errorTitle') })
    sel.value = foto.value.commentsPolicy || 'open'
  } finally {
    commentsPolicySaving.value = false
  }
}

const handleModerateComment = async (commentId: number, hidden: boolean) => {
  if (!pin.value) return
  try {
    await moderateFotoComment(pin.value.slug, commentId, hidden)
    await loadComments(true)
  } catch {
    await showAlert(t('comment.moderation.error'), { variant: 'danger', title: t('modal.errorTitle') })
  }
}

const reportModalOpen = ref(false)
const reportTarget = ref<'foto' | 'comment'>('foto')
const reportCommentId = ref<number | null>(null)

const reportModalContextLabel = computed(() => {
  if (!pin.value) return ''
  if (reportTarget.value === 'foto') return foto.value.title
  return `Commentaire #${reportCommentId.value ?? ''} · ${pin.value.title}`
})

const handleReportPin = async () => {
  if (!pin.value || !isAuthenticated.value) {
    promptGuest('generic')
    return
  }
  if (isPinOwner.value) {
    await showAlert(t('moderation.reportOwnDisabled'), { variant: 'info' })
    return
  }
  if (pin.value.viewerHasReported) {
    await showAlert(t('moderation.reportAlready'), { variant: 'info' })
    return
  }
  reportTarget.value = 'foto'
  reportCommentId.value = null
  reportModalOpen.value = true
}

const handleReportComment = async (commentId: number) => {
  if (!isAuthenticated.value) {
    promptGuest('generic')
    return
  }
  reportTarget.value = 'comment'
  reportCommentId.value = commentId
  reportModalOpen.value = true
}

async function handleSubmitReport(payload: { category: string; details: string }) {
  if (!pin.value) return
  try {
    if (reportTarget.value === 'foto') {
      await reportFoto(pin.value.slug, payload)
      await fetchFotoBySlug(pin.value.slug)
    } else if (reportCommentId.value != null) {
      await reportComment(reportCommentId.value, payload)
      await loadComments(true)
    }
    reportModalOpen.value = false
    await showAlert(t('moderation.reportSent'), { variant: 'success' })
  } catch (e) {
    if (isAlreadyReportedError(e)) {
      if (reportTarget.value === 'foto') {
        await fetchFotoBySlug(pin.value.slug)
      } else {
        await loadComments(true)
      }
      reportModalOpen.value = false
      await showAlert(t('moderation.reportAlready'), { variant: 'info' })
    } else {
      await showAlert(t('moderation.reportError'), { variant: 'danger', title: t('modal.errorTitle') })
    }
  }
}

const handleDeleteComment = async (commentId: number) => {
  if (!pin.value || !isAuthenticated.value) {
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
    await deleteFotoComment(pin.value.slug, commentId)
    await loadComments(true)
  } catch {
    await showAlert(t('comment.delete.error'), { variant: 'danger', title: t('modal.errorTitle') })
  }
}

const handleShare = async () => {
  if (!pin.value) return
  const sharedPin = foto.value
  const url = typeof window !== 'undefined' ? window.location.href : ''
  const title = sharedPin.title || 'Fotoce'
  const text = (sharedPin.description || '').slice(0, 280)
  await shareUrlWithFallback(
    { showAlert, showPrompt },
    {
      url,
      title,
      text,
      copiedMessage: t('foto.share.copied'),
      copyErrorMessage: t('profile.share.copyError'),
      copyErrorTitle: t('modal.errorTitle'),
      manualTitle: t('foto.share.manualTitle'),
      manualBody: t('foto.share.manualBody'),
    },
  )
  if (isAuthenticated.value) {
    try {
      const response = await api.post(`fotos/${encodeURIComponent(sharedPin.slug)}/record-share/`)
      sharedPin.stats.shares = response.data?.shares_count ?? (sharedPin.stats.shares || 0) + 1
    } catch (err) {
      console.warn('Erreur compteur partage foto', err)
    }
  }
}

const handleDownload = async () => {
  if (!isAuthenticated.value) {
    promptGuest('generic')
    return
  }
  if (!pin.value) return
  downloadingPin.value = true
  let tab: Window | null = null
  try {
    tab = window.open('about:blank', '_blank', 'noopener,noreferrer')
  } catch {
    tab = null
  }
  try {
    const plan = currentUser.value?.subscription?.plan || 'free'
    const quality = plan === 'pro' ? 'hd' : 'standard'
    const result = await getFotoDownload(pin.value.slug, quality)
    const url = safeHttpUrl(result.download_url)
    if (!url) {
      try {
        tab?.close()
      } catch {
        /* ignore */
      }
      await showAlert(t('foto.download.error'), { variant: 'danger', title: t('modal.errorTitle') })
      return
    }
    if (tab && !tab.closed) {
      tab.location.href = url
      return
    }
    const link = document.createElement('a')
    link.href = url
    link.download = `${pin.value.slug}.jpg`
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (err) {
    try {
      tab?.close()
    } catch {
      /* ignore */
    }
    console.error('Erreur téléchargement foto', err)
    await showAlert(t('foto.download.error'), { variant: 'danger', title: t('modal.errorTitle') })
  } finally {
    downloadingPin.value = false
  }
}

const goBack = () => {
  router.back()
}

const openRelatedPin = (slug: string) => {
  router.push(`/foto/${slug}`)
}

const confirmDeletePin = async () => {
  const p = foto.value
  if (!p || !isPinOwner.value) return
  const ok = await showConfirm({
    title: t('foto.delete.confirmTitle'),
    message: t('foto.delete.confirmBody'),
    variant: 'danger',
  })
  if (!ok) return
  const slug = p.slug
  const profile = p.username
  try {
    await deleteFoto(slug)
    router.push(profile ? `/profile/${profile}` : '/')
  } catch {
    await showAlert(t('foto.delete.error'), { variant: 'danger', title: t('modal.errorTitle') })
  }
}

function togglePinOwnerMenu() {
  pinOwnerMenuOpen.value = !pinOwnerMenuOpen.value
}

function goEditPinFromMenu() {
  pinOwnerMenuOpen.value = false
  const slug = foto.value?.slug
  if (slug) router.push(`/foto/${slug}/edit`)
}

async function deleteFotoFromMenu() {
  pinOwnerMenuOpen.value = false
  await confirmDeleteFoto()
}
</script>

<template>
  <div class="min-h-screen w-full min-w-0">
    <FotoDetailSkeleton v-if="pinDetailLoading" />

    <!-- Not found -->
    <div
      v-else-if="pinDetailNotFound || !pin"
      class="flex flex-col items-center justify-center py-32 text-center px-6"
    >
      <FotoceIcon name="broken_image" class="text-7xl text-neutral-300 mb-4" />
      <h1 class="text-2xl font-auth-title font-auth-title--black text-neutral-800 mb-2">{{ t('foto.notFound.title') }}</h1>
      <p class="text-neutral-500 mb-6">{{ t('foto.notFound.desc') }}</p>
      <router-link to="/" class="lux-btn-primary lux-btn-pill text-sm">
        {{ t('foto.notFound.cta') }}
      </router-link>
    </div>

    <!-- Foto detail -->
    <template v-else>
    <main
      id="main-foto-detail"
      tabindex="-1"
      :aria-labelledby="pin.title ? 'foto-detail-title' : undefined"
      class="min-h-screen w-full min-w-0 outline-none"
    >
      <div class="foto-detail-page-wrap w-full min-w-0 max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <!-- Back button -->
        <FotoceButton
          variant="secondary"
          class="foto-detail-back group mb-8 hidden text-sm lg:inline-flex"
          :aria-label="t('foto.a11y.back')"
          @click="goBack"
        >
          <FotoceIcon name="arrow_back" class="text-lg" />
          {{ t('common.back') }}
        </FotoceButton>

        <!-- Main card -->
        <div class="foto-detail-mobile-card lux-foto-detail-card flex flex-col lg:flex-row lg:max-h-[80vh]">
          <!-- Image : paysage centré verticalement ; portrait → colonne plus large pour mieux remplir -->
          <div
            class="foto-detail-media-pane bg-neutral-100 flex flex-col lg:max-h-[80vh] lg:overflow-hidden shrink-0 min-h-[200px] lg:min-h-0"
            :class="
              detailImageLandscape === false
                ? 'lg:flex-[1.38] lg:basis-0 lg:min-w-0'
                : 'lg:flex-none lg:w-1/2'
            "
            :style="detailImageLandscape === true ? { justifyContent: 'center' } : undefined"
          >
            <div
              class="foto-detail-media-wrap w-full flex min-h-0"
              :class="detailImageLandscape === true ? 'flex-1 items-center justify-center' : ''"
            >
              <FotoSensitiveMedia
                v-if="pin.imageUrl"
                :sensitive="!!pin.mediaSensitiveBlur"
                :viewer-can-reveal="viewerCanRevealSensitive"
                :blur-by-default="blurSensitiveByDefault"
                :media-url="pin.imageUrl"
                media-type="image"
                wrapper-class="w-full flex justify-center"
              >
                <img
                  :src="pin.imageUrl"
                  :alt="pin.title ? `${pin.title} — ${pin.user}` : t('feed.pinImageFallback', { user: foto.user })"
                  :fetchpriority="detailImageFetchPriority"
                  loading="eager"
                  decoding="async"
                  :class="[
                    PIN_MEDIA_ANTI_LEAK_CLASS,
                    'foto-detail-media w-full h-auto max-h-[min(80vh,900px)] lg:max-h-[80vh] object-contain select-none bg-neutral-100',
                  ]"
                  @load="onDetailImageLoad"
                  @dblclick.prevent="handleMediaDoubleLike"
                  v-bind="pinMediaAntiLeakImgBindings()"
                />
              </FotoSensitiveMedia>
              <FotoSensitiveMedia
                v-else-if="pin.storyVideoUrl"
                :sensitive="!!pin.mediaSensitiveBlur"
                :viewer-can-reveal="viewerCanRevealSensitive"
                :blur-by-default="blurSensitiveByDefault"
                :media-url="pin.storyVideoUrl"
                media-type="video"
                wrapper-class="w-full flex justify-center"
              >
                <video
                  :src="pin.storyVideoUrl"
                  controls
                  playsinline
                  :preload="detailVideoPreload"
                  :class="[
                    PIN_MEDIA_ANTI_LEAK_CLASS,
                    'foto-detail-media w-full h-auto max-h-[min(80vh,900px)] lg:max-h-[80vh] object-contain select-none bg-neutral-100',
                  ]"
                  @loadedmetadata="onDetailVideoLoadedMetadata"
                  @dblclick.prevent="handleMediaDoubleLike"
                  v-bind="pinMediaAntiLeakVideoBindings(true)"
                />
              </FotoSensitiveMedia>
              <transition name="foto-detail-heart">
                <div v-if="pinHeartBurst" :key="pinHeartBurstKey" class="foto-detail-heart-burst pointer-events-none">
                  <FotoceIcon name="favorite" />
                </div>
              </transition>
            </div>
          </div>

          <!-- Details -->
          <div class="foto-detail-info-pane lg:flex-1 lg:min-w-0 p-6 sm:p-8 lg:p-10 flex flex-col lg:max-h-[80vh] lg:overflow-y-auto min-h-0">
            <!-- Actions bar -->
            <div class="foto-detail-actions flex items-center justify-between mb-6">
              <div class="flex items-center gap-2 flex-wrap">
                <div v-if="isPinOwner && foto.slug" class="relative shrink-0">
                  <button
                    ref="pinOwnerMenuTriggerRef"
                    type="button"
                    class="lux-icon-ring-btn"
                    :aria-label="t('foto.ownerMenu.more')"
                    :aria-expanded="pinOwnerMenuOpen"
                    aria-haspopup="menu"
                    @click.stop.prevent="togglePinOwnerMenu"
                  >
                    <FotoceIcon name="more_horiz" class="text-[22px] leading-none translate-y-px" aria-hidden="true" />
                  </button>
                </div>
                <button
                  v-if="!(pin.isStory && isPinOwner)"
                  type="button"
                  class="lux-icon-ring-btn"
                  :class="pin.liked ? 'bg-gradient-to-br from-pink-50 to-rose-50/80 text-pink-700 border-pink-100' : ''"
                  :disabled="likingPin"
                  :aria-pressed="pin.liked"
                  :aria-label="pin.liked ? t('foto.a11y.unlike') : t('foto.a11y.like')"
                  @click="handleLike"
                >
                  <span v-if="likingPin" class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                  <FotoceIcon v-else name="favorite" :class="pin.liked ? 'text-pink-700' : 'text-neutral-700'" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  class="lux-icon-ring-btn"
                  :aria-label="t('foto.a11y.share')"
                  @click="handleShare"
                >
                  <FotoceIcon name="share" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  class="lux-icon-ring-btn disabled:opacity-40 disabled:cursor-not-allowed"
                  :disabled="downloadingPin || !pin.imageUrl"
                  :aria-label="t('foto.a11y.download')"
                  @click="handleDownload"
                >
                  <span v-if="downloadingPin" class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                  <FotoceIcon v-else name="download" aria-hidden="true" />
                </button>
                <button
                  v-if="isAuthenticated && !isPinOwner && !pin.viewerHasReported"
                  type="button"
                  class="lux-icon-ring-btn"
                  :aria-label="t('moderation.report')"
                  @click="handleReportPin"
                >
                  <FotoceIcon name="flag" class="text-[22px]" aria-hidden="true" />
                </button>
              </div>
              <button
                type="button"
                class="foto-detail-save transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
                :class="pin.saved ? 'lux-btn-detail-saved' : 'lux-btn-primary lux-btn-pill'"
                :disabled="savingPin"
                :aria-pressed="pin.saved"
                :aria-label="pin.saved ? t('foto.a11y.saved') : t('foto.a11y.save')"
                @click="handleSave"
              >
                <span v-if="savingPin" class="w-4 h-4 inline-block border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                <FotoceIcon v-else name="bookmark" class="foto-detail-save-icon" aria-hidden="true" />
                <span v-if="!savingPin">{{ foto.saved ? t('foto.saved') : t('foto.save') }}</span>
              </button>
            </div>

            <!-- Link -->
            <a
              v-if="pin.link"
              :href="pin.link.startsWith('http') ? foto.link : 'https://' + foto.link"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1.5 text-sm text-neutral-800 hover:text-neutral-950 underline underline-offset-2 mb-4"
            >
              <FotoceIcon name="open_in_new" class="text-base" />
              {{ foto.link }}
            </a>

            <!-- Title & Description -->
            <div class="flex items-start gap-2 mb-3 flex-wrap">
              <h1 id="foto-detail-title" class="text-2xl sm:text-3xl font-auth-title font-auth-title--black text-neutral-950 dark:text-neutral-100 flex-1 min-w-[12rem]">{{ foto.title }}</h1>
              <span
                v-if="pinVisibility !== 'public'"
                class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase shrink-0"
                :class="pinVisibility === 'private' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'"
              >
                <FotoceIcon :name="pinVisibility === 'private' ? 'lock' : 'group'" class="text-xs" />
                {{ pinVisibility === 'private' ? t('foto.visibility.private') : t('foto.visibility.followers') }}
              </span>
            </div>
            <div class="mb-6">
              <div class="space-y-2">
                <p class="text-sm text-neutral-800 leading-relaxed">
                  {{ descriptionText || foto.description }}
                </p>
                <button
                  v-if="isAuthenticated"
                  class="text-xs font-semibold text-pink-700 hover:text-pink-800 inline-flex items-center gap-1.5"
                  :disabled="translatingDescription"
                  @click="handleTranslateDescription"
                >
                  <span v-if="translatingDescription" class="w-3.5 h-3.5 inline-block border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                  <span>{{ translatingDescription ? t('common.loading') : t('comment.translate') }}</span>
                </button>
              </div>
            </div>

            <!-- Tags privés (lecture seule — créés à la publication) -->
            <div v-if="isPinOwner && foto.privateTags?.length" class="mb-6">
              <p class="text-xs font-semibold text-neutral-500 mb-2">{{ t('foto.privateTags.readonlyTitle') }}</p>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="tag in foto.privateTags"
                  :key="tag"
                  class="px-2.5 py-1 rounded-full bg-neutral-900 text-xs font-medium text-white"
                >
                  {{ tag }}
                </span>
              </div>
            </div>

            <!-- Author -->
            <div class="mt-8 flex items-center justify-between">
              <router-link
                v-if="foto"
                :to="`/profile/${pin.username}`"
                class="flex items-center gap-3 hover:bg-neutral-50 dark:hover:bg-neutral-800 p-2 rounded-xl transition-colors"
              >
                <AvatarDisc
                  :color="pin.userAvatarColor"
                  frame-class="w-10 h-10 text-sm shadow-sm"
                  text-class="text-white"
                  :has-image="!!pin.userAvatarUrl"
                >
                  <img
                    v-if="pin.userAvatarUrl"
                    :src="pin.userAvatarUrl"
                    class="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  <span v-else class="avatar-text">{{ displayInitials(pin.user) }}</span>
                </AvatarDisc>
                <div>
                  <p class="text-sm font-bold text-neutral-900 dark:text-neutral-100">{{ foto.user }}</p>
                  <p class="text-xs text-neutral-500">{{ t('foto.followers', { count: formatCount(pin.authorFollowersCount ?? 0) }) }}</p>
                </div>
              </router-link>
              <button
                v-if="currentUser && currentUser.id !== foto.userId"
                type="button"
                class="text-sm font-bold transition-all rounded-full"
                :class="
                  foto.isFollowing
                    ? 'lux-btn-accent-dark py-2.5 px-6'
                    : 'lux-btn-secondary py-2.5 px-6 border-0 shadow-md'
                "
                :disabled="followingAuthor"
                @click="handleFollow"
              >
                <span v-if="followingAuthor" class="w-4 h-4 inline-block border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                <span v-else>{{ foto.isFollowing ? t('foto.following') : t('foto.follow') }}</span>
              </button>
              <button
                v-if="pin.authorTipsInternalEnabled && isAuthenticated && currentUser && currentUser.id !== foto.userId"
                type="button"
                class="inline-flex items-center justify-center px-5 py-2.5 rounded-full text-sm font-bold bg-gradient-to-br from-amber-50 to-amber-100/90 text-amber-900 ring-1 ring-amber-200/70 shadow-sm hover:shadow-md hover:from-amber-100 hover:to-amber-50 transition"
                @click="tipDialogOpen = true"
              >
                {{ t('foto.tip') }}
              </button>
            </div>

            <!-- Stats -->
            <div class="flex items-center gap-6 mb-6 text-sm text-neutral-500">
              <span class="flex items-center gap-1.5">
                {{ formatCount(pin.stats.saves) }}
                <FotoceIcon name="bookmark" class="text-lg" :class="{ 'fill-1 text-neutral-600': foto.saved }" />
              </span>
              <button
                v-if="pin.isStory && isPinOwner"
                type="button"
                class="flex items-center gap-1.5 rounded-lg px-1 -mx-1 py-0.5 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                :aria-label="t('story.likers.openListAria', { count: foto.stats.reactions })"
                @click="storyLikersOpen = true"
              >
                {{ formatCount(pin.stats.reactions) }}
                <FotoceIcon name="favorite" class="text-lg text-pink-700" aria-hidden="true" />
              </button>
              <span
                v-else-if="!pin.isStory"
                class="flex items-center gap-1.5"
              >
                {{ formatCount(pin.stats.reactions) }}
                <FotoceIcon name="favorite" class="text-lg" :class="pin.liked ? 'text-pink-700' : 'text-neutral-300'" />
              </span>
              <span class="flex items-center gap-1.5">
                <FotoceIcon name="sell" class="text-lg" />
                {{ foto.topicDisplay ?? foto.topic }}
              </span>
            </div>

            <div v-if="pin.hashtags && foto.hashtags.length" class="mb-5 flex flex-wrap gap-2">
              <span
                v-for="tag in foto.hashtags"
                :key="tag"
                class="px-2.5 py-1 rounded-full bg-neutral-100 text-xs font-semibold text-neutral-600"
              >
                {{ tag }}
              </span>
            </div>
            <div v-if="pin.boards && foto.boards.length" class="mb-5 flex flex-wrap gap-2">
              <router-link
                v-for="board in foto.boards"
                :key="board.id"
                :to="`/profile/${board.ownerUsername || foto.username}/board/${board.id}`"
                class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-950/35 text-xs font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/45 transition"
              >
                <FotoceIcon name="dashboard" class="text-sm" aria-hidden="true" />
                {{ board.name }}
              </router-link>
            </div>

            <!-- Comments section (rich) -->
            <div class="foto-detail-comments-pane flex-1">
              <div class="flex flex-col gap-3 mb-4">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <h3 class="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                    {{ t('foto.comments') }}
                    <span class="text-neutral-400 font-normal text-sm">({{ commentsTotalCount }})</span>
                  </h3>
                  <div class="flex flex-wrap items-center gap-2">
                    <label v-if="isPinOwner" class="flex items-center gap-2 text-xs text-neutral-600">
                      <span class="whitespace-nowrap">{{ t('foto.comments.policyLabel') }}</span>
                      <select
                        class="rounded-lg border border-neutral-200 dark:border-neutral-700 px-2 py-1 text-xs font-medium bg-white dark:bg-neutral-900 max-w-[11rem]"
                        :value="pin.commentsPolicy || 'open'"
                        :disabled="commentsPolicySaving"
                        @change="handleCommentsPolicyChange"
                      >
                        <option value="open">{{ t('foto.comments.policyOpen') }}</option>
                        <option value="followers_only">{{ t('foto.comments.policyFollowers') }}</option>
                        <option value="closed">{{ t('foto.comments.policyClosed') }}</option>
                      </select>
                    </label>
                    <div class="flex items-center gap-1.5">
                      <FotoceButton
                        size="sm"
                        class="text-xs"
                        :variant="commentSort === 'recent' ? 'primary' : 'secondary'"
                        @click="setCommentSort('recent')"
                      >
                        {{ t('foto.comments.sortRecent') }}
                      </FotoceButton>
                      <FotoceButton
                        size="sm"
                        class="text-xs"
                        :variant="commentSort === 'relevant' ? 'primary' : 'secondary'"
                        @click="setCommentSort('relevant')"
                      >
                        {{ t('foto.comments.sortRelevant') }}
                      </FotoceButton>
                    </div>
                  </div>
                </div>
                <p
                  v-if="isAuthenticated && !viewerCanComment"
                  class="text-xs text-amber-900 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2"
                >
                  {{ foto.commentsPolicy === 'closed' ? t('foto.comments.closedBanner') : t('foto.comments.followersOnlyBanner') }}
                </p>
              </div>

              <!-- Rich threads -->
              <div class="max-h-[420px] overflow-y-auto mb-5 pr-1">
                <CommentThread
                  :comments="richComments"
                  :can-translate="isAuthenticated"
                  :highlighted-comment-id="highlightedCommentId"
                  :is-foto-owner="isPinOwner"
                  :viewer-can-comment="viewerCanComment"
                  :viewer-username="currentUser?.username ?? null"
                  @add="handleRichSubmit"
                  @like="handleLikeComment"
                  @translate="handleTranslateComment"
                  @load-more-replies="handleLoadMoreReplies"
                  @moderate-comment="handleModerateComment"
                  @report-comment="handleReportComment"
                  @delete-comment="handleDeleteComment"
                />
                <div v-if="commentsHasNext" class="mt-3 text-center">
                  <button
                    class="text-sm font-semibold text-pink-700 hover:text-pink-800 disabled:opacity-50"
                    :disabled="commentsLoadingMore"
                    @click="handleLoadMoreComments"
                  >
                    {{ commentsLoadingMore ? t('comment.loadingMoreComments') : t('comment.loadMoreComments') }}
                  </button>
                </div>
              </div>

              <!-- Add comment (rich) -->
              <div
                v-if="!isAuthenticated || viewerCanComment"
                class="flex items-start gap-3 pt-3 border-t border-neutral-100 w-full min-w-0"
              >
                <AvatarDisc
                  v-if="currentUser"
                  :color="currentUser.avatarColor"
                  frame-class="w-9 h-9 text-xs mt-1"
                  text-class="text-white"
                  :has-image="!!currentUser.avatarUrl"
                >
                  <img
                    v-if="currentUser.avatarUrl"
                    :src="currentUser.avatarUrl"
                    alt=""
                    class="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  <span v-else>{{ currentUser.displayName[0] }}</span>
                </AvatarDisc>
                <div class="flex-1 min-w-0 w-full">
                  <RichCommentInput :submitting="submittingComment" @submit="handleRichSubmit" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Related fotos -->
      <section v-if="relatedPins.length > 0 || pinsLoading" class="w-full min-w-0 px-3 sm:px-6 lg:px-10 xl:px-16 pb-10">
        <h2 class="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-5">{{ t('foto.related') }}</h2>
        <FotoGrid
          class="w-full"
          :pins="relatedPins"
          :loading-initial="pinsLoading && relatedPins.length === 0"
          @toggle-save="handleToggleSaveRelated"
          @open-pin="openRelatedPin"
        />
      </section>
    </main>
    </template>

    <StoryLikersModal
      v-model="storyLikersOpen"
      :pin-slug="storyLikersOpen ? (pin?.slug ?? null) : null"
    />

    <ReportContentModal
      v-model="reportModalOpen"
      :context-label="reportModalContextLabel"
      @submit="handleSubmitReport"
    />

    <TipDialog
      v-if="foto"
      :open="tipDialogOpen"
      :recipient-username="pin.username"
      :pin-slug="pin.slug"
      @close="tipDialogOpen = false"
    />

    <Teleport to="body">
      <div
        v-if="pinOwnerMenuOpen && isPinOwner && foto?.slug"
        ref="pinOwnerMenuPanelRef"
        role="menu"
        class="app-floating-panel rounded-xl overflow-hidden"
        :style="pinOwnerMenuFloatingStyles"
        @pointerdown.stop
      >
        <button
          type="button"
          role="menuitem"
          class="app-menu-item w-full px-4 py-2.5 text-left text-sm text-neutral-800 dark:text-neutral-100 flex items-center gap-2 transition-colors"
          @click="goEditPinFromMenu"
        >
          <FotoceIcon name="edit" class="text-lg text-neutral-500" aria-hidden="true" />
          {{ t('foto.ownerMenu.edit') }}
        </button>
        <button
          type="button"
          role="menuitem"
          class="app-menu-item w-full px-4 py-2.5 text-left text-sm text-neutral-800 dark:text-neutral-100 flex items-center gap-2 transition-colors"
          @click="promoteSheetOpen = true; pinOwnerMenuOpen = false"
        >
          <FotoceIcon name="rocket_launch" class="text-lg text-amber-600" aria-hidden="true" />
          {{ t('foto.boost.cta') }}
        </button>
        <button
          type="button"
          role="menuitem"
          class="app-menu-item w-full px-4 py-2.5 text-left text-sm font-semibold text-red-700 dark:text-red-300 flex items-center gap-2 transition-colors"
          @click="deleteFotoFromMenu"
        >
          <FotoceIcon name="delete" class="text-lg" aria-hidden="true" />
          {{ t('foto.ownerMenu.delete') }}
        </button>
      </div>
    </Teleport>

    <PromoteFotoSheet
      v-if="foto"
      :open="promoteSheetOpen"
      :pin-slug="pin.slug"
      initial-mode="boost"
      @close="promoteSheetOpen = false"
    />
  </div>
</template>
