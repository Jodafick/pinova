<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import type { CSSProperties, PropType } from 'vue'
import type { Pin, User } from '../types'
import type { PinOverlayOriginRect } from '../utils/pinOverlayOrigin'
import { useI18n } from '../i18n'
import PinSensitiveMedia from './PinSensitiveMedia.vue'
import AvatarDisc from './AvatarDisc.vue'
import CommentThread from './CommentThread.vue'
import RichCommentInput from './RichCommentInput.vue'
import { displayInitials } from '../utils/displayInitials'
import PinovaModal from './ui/PinovaModal.vue'
import {
  PIN_MEDIA_ANTI_LEAK_CLASS,
  pinMediaAntiLeakImgBindings,
  pinMediaAntiLeakVideoBindings,
} from '../composables/mediaAntiLeak'
import OfflineImg from './OfflineImg.vue'
import OfflineVideo from './OfflineVideo.vue'
import ContextualSponsoredSlot from './ContextualSponsoredSlot.vue'

type CommentSubmitPayload = {
  text: string
  gif?: string | null
  mediaFile?: File | null
  replyTo?: string | null
  parentId?: number
}

const props = defineProps({
  pin: { type: Object as PropType<Pin>, required: true },
  previousPin: { type: Object as PropType<Pin | null>, default: null },
  nextPin: { type: Object as PropType<Pin | null>, default: null },
  canNavigatePrevious: { type: Boolean, default: false },
  canNavigateNext: { type: Boolean, default: false },
  openingOriginRect: { type: Object as PropType<PinOverlayOriginRect | null>, default: null },
  currentUser: { type: Object as PropType<User | null>, default: null },
  isAuthenticated: { type: Boolean, required: true },
  isPinOwner: { type: Boolean, required: true },
  viewerCanComment: { type: Boolean, required: true },
  viewerCanRevealSensitive: { type: Boolean, required: true },
  blurSensitiveByDefault: { type: Boolean, required: true },
  descriptionText: { type: String, default: '' },
  comments: { type: Array as PropType<any[]>, default: () => [] },
  commentsTotalCount: { type: Number, default: 0 },
  commentsHasNext: { type: Boolean, default: false },
  commentsLoadingMore: { type: Boolean, default: false },
  highlightedCommentId: { type: Number as PropType<number | null>, default: null },
  detailVideoPreload: { type: String as PropType<'none' | 'metadata' | 'auto'>, default: 'metadata' },
  detailImageFetchPriority: { type: String as PropType<'high' | 'low' | 'auto'>, default: 'high' },
  formatCount: { type: Function as PropType<(value: number) => string>, required: true },
  likingPin: { type: Boolean, default: false },
  savingPin: { type: Boolean, default: false },
  downloadingPin: { type: Boolean, default: false },
  followingAuthor: { type: Boolean, default: false },
  translatingDescription: { type: Boolean, default: false },
  submittingComment: { type: Boolean, default: false },
})

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'media-orientation', landscape: boolean): void
  (e: 'like'): void
  (e: 'double-like'): void
  (e: 'save'): void
  (e: 'share'): void
  (e: 'download'): void
  (e: 'report'): void
  (e: 'boost'): void
  (e: 'follow'): void
  (e: 'translate-description'): void
  (e: 'open-likers'): void
  (e: 'comment-add', payload: CommentSubmitPayload): void
  (e: 'comment-like', id: number): void
  (e: 'comment-translate', id: number): void
  (e: 'load-more-comments'): void
  (e: 'load-more-replies', id: number): void
  (e: 'moderate-comment', id: number, hidden: boolean): void
  (e: 'report-comment', id: number): void
  (e: 'delete-comment', id: number): void
  (e: 'next-pin'): void
  (e: 'prev-pin'): void
}>()

const { t } = useI18n()
const commentsOpen = ref(false)
const actionsOpen = ref(false)
const chromeVisible = ref(true)
const heartBurst = ref(false)
const heartBurstKey = ref(0)
let heartBurstHideTimer: number | null = null
const surfaceDragX = ref(0)
const surfaceDragY = ref(0)
/** Doigt / pointeur actif sur la surface — transitions CSS coupées pour suivre le geste sans « combat » visuel. */
const surfacePointerActive = ref(false)
const gestureStart = ref<{ x: number; y: number; at: number } | null>(null)
const gestureIntent = ref<'none' | 'vertical' | 'horizontal'>('none')
const followBadgeState = ref<'idle' | 'checking' | 'done'>(props.pin.isFollowing ? 'done' : 'idle')
let singleTapTimer: ReturnType<typeof setTimeout> | null = null
let lastTapAt = 0
let lastTapX = 0
let lastTapY = 0
let followBadgeTimer: ReturnType<typeof setTimeout> | null = null
let longPressTimer: ReturnType<typeof setTimeout> | null = null
let longPressTriggered = false

/** Fermeture animée : laisser voir le feed derrière avant `emit('back')`. */
const isExitClosing = ref(false)
let exitCloseTimer: ReturnType<typeof setTimeout> | null = null
const EXIT_CLOSE_ANIM_MS = 360

function clearExitCloseTimer() {
  if (exitCloseTimer) {
    clearTimeout(exitCloseTimer)
    exitCloseTimer = null
  }
}

function startDismissClose() {
  if (isExitClosing.value) return
  clearSingleTapTimer()
  gestureIntent.value = 'none'
  gestureStart.value = null
  isExitClosing.value = true
  resetSurfaceGesture()
  clearExitCloseTimer()
  exitCloseTimer = setTimeout(() => {
    exitCloseTimer = null
    emit('back')
  }, EXIT_CLOSE_ANIM_MS)
}

const isOwnStory = computed(() => props.pin.isStory && props.isPinOwner)
const displayDescription = computed(() => (props.descriptionText || props.pin.description || '').trim())
const descriptionTranslated = computed(() => {
  const original = (props.pin.description || '').trim()
  const current = (props.descriptionText || '').trim()
  return !!original && !!current && current !== original
})
const canFollowAuthor = computed(() => !props.isPinOwner && (!props.currentUser || props.currentUser.id !== props.pin.userId))
const shareCount = computed(() => {
  return props.pin.stats.shares || 0
})
const mediaSlides = computed(() => [
  { key: props.previousPin?.slug ?? 'empty-prev', pin: props.previousPin, active: false },
  { key: props.pin.slug, pin: props.pin, active: true },
  { key: props.nextPin?.slug ?? 'empty-next', pin: props.nextPin, active: false },
])
/** Drag vertical : appliqué sur `.pin-mobile-surface` (pas la racine) pour ne pas créer un
 * containing block `transform` + `overflow:hidden` qui casse les `fixed` et les `<transition>` des feuilles. */
const surfaceStyle = computed(() => {
  if (isExitClosing.value) return undefined
  const transition =
    surfacePointerActive.value && (surfaceDragY.value > 0 || gestureIntent.value !== 'none')
      ? 'none'
      : undefined
  if (surfaceDragY.value > 0) {
    const y = Math.round(surfaceDragY.value * 4) / 4
    const scale = Math.max(0.9, 1 - y / 1800)
    const radius = Math.min(22, Math.round(y / 7))
    return {
      ...(transition ? { transition } : {}),
      transform: `translate3d(0, ${y}px, 0) scale(${scale})`,
      borderRadius: `${radius}px`,
    }
  }
  return transition ? { transition } : undefined
})
const openingOriginStyle = computed<CSSProperties>(() => {
  const rect = props.openingOriginRect
  if (!rect) return {}
  const viewportWidth = window.innerWidth || 1
  const viewportHeight = window.innerHeight || 1
  return {
    '--pin-open-left': `${rect.left}px`,
    '--pin-open-top': `${rect.top}px`,
    '--pin-open-scale-x': `${Math.max(0.04, rect.width / viewportWidth)}`,
    '--pin-open-scale-y': `${Math.max(0.04, rect.height / viewportHeight)}`,
    '--pin-open-radius': '1.5rem',
  } as CSSProperties
})
const rootStyle = computed(() => ({
  ...openingOriginStyle.value,
}))

/** Voile derrière le média : s’allège au drag vertical, disparaît à la fermeture pour révéler le feed. */
const scrimOverlayStyle = computed(() => {
  if (isExitClosing.value) {
    return {
      opacity: 0,
      transition: `opacity ${EXIT_CLOSE_ANIM_MS * 0.88}ms cubic-bezier(0.22, 1, 0.36, 1)`,
    }
  }
  const y = surfaceDragY.value
  if (y <= 0) return { opacity: 1 }
  const t = Math.min(1, y / 420)
  return { opacity: Math.max(0.08, 1 - t * 0.88) }
})

const mediaTrackStyle = computed(() => ({
  transform: `translate3d(calc(-100vw + ${surfaceDragX.value}px), 0, 0)`,
  transition: gestureIntent.value === 'horizontal' ? 'none' : 'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)',
}))

function onImageLoad(e: Event) {
  const img = e.target as HTMLImageElement
  if (!img.naturalWidth || !img.naturalHeight) return
  emit('media-orientation', img.naturalWidth >= img.naturalHeight)
}

function onVideoMetadata(e: Event) {
  const video = e.target as HTMLVideoElement
  if (!video.videoWidth || !video.videoHeight) return
  emit('media-orientation', video.videoWidth >= video.videoHeight)
}

function burstAndLike() {
  heartBurstKey.value += 1
  heartBurst.value = true
  if (heartBurstHideTimer) clearTimeout(heartBurstHideTimer)
  heartBurstHideTimer = window.setTimeout(() => {
    heartBurst.value = false
    heartBurstHideTimer = null
  }, 900)
}

function handleLikePress() {
  if (!props.pin.liked) burstAndLike()
  emit('like')
}

function handleDoubleTapLike() {
  burstAndLike()
  emit('double-like')
}

function clearSingleTapTimer() {
  if (singleTapTimer) {
    clearTimeout(singleTapTimer)
    singleTapTimer = null
  }
}

function clearLongPressTimer() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function shouldIgnoreSurfaceGesture(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest(
      '.contextual-sponsored-slot, .sponsored-native-strip, .pin-mobile-rail, .pin-mobile-caption, button, a, input, textarea, select, [role="button"]',
    ),
  )
}

function beginGesture(x: number, y: number) {
  if (isExitClosing.value) return
  if (commentsOpen.value || actionsOpen.value) return
  surfacePointerActive.value = true
  gestureStart.value = { x, y, at: Date.now() }
  gestureIntent.value = 'none'
  surfaceDragX.value = 0
  surfaceDragY.value = 0
  longPressTriggered = false
  clearLongPressTimer()
  longPressTimer = setTimeout(() => {
    const start = gestureStart.value
    if (!start || gestureIntent.value !== 'none') return
    longPressTriggered = true
    gestureStart.value = null
    clearSingleTapTimer()
    actionsOpen.value = true
  }, 420)
}

function moveGesture(x: number, y: number) {
  if (isExitClosing.value) return
  if (commentsOpen.value || actionsOpen.value) return
  const start = gestureStart.value
  if (!start) return
  const dx = x - start.x
  const dy = y - start.y
  const absX = Math.abs(dx)
  const absY = Math.abs(dy)

  if (gestureIntent.value === 'none') {
    if (absY > 10 && absY > absX * 1.15) gestureIntent.value = 'vertical'
    else if (absX > 10 && absX > absY * 1.15) gestureIntent.value = 'horizontal'
    else return
  }
  if (absX > 12 || absY > 12) clearLongPressTimer()

  if (gestureIntent.value === 'vertical') {
    surfaceDragY.value = Math.max(0, Math.round(dy * 4) / 4)
    surfaceDragX.value = 0
  } else {
    const hasTarget = dx < 0 ? (props.canNavigateNext || !!props.nextPin) : (props.canNavigatePrevious || !!props.previousPin)
    const drag = hasTarget ? dx : dx * 0.18
    const viewportWidth = window.innerWidth || 1
    surfaceDragX.value = Math.max(-viewportWidth, Math.min(viewportWidth, drag))
    surfaceDragY.value = 0
  }
}

function resetSurfaceGesture() {
  gestureIntent.value = 'none'
  surfaceDragX.value = 0
  surfaceDragY.value = 0
}

function endGesture(x: number, y: number) {
  try {
    if (isExitClosing.value) return
    const start = gestureStart.value
    gestureStart.value = null
    if (commentsOpen.value || actionsOpen.value) {
      clearLongPressTimer()
      longPressTriggered = false
      resetSurfaceGesture()
      return
    }
    if (!start) {
      resetSurfaceGesture()
      return
    }
    clearLongPressTimer()
    if (longPressTriggered) {
      longPressTriggered = false
      resetSurfaceGesture()
      return
    }

    const dx = x - start.x
    const dy = y - start.y
    const absX = Math.abs(dx)
    const absY = Math.abs(dy)
    const elapsed = Date.now() - start.at

    if (absY > 74 && absY > absX * 1.12) {
      clearSingleTapTimer()
      if (dy > 0) {
        gestureIntent.value = 'none'
        startDismissClose()
        return
      }
      resetSurfaceGesture()
      commentsOpen.value = true
      return
    }

    if (absX > 58 && absX > absY * 1.12) {
      clearSingleTapTimer()
      resetSurfaceGesture()
      if (dx < 0 && (props.canNavigateNext || props.nextPin)) {
        emit('next-pin')
      } else if (dx > 0 && (props.canNavigatePrevious || props.previousPin)) {
        emit('prev-pin')
      }
      return
    }

    resetSurfaceGesture()

    if (absX > 12 || absY > 12 || elapsed > 420) return

    const now = Date.now()
    const doubleTap =
      now - lastTapAt < 320 &&
      Math.abs(x - lastTapX) < 34 &&
      Math.abs(y - lastTapY) < 34

    if (doubleTap) {
      clearSingleTapTimer()
      lastTapAt = 0
      handleDoubleTapLike()
      return
    }

    lastTapAt = now
    lastTapX = x
    lastTapY = y
    clearSingleTapTimer()
    singleTapTimer = setTimeout(() => {
      singleTapTimer = null
      chromeVisible.value = !chromeVisible.value
    }, 280)
  } finally {
    surfacePointerActive.value = false
  }
}

function onSurfacePointerDown(e: PointerEvent) {
  if (e.pointerType === 'touch') return
  if (shouldIgnoreSurfaceGesture(e.target)) return
  ;(e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId)
  beginGesture(e.clientX, e.clientY)
}

function onSurfacePointerMove(e: PointerEvent) {
  if (e.pointerType === 'touch') return
  moveGesture(e.clientX, e.clientY)
}

function onSurfacePointerUp(e: PointerEvent) {
  if (e.pointerType === 'touch') return
  endGesture(e.clientX, e.clientY)
}

function onSurfacePointerCancel() {
  surfacePointerActive.value = false
  clearLongPressTimer()
  longPressTriggered = false
  gestureStart.value = null
  resetSurfaceGesture()
}

function onSurfaceTouchStart(e: TouchEvent) {
  const touch = e.changedTouches[0]
  if (!touch) return
  if (shouldIgnoreSurfaceGesture(e.target)) return
  beginGesture(touch.clientX, touch.clientY)
}

function onSurfaceTouchMove(e: TouchEvent) {
  const touch = e.changedTouches[0]
  if (!touch) return
  moveGesture(touch.clientX, touch.clientY)
  if (gestureIntent.value !== 'none') e.preventDefault()
}

function onSurfaceTouchEnd(e: TouchEvent) {
  const touch = e.changedTouches[0]
  if (!touch) return
  endGesture(touch.clientX, touch.clientY)
}

function onSurfaceTouchCancel() {
  onSurfacePointerCancel()
}

function handleFollowClick() {
  if (followBadgeState.value === 'done') return
  emit('follow')
}

function closeActionsAnd(action: 'share' | 'save' | 'report') {
  actionsOpen.value = false
  if (action === 'share') emit('share')
  else if (action === 'save') emit('save')
  else emit('report')
}

watch(
  () => props.pin.slug,
  () => {
    chromeVisible.value = true
    commentsOpen.value = false
    actionsOpen.value = false
    surfacePointerActive.value = false
    clearSingleTapTimer()
    clearLongPressTimer()
    resetSurfaceGesture()
  },
)

watch(
  () => props.pin.isFollowing,
  (following, previous) => {
    if (followBadgeTimer) {
      clearTimeout(followBadgeTimer)
      followBadgeTimer = null
    }
    if (!previous && following) {
      followBadgeState.value = 'checking'
      followBadgeTimer = setTimeout(() => {
        followBadgeState.value = 'done'
      }, 720)
    } else if (!following) {
      followBadgeState.value = 'idle'
    } else {
      followBadgeState.value = 'done'
    }
  },
)

onUnmounted(() => {
  clearExitCloseTimer()
  if (heartBurstHideTimer) clearTimeout(heartBurstHideTimer)
})
</script>

<template>
  <!--
    Teleport vers `body` : `#app-shell` a `contain: layout style` (pour piloter
    le depthEffect des modales sans cascader le layout). Ce containment crée
    un containing block pour `position: fixed`, donc sans teleport l'overlay
    serait ancré à `#app-shell` au lieu du viewport → quand la page derrière
    est scrollée, l'overlay apparaissait à mi-hauteur / en bas. Teleporter au
    body remet le fixed relatif au viewport comme attendu.
  -->
  <Teleport to="body">
  <section
    class="pin-mobile fixed inset-0 z-[95] bg-transparent text-white lg:hidden"
    :class="{
      'pin-mobile--opening-from-card': openingOriginRect,
      'pin-mobile--exit-closing': isExitClosing,
    }"
    :style="rootStyle"
  >
    <div class="pin-mobile-scrim" :style="scrimOverlayStyle" aria-hidden="true" />
    <button
      type="button"
      class="pin-mobile-desktop-close hidden lg:grid"
      :aria-label="t('common.close')"
      @click="startDismissClose"
    >
      <PinovaIcon name="close" filled class="text-2xl" />
    </button>

    <div
      class="pin-mobile-surface absolute inset-0 z-[1] bg-black"
      :class="{ 'pin-mobile-surface--exit-dismiss': isExitClosing }"
      :style="surfaceStyle"
      @pointerdown="onSurfacePointerDown"
      @pointermove="onSurfacePointerMove"
      @pointerup="onSurfacePointerUp"
      @pointercancel="onSurfacePointerCancel"
      @touchstart="onSurfaceTouchStart"
      @touchmove="onSurfaceTouchMove"
      @touchend="onSurfaceTouchEnd"
      @touchcancel="onSurfaceTouchCancel"
    >
      <div class="pin-mobile-media-track absolute inset-0 flex" :style="mediaTrackStyle">
        <div
          v-for="slide in mediaSlides"
          :key="slide.key"
          class="pin-mobile-panel relative flex h-full w-screen shrink-0 items-center justify-center bg-black"
        >
          <PinSensitiveMedia
            v-if="slide.pin?.imageUrl"
            :sensitive="!!slide.pin.mediaSensitiveBlur"
            :viewer-can-reveal="viewerCanRevealSensitive"
            :blur-by-default="blurSensitiveByDefault"
            :media-url="slide.pin.imageUrl"
            media-type="image"
            wrapper-class="h-full w-full flex items-center justify-center"
          >
            <OfflineImg
              :src="slide.pin.imageUrl"
              :alt="slide.pin.title ? `${slide.pin.title} - ${slide.pin.user}` : t('feed.pinImageFallback', { user: slide.pin.user })"
              :fetchpriority="slide.active ? detailImageFetchPriority : 'low'"
              loading="eager"
              decoding="async"
              :class="[PIN_MEDIA_ANTI_LEAK_CLASS, 'pin-mobile-media']"
              @load="slide.active ? onImageLoad($event) : undefined"
              v-bind="pinMediaAntiLeakImgBindings()"
            />
          </PinSensitiveMedia>

          <PinSensitiveMedia
            v-else-if="slide.pin?.storyVideoUrl"
            :sensitive="!!slide.pin.mediaSensitiveBlur"
            :viewer-can-reveal="viewerCanRevealSensitive"
            :blur-by-default="blurSensitiveByDefault"
            :media-url="slide.pin.storyVideoUrl"
            media-type="video"
            wrapper-class="h-full w-full flex items-center justify-center"
          >
            <OfflineVideo
              :src="slide.pin.storyVideoUrl"
              class="pin-mobile-media"
              :controls="slide.active"
              playsinline
              :preload="slide.active ? detailVideoPreload : 'metadata'"
              @loadedmetadata="slide.active ? onVideoMetadata($event) : undefined"
              v-bind="pinMediaAntiLeakVideoBindings(true)"
            />
          </PinSensitiveMedia>
          <div v-else class="grid h-full w-full place-items-center bg-black text-white/30">
            <PinovaIcon name="more_horiz" filled class="text-5xl" />
          </div>

          <template v-if="slide.pin">
            <div v-show="chromeVisible" class="absolute inset-0 bg-gradient-to-b from-black/50 via-black/5 via-35% to-black/86 transition-opacity" />
            <div v-show="chromeVisible" class="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black via-black/55 to-transparent transition-opacity" />

            <aside
              v-show="chromeVisible"
              class="pin-mobile-rail"
              @touchstart.stop
              @touchend.stop
              @touchcancel.stop
              @pointerdown.stop
            >
              <div class="pin-mobile-avatar-wrap">
                <router-link
                  :to="`/profile/${slide.pin.username}`"
                  class="pin-mobile-avatar-link"
                  :aria-label="slide.pin.user"
                >
                  <AvatarDisc
                    :color="slide.pin.userAvatarColor"
                    frame-class="h-12 w-12 text-sm shadow-lg border-1"
                    text-class="text-white"
                    :has-image="!!slide.pin.userAvatarUrl"
                  >
                    <OfflineImg
                      v-if="slide.pin.userAvatarUrl"
                      :src="slide.pin.userAvatarUrl"
                      alt=""
                      class="h-full w-full object-cover"
                    />
                    <span v-else class="avatar-text">{{ displayInitials(slide.pin.user) }}</span>
                  </AvatarDisc>
                </router-link>
                <button
                  v-if="slide.active && canFollowAuthor"
                  type="button"
                  class="pin-mobile-follow-badge"
                  :class="[
                    `pin-mobile-follow-badge--${followBadgeState}`,
                    { 'pin-mobile-follow-badge--busy': followingAuthor },
                  ]"
                  :disabled="followingAuthor || followBadgeState === 'done'"
                  :aria-label="pin.isFollowing ? t('pin.following') : t('pin.follow')"
                  @click.stop="handleFollowClick"
                >
                  <span v-if="followingAuthor" class="h-2 w-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <PinovaIcon v-else :name="followBadgeState === 'checking' ? 'check' : 'add'" filled class="text-[13px] leading-none text-white" />
                </button>
              </div>

              <button
                v-if="slide.active && !isOwnStory"
                type="button"
                class="pin-mobile-rail-btn"
                :class="{ 'pin-mobile-rail-btn--active': pin.liked }"
                :disabled="likingPin"
                :aria-pressed="pin.liked"
                :aria-label="pin.liked ? t('pin.a11y.unlike') : t('pin.a11y.like')"
                @click="handleLikePress"
              >
                <PinovaIcon name="favorite" filled class="text-[31px]" />
                <span class="pin-mobile-rail-label">{{ formatCount(pin.stats.reactions || 0) }}</span>
              </button>

              <button
                v-else-if="slide.active"
                type="button"
                class="pin-mobile-rail-btn pin-mobile-rail-btn--active"
                :aria-label="t('story.likers.openListAria', { count: pin.stats.reactions })"
                @click="emit('open-likers')"
              >
                <PinovaIcon name="favorite" filled class="text-[31px]" />
                <span class="pin-mobile-rail-label">{{ formatCount(pin.stats.reactions || 0) }}</span>
              </button>

              <div
                v-else
                class="pin-mobile-rail-btn"
                :class="{ 'pin-mobile-rail-btn--active': slide.pin.liked }"
              >
                <PinovaIcon name="favorite" filled class="text-[31px]" />
                <span class="pin-mobile-rail-label">{{ formatCount(slide.pin.stats.reactions || 0) }}</span>
              </div>

              <button
                v-if="slide.active"
                type="button"
                class="pin-mobile-rail-btn"
                :class="{ 'pin-mobile-rail-btn--active': commentsOpen }"
                :aria-label="t('pin.comments')"
                @click="commentsOpen = true"
              >
                <PinovaIcon name="chat_bubble" filled class="text-[29px]" />
                <span class="pin-mobile-rail-label">{{ formatCount(commentsTotalCount) }}</span>
              </button>
              <div v-else class="pin-mobile-rail-btn">
                <PinovaIcon name="chat_bubble" filled class="text-[29px]" />
                <span class="pin-mobile-rail-label">0</span>
              </div>

              <button
                v-if="slide.active"
                type="button"
                class="pin-mobile-rail-btn"
                :class="{ 'pin-mobile-rail-btn--active': pin.saved }"
                :disabled="savingPin"
                :aria-pressed="pin.saved"
                :aria-label="pin.saved ? t('pin.a11y.saved') : t('pin.a11y.save')"
                @click="emit('save')"
              >
                <span v-if="savingPin" class="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <PinovaIcon v-else name="bookmark" filled class="text-[29px]" />
                <span class="pin-mobile-rail-label">{{ formatCount(pin.stats.saves || 0) }}</span>
              </button>
              <div
                v-else
                class="pin-mobile-rail-btn"
                :class="{ 'pin-mobile-rail-btn--active': slide.pin.saved }"
              >
                <PinovaIcon name="bookmark" filled class="text-[29px]" />
                <span class="pin-mobile-rail-label">{{ formatCount(slide.pin.stats.saves || 0) }}</span>
              </div>

              <button
                v-if="slide.active"
                type="button"
                class="pin-mobile-rail-btn"
                :aria-label="t('pin.a11y.share')"
                @click="emit('share')"
              >
                <PinovaIcon name="share" filled class="text-[28px]" />
                <span class="pin-mobile-rail-label">{{ formatCount(shareCount) }}</span>
              </button>
              <div v-else class="pin-mobile-rail-btn">
                <PinovaIcon name="share" filled class="text-[28px]" />
                <span class="pin-mobile-rail-label">{{ formatCount(slide.pin.stats.shares || 0) }}</span>
              </div>
            </aside>

            <main
              v-show="chromeVisible"
              class="pin-mobile-caption"
              @touchstart.stop
              @touchend.stop
              @touchcancel.stop
              @pointerdown.stop
            >
              <router-link
                :to="`/profile/${slide.pin.username}`"
                class="mb-1.5 block max-w-[calc(100%-3rem)] drop-shadow"
                :aria-label="slide.pin.user"
              >
                <span class="block truncate text-[15px] font-extrabold leading-tight text-white">{{ slide.pin.user }}</span>
                <span class="block truncate text-xs font-semibold leading-tight text-white/62">@{{ slide.pin.username }}</span>
              </router-link>

              <h1
                :id="slide.active ? 'pin-detail-title' : undefined"
                class="max-w-[calc(100%-3rem)] text-lg font-black leading-snug tracking-tight drop-shadow"
              >
                {{ slide.pin.title }}
              </h1>
              <span
                v-if="slide.pin.isBoosted"
                class="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold text-white"
              >
                <PinovaIcon name="rocket_launch" class="text-[12px]" />
                {{ t('feed.pinBoosted') }}
              </span>

              <p
                v-if="slide.active ? displayDescription : slide.pin.description"
                class="mt-2 max-w-[calc(100%-3rem)] text-sm leading-5 text-white/82 line-clamp-3"
              >
                {{ slide.active ? displayDescription : slide.pin.description }}
              </p>

              <div class="mt-3 flex max-w-[calc(100%-3rem)] flex-wrap items-center gap-2 text-[11px] font-bold text-white/70">
                <span class="rounded-full bg-white/12 px-2.5 py-1 backdrop-blur">{{ slide.pin.topicDisplay ?? slide.pin.topic }}</span>
                <button
                  v-if="slide.active && isAuthenticated && displayDescription"
                  type="button"
                  class="inline-flex min-h-[1.625rem] items-center gap-1 rounded-full bg-white/12 px-2.5 py-1 backdrop-blur disabled:opacity-70"
                  :disabled="translatingDescription"
                  @click="emit('translate-description')"
                >
                  <span v-if="translatingDescription" class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/80 border-t-transparent" />
                  <template v-else-if="descriptionTranslated">
                    <PinovaIcon name="language" filled class="text-[14px]" />
                    <span>{{ t('translate.auto') }}</span>
                  </template>
                  <span v-else>{{ t('comment.translate') }}</span>
                </button>
                <a
                  v-if="slide.pin.link"
                  class="rounded-full bg-white/12 px-2.5 py-1 backdrop-blur"
                  :href="slide.pin.link.startsWith('http') ? slide.pin.link : 'https://' + slide.pin.link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ t('pin.detail.externalLink') }}
                </a>
              </div>

              <div
                v-if="slide.active && !isPinOwner"
                class="mt-3 max-w-[calc(100%-3rem)] pointer-events-auto"
              >
                <ContextualSponsoredSlot placement="pin_detail" :topic="slide.pin.topic" variant="detail" tone="dark" />
              </div>
            </main>
          </template>
        </div>
      </div>
    </div>

    <transition name="pin-mobile-heart">
      <div v-if="heartBurst" :key="heartBurstKey" class="pin-mobile-heart pointer-events-none">
        <PinovaIcon name="favorite" filled />
        <span class="pin-mobile-heart-particles" aria-hidden="true">
          <PinovaIcon v-for="n in 7" :key="n" name="favorite" filled class="pin-mobile-heart-particle" />
        </span>
      </div>
    </transition>

    <PinovaModal
      v-model:open="commentsOpen"
      presentation="tallSheet"
      :depth-effect="false"
      :title="`${t('pin.comments')} · ${commentsTotalCount}`"
    >
      <template #headerEnd>
        <button
          type="button"
          class="inline-flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 hover:bg-black/[0.06] dark:text-neutral-300 dark:hover:bg-white/[0.08] transition"
          :aria-label="t('common.close')"
          @click="commentsOpen = false"
        >
          <PinovaIcon name="close" class="text-[22px] leading-none" />
        </button>
      </template>

      <div class="pin-mobile-comments-scroll max-h-[min(52vh,28rem)] overflow-y-auto pr-1 -mx-1">
        <CommentThread
          :comments="comments"
          :can-translate="isAuthenticated"
          :highlighted-comment-id="highlightedCommentId"
          :is-pin-owner="isPinOwner"
          :viewer-can-comment="viewerCanComment"
          :viewer-username="currentUser?.username ?? null"
          @add="(payload) => emit('comment-add', payload)"
          @like="(id) => emit('comment-like', id)"
          @translate="(id) => emit('comment-translate', id)"
          @load-more-replies="(id) => emit('load-more-replies', id)"
          @moderate-comment="(id, hidden) => emit('moderate-comment', id, hidden)"
          @report-comment="(id) => emit('report-comment', id)"
          @delete-comment="(id) => emit('delete-comment', id)"
        />
        <div v-if="commentsHasNext" class="py-3 text-center">
          <button
            type="button"
            class="pin-mobile-load-more text-sm font-bold disabled:opacity-50"
            :disabled="commentsLoadingMore"
            @click="emit('load-more-comments')"
          >
            {{ commentsLoadingMore ? t('comment.loadingMoreComments') : t('comment.loadMoreComments') }}
          </button>
        </div>
      </div>

      <div
        v-if="!isAuthenticated || viewerCanComment"
        class="mt-4 border-t border-neutral-100 dark:border-neutral-800 pt-3"
      >
        <RichCommentInput :submitting="submittingComment" @submit="(payload) => emit('comment-add', payload)" />
      </div>
    </PinovaModal>

    <PinovaModal
      v-model:open="actionsOpen"
      presentation="tallSheet"
      :depth-effect="false"
      :title="t('pin.actionsTitle')"
    >
      <template #headerEnd>
        <button
          type="button"
          class="inline-flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 hover:bg-black/[0.06] dark:text-neutral-300 dark:hover:bg-white/[0.08] transition"
          :aria-label="t('common.close')"
          @click="actionsOpen = false"
        >
          <PinovaIcon name="close" class="text-[22px] leading-none" />
        </button>
      </template>

      <div class="space-y-2">
        <button
          type="button"
          class="pin-mobile-action-row"
          :aria-label="t('pin.a11y.share')"
          @click="closeActionsAnd('share')"
        >
          <span class="pin-mobile-action-icon">
            <PinovaIcon name="share" filled class="text-[20px]" />
          </span>
          <span class="min-w-0 flex-1 text-left font-bold">{{ t('pin.shareLink') }}</span>
        </button>

        <button
          v-if="isPinOwner && pin.slug"
          type="button"
          class="pin-mobile-action-row"
          :aria-label="t('pin.boost.cta')"
          @click="actionsOpen = false; emit('boost')"
        >
          <span class="pin-mobile-action-icon pin-mobile-action-icon--boost">
            <PinovaIcon name="rocket_launch" filled class="text-[20px]" />
          </span>
          <span class="min-w-0 flex-1 text-left font-bold">{{ t('pin.boost.cta') }}</span>
        </button>

        <button
          type="button"
          class="pin-mobile-action-row"
          :aria-label="t('pin.a11y.download')"
          @click="actionsOpen = false; emit('download')"
        >
          <span class="pin-mobile-action-icon">
            <span v-if="downloadingPin" class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <PinovaIcon v-else name="download" filled class="text-[20px]" />
          </span>
          <span class="min-w-0 flex-1 text-left font-bold">{{ t('pin.a11y.download') }}</span>
        </button>

        <button
          v-if="isAuthenticated && !isPinOwner"
          type="button"
          class="pin-mobile-action-row"
          :disabled="!!pin.viewerHasReported"
          :aria-label="t('moderation.report')"
          @click="closeActionsAnd('report')"
        >
          <span class="pin-mobile-action-icon">
            <PinovaIcon name="flag" filled class="text-[20px]" />
          </span>
          <span class="min-w-0 flex-1 text-left font-bold">
            {{ pin.viewerHasReported ? t('moderation.reportAlready') : t('moderation.report') }}
          </span>
        </button>
      </div>
    </PinovaModal>
  </section>
  </Teleport>
</template>

<style scoped>
.pin-mobile-media {
  display: block;
  max-height: 100svh;
  max-width: 100vw;
  height: 100%;
  width: 100%;
  object-fit: contain;
  background: #000;
  user-select: none;
  touch-action: none;
}

.pin-mobile {
  overflow: hidden;
  touch-action: none;
  transform-origin: top left;
}

.pin-mobile--exit-closing {
  pointer-events: none;
}

.pin-mobile-scrim {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-color: rgb(0 0 0 / 0.88);
}

.pin-mobile--opening-from-card {
  animation: pin-mobile-open-from-card 0.36s cubic-bezier(0.2, 0.86, 0.22, 1) both;
}

.pin-mobile-surface--exit-dismiss {
  transform: translate3d(0, 100%, 0) !important;
  transition: transform 0.34s cubic-bezier(0.22, 1, 0.36, 1) !important;
}

.pin-mobile-surface {
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  transition: transform 0.18s ease-out, border-radius 0.18s ease-out;
  will-change: transform;
}

.pin-mobile-media-track {
  width: 300vw;
  will-change: transform;
}

.pin-mobile-desktop-close {
  position: fixed;
  top: 1.25rem;
  right: 1.25rem;
  z-index: 70;
  height: 2.75rem;
  width: 2.75rem;
  place-items: center;
  border-radius: 999px;
  border: 1px solid rgb(255 255 255 / 0.18);
  background: rgb(0 0 0 / 0.45);
  color: white;
  box-shadow: 0 18px 46px rgb(0 0 0 / 0.28);
  backdrop-filter: blur(16px);
}

.pin-mobile-filled {
  font-variation-settings: 'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 24;
}

.pin-mobile-top-btn {
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + 0.75rem);
  z-index: 20;
  display: grid;
  height: 2.5rem;
  width: 2.5rem;
  place-items: center;
  border-radius: 999px;
  border: 1px solid rgb(255 255 255 / 0.14);
  background: rgb(0 0 0 / 0.42);
  color: white;
  backdrop-filter: blur(14px);
}

.pin-mobile-rail {
  position: absolute;
  right: 0.55rem;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 8.25rem);
  z-index: 22;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.18rem;
  transition: opacity 0.2s ease;
}

.pin-mobile-avatar-wrap {
  position: relative;
  display: grid;
  place-items: center;
  margin-bottom: 0.2rem;
}

.pin-mobile-avatar-link {
  display: grid;
  min-height: 3rem;
  min-width: 3rem;
  place-items: center;
}

.pin-mobile-follow-badge {
  position: absolute;
  bottom: -1.08rem;
  left: 50%;
  z-index: 2;
  display: grid;
  height: 2.5rem;
  width: 2.5rem;
  transform: translateX(-50%) scale(1);
  place-items: center;
  border-radius: 999px;
  opacity: 1;
  transition: transform 0.28s cubic-bezier(0.18, 0.9, 0.22, 1.25), opacity 0.22s ease;
}

.pin-mobile-follow-badge::before {
  content: '';
  display: grid;
  height: 1.42rem;
  width: 1.42rem;
  place-items: center;
  border-radius: 999px;
  background: var(--pn-pink-strong);
  box-shadow: 0 8px 20px rgb(0 0 0 / 0.4);
}

.pin-mobile-follow-badge > span {
  position: absolute;
}

.pin-mobile-follow-badge--checking::before {
  background: #22c55e;
}

.pin-mobile-follow-badge--done {
  pointer-events: none;
  opacity: 0;
  transform: translateX(-50%) scale(0);
}

.pin-mobile-follow-badge--busy::before {
  background: var(--pn-pink-strong);
}

.pin-mobile-rail-btn {
  display: flex;
  min-width: 3.15rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.1rem;
  border-radius: 999px;
  color: white;
  text-shadow: 0 2px 12px rgb(0 0 0 / 0.7);
  transition: color 0.16s ease, transform 0.16s ease;
}

.pin-mobile-rail-btn--active {
  color: var(--pn-pink-strong);
}

.pin-mobile-rail-btn--active .pinova-icon {
  filter: drop-shadow(0 0 14px rgb(219 39 119 / 0.5));
}

.pin-mobile-rail-label {
  font-size: 0.68rem;
  font-weight: 900;
  line-height: 1;
  color: rgb(255 255 255 / 0.88);
  text-shadow: 0 2px 12px rgb(0 0 0 / 0.7);
}

.pin-mobile-caption {
  position: absolute;
  inset-inline: 0;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 1rem);
  z-index: 18;
  padding-inline: 1rem 4.4rem;
  transition: opacity 0.2s ease;
}

.pin-mobile-heart {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  color: var(--pn-pink-strong);
  text-shadow: 0 18px 50px rgb(0 0 0 / 0.55);
}

.pin-mobile-heart .pinova-icon {
  font-size: clamp(4.25rem, 24vw, 9rem);
  animation: pin-mobile-heart-pop 0.88s cubic-bezier(0.2, 0.88, 0.34, 1.02) forwards;
}

.pin-mobile-heart-particles {
  position: absolute;
  inset: 0;
}

.pin-mobile-heart-particle {
  position: absolute;
  left: calc(50% - 0.95rem);
  top: calc(50% - 0.95rem);
  color: var(--pn-pink-strong);
  font-size: 1.85rem !important;
  opacity: 0;
  animation: pin-mobile-heart-particle 1.05s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
}

.pin-mobile-heart-particle:nth-child(1) { --x: -88px; --y: -130px; --r: -24deg; animation-delay: 40ms; }
.pin-mobile-heart-particle:nth-child(2) { --x: 82px; --y: -128px; --r: 20deg; animation-delay: 65ms; }
.pin-mobile-heart-particle:nth-child(3) { --x: -122px; --y: -48px; --r: -38deg; animation-delay: 20ms; }
.pin-mobile-heart-particle:nth-child(4) { --x: 126px; --y: -42px; --r: 34deg; animation-delay: 85ms; }
.pin-mobile-heart-particle:nth-child(5) { --x: -72px; --y: -202px; --r: 12deg; animation-delay: 110ms; }
.pin-mobile-heart-particle:nth-child(6) { --x: 58px; --y: -210px; --r: -14deg; animation-delay: 130ms; }
.pin-mobile-heart-particle:nth-child(7) { --x: 8px; --y: -162px; --r: 8deg; animation-delay: 55ms; }

.pin-mobile-sheet {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  z-index: 50;
  max-height: 72svh;
  overflow: hidden;
  border-radius: 1.6rem 1.6rem 0 0;
  background: var(--surface-modal-bg);
  color: var(--card-text);
  padding: 0.85rem 1rem calc(env(safe-area-inset-bottom, 0px) + 1rem);
  box-shadow: var(--surface-modal-shadow);
  touch-action: pan-y;
}

.pin-mobile-sheet__lift {
  width: 100%;
}

.pin-mobile-load-more {
  color: var(--pn-pink-strong);
}

.pin-mobile-actions-sheet {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  z-index: 55;
  overflow: hidden;
  border-radius: 1.6rem 1.6rem 0 0;
  background: var(--surface-modal-bg);
  color: var(--card-text);
  padding: 0.85rem 1rem calc(env(safe-area-inset-bottom, 0px) + 1rem);
  box-shadow: var(--surface-modal-shadow);
}

.pin-mobile-action-row {
  display: flex;
  min-height: 3.25rem;
  width: 100%;
  align-items: center;
  gap: 0.85rem;
  border-radius: 1.15rem;
  padding: 0.65rem 0.8rem;
  color: var(--card-text);
  transition: background-color 0.16s ease, color 0.16s ease, transform 0.16s ease;
}

.pin-mobile-action-row:active {
  transform: scale(0.985);
  background: rgb(219 39 119 / 0.08);
}

.pin-mobile-action-row:disabled {
  opacity: 0.55;
}

.pin-mobile-action-row--active {
  color: var(--pn-pink-strong);
}

.pin-mobile-action-icon {
  display: grid;
  height: 2.35rem;
  width: 2.35rem;
  place-items: center;
  border-radius: 999px;
  background: rgb(219 39 119 / 0.14);
  color: var(--pn-pink-strong);
  flex: 0 0 auto;
}

.pin-mobile-action-icon--boost {
  background: rgb(245 158 11 / 0.18);
  color: #d97706;
}

:global(.dark) .pin-mobile-sheet {
  background: var(--surface-modal-bg);
  color: var(--card-text);
  border-top: 1px solid var(--surface-modal-border);
}

:global(.dark) .pin-mobile-sheet :deep(.text-neutral-950),
:global(.dark) .pin-mobile-sheet :deep(.text-neutral-900),
:global(.dark) .pin-mobile-sheet :deep(.text-neutral-800),
:global(.dark) .pin-mobile-sheet :deep(.text-neutral-700),
:global(.dark) .pin-mobile-sheet :deep(.text-neutral-600) {
  color: #f5f5f5;
}

:global(.dark) .pin-mobile-sheet :deep(.bg-white),
:global(.dark) .pin-mobile-sheet :deep(.bg-neutral-50),
:global(.dark) .pin-mobile-sheet :deep(.bg-neutral-100) {
  background-color: rgb(38 38 38);
}

:global(.dark) .pin-mobile-sheet :deep(.border-neutral-100),
:global(.dark) .pin-mobile-sheet :deep(.border-neutral-200) {
  border-color: rgb(64 64 64);
}

.pin-mobile-slide-next-enter-active,
.pin-mobile-slide-next-leave-active,
.pin-mobile-slide-prev-enter-active,
.pin-mobile-slide-prev-leave-active {
  transition: transform 0.34s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.34s ease;
  will-change: transform;
}

.pin-mobile-slide-next-enter-from {
  transform: translateX(100%);
}

.pin-mobile-slide-next-leave-to {
  transform: translateX(-100%);
}

.pin-mobile-slide-prev-enter-from {
  transform: translateX(-100%);
}

.pin-mobile-slide-prev-leave-to {
  transform: translateX(100%);
}

.pin-mobile-sheet-enter-active,
.pin-mobile-sheet-leave-active {
  transition:
    transform 0.3s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.26s ease;
}

.pin-mobile-sheet-enter-from,
.pin-mobile-sheet-leave-to {
  opacity: 0;
  transform: translate3d(0, 100%, 0);
}

@media (min-width: 1024px) {
  .pin-mobile {
    display: grid;
    place-items: center;
    padding: 2rem;
    background: rgb(0 0 0 / 0.62);
    backdrop-filter: blur(18px);
    touch-action: auto;
  }

  .pin-mobile-surface {
    position: relative;
    inset: auto;
    width: min(92vw, 1120px);
    height: min(88vh, 760px);
    overflow: hidden;
    border: 1px solid rgb(255 255 255 / 0.12);
    border-radius: 1.9rem;
    box-shadow: 0 32px 90px rgb(0 0 0 / 0.42);
  }

  .pin-mobile-media {
    max-width: min(92vw, 1120px);
    max-height: min(88vh, 760px);
  }

  .pin-mobile-rail {
    right: max(2rem, calc((100vw - min(92vw, 1120px)) / 2 + 1.25rem));
    bottom: max(3rem, calc((100vh - min(88vh, 760px)) / 2 + 1.5rem));
  }

  .pin-mobile-caption {
    inset-inline: auto;
    left: max(2rem, calc((100vw - min(92vw, 1120px)) / 2 + 1.5rem));
    bottom: max(3rem, calc((100vh - min(88vh, 760px)) / 2 + 1.5rem));
    width: min(56vw, 680px);
    padding: 0 4.5rem 0 0;
  }

  .pin-mobile-caption :is(h1, p, a, div),
  .pin-mobile-caption .max-w-\[calc\(100\%-3rem\)\] {
    max-width: 100%;
  }

  .pin-mobile-sheet,
  .pin-mobile-actions-sheet {
    inset-inline: auto;
    left: 50%;
    width: min(520px, calc(100vw - 2rem));
    border-radius: 1.6rem;
    transform: translate3d(-50%, 0, 0);
  }

  /* Conserver le centrage horizontal pendant les transitions Vue (sinon saut latéral à la fermeture). */
  .pin-mobile-sheet-enter-from,
  .pin-mobile-sheet-leave-to {
    transform: translate3d(-50%, 100%, 0);
  }
}

@keyframes pin-mobile-open-from-card {
  0% {
    opacity: 0.92;
    border-radius: var(--pin-open-radius, 1.5rem);
    transform: translate3d(var(--pin-open-left, 0), var(--pin-open-top, 0), 0)
      scale(var(--pin-open-scale-x, 0.2), var(--pin-open-scale-y, 0.2));
  }
  72% {
    opacity: 1;
    border-radius: 0.55rem;
  }
  100% {
    opacity: 1;
    border-radius: 0;
    transform: translate3d(0, 0, 0) scale(1);
  }
}

@keyframes pin-mobile-heart-pop {
  0% {
    opacity: 0;
    transform: scale(0.28);
    filter: blur(4px);
  }
  22% {
    opacity: 1;
    transform: scale(1.14);
    filter: blur(0);
  }
  48% {
    transform: scale(0.9);
  }
  74% {
    opacity: 1;
    transform: scale(1.06);
  }
  100% {
    opacity: 0;
    transform: scale(1.22);
    filter: blur(1px);
  }
}

@keyframes pin-mobile-heart-particle {
  0% {
    opacity: 0;
    transform: translate3d(0, 0, 0) scale(0.35) rotate(0deg);
  }
  16% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate3d(var(--x), var(--y), 0) scale(1.08) rotate(var(--r));
  }
}
</style>
