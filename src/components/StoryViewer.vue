<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import type { Pin } from '../types'
import { usePins } from '../composables/usePins'
import { useAuth, DEFAULT_AVATAR_COLOR_CLASS } from '../composables/useAuth'
import { useI18n } from '../i18n'
import { useAppModal } from '../composables/useAppModal'
import PinSensitiveMedia from './PinSensitiveMedia.vue'
import StorySegmentedProgressBar from './StorySegmentedProgressBar.vue'
import StoryLikersModal from './StoryLikersModal.vue'
import ReportContentModal from './ReportContentModal.vue'
import { viewerCanRevealSensitiveMedia, sensitiveMediaBlurredByDefault } from '../composables/useModeration'
import {
  PIN_MEDIA_ANTI_LEAK_CLASS,
  pinMediaAntiLeakImgBindings,
  pinMediaAntiLeakVideoBindings,
} from '../composables/mediaAntiLeak'

const props = defineProps<{
  modelValue: boolean
  pins: Pin[]
  initialIndex?: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
}>()

const router = useRouter()
const { toggleLike, reportPin } = usePins()
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

const index = ref(0)
const heartBurst = ref(false)
const expandedDesc = ref(false)
const storyLikersOpen = ref(false)
/** État like / reactions — props.story ≠ store `pins`; toggleLike ne met pas à jour le viewer. */
const storyLikedBySlug = ref<Record<string, boolean>>({})
const storyReactionsBySlug = ref<Record<string, number>>({})
/** Recrée l’animation CSS de la barre du segment courant à chaque story. */
const progressAnimKey = ref(0)
/** Durée du segment courant (barre + auto-suivant). */
const slideDurationMs = ref(DEFAULT_IMAGE_MS)

const storyVideoEl = ref<HTMLVideoElement | null>(null)
/** Autoplay : départ en muted (politiques navigateurs) ; clic sur le bouton active le son jusqu’à fermeture du viewer. */
const storySoundOn = ref(false)

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
/** Incrémenté à chaque segment pour ignorer timeouts / événements obsolètes */
const segmentPlaybackId = ref(0)

function bumpProgressAnimation() {
  progressAnimKey.value++
}

function clearAdvance() {
  if (advanceTimer) {
    clearTimeout(advanceTimer)
    advanceTimer = null
  }
}

function scheduleAdvance() {
  clearAdvance()
  if (!props.modelValue || props.pins.length === 0) return
  const playbackId = segmentPlaybackId.value
  const delay = slideDurationMs.value
  advanceTimer = setTimeout(() => {
    advanceTimer = null
    if (playbackId !== segmentPlaybackId.value) return
    goNext()
  }, delay)
}

function restartCurrentSegment() {
  expandedDesc.value = false
  segmentPlaybackId.value++
  clearAdvance()
  bumpProgressAnimation()
  const pin = props.pins[index.value]
  if (!pin || !props.modelValue) return
  slideDurationMs.value = DEFAULT_IMAGE_MS

  if (pin.storyVideoUrl?.trim()) {
    const playbackId = segmentPlaybackId.value
    slideDurationMs.value = DEFAULT_IMAGE_MS
    advanceTimer = setTimeout(() => {
      advanceTimer = null
      if (playbackId !== segmentPlaybackId.value) return
      goNext()
    }, MAX_VIDEO_MS)
    return
  }

  scheduleAdvance()
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

watch(
  () => props.modelValue,
  (open) => {
    if (open && props.pins.length > 0) {
      storySoundOn.value = false
      syncStoryEngagementFromProps()
      const maxIdx = props.pins.length - 1
      index.value = Math.min(Math.max(0, props.initialIndex ?? 0), maxIdx)
      restartCurrentSegment()
    } else {
      clearAdvance()
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

watch(
  () => props.pins,
  () => {
    if (props.modelValue && props.pins.length > 0) syncStoryEngagementFromProps()
  },
  { deep: true },
)

watch(index, () => {
  if (props.modelValue) restartCurrentSegment()
})

watch(storyLikersOpen, (open) => {
  if (!props.modelValue || props.pins.length === 0) return
  if (open) clearAdvance()
  else restartCurrentSegment()
})

const current = computed(() => props.pins[index.value])

watch(
  () => current.value?.slug,
  () => {
    void nextTick(() => syncStoryVideoMute())
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

const reportStoryOpen = ref(false)

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

async function handleSubmitStoryReport(payload: { category: string; details: string }) {
  const pin = current.value
  if (!pin) return
  try {
    await reportPin(pin.slug, payload)
    reportStoryOpen.value = false
    await showAlert(t('moderation.reportSent'), { variant: 'success' })
  } catch {
    await showAlert(t('moderation.reportError'), { variant: 'danger', title: t('modal.errorTitle') })
  }
}

function close() {
  clearAdvance()
  emit('update:modelValue', false)
}

function goNext() {
  clearAdvance()
  if (index.value < props.pins.length - 1) {
    index.value++
    return
  }
  close()
}

function goPrev() {
  clearAdvance()
  if (index.value > 0) {
    index.value--
  }
}

function onStoryVideoLoadedMetadata(e: Event) {
  const v = e.target as HTMLVideoElement
  let ms = Math.round(v.duration * 1000)
  if (!Number.isFinite(ms) || ms <= 0) ms = DEFAULT_IMAGE_MS
  ms = Math.min(Math.max(ms, MIN_VIDEO_MS), MAX_VIDEO_MS)
  clearAdvance()
  slideDurationMs.value = ms
  bumpProgressAnimation()
  const slackMs = Math.min(800, Math.max(220, Math.round(ms * 0.06)))
  const playbackId = segmentPlaybackId.value
  advanceTimer = setTimeout(() => {
    advanceTimer = null
    if (playbackId !== segmentPlaybackId.value) return
    goNext()
  }, ms + slackMs)
  syncStoryVideoMute(v)
}

/** Fin lecture vidéo : prioritaire sur le timer avec marge. */
function onStoryVideoEnded() {
  const pin = props.pins[index.value]
  if (!pin?.storyVideoUrl?.trim()) return
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
  heartBurst.value = true
  window.setTimeout(() => {
    heartBurst.value = false
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
    if (storyLikersOpen.value) {
      storyLikersOpen.value = false
      return
    }
    close()
  } else if (e.key === 'ArrowRight') goNext()
  else if (e.key === 'ArrowLeft') goPrev()
}

function handleStoryDblLike() {
  if (isOwnerViewingStory.value) return
  void doLike()
}

let lastTap = 0
function onCenterTap() {
  const pin = current.value
  if (!pin || !isAuthenticated.value) return
  if (isOwnerViewingStory.value) return
  const now = Date.now()
  if (now - lastTap < 340) {
    lastTap = 0
    void doLike()
    return
  }
  lastTap = now
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  clearAdvance()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue && pins.length > 0"
      class="fixed inset-0 z-[100] bg-neutral-950 flex flex-col"
      role="dialog"
      aria-modal="true"
    >
      <!-- Progress + auteur -->
      <div class="shrink-0 z-50 px-2 pt-safe pt-3 space-y-2">
        <StorySegmentedProgressBar
          :segment-count="pins.length"
          :current-index="index"
          :active-duration-ms="slideDurationMs"
          :animation-key="progressAnimKey"
        />
        <div class="flex justify-center px-2 pb-1">
          <button
            type="button"
            class="flex items-center gap-2.5 max-w-[min(100%,320px)] rounded-full px-2 py-1 pr-3 hover:bg-white/10 transition cursor-pointer pointer-events-auto"
            @click.stop="openAuthorProfile"
          >
            <span
              class="relative h-9 w-9 shrink-0 rounded-full overflow-hidden ring-2 ring-white/35 shadow-md flex items-center justify-center text-white"
              :class="
                current?.userAvatarUrl
                  ? 'bg-neutral-900'
                  : current?.userAvatarColor || DEFAULT_AVATAR_COLOR_CLASS
              "
            >
              <img
                v-if="current?.userAvatarUrl"
                :src="current.userAvatarUrl"
                alt=""
                class="h-full w-full object-cover"
                draggable="false"
              />
              <span v-else class="text-[11px] font-bold text-white leading-none">{{ storyAuthorInitials }}</span>
            </span>
            <span class="text-sm font-semibold text-white drop-shadow-md truncate text-left">
              {{ current?.user }}
            </span>
          </button>
        </div>
      </div>

      <div class="absolute top-safe right-3 z-50 flex flex-col items-end gap-2 pt-safe">
        <button
          v-if="current?.storyVideoUrl"
          type="button"
          class="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/55 border border-white/10"
          :title="storySoundOn ? t('story.sound.mute') : t('story.sound.unmute')"
          @click.stop="toggleStorySound"
        >
          <span class="material-symbols-outlined text-[22px]">{{ storySoundOn ? 'volume_up' : 'volume_off' }}</span>
        </button>
        <button
          v-if="isAuthenticated && current?.username !== currentUser?.username"
          type="button"
          class="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/55 border border-white/10"
          :title="t('moderation.report')"
          @click.stop="handleReportStory"
        >
          <span class="material-symbols-outlined text-[22px]">flag</span>
        </button>
        <button
          type="button"
          class="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/55 border border-white/10"
          @click="close"
        >
          <span class="material-symbols-outlined text-[22px]">close</span>
        </button>
      </div>

      <!-- Zones tap -->
      <div class="relative flex-1 min-h-0 flex items-stretch justify-center">
        <button
          type="button"
          class="absolute inset-y-0 left-0 w-[28%] z-30 cursor-w-resize opacity-0"
          aria-label="Précédent"
          @click.stop="goPrev"
        />
        <button
          type="button"
          class="absolute inset-y-0 right-0 w-[28%] z-30 cursor-e-resize opacity-0"
          aria-label="Suivant"
          @click.stop="goNext"
        />

        <div
          class="absolute inset-y-0 left-[28%] right-[28%] z-25 flex items-center justify-center"
          @click.stop="onCenterTap"
          @dblclick.stop.prevent="handleStoryDblLike"
        />

        <div class="relative flex-1 flex items-center justify-center px-3 pb-28 pt-14 sm:px-8">
          <div
            v-if="current"
            class="relative max-w-[min(100%,520px)] w-full rounded-2xl overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.55)] ring-1 ring-white/10"
          >
            <PinSensitiveMedia
              v-if="current.storyVideoUrl"
              :sensitive="!!current.mediaSensitiveBlur"
              :viewer-can-reveal="viewerCanRevealSensitive"
              :blur-by-default="blurSensitiveByDefault"
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
                v-bind="pinMediaAntiLeakVideoBindings(false)"
              />
            </PinSensitiveMedia>
            <PinSensitiveMedia
              v-else-if="current.imageUrl"
              :sensitive="!!current.mediaSensitiveBlur"
              :viewer-can-reveal="viewerCanRevealSensitive"
              :blur-by-default="blurSensitiveByDefault"
              wrapper-class="w-full"
            >
              <img
                :src="current.imageUrl"
                :alt="current.title"
                :class="[
                  PIN_MEDIA_ANTI_LEAK_CLASS,
                  'w-full max-h-[min(78vh,820px)] object-contain bg-black select-none pointer-events-none block',
                ]"
                v-bind="pinMediaAntiLeakImgBindings()"
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
                :class="currentStoryLiked ? 'story-ms-heart-on text-pink-400' : 'text-white'"
              >favorite</span>
            </button>
            <button
              v-else
              type="button"
              class="absolute top-3 right-3 z-40 flex items-center gap-2 rounded-full bg-black/45 backdrop-blur-md px-3 py-2 text-white border border-white/15 hover:bg-black/55 transition cursor-pointer"
              :aria-label="t('story.likers.title', { count: currentStoryReactions })"
              @click.stop="openStoryLikersModal"
            >
              <span class="material-symbols-outlined text-[24px] story-ms-heart-on text-pink-300">favorite</span>
              <span class="text-xs font-semibold tabular-nums min-w-[1.25rem]">{{ currentStoryReactions }}</span>
            </button>

            <transition name="fade">
              <div
                v-if="heartBurst"
                class="pointer-events-none absolute inset-0 flex items-center justify-center z-[45]"
              >
                <span
                  class="material-symbols-outlined story-ms-heart-on text-pink-300 story-heart-burst drop-shadow-[0_10px_40px_rgba(0,0,0,.55)]"
                >
                  favorite
                </span>
              </div>
            </transition>
          </div>
        </div>
      </div>

      <div class="absolute bottom-6 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
        <button
          v-if="current?.slug && !current?.storyEphemeral"
          type="button"
          class="pointer-events-auto px-5 py-2.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white text-xs font-semibold hover:bg-white/25 transition"
          @click="openPinPage"
        >
          {{ t('story.viewPin') }}
        </button>
      </div>
    </div>
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
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.35s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.story-ms-heart-on {
  font-variation-settings: 'FILL' 1, 'wght' 600;
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

.pt-safe {
  padding-top: env(safe-area-inset-top, 0px);
}
.top-safe {
  top: env(safe-area-inset-top, 0px);
}
</style>
