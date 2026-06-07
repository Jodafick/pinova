<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { feedPinsOnly, usePins, getFullMediaUrl, isAlreadyReportedError } from '../composables/usePins'
import { isFeedPin, type Pin } from '../types'
import { useAuth, DEFAULT_AVATAR_COLOR_CLASS } from '../composables/useAuth'
import api from '../api/index'
import { displayInitials } from '../utils/displayInitials'
import PinGrid from '../components/PinGrid.vue'
import PinDetailSkeleton from '../components/PinDetailSkeleton.vue'
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
import PinSensitiveMedia from '../components/PinSensitiveMedia.vue'
import StoryLikersModal from '../components/StoryLikersModal.vue'
import ReportContentModal from '../components/ReportContentModal.vue'
import TipDialog from '../components/TipDialog.vue'
import PromotePinSheet from '../components/PromotePinSheet.vue'
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
import PinovaButton from '../components/ui/PinovaButton.vue'

const { t } = useI18n()
const { showAlert, showPrompt, showConfirm } = useAppModal()

const route = useRoute()
const router = useRouter()

const {
  getPin,
  toggleSave,
  pins,
  fetchPinBySlug,
  seedPinDetailCacheIntoStore,
  patchPinCommentsPolicy,
  moderatePinComment,
  deletePinComment,
  formatCount,
  toggleFollow,
  loading: pinsLoading,
  fetchComments,
  fetchCommentReplies,
  addComment,
  translateComment,
  toggleCommentLike,
  translatePinDescription,
  trackPinView,
  getPinDownload,
  reportPin,
  reportComment,
  deletePin,
} = usePins()
const { currentUser, toggleSavePin, isAuthenticated } = useAuth()
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

const pinSlug = computed(() => route.params.slug as string)
const pin = computed(() => getPin(pinSlug.value))

function initPinDetailLoadingFromCache(): boolean {
  const s = typeof route.params.slug === 'string' ? route.params.slug : ''
  if (!s) return true
  seedPinDetailCacheIntoStore(s)
  return !getPin(s)
}

const pinDetailLoading = ref(initPinDetailLoadingFromCache())

function usernamesMatch(a?: string | null, b?: string | null) {
  return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()
}

const isPinOwner = computed(() => !!(currentUser.value && pin.value && usernamesMatch(currentUser.value.username, pin.value.username)))
const viewerCanComment = computed(() => {
  const p = pin.value
  if (!p) return false
  return p.canComment !== false
})
const targetLang = computed(() => currentUser.value?.preferredLanguage || navigator.language?.split('-')[0] || 'fr')

const relatedPins = computed(() => {
  if (!pin.value) return []
  return feedPinsOnly(pins.value).filter(
    (p) => p.topic === pin.value?.topic && p.slug !== pin.value?.slug,
  ).slice(0, 8)
})
const savingPin = ref(false)
const likingPin = ref(false)
const followingAuthor = ref(false)
const tipDialogOpen = ref(false)
const promoteSheetOpen = ref(false)
const pinHeartBurst = ref(false)
const pinHeartBurstKey = ref(0)
let pinHeartBurstHideTimer: ReturnType<typeof setTimeout> | null = null
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

async function resolvePinDetail() {
  const slug = pinSlug.value
  const generation = ++resolvePinGeneration
  seedPinDetailCacheIntoStore(slug)
  pinDetailLoading.value = !pin.value
  pinDetailNotFound.value = false
  detailImageLandscape.value = null
  richComments.value = []
  commentsTotalCount.value = 0
  try {
    await fetchPinBySlug(slug)
  } catch {
    if (generation !== resolvePinGeneration) return
    pinDetailNotFound.value = true
  } finally {
    if (generation === resolvePinGeneration) {
      pinDetailLoading.value = false
    }
  }
  if (generation !== resolvePinGeneration || pinSlug.value !== slug) return
  if (pin.value && pin.value.slug === slug) {
    pinDetailNotFound.value = false
    descriptionText.value = pin.value.description
    descriptionTranslated.value = false
    void trackPinView(pin.value.slug)
    try {
      await loadComments(true)
    } catch (err) {
      console.error('Erreur lors du chargement des commentaires', err)
    }
  } else if (generation === resolvePinGeneration && pinSlug.value === slug) {
    pinDetailNotFound.value = true
  }
}

onMounted(async () => {
  await resolvePinDetail()
})

watch(pinSlug, async () => {
  pinOwnerMenuOpen.value = false
  await resolvePinDetail()
})

watch(
  () => route.query.commentId,
  async () => {
    await focusHighlightedComment()
  },
)

const handleLike = async () => {
  const p = pin.value
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
    const response = await api.post(`pins/${encodeURIComponent(p.slug)}/like/`)
    p.liked = response.data.status === 'liked'
    p.stats.reactions = response.data.likes_count
  } catch (err) {
    p.liked = previousLiked
    p.stats.reactions = previousReactions
    console.error('Erreur like pin', err)
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
  triggerPinHeartBurst()
  const p = pin.value
  if (!p) return
  if (!isAuthenticated.value) {
    promptGuest('like', { resourceId: p.slug })
    return
  }
  if (p.liked) return
  void handleLike()
}

const handleSave = () => {
  const currentPin = pin.value
  if (!currentPin) return
  if (!isAuthenticated.value) {
    promptGuest('save', { resourceId: currentPin.slug })
    return
  }
  savingPin.value = true
  toggleSavePin(currentPin.id)
  Promise.resolve(toggleSave(currentPin.slug))
    .catch((err) => {
      toggleSavePin(currentPin.id)
      console.error('Erreur sauvegarde pin', err)
    })
    .finally(() => {
      savingPin.value = false
    })
}

const handleFollow = async () => {
  const username = pin.value?.username?.trim()
  if (!isAuthenticated.value) {
    if (!username) return
    promptGuest('follow', { resourceId: username })
    return
  }
  if (pin.value && pin.value.username) {
    const previous = !!pin.value.isFollowing
    pin.value.isFollowing = !previous
    followingAuthor.value = true
    try {
      await toggleFollow(pin.value.username)
    } catch (err) {
      pin.value.isFollowing = previous
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
  typeof window !== 'undefined' && window.localStorage.getItem('pinova_comment_sort') === 'relevant'
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
  if (!pinSlug.value) return
  if (reset) {
    commentsPage.value = 1
    commentsHasNext.value = false
    richComments.value = []
  }
  const pageToFetch = commentsPage.value
  const response = await fetchComments(
    pinSlug.value,
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
    window.localStorage.setItem('pinova_comment_sort', sort)
  }
  await loadComments(true)
}

const handleRichSubmit = async (
  payload: { text: string; gif?: string | null; mediaFile?: File | null; replyTo?: string | null; parentId?: number },
) => {
  if (!pin.value || !isAuthenticated.value) {
    if (!pin.value) return
    if (payload.mediaFile) {
      promptGuest('comment', { resourceId: pin.value.slug })
      return
    }
    promptGuest('comment', {
      resourceId: pin.value.slug,
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
      pin.value.commentsPolicy === 'closed' ? t('pin.comments.closedBanner') : t('pin.comments.followersOnlyBanner'),
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
      metadata: { scope: 'comment', pinSlug: pin.value?.slug },
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
    const slug = pin.value?.slug
    if (!slug) return
    promptGuest('translate', {
      resourceId: String(id),
      metadata: { target: 'comment', commentId: id, lang: targetLang.value, pinSlug: slug },
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
      resourceId: pin.value.slug,
      metadata: { target: 'description', lang: targetLang.value, pinSlug: pin.value.slug },
    })
    return
  }
  if (descriptionTranslated.value) {
    descriptionText.value = pin.value.description
    descriptionTranslated.value = false
    return
  }
  translatingDescription.value = true
  try {
    const result = await translatePinDescription(pin.value.slug, targetLang.value)
    descriptionText.value = result?.translated || pin.value.description
    descriptionTranslated.value = !!result?.translated && result.translated.trim() !== pin.value.description.trim()
  } finally {
    translatingDescription.value = false
  }
}

const handleToggleSaveRelated = async (slug: string) => {
  if (!isAuthenticated.value) {
    promptGuest('save', { resourceId: slug })
    return
  }
  const relatedPin = pins.value.find((p): p is Pin => isFeedPin(p) && p.slug === slug)
  if (relatedPin) {
    toggleSavePin(relatedPin.id)
  }
  try {
    await toggleSave(slug)
  } catch (err) {
    if (relatedPin) {
      toggleSavePin(relatedPin.id)
    }
    console.error('Erreur sauvegarde pin relié', err)
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
    await patchPinCommentsPolicy(pin.value.slug, next)
  } catch {
    await showAlert(t('pin.comments.policySaveError'), { variant: 'danger', title: t('modal.errorTitle') })
    sel.value = pin.value.commentsPolicy || 'open'
  } finally {
    commentsPolicySaving.value = false
  }
}

const handleModerateComment = async (commentId: number, hidden: boolean) => {
  if (!pin.value) return
  try {
    await moderatePinComment(pin.value.slug, commentId, hidden)
    await loadComments(true)
  } catch {
    await showAlert(t('comment.moderation.error'), { variant: 'danger', title: t('modal.errorTitle') })
  }
}

const reportModalOpen = ref(false)
const reportTarget = ref<'pin' | 'comment'>('pin')
const reportCommentId = ref<number | null>(null)

const reportModalContextLabel = computed(() => {
  if (!pin.value) return ''
  if (reportTarget.value === 'pin') return pin.value.title
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
  reportTarget.value = 'pin'
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
    if (reportTarget.value === 'pin') {
      await reportPin(pin.value.slug, payload)
      await fetchPinBySlug(pin.value.slug)
    } else if (reportCommentId.value != null) {
      await reportComment(reportCommentId.value, payload)
      await loadComments(true)
    }
    reportModalOpen.value = false
    await showAlert(t('moderation.reportSent'), { variant: 'success' })
  } catch (e) {
    if (isAlreadyReportedError(e)) {
      if (reportTarget.value === 'pin') {
        await fetchPinBySlug(pin.value.slug)
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
    await deletePinComment(pin.value.slug, commentId)
    await loadComments(true)
  } catch {
    await showAlert(t('comment.delete.error'), { variant: 'danger', title: t('modal.errorTitle') })
  }
}

const handleShare = async () => {
  if (!pin.value) return
  const sharedPin = pin.value
  const url = typeof window !== 'undefined' ? window.location.href : ''
  const title = sharedPin.title || 'Pinova'
  const text = (sharedPin.description || '').slice(0, 280)
  await shareUrlWithFallback(
    { showAlert, showPrompt },
    {
      url,
      title,
      text,
      copiedMessage: t('pin.share.copied'),
      copyErrorMessage: t('profile.share.copyError'),
      copyErrorTitle: t('modal.errorTitle'),
      manualTitle: t('pin.share.manualTitle'),
      manualBody: t('pin.share.manualBody'),
    },
  )
  if (isAuthenticated.value) {
    try {
      const response = await api.post(`pins/${encodeURIComponent(sharedPin.slug)}/record-share/`)
      sharedPin.stats.shares = response.data?.shares_count ?? (sharedPin.stats.shares || 0) + 1
    } catch (err) {
      console.warn('Erreur compteur partage pin', err)
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
    const result = await getPinDownload(pin.value.slug, quality)
    const url = safeHttpUrl(result.download_url)
    if (!url) {
      try {
        tab?.close()
      } catch {
        /* ignore */
      }
      await showAlert(t('pin.download.error'), { variant: 'danger', title: t('modal.errorTitle') })
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
    console.error('Erreur téléchargement pin', err)
    await showAlert(t('pin.download.error'), { variant: 'danger', title: t('modal.errorTitle') })
  } finally {
    downloadingPin.value = false
  }
}

const goBack = () => {
  router.back()
}

const openRelatedPin = (slug: string) => {
  router.push(`/pin/${slug}`)
}

const confirmDeletePin = async () => {
  const p = pin.value
  if (!p || !isPinOwner.value) return
  const ok = await showConfirm({
    title: t('pin.delete.confirmTitle'),
    message: t('pin.delete.confirmBody'),
    variant: 'danger',
  })
  if (!ok) return
  const slug = p.slug
  const profile = p.username
  try {
    await deletePin(slug)
    router.push(profile ? `/profile/${profile}` : '/')
  } catch {
    await showAlert(t('pin.delete.error'), { variant: 'danger', title: t('modal.errorTitle') })
  }
}

function togglePinOwnerMenu() {
  pinOwnerMenuOpen.value = !pinOwnerMenuOpen.value
}

function goEditPinFromMenu() {
  pinOwnerMenuOpen.value = false
  const slug = pin.value?.slug
  if (slug) router.push(`/pin/${slug}/edit`)
}

async function deletePinFromMenu() {
  pinOwnerMenuOpen.value = false
  await confirmDeletePin()
}
</script>

<template>
  <div class="min-h-screen w-full min-w-0">
    <PinDetailSkeleton v-if="pinDetailLoading" />

    <!-- Not found -->
    <div
      v-else-if="pinDetailNotFound || !pin"
      class="flex flex-col items-center justify-center py-32 text-center px-6"
    >
      <span class="material-symbols-outlined text-7xl text-neutral-300 mb-4">broken_image</span>
      <h1 class="text-2xl font-auth-title font-auth-title--black text-neutral-800 mb-2">{{ t('pin.notFound.title') }}</h1>
      <p class="text-neutral-500 mb-6">{{ t('pin.notFound.desc') }}</p>
      <router-link to="/" class="lux-btn-primary lux-btn-pill text-sm">
        {{ t('pin.notFound.cta') }}
      </router-link>
    </div>

    <!-- Pin detail -->
    <template v-else>
    <main
      id="main-pin-detail"
      tabindex="-1"
      :aria-labelledby="pin.title ? 'pin-detail-title' : undefined"
      class="min-h-screen w-full min-w-0 outline-none"
    >
      <div class="pin-detail-page-wrap w-full min-w-0 max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <!-- Back button -->
        <PinovaButton
          variant="secondary"
          class="pin-detail-back group mb-8 hidden text-sm lg:inline-flex"
          :aria-label="t('pin.a11y.back')"
          @click="goBack"
        >
          <span class="material-symbols-outlined text-lg">arrow_back</span>
          {{ t('common.back') }}
        </PinovaButton>

        <!-- Main card -->
        <div class="pin-detail-mobile-card lux-pin-detail-card flex flex-col lg:flex-row lg:max-h-[80vh]">
          <!-- Image : paysage centré verticalement ; portrait → colonne plus large pour mieux remplir -->
          <div
            class="pin-detail-media-pane bg-neutral-100 flex flex-col lg:max-h-[80vh] lg:overflow-hidden shrink-0 min-h-[200px] lg:min-h-0"
            :class="
              detailImageLandscape === false
                ? 'lg:flex-[1.38] lg:basis-0 lg:min-w-0'
                : 'lg:flex-none lg:w-1/2'
            "
            :style="detailImageLandscape === true ? { justifyContent: 'center' } : undefined"
          >
            <div
              class="pin-detail-media-wrap w-full flex min-h-0"
              :class="detailImageLandscape === true ? 'flex-1 items-center justify-center' : ''"
            >
              <PinSensitiveMedia
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
                  :alt="pin.title ? `${pin.title} — ${pin.user}` : t('feed.pinImageFallback', { user: pin.user })"
                  :fetchpriority="detailImageFetchPriority"
                  loading="eager"
                  decoding="async"
                  :class="[
                    PIN_MEDIA_ANTI_LEAK_CLASS,
                    'pin-detail-media w-full h-auto max-h-[min(80vh,900px)] lg:max-h-[80vh] object-contain select-none bg-neutral-100',
                  ]"
                  @load="onDetailImageLoad"
                  @dblclick.prevent="handleMediaDoubleLike"
                  v-bind="pinMediaAntiLeakImgBindings()"
                />
              </PinSensitiveMedia>
              <PinSensitiveMedia
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
                    'pin-detail-media w-full h-auto max-h-[min(80vh,900px)] lg:max-h-[80vh] object-contain select-none bg-neutral-100',
                  ]"
                  @loadedmetadata="onDetailVideoLoadedMetadata"
                  @dblclick.prevent="handleMediaDoubleLike"
                  v-bind="pinMediaAntiLeakVideoBindings(true)"
                />
              </PinSensitiveMedia>
              <transition name="pin-detail-heart">
                <div v-if="pinHeartBurst" :key="pinHeartBurstKey" class="pin-detail-heart-burst pointer-events-none">
                  <span class="material-symbols-outlined">favorite</span>
                </div>
              </transition>
            </div>
          </div>

          <!-- Details -->
          <div class="pin-detail-info-pane lg:flex-1 lg:min-w-0 p-6 sm:p-8 lg:p-10 flex flex-col lg:max-h-[80vh] lg:overflow-y-auto min-h-0">
            <!-- Actions bar -->
            <div class="pin-detail-actions flex items-center justify-between mb-6">
              <div class="flex items-center gap-2 flex-wrap">
                <div v-if="isPinOwner && pin.slug" class="relative shrink-0">
                  <button
                    ref="pinOwnerMenuTriggerRef"
                    type="button"
                    class="lux-icon-ring-btn"
                    :aria-label="t('pin.ownerMenu.more')"
                    :aria-expanded="pinOwnerMenuOpen"
                    aria-haspopup="menu"
                    @click.stop.prevent="togglePinOwnerMenu"
                  >
                    <span class="material-symbols-outlined text-[22px] leading-none translate-y-px" aria-hidden="true">
                      more_horiz
                    </span>
                  </button>
                </div>
                <button
                  v-if="!(pin.isStory && isPinOwner)"
                  type="button"
                  class="lux-icon-ring-btn"
                  :class="pin.liked ? 'bg-gradient-to-br from-pink-50 to-rose-50/80 text-pink-700 border-pink-100' : ''"
                  :disabled="likingPin"
                  :aria-pressed="pin.liked"
                  :aria-label="pin.liked ? t('pin.a11y.unlike') : t('pin.a11y.like')"
                  @click="handleLike"
                >
                  <span v-if="likingPin" class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                  <span v-else class="material-symbols-outlined" :class="pin.liked ? 'text-pink-700' : 'text-neutral-700'" aria-hidden="true">favorite</span>
                </button>
                <button
                  type="button"
                  class="lux-icon-ring-btn"
                  :aria-label="t('pin.a11y.share')"
                  @click="handleShare"
                >
                  <span class="material-symbols-outlined" aria-hidden="true">share</span>
                </button>
                <button
                  type="button"
                  class="lux-icon-ring-btn disabled:opacity-40 disabled:cursor-not-allowed"
                  :disabled="downloadingPin || !pin.imageUrl"
                  :aria-label="t('pin.a11y.download')"
                  @click="handleDownload"
                >
                  <span v-if="downloadingPin" class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                  <span v-else class="material-symbols-outlined" aria-hidden="true">download</span>
                </button>
                <button
                  v-if="isAuthenticated && !isPinOwner && !pin.viewerHasReported"
                  type="button"
                  class="lux-icon-ring-btn"
                  :aria-label="t('moderation.report')"
                  @click="handleReportPin"
                >
                  <span class="material-symbols-outlined text-[22px]" aria-hidden="true">flag</span>
                </button>
              </div>
              <button
                type="button"
                class="pin-detail-save transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
                :class="pin.saved ? 'lux-btn-detail-saved' : 'lux-btn-primary lux-btn-pill'"
                :disabled="savingPin"
                :aria-pressed="pin.saved"
                :aria-label="pin.saved ? t('pin.a11y.saved') : t('pin.a11y.save')"
                @click="handleSave"
              >
                <span v-if="savingPin" class="w-4 h-4 inline-block border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                <span v-else class="pin-detail-save-icon material-symbols-outlined" aria-hidden="true">bookmark</span>
                <span v-if="!savingPin">{{ pin.saved ? t('pin.saved') : t('pin.save') }}</span>
              </button>
            </div>

            <!-- Link -->
            <a
              v-if="pin.link"
              :href="pin.link.startsWith('http') ? pin.link : 'https://' + pin.link"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1.5 text-sm text-neutral-800 hover:text-neutral-950 underline underline-offset-2 mb-4"
            >
              <span class="material-symbols-outlined text-base">open_in_new</span>
              {{ pin.link }}
            </a>

            <!-- Title & Description -->
            <div class="flex items-start gap-2 mb-3 flex-wrap">
              <h1 id="pin-detail-title" class="text-2xl sm:text-3xl font-auth-title font-auth-title--black text-neutral-950 dark:text-neutral-100 flex-1 min-w-[12rem]">{{ pin.title }}</h1>
              <span
                v-if="pinVisibility !== 'public'"
                class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase shrink-0"
                :class="pinVisibility === 'private' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'"
              >
                <span class="material-symbols-outlined text-xs">{{ pinVisibility === 'private' ? 'lock' : 'group' }}</span>
                {{ pinVisibility === 'private' ? t('pin.visibility.private') : t('pin.visibility.followers') }}
              </span>
            </div>
            <div class="mb-6">
              <div class="space-y-2">
                <p class="text-sm text-neutral-800 leading-relaxed">
                  {{ descriptionText || pin.description }}
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
            <div v-if="isPinOwner && pin.privateTags?.length" class="mb-6">
              <p class="text-xs font-semibold text-neutral-500 mb-2">{{ t('pin.privateTags.readonlyTitle') }}</p>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="tag in pin.privateTags"
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
                v-if="pin"
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
                  <p class="text-sm font-bold text-neutral-900 dark:text-neutral-100">{{ pin.user }}</p>
                  <p class="text-xs text-neutral-500">{{ t('pin.followers', { count: formatCount(pin.authorFollowersCount ?? 0) }) }}</p>
                </div>
              </router-link>
              <button
                v-if="currentUser && currentUser.id !== pin.userId"
                type="button"
                class="text-sm font-bold transition-all rounded-full"
                :class="
                  pin.isFollowing
                    ? 'lux-btn-accent-dark py-2.5 px-6'
                    : 'lux-btn-secondary py-2.5 px-6 border-0 shadow-md'
                "
                :disabled="followingAuthor"
                @click="handleFollow"
              >
                <span v-if="followingAuthor" class="w-4 h-4 inline-block border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                <span v-else>{{ pin.isFollowing ? t('pin.following') : t('pin.follow') }}</span>
              </button>
              <button
                v-if="pin.authorTipsInternalEnabled && isAuthenticated && currentUser && currentUser.id !== pin.userId"
                type="button"
                class="inline-flex items-center justify-center px-5 py-2.5 rounded-full text-sm font-bold bg-gradient-to-br from-amber-50 to-amber-100/90 text-amber-900 ring-1 ring-amber-200/70 shadow-sm hover:shadow-md hover:from-amber-100 hover:to-amber-50 transition"
                @click="tipDialogOpen = true"
              >
                {{ t('pin.tip') }}
              </button>
            </div>

            <!-- Stats -->
            <div class="flex items-center gap-6 mb-6 text-sm text-neutral-500">
              <span class="flex items-center gap-1.5">
                {{ formatCount(pin.stats.saves) }}
                <span class="material-symbols-outlined text-lg" :class="{ 'fill-1 text-neutral-600': pin.saved }">bookmark</span>
              </span>
              <button
                v-if="pin.isStory && isPinOwner"
                type="button"
                class="flex items-center gap-1.5 rounded-lg px-1 -mx-1 py-0.5 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                :aria-label="t('story.likers.openListAria', { count: pin.stats.reactions })"
                @click="storyLikersOpen = true"
              >
                {{ formatCount(pin.stats.reactions) }}
                <span class="material-symbols-outlined text-lg text-pink-700" aria-hidden="true">favorite</span>
              </button>
              <span
                v-else-if="!pin.isStory"
                class="flex items-center gap-1.5"
              >
                {{ formatCount(pin.stats.reactions) }}
                <span class="material-symbols-outlined text-lg" :class="pin.liked ? 'text-pink-700' : 'text-neutral-300'">favorite</span>
              </span>
              <span class="flex items-center gap-1.5">
                <span class="material-symbols-outlined text-lg">sell</span>
                {{ pin.topicDisplay ?? pin.topic }}
              </span>
            </div>

            <div v-if="pin.hashtags && pin.hashtags.length" class="mb-5 flex flex-wrap gap-2">
              <span
                v-for="tag in pin.hashtags"
                :key="tag"
                class="px-2.5 py-1 rounded-full bg-neutral-100 text-xs font-semibold text-neutral-600"
              >
                {{ tag }}
              </span>
            </div>
            <div v-if="pin.boards && pin.boards.length" class="mb-5 flex flex-wrap gap-2">
              <router-link
                v-for="board in pin.boards"
                :key="board.id"
                :to="`/profile/${board.ownerUsername || pin.username}/board/${board.id}`"
                class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-950/35 text-xs font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/45 transition"
              >
                <span class="material-symbols-outlined text-sm" aria-hidden="true">dashboard</span>
                {{ board.name }}
              </router-link>
            </div>

            <!-- Comments section (rich) -->
            <div class="pin-detail-comments-pane flex-1">
              <div class="flex flex-col gap-3 mb-4">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <h3 class="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                    {{ t('pin.comments') }}
                    <span class="text-neutral-400 font-normal text-sm">({{ commentsTotalCount }})</span>
                  </h3>
                  <div class="flex flex-wrap items-center gap-2">
                    <label v-if="isPinOwner" class="flex items-center gap-2 text-xs text-neutral-600">
                      <span class="whitespace-nowrap">{{ t('pin.comments.policyLabel') }}</span>
                      <select
                        class="rounded-lg border border-neutral-200 dark:border-neutral-700 px-2 py-1 text-xs font-medium bg-white dark:bg-neutral-900 max-w-[11rem]"
                        :value="pin.commentsPolicy || 'open'"
                        :disabled="commentsPolicySaving"
                        @change="handleCommentsPolicyChange"
                      >
                        <option value="open">{{ t('pin.comments.policyOpen') }}</option>
                        <option value="followers_only">{{ t('pin.comments.policyFollowers') }}</option>
                        <option value="closed">{{ t('pin.comments.policyClosed') }}</option>
                      </select>
                    </label>
                    <div class="flex items-center gap-1.5">
                      <PinovaButton
                        size="sm"
                        class="text-xs"
                        :variant="commentSort === 'recent' ? 'primary' : 'secondary'"
                        @click="setCommentSort('recent')"
                      >
                        {{ t('pin.comments.sortRecent') }}
                      </PinovaButton>
                      <PinovaButton
                        size="sm"
                        class="text-xs"
                        :variant="commentSort === 'relevant' ? 'primary' : 'secondary'"
                        @click="setCommentSort('relevant')"
                      >
                        {{ t('pin.comments.sortRelevant') }}
                      </PinovaButton>
                    </div>
                  </div>
                </div>
                <p
                  v-if="isAuthenticated && !viewerCanComment"
                  class="text-xs text-amber-900 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2"
                >
                  {{ pin.commentsPolicy === 'closed' ? t('pin.comments.closedBanner') : t('pin.comments.followersOnlyBanner') }}
                </p>
              </div>

              <!-- Rich threads -->
              <div class="max-h-[420px] overflow-y-auto mb-5 pr-1">
                <CommentThread
                  :comments="richComments"
                  :can-translate="isAuthenticated"
                  :highlighted-comment-id="highlightedCommentId"
                  :is-pin-owner="isPinOwner"
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

      <!-- Related pins -->
      <section v-if="relatedPins.length > 0 || pinsLoading" class="w-full min-w-0 px-3 sm:px-6 lg:px-10 xl:px-16 pb-10">
        <h2 class="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-5">{{ t('pin.related') }}</h2>
        <PinGrid
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
      v-if="pin"
      :open="tipDialogOpen"
      :recipient-username="pin.username"
      :pin-slug="pin.slug"
      @close="tipDialogOpen = false"
    />

    <Teleport to="body">
      <div
        v-if="pinOwnerMenuOpen && isPinOwner && pin?.slug"
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
          <span class="material-symbols-outlined text-lg text-neutral-500" aria-hidden="true">edit</span>
          {{ t('pin.ownerMenu.edit') }}
        </button>
        <button
          type="button"
          role="menuitem"
          class="app-menu-item w-full px-4 py-2.5 text-left text-sm text-neutral-800 dark:text-neutral-100 flex items-center gap-2 transition-colors"
          @click="promoteSheetOpen = true; pinOwnerMenuOpen = false"
        >
          <span class="material-symbols-outlined text-lg text-amber-600" aria-hidden="true">rocket_launch</span>
          {{ t('pin.boost.cta') }}
        </button>
        <button
          type="button"
          role="menuitem"
          class="app-menu-item w-full px-4 py-2.5 text-left text-sm font-semibold text-red-700 dark:text-red-300 flex items-center gap-2 transition-colors"
          @click="deletePinFromMenu"
        >
          <span class="material-symbols-outlined text-lg" aria-hidden="true">delete</span>
          {{ t('pin.ownerMenu.delete') }}
        </button>
      </div>
    </Teleport>

    <PromotePinSheet
      v-if="pin"
      :open="promoteSheetOpen"
      :pin-slug="pin.slug"
      initial-mode="boost"
      @close="promoteSheetOpen = false"
    />
  </div>
</template>
