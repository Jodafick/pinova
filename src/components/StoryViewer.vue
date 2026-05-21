<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import type { Pin } from '../types'
import { usePins, isAlreadyReportedError } from '../composables/usePins'
import { useAuth, DEFAULT_AVATAR_COLOR_CLASS } from '../composables/useAuth'
import { useI18n } from '../i18n'
import { useAppModal } from '../composables/useAppModal'
import PinSensitiveMedia from './PinSensitiveMedia.vue'
import PinovaModal from './ui/PinovaModal.vue'
import StorySegmentedProgressBar from './StorySegmentedProgressBar.vue'
import StoryLikersModal from './StoryLikersModal.vue'
import ReportContentModal from './ReportContentModal.vue'
import { viewerCanRevealSensitiveMedia, sensitiveMediaBlurredByDefault } from '../composables/useModeration'
import {
  PIN_MEDIA_ANTI_LEAK_CLASS,
  pinMediaAntiLeakImgBindings,
  pinMediaAntiLeakVideoBindings,
} from '../composables/mediaAntiLeak'
import { avatarBgStyle, avatarBgTailwindClass } from '../utils/avatarBackground'

const props = defineProps<{
  modelValue: boolean
  pins: Pin[]
  initialIndex?: number
  /** Ms déjà écoulées sur `initialIndex` (reprise après fermeture du viewer). */
  initialSegmentElapsedMs?: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (
    e: 'session-end',
    payload: {
      username: string
      pinSlugs: string[]
      resumeIndex: number
      allCaughtUp: boolean
      segmentElapsedMs: number
    },
  ): void
}>()

/** Fermeture après le dernier segment (lecture terminée) vs fermeture manuelle. */
const closingSessionReason = ref<'completed_all' | null>(null)

const router = useRouter()
const { toggleLike, reportPin, trackPinView } = usePins()
const { isAuthenticated, currentUser } = useAuth()
const { t } = useI18n()
const { showAlert } = useAppModal()

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

/** Durée image par défaut ; vidéo = métadonnées (bornée). */
const DEFAULT_IMAGE_MS = 8000
const MIN_VIDEO_MS = 3000
const MAX_VIDEO_MS = 120_000
const VIDEO_LOAD_FALLBACK_MS = 90_000

function clampIncomingResumeMs(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0
  return Math.min(Math.max(0, Math.round(v)), MAX_VIDEO_MS)
}

function clampResumeAgainstFull(resume: number, full: number): number {
  if (!Number.isFinite(resume) || resume <= 0) return 0
  if (!Number.isFinite(full) || full <= 0) return 0
  return Math.min(resume, Math.max(0, full - 80))
}

const index = ref(0)
const heartBurst = ref(false)
const heartBurstKey = ref(0)
let heartBurstHideTimer: ReturnType<typeof setTimeout> | null = null
const expandedDesc = ref(false)
const storyLikersOpen = ref(false)
const reportStoryOpen = ref(false)
/** Feuille Partager / Signaler — même principe que l’appui long sur la fiche pin mobile. */
const storyActionsOpen = ref(false)
/** État like / reactions — props.story ≠ store `pins`; toggleLike ne met pas à jour le viewer. */
const storyLikedBySlug = ref<Record<string, boolean>>({})
const storyReactionsBySlug = ref<Record<string, number>>({})
/** Recrée l’animation CSS de la barre du segment courant à chaque story. */
const progressAnimKey = ref(0)
/** Durée « pleine » du segment courant (ms) — bornes vidéo, pour cap à la fermeture. */
const slideDurationMs = ref(DEFAULT_IMAGE_MS)
/** Durée restante animée sur la barre (peut être < slideDurationMs si reprise). */
const activeProgressDurationForBar = ref(DEFAULT_IMAGE_MS)
/** Remplissage initial du segment actif [0..1] (reprise). */
const progressStartFraction = ref(0)
/** Tant que le média n’est pas prêt, pas de compte à rebours (évite PWA / onglets lents). */
const segmentMediaPending = ref(true)

/** Brings one-shot resume ms from the parent open, consommée au prochain segment. */
const pendingOpenResumeElapsed = ref(0)
/** Offset ms déjà parcouru sur le segment courant (reprise). */
const segmentOpenedWithResumeMs = ref(0)
/** Horodatage (wall) du début du timer auto-suivant sur le segment courant. */
let segmentTimerAnchorAt: number | null = null

const storyVideoEl = ref<HTMLVideoElement | null>(null)
/** Autoplay : départ en muted (politiques navigateurs) ; clic sur le bouton active le son jusqu’à fermeture du viewer. */
const storySoundOn = ref(false)
const playbackPaused = computed(() =>
  storyActionsOpen.value || storyLikersOpen.value || reportStoryOpen.value,
)

/** Fermeture par swipe bas — aligné `PinDetailMobileFullscreen`. */
const surfaceDragY = ref(0)
const surfacePointerActive = ref(false)
const gestureStart = ref<{ x: number; y: number; at: number } | null>(null)
const gestureIntent = ref<'none' | 'vertical' | 'horizontal'>('none')
const isExitClosing = ref(false)
let exitCloseTimer: ReturnType<typeof setTimeout> | null = null
const EXIT_CLOSE_ANIM_MS = 360
let longPressTimer: ReturnType<typeof setTimeout> | null = null
let longPressTriggered = false
const storyRootRef = ref<HTMLElement | null>(null)
let detachStoryTouchGestures: (() => void) | null = null

/** Double tap cœur (zone centrale) — coordonnées écran. */
let lastTap = 0
let lastTapX = 0
let lastTapY = 0

function clearExitCloseTimer() {
  if (exitCloseTimer) {
    clearTimeout(exitCloseTimer)
    exitCloseTimer = null
  }
}

function startDismissClose() {
  if (isExitClosing.value) return
  clearLongPressTimer()
  gestureIntent.value = 'none'
  gestureStart.value = null
  isExitClosing.value = true
  resetSurfaceGesture()
  clearExitCloseTimer()
  exitCloseTimer = window.setTimeout(() => {
    exitCloseTimer = null
    close()
  }, EXIT_CLOSE_ANIM_MS)
}

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

function clearLongPressTimer() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function resetSurfaceGesture() {
  gestureIntent.value = 'none'
  surfaceDragY.value = 0
}

function gestureTargetIgnored(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el?.closest) return false
  return !!el.closest(
    'button, a[href], input, textarea, select, [data-story-gesture-ignore]',
  )
}

function beginGesture(x: number, y: number) {
  if (isExitClosing.value) return
  if (storyActionsOpen.value || storyLikersOpen.value || reportStoryOpen.value) return
  surfacePointerActive.value = true
  gestureStart.value = { x, y, at: Date.now() }
  gestureIntent.value = 'none'
  surfaceDragY.value = 0
  longPressTriggered = false
  clearLongPressTimer()
  longPressTimer = window.setTimeout(() => {
    const start = gestureStart.value
    if (!start || gestureIntent.value !== 'none') return
    longPressTriggered = true
    gestureStart.value = null
    clearLongPressTimer()
    storyActionsOpen.value = true
  }, 420)
}

function moveGesture(x: number, y: number) {
  if (isExitClosing.value) return
  if (storyActionsOpen.value || storyLikersOpen.value || reportStoryOpen.value) return
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
  }
}

function endGesture(x: number, y: number) {
  try {
    if (isExitClosing.value) return
    const start = gestureStart.value
    gestureStart.value = null
    if (storyActionsOpen.value || storyLikersOpen.value || reportStoryOpen.value) {
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
      if (dy > 0) {
        gestureIntent.value = 'none'
        startDismissClose()
        return
      }
      resetSurfaceGesture()
      return
    }

    if (absX > 58 && absX > absY * 1.12) {
      resetSurfaceGesture()
      if (dx < 0) goNext()
      else goPrev()
      return
    }

    resetSurfaceGesture()

    if (absX > 12 || absY > 12 || elapsed > 420) return

    const vw = typeof window !== 'undefined' ? window.innerWidth : 1
    const fx = x / Math.max(1, vw)
    if (fx < 0.28) {
      goPrev()
      return
    }
    if (fx > 0.72) {
      goNext()
      return
    }

    const pin = current.value
    if (!pin || !isAuthenticated.value) return
    if (isOwnerViewingStory.value) return
    const now = Date.now()
    if (
      now - lastTap < 340 &&
      Math.abs(x - lastTapX) < 34 &&
      Math.abs(y - lastTapY) < 34
    ) {
      lastTap = 0
      const slug = pin.slug
      const likedStored = storyLikedBySlug.value[slug]
      const alreadyLiked =
        typeof likedStored === 'boolean' ? likedStored : !!pin.liked
      if (alreadyLiked) return
      void doLike()
      return
    }
    lastTap = now
    lastTapX = x
    lastTapY = y
  } finally {
    surfacePointerActive.value = false
  }
}

function onSurfacePointerCancel() {
  surfacePointerActive.value = false
  clearLongPressTimer()
  longPressTriggered = false
  gestureStart.value = null
  resetSurfaceGesture()
}

function attachStoryTouchGestures() {
  detachStoryTouchGestures?.()
  detachStoryTouchGestures = null
  const el = storyRootRef.value
  if (!el || typeof window === 'undefined') return
  const cap = { capture: true }
  const onStart = (e: TouchEvent) => {
    if (gestureTargetIgnored(e.target)) return
    const touch = e.changedTouches[0]
    if (!touch) return
    beginGesture(touch.clientX, touch.clientY)
  }
  const onMove = (e: TouchEvent) => {
    if (!gestureStart.value && !surfacePointerActive.value) return
    const touch = e.changedTouches[0]
    if (!touch) return
    moveGesture(touch.clientX, touch.clientY)
    if (gestureIntent.value === 'vertical') e.preventDefault()
  }
  const onEnd = (e: TouchEvent) => {
    const touch = e.changedTouches[0]
    if (!touch) return
    endGesture(touch.clientX, touch.clientY)
  }
  const onCancel = () => {
    onSurfacePointerCancel()
  }
  el.addEventListener('touchstart', onStart, cap)
  el.addEventListener('touchmove', onMove, { capture: true, passive: false })
  el.addEventListener('touchend', onEnd, cap)
  el.addEventListener('touchcancel', onCancel, cap)
  detachStoryTouchGestures = () => {
    el.removeEventListener('touchstart', onStart, cap)
    el.removeEventListener('touchmove', onMove, { capture: true } as AddEventListenerOptions)
    el.removeEventListener('touchend', onEnd, cap)
    el.removeEventListener('touchcancel', onCancel, cap)
    detachStoryTouchGestures = null
  }
}

function onRootPointerDown(e: PointerEvent) {
  if (e.pointerType === 'touch') return
  if (gestureTargetIgnored(e.target)) return
  ;(e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId)
  beginGesture(e.clientX, e.clientY)
}

function onRootPointerMove(e: PointerEvent) {
  if (e.pointerType === 'touch') return
  moveGesture(e.clientX, e.clientY)
}

function onRootPointerUp(e: PointerEvent) {
  if (e.pointerType === 'touch') return
  endGesture(e.clientX, e.clientY)
}

function onRootPointerCancel(e: PointerEvent) {
  if (e.pointerType === 'touch') return
  onSurfacePointerCancel()
}

function syncStoryVideoMute(el?: HTMLVideoElement | null) {
  const v = el ?? storyVideoEl.value
  if (!v) return
  v.muted = !storySoundOn.value
}

function toggleStorySound() {
  storySoundOn.value = !storySoundOn.value
  syncStoryVideoMute()
  void storyVideoEl.value?.play()?.catch(() => {})
}

let advanceTimer: ReturnType<typeof setTimeout> | null = null
let videoSafetyTimer: ReturnType<typeof setTimeout> | null = null
/** Incrémenté à chaque segment pour ignorer timeouts / événements obsolètes */
const segmentPlaybackId = ref(0)

function bumpProgressAnimation() {
  progressAnimKey.value++
}

function clearVideoSafetyTimer() {
  if (videoSafetyTimer) {
    clearTimeout(videoSafetyTimer)
    videoSafetyTimer = null
  }
}

function clearAdvance() {
  if (advanceTimer) {
    clearTimeout(advanceTimer)
    advanceTimer = null
  }
  segmentTimerAnchorAt = null
}

function primeSegmentCountdown(fullMs: number, slackMs: number) {
  clearAdvance()
  if (!props.modelValue || props.pins.length === 0) return
  const resume = clampResumeAgainstFull(segmentOpenedWithResumeMs.value, fullMs)
  const remaining = Math.max(220, fullMs - resume + slackMs)
  slideDurationMs.value = fullMs
  activeProgressDurationForBar.value = remaining
  progressStartFraction.value = fullMs > 0 ? resume / fullMs : 0
  segmentMediaPending.value = false
  bumpProgressAnimation()
  const playbackId = segmentPlaybackId.value
  segmentTimerAnchorAt = Date.now()
  advanceTimer = setTimeout(() => {
    advanceTimer = null
    segmentTimerAnchorAt = null
    if (playbackId !== segmentPlaybackId.value) return
    goNext()
  }, remaining)
}

function startVideoMetadataSafetyTimer() {
  clearVideoSafetyTimer()
  const playbackId = segmentPlaybackId.value
  videoSafetyTimer = window.setTimeout(() => {
    videoSafetyTimer = null
    if (playbackId !== segmentPlaybackId.value) return
    if (!props.modelValue) return
    clearAdvance()
    slideDurationMs.value = DEFAULT_IMAGE_MS
    primeSegmentCountdown(DEFAULT_IMAGE_MS, 600)
  }, VIDEO_LOAD_FALLBACK_MS)
}

function pauseStoryVideo() {
  storyVideoEl.value?.pause()
}

function resumeStoryVideo() {
  void storyVideoEl.value?.play()?.catch(() => {})
}

function restartCurrentSegment() {
  expandedDesc.value = false
  segmentPlaybackId.value++
  clearAdvance()
  clearVideoSafetyTimer()
  segmentMediaPending.value = true
  progressStartFraction.value = 0
  activeProgressDurationForBar.value = DEFAULT_IMAGE_MS
  slideDurationMs.value = DEFAULT_IMAGE_MS
  bumpProgressAnimation()

  const pin = props.pins[index.value]
  if (!pin || !props.modelValue) return

  const resumeMs = pendingOpenResumeElapsed.value
  pendingOpenResumeElapsed.value = 0
  segmentOpenedWithResumeMs.value = resumeMs

  if (pin.storyVideoUrl?.trim()) {
    startVideoMetadataSafetyTimer()
    return
  }

  if (pin.imageUrl?.trim()) {
    void nextTick(() => {
      if (!props.modelValue) return
      const pin2 = props.pins[index.value]
      if (!pin2?.imageUrl?.trim() || pin2.storyVideoUrl?.trim()) return
      const root = storyRootRef.value
      const el = root?.querySelector?.(
        '[data-story-slide-img]',
      ) as HTMLImageElement | undefined | null
      if (el && el.complete && el.naturalWidth > 0) {
        void finalizeStoryImageFromEl(el)
      }
    })
    return
  }

  const full = DEFAULT_IMAGE_MS
  const slackMs = Math.min(400, Math.max(120, Math.round(full * 0.04)))
  primeSegmentCountdown(full, slackMs)
}

function syncStoryEngagementFromProps() {
  const liked: Record<string, boolean> = {}
  const reactions: Record<string, number> = {}
  for (const p of props.pins) {
    liked[p.slug] = !!p.liked
    reactions[p.slug] = p.stats?.reactions ?? 0
  }
  storyLikedBySlug.value = liked
  storyReactionsBySlug.value = reactions
}

function computeSegmentElapsedForEmit(): number {
  const full = slideDurationMs.value
  const resume = segmentOpenedWithResumeMs.value
  if (!Number.isFinite(full) || full <= 0) {
    return Math.max(0, resume)
  }
  const cap = Math.max(0, full - 1)
  if (segmentTimerAnchorAt == null) {
    return Math.min(cap, Math.max(0, resume))
  }
  const raw = resume + (Date.now() - segmentTimerAnchorAt)
  return Math.min(Math.max(0, raw), cap)
}

watch(
  () => props.modelValue,
  async (open, prevOpen) => {
    if (open && props.pins.length > 0) {
      closingSessionReason.value = null
      storySoundOn.value = false
      isExitClosing.value = false
      resetSurfaceGesture()
      surfacePointerActive.value = false
      syncStoryEngagementFromProps()
      pendingOpenResumeElapsed.value = clampIncomingResumeMs(props.initialSegmentElapsedMs)
      const maxIdx = props.pins.length - 1
      index.value = Math.min(Math.max(0, props.initialIndex ?? 0), maxIdx)
      // Force le redémarrage du segment même si l'index n'a pas changé (cas 0 -> 0)
      restartCurrentSegment()
      await nextTick()
      attachStoryTouchGestures()
    } else {
      clearAdvance()
      clearVideoSafetyTimer()
      detachStoryTouchGestures?.()
    }
    if (prevOpen && !open && props.pins.length > 0) {
      const username = props.pins[0]?.username?.trim() ?? ''
      if (username) {
        const pinSlugs = props.pins.map((p) => p.slug)
        const allCaughtUp = closingSessionReason.value === 'completed_all'
        emit('session-end', {
          username,
          pinSlugs,
          resumeIndex: allCaughtUp ? 0 : index.value,
          allCaughtUp,
          segmentElapsedMs: allCaughtUp ? 0 : computeSegmentElapsedForEmit(),
        })
      }
      closingSessionReason.value = null
    }
  },
)

watch(
  () => props.modelValue && props.pins.length,
  () => {
    if (props.modelValue && props.pins.length > 0) syncStoryEngagementFromProps()
  },
)

watch(
  () => props.initialIndex,
  (v) => {
    if (!props.modelValue || props.pins.length === 0) return
    index.value = Math.min(Math.max(0, v ?? 0), props.pins.length - 1)
    restartCurrentSegment()
  },
)

/*
 * `deep: true` faisait recalculer à chaque mutation profonde du tableau (likes,
 * reactions, etc.) → cycles de re-render lourds qui finissaient par geler le
 * modal sur certains appareils. On surveille maintenant seulement les
 * signaux qui changent vraiment l'engagement à synchroniser (longueur + slug
 * du pin courant), ce qui suffit pour le cas usage réel.
 */
watch(
  [
    () => props.modelValue,
    () => props.pins.length,
    () => props.pins[index.value]?.slug ?? '',
  ],
  () => {
    if (props.modelValue && props.pins.length > 0) syncStoryEngagementFromProps()
  },
)

watch(index, () => {
  if (props.modelValue) restartCurrentSegment()
})

watch(storyLikersOpen, (open) => {
  if (!props.modelValue || props.pins.length === 0) return
  if (open) clearAdvance()
  else restartCurrentSegment()
})

watch(storyActionsOpen, (open) => {
  if (!props.modelValue || props.pins.length === 0) return
  if (open) clearAdvance()
  else restartCurrentSegment()
})

watch(playbackPaused, (paused) => {
  if (!props.modelValue || props.pins.length === 0) return
  if (paused) {
    clearAdvance()
    pauseStoryVideo()
    return
  }
  resumeStoryVideo()
  restartCurrentSegment()
})

const current = computed(() => props.pins[index.value])

watch(
  () => current.value?.slug,
  () => {
    void nextTick(() => syncStoryVideoMute())
  },
)

/** Enregistrement vues (PinViewEvent) — aligné fiche pin / mobile. */
watch(
  () =>
    props.modelValue && current.value?.slug && isAuthenticated.value
      ? `${current.value.slug}`
      : '',
  (slug) => {
    if (slug) void trackPinView(slug)
  },
)

const currentStoryLiked = computed(() => {
  const p = current.value
  if (!p) return false
  const v = storyLikedBySlug.value[p.slug]
  return typeof v === 'boolean' ? v : !!p.liked
})

const currentStoryReactions = computed(() => {
  const p = current.value
  if (!p) return 0
  const v = storyReactionsBySlug.value[p.slug]
  return typeof v === 'number' ? v : (p.stats?.reactions ?? 0)
})

const rawDescription = computed(() => (current.value?.description || '').trim())

const descriptionNeedsExpand = computed(() => rawDescription.value.length > 220)

const descriptionDisplay = computed(() => {
  const d = rawDescription.value
  if (!d) return ''
  if (!descriptionNeedsExpand.value || expandedDesc.value) return d
  const slice = d.slice(0, 220).trimEnd()
  return slice.length < d.length ? `${slice}…` : d
})

const storyAuthorInitials = computed(() => {
  const pin = current.value
  if (!pin?.user?.trim()) return '?'
  const parts = pin.user.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const first = parts[0] ?? ''
    const last = parts[parts.length - 1] ?? ''
    const a = first[0] || ''
    const b = last[0] || ''
    return (a + b).toUpperCase()
  }
  return pin.user.trim().slice(0, 2).toUpperCase()
})

const storyAuthorAvatarTw = computed(() => {
  const p = current.value
  if (!p) return DEFAULT_AVATAR_COLOR_CLASS
  if (p.userAvatarUrl?.trim()) return 'bg-neutral-900'
  return avatarBgTailwindClass(p.userAvatarColor, DEFAULT_AVATAR_COLOR_CLASS)
})

const storyAuthorAvatarStyle = computed(() => {
  const p = current.value
  if (!p) return {}
  if (p.userAvatarUrl?.trim()) return {}
  return avatarBgStyle(p.userAvatarColor ?? null)
})

/** Stories : uniquement le propriétaire voit le compteur (liste des j’aime au clic). */
const isOwnerViewingStory = computed(() => {
  const pin = current.value
  const u = currentUser.value?.username
  if (!pin || !u) return false
  return pin.username.trim().toLowerCase() === u.trim().toLowerCase()
})

function openStoryLikersModal() {
  if (!isOwnerViewingStory.value || !current.value?.slug) return
  storyLikersOpen.value = true
}

async function handleReportStory() {
  const pin = current.value
  if (!pin) return
  if (!isAuthenticated.value) {
    router.push('/login')
    return
  }
  if (currentUser.value && pin.username === currentUser.value.username) {
    await showAlert(t('moderation.reportOwnDisabled'), { variant: 'info' })
    return
  }
  reportStoryOpen.value = true
}

async function handleShareStory() {
  const slug = current.value?.slug?.trim()
  if (!slug) return
  const url = `${window.location.origin}/pin/${encodeURIComponent(slug)}`
  const shareData = {
    title: (current.value?.title || 'Pinova').trim() || 'Pinova',
    text: `@${current.value?.username ?? ''}`.trim(),
    url,
  }
  try {
    if (navigator.share) {
      await navigator.share(shareData)
      return
    }
  } catch {
    /* ignore and fallback */
  }
  try {
    await navigator.clipboard.writeText(url)
    await showAlert(t('pin.share.copied'), { variant: 'success' })
  } catch {
    await showAlert(`${t('pin.share.manualBody')}\n\n${url}`, { variant: 'info', title: t('pin.share.manualTitle') })
  }
}

async function handleSubmitStoryReport(payload: { category: string; details: string }) {
  const pin = current.value
  if (!pin) return
  try {
    await reportPin(pin.slug, payload)
    reportStoryOpen.value = false
    await showAlert(t('moderation.reportSent'), { variant: 'success' })
  } catch (e) {
    if (isAlreadyReportedError(e)) {
      reportStoryOpen.value = false
      await showAlert(t('moderation.reportAlready'), { variant: 'info' })
    } else {
      await showAlert(t('moderation.reportError'), { variant: 'danger', title: t('modal.errorTitle') })
    }
  }
}

function closeActionsAndShare() {
  storyActionsOpen.value = false
  void handleShareStory()
}

function closeActionsAndReport() {
  storyActionsOpen.value = false
  void handleReportStory()
}

function close() {
  clearAdvance()
  clearVideoSafetyTimer()
  clearExitCloseTimer()
  storyActionsOpen.value = false
  isExitClosing.value = false
  resetSurfaceGesture()
  surfacePointerActive.value = false
  gestureStart.value = null
  detachStoryTouchGestures?.()
  emit('update:modelValue', false)
}

function goNext() {
  clearAdvance()
  clearVideoSafetyTimer()
  if (index.value < props.pins.length - 1) {
    index.value++
    return
  }
  closingSessionReason.value = 'completed_all'
  close()
}

function goPrev() {
  clearAdvance()
  clearVideoSafetyTimer()
  if (index.value > 0) {
    index.value--
  }
}

function onStoryVideoLoadedMetadata(e: Event) {
  clearVideoSafetyTimer()
  const v = e.target as HTMLVideoElement
  let ms = Math.round(v.duration * 1000)
  if (!Number.isFinite(ms) || ms <= 0) ms = DEFAULT_IMAGE_MS
  ms = Math.min(Math.max(ms, MIN_VIDEO_MS), MAX_VIDEO_MS)
  const slackMs = Math.min(800, Math.max(220, Math.round(ms * 0.06)))
  primeSegmentCountdown(ms, slackMs)
  syncStoryVideoMute(v)
  void v.play()?.catch(() => {})
}

async function finalizeStoryImageFromEl(img: HTMLImageElement) {
  if (!props.modelValue) return
  const pin = props.pins[index.value]
  if (!pin || pin.storyVideoUrl?.trim()) return
  try {
    await img.decode?.()
  } catch {
    /* decode() est optionnel ; @load suffit */
  }
  if (!props.modelValue) return
  const full = DEFAULT_IMAGE_MS
  const slackMs = Math.min(400, Math.max(120, Math.round(full * 0.04)))
  primeSegmentCountdown(full, slackMs)
}

async function onStoryImageLoaded(e: Event) {
  await finalizeStoryImageFromEl(e.target as HTMLImageElement)
}

function onStoryImageError() {
  if (!props.modelValue) return
  clearVideoSafetyTimer()
  segmentMediaPending.value = false
  goNext()
}

function onStoryVideoError() {
  clearVideoSafetyTimer()
  if (!props.modelValue) return
  segmentMediaPending.value = false
  goNext()
}

/** Fin lecture vidéo : prioritaire sur le timer avec marge. */
function onStoryVideoEnded() {
  const pin = props.pins[index.value]
  if (!pin?.storyVideoUrl?.trim()) return
  clearVideoSafetyTimer()
  clearAdvance()
  goNext()
}

async function doLike() {
  const pin = current.value
  if (!pin || !isAuthenticated.value) {
    router.push('/login')
    return
  }
  if (isOwnerViewingStory.value) return
  heartBurstKey.value += 1
  heartBurst.value = true
  if (heartBurstHideTimer) clearTimeout(heartBurstHideTimer)
  heartBurstHideTimer = window.setTimeout(() => {
    heartBurst.value = false
    heartBurstHideTimer = null
  }, 980)

  const slug = pin.slug
  const prevLikedStored = storyLikedBySlug.value[slug]
  const prevLiked =
    typeof prevLikedStored === 'boolean' ? prevLikedStored : !!pin.liked
  const prevCount =
    slug in storyReactionsBySlug.value
      ? storyReactionsBySlug.value[slug]!
      : (pin.stats?.reactions ?? 0)
  const nextLiked = !prevLiked
  storyLikedBySlug.value = { ...storyLikedBySlug.value, [slug]: nextLiked }
  storyReactionsBySlug.value = {
    ...storyReactionsBySlug.value,
    [slug]: Math.max(0, prevCount + (nextLiked ? 1 : -1)),
  }

  try {
    const data = await toggleLike(slug) as {
      status?: string
      likes_count?: number
    }
    storyLikedBySlug.value = {
      ...storyLikedBySlug.value,
      [slug]: data.status === 'liked',
    }
    if (typeof data.likes_count === 'number') {
      storyReactionsBySlug.value = {
        ...storyReactionsBySlug.value,
        [slug]: data.likes_count,
      }
    }
  } catch {
    heartBurst.value = false
    if (heartBurstHideTimer) {
      clearTimeout(heartBurstHideTimer)
      heartBurstHideTimer = null
    }
    storyLikedBySlug.value = { ...storyLikedBySlug.value, [slug]: prevLiked }
    storyReactionsBySlug.value = {
      ...storyReactionsBySlug.value,
      [slug]: prevCount,
    }
  }
}

function openAuthorProfile() {
  const u = current.value?.username
  if (!u) return
  close()
  router.push(`/profile/${encodeURIComponent(u)}`)
}

function openPinPage() {
  const slug = current.value?.slug
  if (!slug) return
  close()
  router.push(`/pin/${slug}`)
}

function onKeydown(e: KeyboardEvent) {
  if (!props.modelValue) return
  if (e.key === 'Escape') {
    if (storyActionsOpen.value) {
      storyActionsOpen.value = false
      return
    }
    if (reportStoryOpen.value) {
      reportStoryOpen.value = false
      return
    }
    if (storyLikersOpen.value) {
      storyLikersOpen.value = false
      return
    }
    close()
  } else if (e.key === 'ArrowRight') goNext()
  else if (e.key === 'ArrowLeft') goPrev()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  if (heartBurstHideTimer) {
    clearTimeout(heartBurstHideTimer)
    heartBurstHideTimer = null
  }
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
  clearAdvance()
  clearVideoSafetyTimer()
  clearExitCloseTimer()
  detachStoryTouchGestures?.()
  /* Reset des états module-level qui survivaient au démontage (cas re-monté
     immédiat après fermeture → ancres temporelles stales). */
  segmentTimerAnchorAt = null
  longPressTriggered = false
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue && pins.length > 0"
      ref="storyRootRef"
      class="story-viewer-root fixed inset-0 z-[100] flex flex-col overflow-hidden bg-transparent touch-none select-none"
      :class="{ 'story-viewer--exit-closing': isExitClosing }"
      role="dialog"
      aria-modal="true"
    >
      <div
        class="story-scrim pointer-events-none absolute inset-0 z-0 bg-neutral-950"
        :style="scrimOverlayStyle"
        aria-hidden="true"
      />
      <div
        class="story-surface relative z-[1] flex min-h-0 flex-1 flex-col bg-transparent"
        :class="{ 'story-surface--exit-dismiss': isExitClosing }"
        :style="surfaceStyle"
        @pointerdown="onRootPointerDown"
        @pointermove="onRootPointerMove"
        @pointerup="onRootPointerUp"
        @pointercancel="onRootPointerCancel"
      >
        <!-- Progress + auteur -->
        <div class="shrink-0 z-50 px-2 pt-safe pt-3 space-y-2">
          <StorySegmentedProgressBar
            :segment-count="pins.length"
            :current-index="index"
            :active-duration-ms="activeProgressDurationForBar"
            :active-fill-start-fraction="progressStartFraction"
            :animation-key="progressAnimKey"
            :paused="playbackPaused || segmentMediaPending"
          />
          <div class="flex justify-center px-2 pb-1">
            <button
              type="button"
              class="flex max-w-[min(100%,320px)] cursor-pointer items-center gap-2.5 rounded-full px-2 py-1 pr-3 transition hover:bg-white/10 pointer-events-auto"
              @click.stop="openAuthorProfile"
            >
              <span
                class="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-white shadow-md ring-2 ring-white/35"
                :class="storyAuthorAvatarTw"
                :style="storyAuthorAvatarStyle"
              >
                <img
                  v-if="current?.userAvatarUrl"
                  :src="current.userAvatarUrl"
                  alt=""
                  class="h-full w-full object-cover"
                  draggable="false"
                />
                <span v-else class="text-[11px] font-bold leading-none text-white">{{ storyAuthorInitials }}</span>
              </span>
              <span class="truncate text-left text-sm font-semibold text-white drop-shadow-md">
                {{ current?.user }}
              </span>
            </button>
          </div>
        </div>

        <div class="absolute top-safe right-3 z-50 flex flex-col items-end gap-2 pt-safe">
          <button
            v-if="current?.storyVideoUrl"
            type="button"
            class="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white backdrop-blur-md hover:bg-black/55"
            :title="storySoundOn ? t('story.sound.mute') : t('story.sound.unmute')"
            @click.stop="toggleStorySound"
          >
            <span class="material-symbols-outlined text-[22px]">{{ storySoundOn ? 'volume_up' : 'volume_off' }}</span>
          </button>
        </div>

        <div class="relative flex min-h-0 flex-1 flex-col">
          <!--
            Padding symétrique : auparavant `pt-14 pb-28` poussait l'image
            visuellement vers le bas de l'écran. On utilise maintenant la même
            valeur haut/bas (assez pour que le titre auteur en haut et le
            bouton « voir le pin » en bas ne se superposent pas trop, mais sans
            décentrer l'image par rapport au viewport).
          -->
          <div class="relative flex flex-1 items-center justify-center px-3 py-16 sm:px-8">
            <div class="absolute inset-0 z-[15] flex pointer-events-none">
              <button
                type="button"
                class="h-full w-[28%] shrink-0 cursor-default opacity-0 pointer-events-auto"
                :aria-label="t('story.nav.prev')"
                @click.stop="goPrev"
              />
              <div class="min-w-0 flex-1 pointer-events-none" aria-hidden="true" />
              <button
                type="button"
                class="h-full w-[28%] shrink-0 cursor-default opacity-0 pointer-events-auto"
                :aria-label="t('story.nav.next')"
                @click.stop="goNext"
              />
            </div>
            <div
              v-if="current"
              class="relative z-[10] w-full max-w-[min(100%,520px)] overflow-hidden rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.55)] ring-1 ring-white/10"
            >
            <PinSensitiveMedia
              v-if="current.storyVideoUrl"
              :sensitive="!!current.mediaSensitiveBlur"
              :viewer-can-reveal="viewerCanRevealSensitive"
              :blur-by-default="blurSensitiveByDefault"
              :enable-client-scan="false"
              :media-url="current.storyVideoUrl"
              media-type="video"
              wrapper-class="w-full"
            >
              <video
                ref="storyVideoEl"
                :key="`${current.slug}-video`"
                :src="current.storyVideoUrl"
                :class="[
                  PIN_MEDIA_ANTI_LEAK_CLASS,
                  'w-full max-h-[min(78vh,820px)] object-contain bg-black select-none pointer-events-none block',
                ]"
                playsinline
                :muted="!storySoundOn"
                autoplay
                @loadedmetadata="onStoryVideoLoadedMetadata"
                @ended="onStoryVideoEnded"
                @error="onStoryVideoError"
                v-bind="pinMediaAntiLeakVideoBindings(false)"
              />
            </PinSensitiveMedia>
            <PinSensitiveMedia
              v-else-if="current.imageUrl"
              :sensitive="!!current.mediaSensitiveBlur"
              :viewer-can-reveal="viewerCanRevealSensitive"
              :blur-by-default="blurSensitiveByDefault"
              :enable-client-scan="false"
              :media-url="current.imageUrl"
              media-type="image"
              wrapper-class="w-full"
            >
              <img
                :key="current.slug"
                data-story-slide-img
                :src="current.imageUrl"
                :alt="current.title"
                :class="[
                  PIN_MEDIA_ANTI_LEAK_CLASS,
                  'w-full max-h-[min(78vh,820px)] object-contain bg-black select-none pointer-events-none block',
                ]"
                v-bind="pinMediaAntiLeakImgBindings()"
                @load="onStoryImageLoaded"
                @error="onStoryImageError"
              />
            </PinSensitiveMedia>

            <!-- Description bas du média -->
            <div
              v-if="rawDescription"
              class="absolute inset-x-0 bottom-0 z-[35] pointer-events-none flex flex-col justify-end"
            >
              <div
                class="mx-2 mb-2 rounded-xl bg-black/60 backdrop-blur-sm px-3 py-2.5 pointer-events-auto border border-white/10"
              >
                <p
                  class="text-white text-sm leading-snug whitespace-pre-wrap break-words"
                  :class="descriptionNeedsExpand && !expandedDesc ? 'max-h-[5rem] overflow-hidden' : ''"
                >
                  {{ descriptionDisplay }}
                </p>
                <button
                  v-if="descriptionNeedsExpand"
                  type="button"
                  class="mt-1.5 text-xs font-semibold text-white/90 hover:text-white underline-offset-2 hover:underline"
                  @click.stop="expandedDesc = !expandedDesc"
                >
                  {{ expandedDesc ? t('story.description.less') : t('story.description.more') }}
                </button>
              </div>
            </div>

            <button
              v-if="!isOwnerViewingStory"
              type="button"
              class="absolute top-3 right-3 z-40 flex items-center justify-center rounded-full bg-black/45 backdrop-blur-md w-11 h-11 text-white border border-white/15 hover:bg-black/55 transition"
              :title="t('pin.doubleTapLikeHint')"
              @click.stop="doLike"
            >
              <span
                class="material-symbols-outlined text-[26px] transition-colors"
                  :class="currentStoryLiked ? 'text-pink-700 dark:text-pink-600' : 'text-white'"
              >favorite</span>
            </button>
            <button
              v-else
              type="button"
              class="absolute top-3 right-3 z-40 flex items-center gap-2 rounded-full bg-black/45 backdrop-blur-md px-3 py-2 text-white border border-white/15 hover:bg-black/55 transition cursor-pointer"
              :aria-label="t('story.likers.title', { count: currentStoryReactions })"
              @click.stop="openStoryLikersModal"
            >
                <span class="material-symbols-outlined text-[24px] text-pink-700 dark:text-pink-600">favorite</span>
              <span class="text-xs font-semibold tabular-nums min-w-[1.25rem]">{{ currentStoryReactions }}</span>
            </button>

            <transition name="fade">
              <div
                v-if="heartBurst"
                :key="heartBurstKey"
                class="pointer-events-none absolute inset-0 flex items-center justify-center z-[45]"
              >
                <span class="material-symbols-outlined text-pink-700 dark:text-pink-600 story-heart-burst drop-shadow-[0_10px_40px_rgba(0,0,0,.55)]">
                  favorite
                </span>
              </div>
            </transition>
          </div>
        </div>

        <div class="pointer-events-none absolute bottom-6 inset-x-0 z-40 flex justify-center px-4">
          <button
            v-if="current?.slug && !current?.storyEphemeral"
            type="button"
            class="pointer-events-auto rounded-full border border-white/20 bg-white/15 px-5 py-2.5 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-white/25"
            @click="openPinPage"
          >
            {{ t('story.viewPin') }}
          </button>
        </div>
      </div>

      </div>
    </div>

    <PinovaModal
      v-model:open="storyActionsOpen"
      presentation="tallSheet"
      :depth-effect="false"
      :title="t('pin.actionsTitle')"
    >
      <template #headerEnd>
        <button
          type="button"
          class="inline-flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 transition hover:bg-black/[0.06] dark:text-neutral-300 dark:hover:bg-white/[0.08]"
          :aria-label="t('common.close')"
          @click="storyActionsOpen = false"
        >
          <span class="material-symbols-outlined text-[22px] leading-none">close</span>
        </button>
      </template>
      <div class="space-y-2">
        <button
          v-if="current?.slug"
          type="button"
          class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold text-neutral-900 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-white/10"
          @click="closeActionsAndShare"
        >
          <span class="material-symbols-outlined text-[20px]">share</span>
          {{ t('pin.shareLink') }}
        </button>
        <button
          v-if="isAuthenticated && current?.username !== currentUser?.username"
          type="button"
          class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold text-neutral-900 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-white/10"
          @click="closeActionsAndReport"
        >
          <span class="material-symbols-outlined text-[20px]">flag</span>
          {{ t('moderation.report') }}
        </button>
      </div>
    </PinovaModal>
  </Teleport>

  <ReportContentModal
    v-model="reportStoryOpen"
    :context-label="current?.title ?? ''"
    @submit="handleSubmitStoryReport"
  />

  <StoryLikersModal
    v-model="storyLikersOpen"
    :pin-slug="storyLikersOpen ? (current?.slug ?? null) : null"
  />
</template>

<style scoped>
.story-viewer-root {
  animation: story-viewer-enter 0.22s ease-out both;
  -webkit-touch-callout: none;
}

.story-viewer--exit-closing {
  pointer-events: none;
}

.story-surface {
  -webkit-touch-callout: none;
  transform-origin: center top;
  transition: transform 0.18s ease-out, border-radius 0.18s ease-out;
  will-change: transform;
}

.story-surface--exit-dismiss {
  transform: translate3d(0, 100%, 0) !important;
  transition: transform 0.34s cubic-bezier(0.22, 1, 0.36, 1) !important;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.35s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
/** Cœur like / double-tap : bien plus visible qu’à l’écran précédent. */
.story-heart-burst {
  font-size: clamp(7rem, 38vw, 15rem);
  line-height: 1;
  animation: story-heart-burst-pop 0.88s cubic-bezier(0.2, 0.88, 0.34, 1.02) forwards;
}

@keyframes story-heart-burst-pop {
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

@keyframes story-viewer-enter {
  from {
    opacity: 0;
    transform: translateY(18px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.pt-safe {
  padding-top: env(safe-area-inset-top, 0px);
}
.top-safe {
  top: env(safe-area-inset-top, 0px);
}
</style>
