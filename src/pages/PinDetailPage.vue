<script setup lang="ts">
import { computed, ref, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePins } from '../composables/usePins'
import { useAuth } from '../composables/useAuth'
import PinGrid from '../components/PinGrid.vue'
import PinSkeleton from '../components/PinSkeleton.vue'
import RichCommentInput from '../components/RichCommentInput.vue'
import CommentThread from '../components/CommentThread.vue'
import PrivateTags from '../components/PrivateTags.vue'
import ProvenanceChain from '../components/ProvenanceChain.vue'
import { useI18n } from '../i18n'

const { t } = useI18n()

const route = useRoute()
const router = useRouter()

const {
  getPin,
  toggleSave,
  pins,
  fetchPins,
  formatCount,
  toggleLike,
  toggleFollow,
  loading: pinsLoading,
  fetchComments,
  fetchCommentReplies,
  addComment,
  translateComment,
  toggleCommentLike,
  translatePinDescription,
  fetchProvenance,
  fetchPrivateTags,
  savePrivateTags,
  trackPinView,
  getPinDownload,
} = usePins()
const { currentUser, toggleSavePin, isAuthenticated } = useAuth()

const pinSlug = computed(() => route.params.slug as string)
const pin = computed(() => getPin(pinSlug.value))
const selectedVariantKind = ref<string | null>(null)

watch(pinSlug, () => {
  selectedVariantKind.value = null
})

const displayImageUrl = computed(() => {
  const p = pin.value
  if (!p) return ''
  if (selectedVariantKind.value && p.variants?.length) {
    const found = p.variants.find((x) => x.kind === selectedVariantKind.value)
    if (found?.url) return found.url
  }
  return p.imageUrl
})

const isPinOwner = computed(() => !!(currentUser.value && pin.value && currentUser.value.username === pin.value.username))
const targetLang = computed(() => currentUser.value?.preferredLanguage || navigator.language?.split('-')[0] || 'fr')

const relatedPins = computed(() => {
  if (!pin.value) return []
  return pins.value.filter((p) => p.topic === pin.value?.topic && p.slug !== pin.value?.slug).slice(0, 8)
})
const savingPin = ref(false)
const likingPin = ref(false)
const followingAuthor = ref(false)
const translatingDescription = ref(false)
const submittingComment = ref(false)
const downloadingPin = ref(false)

onMounted(async () => {
  if (pins.value.length === 0 || !pin.value) {
    await fetchPins()
  }
  if (pin.value?.slug) {
    void trackPinView(pin.value.slug)
  }
  await loadPinMetadata()
})

watch(pinSlug, async () => {
  if (!pin.value) {
    await fetchPins(true)
  }
  if (pin.value?.slug) {
    void trackPinView(pin.value.slug)
  }
  await loadPinMetadata()
})

watch(
  () => route.query.commentId,
  async () => {
    await focusHighlightedComment()
  },
)

const handleLike = async () => {
  if (!isAuthenticated.value) {
    router.push('/login')
    return
  }
  if (pin.value) {
    likingPin.value = true
    try {
      await toggleLike(pin.value.slug)
    } finally {
      likingPin.value = false
    }
  }
}

const handleSave = () => {
  if (!isAuthenticated.value) {
    router.push('/login')
    return
  }
  const currentPin = pin.value
  if (!currentPin) return
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
  if (!isAuthenticated.value) {
    router.push('/login')
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
  avatar: string
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
}

const richComments = ref<UiComment[]>([])
const commentsTotalCount = ref(0)
const commentsPage = ref(1)
const commentsHasNext = ref(false)
const commentsLoadingMore = ref(false)
const descriptionText = ref('')
const provenanceHash = ref('')
const provenanceEvents = ref<any[]>([])
const privateTags = ref<string[]>([])
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
    avatar: comment.avatar_color || 'bg-pink-500',
    text: comment.text || '',
    translatedText: comment.translated_text || '',
    gif: comment.gif_url || null,
    media: comment.media || null,
    createdAt: new Date(comment.created_at).toLocaleString(),
    likes: comment.likes_count || 0,
    liked: !!comment.is_liked,
    translated: false,
    originalLang: comment.original_language || undefined,
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

const loadPinMetadata = async () => {
  try {
    await loadComments(true)
  } catch (err) {
    console.error('Erreur lors du chargement des commentaires', err)
  }
  if (!pin.value) return
  descriptionText.value = pin.value.description
  try {
    const provenance = await fetchProvenance(pin.value.slug)
    provenanceHash.value = provenance?.root_hash || pin.value.provenanceRootHash || ''
    provenanceEvents.value = provenance?.events || []
  } catch (err) {
    console.error('Erreur lors du chargement de la provenance', err)
    provenanceHash.value = pin.value.provenanceRootHash || ''
    provenanceEvents.value = []
  }
  if (isAuthenticated.value && isPinOwner.value) {
    try {
      privateTags.value = await fetchPrivateTags(pin.value.slug)
    } catch (err) {
      console.error('Erreur lors du chargement des tags privés', err)
      privateTags.value = []
    }
  } else {
    privateTags.value = []
  }
}

const handleRichSubmit = async (
  payload: { text: string; gif?: string | null; mediaFile?: File | null; replyTo?: string | null; parentId?: number },
) => {
  if (!pin.value || !isAuthenticated.value) {
    router.push('/login')
    return
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
  } finally {
    submittingComment.value = false
  }
}

const handleLikeComment = (id: number) => {
  if (!isAuthenticated.value) {
    router.push('/login')
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
    router.push('/login')
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
    router.push('/login')
    return
  }
  translatingDescription.value = true
  try {
    const result = await translatePinDescription(pin.value.slug, targetLang.value)
    descriptionText.value = result?.translated || pin.value.description
  } finally {
    translatingDescription.value = false
  }
}

const handlePrivateTagsUpdate = async (tags: string[]) => {
  if (!pin.value || !isAuthenticated.value) return
  privateTags.value = await savePrivateTags(pin.value.slug, tags)
}

const handleToggleSaveRelated = async (slug: string) => {
  const pin = pins.value.find(p => p.slug === slug)
  if (pin) {
    toggleSavePin(pin.id)
  }
  try {
    await toggleSave(slug)
  } catch (err) {
    if (pin) {
      toggleSavePin(pin.id)
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

const handleShare = () => {
  navigator.clipboard.writeText(window.location.href)
  alert(t('pin.share.copied'))
}

const handleDownload = async () => {
  if (!isAuthenticated.value) {
    router.push('/login')
    return
  }
  if (!pin.value) return
  downloadingPin.value = true
  try {
    const plan = currentUser.value?.subscription?.plan || 'free'
    const quality = plan === 'pro' ? 'hd' : 'standard'
    const result = await getPinDownload(pin.value.slug, quality)
    const link = document.createElement('a')
    link.href = result.download_url
    link.download = `${pin.value.slug}.jpg`
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (err) {
    console.error('Erreur téléchargement pin', err)
    window.alert(t('pin.download.error'))
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
</script>

<template>
  <div class="min-h-screen">
    <!-- Not found -->
    <div v-if="!pin" class="flex flex-col items-center justify-center py-32 text-center px-6">
      <span class="material-symbols-outlined text-7xl text-neutral-300 mb-4">broken_image</span>
      <h1 class="text-2xl font-bold text-neutral-800 mb-2">{{ t('pin.notFound.title') }}</h1>
      <p class="text-neutral-500 mb-6">{{ t('pin.notFound.desc') }}</p>
      <router-link to="/" class="px-6 py-2.5 rounded-full bg-pink-600 text-white font-semibold text-sm hover:bg-pink-700 transition">
        {{ t('pin.notFound.cta') }}
      </router-link>
    </div>

    <!-- Pin detail -->
    <div v-else>
      <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <!-- Back button -->
        <button
          class="mb-6 flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900 transition"
          @click="goBack"
        >
          <span class="material-symbols-outlined text-lg">arrow_back</span>
          {{ t('common.back') }}
        </button>

        <!-- Main card -->
        <div class="bg-white rounded-[2rem] shadow-xl overflow-hidden flex flex-col lg:flex-row">
          <!-- Image -->
          <div class="lg:w-1/2 bg-neutral-100">
            <div v-if="pin.variants?.length" class="p-3 sm:p-4 flex flex-wrap gap-2 border-b border-neutral-200 bg-white/80">
              <button
                type="button"
                class="px-3 py-1.5 rounded-full text-xs font-semibold transition"
                :class="!selectedVariantKind ? 'bg-pink-600 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'"
                @click="selectedVariantKind = null"
              >
                {{ t('pin.variant.original') }}
              </button>
              <button
                v-for="v in pin.variants"
                :key="v.kind"
                type="button"
                class="px-3 py-1.5 rounded-full text-xs font-semibold transition capitalize"
                :class="selectedVariantKind === v.kind ? 'bg-pink-600 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'"
                @click="selectedVariantKind = v.kind"
              >
                {{ t(`pin.variant.${v.kind}`) }}
              </button>
            </div>
            <img
              :src="displayImageUrl"
              :alt="pin.title"
              class="w-full h-80 sm:h-96 lg:h-full object-cover select-none"
              draggable="false"
              @dblclick.prevent="handleLike"
              @contextmenu.prevent
              @dragstart.prevent
            />
            <p class="text-[11px] text-neutral-400 px-3 py-2">{{ t('pin.doubleTapLikeHint') }}</p>
          </div>

          <!-- Details -->
          <div class="lg:w-1/2 p-6 sm:p-8 lg:p-10 flex flex-col">
            <!-- Actions bar -->
            <div class="flex items-center justify-between mb-6">
              <div class="flex items-center gap-2">
                <button
                  class="w-10 h-10 rounded-full flex items-center justify-center transition"
                  :class="pin.liked ? 'bg-pink-50 text-pink-600' : 'hover:bg-neutral-100 text-neutral-600'"
                  :disabled="likingPin"
                  @click="handleLike"
                >
                  <span v-if="likingPin" class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                  <span v-else class="material-symbols-outlined fill-1" :class="pin.liked ? 'text-pink-500' : 'text-neutral-300'">favorite</span>
                </button>
                <button
                  class="w-10 h-10 rounded-full hover:bg-neutral-100 flex items-center justify-center text-neutral-600 transition"
                  @click="handleShare"
                >
                  <span class="material-symbols-outlined">share</span>
                </button>
                <button
                  class="w-10 h-10 rounded-full hover:bg-neutral-100 flex items-center justify-center text-neutral-600 transition"
                  :disabled="downloadingPin"
                  @click="handleDownload"
                >
                  <span v-if="downloadingPin" class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                  <span v-else class="material-symbols-outlined">download</span>
                </button>
                <button class="w-10 h-10 rounded-full hover:bg-neutral-100 flex items-center justify-center text-neutral-600 transition">
                  <span class="material-symbols-outlined">more_horiz</span>
                </button>
              </div>
              <button
                class="px-6 py-2.5 rounded-full font-semibold text-sm transition-all"
                :class="pin.saved
                  ? 'bg-neutral-900 text-white hover:bg-neutral-800'
                  : 'bg-pink-600 text-white hover:bg-pink-700'"
                :disabled="savingPin"
                @click="handleSave"
              >
                <span v-if="savingPin" class="w-4 h-4 inline-block border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                <span v-else>{{ pin.saved ? t('pin.saved') : t('pin.save') }}</span>
              </button>
            </div>

            <!-- Link -->
            <a
              v-if="pin.link"
              :href="pin.link.startsWith('http') ? pin.link : 'https://' + pin.link"
              target="_blank"
              class="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700 hover:underline mb-4"
            >
              <span class="material-symbols-outlined text-base">open_in_new</span>
              {{ pin.link }}
            </a>

            <!-- Title & Description -->
            <div class="flex items-start gap-2 mb-3 flex-wrap">
              <h1 class="text-2xl sm:text-3xl font-bold text-neutral-900 flex-1 min-w-[12rem]">{{ pin.title }}</h1>
              <span
                v-if="pin.isStory"
                class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase shrink-0 bg-violet-100 text-violet-800"
              >
                <span class="material-symbols-outlined text-xs">auto_stories</span>
                {{ t('pin.storyBadge') }}
              </span>
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
                <p class="text-sm text-neutral-700 leading-relaxed">
                  {{ descriptionText || pin.description }}
                </p>
                <button
                  v-if="isAuthenticated"
                  class="text-xs font-semibold text-pink-600 hover:text-pink-700 inline-flex items-center gap-1.5"
                  :disabled="translatingDescription"
                  @click="handleTranslateDescription"
                >
                  <span v-if="translatingDescription" class="w-3.5 h-3.5 inline-block border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                  <span>{{ translatingDescription ? t('common.loading') : t('comment.translate') }}</span>
                </button>
              </div>
            </div>

            <!-- Crédit créateur certifié (provenance) -->
            <div class="mb-6">
              <ProvenanceChain
                :creator="pin.user"
                :creator-avatar="pin.userAvatarColor"
                :certified="!!pin.certifiedCredit"
                :hash="provenanceHash || pin.provenanceRootHash"
                :events="provenanceEvents"
              />
            </div>

            <!-- Tags privés -->
            <div v-if="isPinOwner" class="mb-6">
              <PrivateTags
                :model-value="privateTags"
                :editable="isAuthenticated"
                @update:model-value="handlePrivateTagsUpdate"
              />
            </div>

            <!-- Author -->
            <div class="mt-8 flex items-center justify-between">
              <router-link
                v-if="pin"
                :to="`/profile/${pin.username}`"
                class="flex items-center gap-3 hover:bg-neutral-50 p-2 rounded-xl transition-colors"
              >
                <div
                  class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm overflow-hidden avatar-shadow"
                  :class="pin.userAvatarColor"
                >
                  <img v-if="pin.userAvatarUrl" :src="pin.userAvatarUrl" class="w-full h-full object-cover" />
                  <span v-else class="avatar-text">{{ pin.user[0] }}</span>
                </div>
                <div>
                  <p class="text-sm font-bold text-neutral-900">{{ pin.user }}</p>
                  <p class="text-xs text-neutral-500">{{ t('pin.followers', { count: formatCount(pin.authorFollowersCount ?? 0) }) }}</p>
                </div>
              </router-link>
              <button
                v-if="currentUser && currentUser.id !== pin.userId"
                class="px-5 py-3 rounded-full text-sm font-bold transition-all"
                :class="pin.isFollowing
                  ? 'bg-neutral-900 text-white hover:bg-neutral-800'
                  : 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200'"
                :disabled="followingAuthor"
                @click="handleFollow"
              >
                <span v-if="followingAuthor" class="w-4 h-4 inline-block border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                <span v-else>{{ pin.isFollowing ? t('pin.following') : t('pin.follow') }}</span>
              </button>
              <a
                v-if="pin.authorTipsEnabled && pin.authorTipsUrl && (!currentUser || currentUser.id !== pin.userId)"
                :href="pin.authorTipsUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="px-4 py-3 rounded-full text-sm font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 transition"
              >
                {{ t('pin.tip') }}
              </a>
            </div>

            <!-- Stats -->
            <div class="flex items-center gap-6 mb-6 text-sm text-neutral-500">
              <span class="flex items-center gap-1.5">
                {{ formatCount(pin.stats.saves) }}
                <span class="material-symbols-outlined text-lg" :class="{ 'fill-1 text-neutral-600': pin.saved }">bookmark</span>
              </span>
              <span class="flex items-center gap-1.5">
                {{ formatCount(pin.stats.reactions) }}
                <span class="material-symbols-outlined text-lg fill-1" :class="pin.liked ? 'text-pink-500' : 'text-neutral-300'">favorite</span>
              </span>
              <span class="flex items-center gap-1.5">
                <span class="material-symbols-outlined text-lg">sell</span>
                {{ pin.topic }}
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
              <span
                v-for="board in pin.boards"
                :key="board.id"
                class="px-2.5 py-1 rounded-full bg-purple-50 text-xs font-semibold text-purple-700"
              >
                {{ board.name }}
              </span>
            </div>

            <!-- Comments section (rich) -->
            <div class="flex-1">
              <div class="flex items-center justify-between mb-4">
                <h3 class="font-semibold text-neutral-900 flex items-center gap-2">
                  {{ t('pin.comments') }}
                  <span class="text-neutral-400 font-normal text-sm">({{ commentsTotalCount }})</span>
                </h3>
                <div class="flex items-center gap-1.5">
                  <button
                    class="text-xs font-medium px-2 py-1 rounded-full border transition"
                    :class="commentSort === 'recent' ? 'bg-pink-50 text-pink-600 border-pink-200' : 'text-neutral-500 border-neutral-200 hover:text-neutral-700'"
                    @click="setCommentSort('recent')"
                  >
                    {{ t('pin.comments.sortRecent') }}
                  </button>
                  <button
                    class="text-xs font-medium px-2 py-1 rounded-full border transition"
                    :class="commentSort === 'relevant' ? 'bg-pink-50 text-pink-600 border-pink-200' : 'text-neutral-500 border-neutral-200 hover:text-neutral-700'"
                    @click="setCommentSort('relevant')"
                  >
                    {{ t('pin.comments.sortRelevant') }}
                  </button>
                </div>
              </div>

              <!-- Rich threads -->
              <div class="max-h-[420px] overflow-y-auto mb-5 pr-1">
                <CommentThread
                  :comments="richComments"
                  :can-translate="isAuthenticated"
                  :highlighted-comment-id="highlightedCommentId"
                  @add="handleRichSubmit"
                  @like="handleLikeComment"
                  @translate="handleTranslateComment"
                  @load-more-replies="handleLoadMoreReplies"
                />
                <div v-if="commentsHasNext" class="mt-3 text-center">
                  <button
                    class="text-sm font-semibold text-pink-600 hover:text-pink-700 disabled:opacity-50"
                    :disabled="commentsLoadingMore"
                    @click="handleLoadMoreComments"
                  >
                    {{ commentsLoadingMore ? t('comment.loadingMoreComments') : t('comment.loadMoreComments') }}
                  </button>
                </div>
              </div>

              <!-- Add comment (rich) -->
              <div class="flex items-start gap-3 pt-3 border-t border-neutral-100">
                <div
                  v-if="currentUser"
                  class="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-1"
                  :class="currentUser.avatarColor"
                >
                  {{ currentUser.displayName[0] }}
                </div>
                <div class="flex-1 min-w-0">
                  <RichCommentInput :submitting="submittingComment" @submit="handleRichSubmit" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Related pins -->
      <section v-if="relatedPins.length > 0 || pinsLoading" class="px-3 sm:px-6 lg:px-10 xl:px-16 pb-10">
        <h2 class="text-xl font-bold text-neutral-900 mb-5">{{ t('pin.related') }}</h2>
        <PinSkeleton v-if="pinsLoading && relatedPins.length === 0" />
        <PinGrid
          v-else
          :pins="relatedPins"
          @toggle-save="handleToggleSaveRelated"
          @open-pin="openRelatedPin"
          @more="openRelatedPin"
        />
      </section>
    </div>
  </div>
</template>
