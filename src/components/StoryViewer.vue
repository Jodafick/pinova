<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import type { Pin } from '../types'
import { usePins } from '../composables/usePins'
import { useAuth } from '../composables/useAuth'
import { useI18n } from '../i18n'
import { useAppModal } from '../composables/useAppModal'

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

/** Durée image par défaut ; vidéo = métadonnées (bornée). */
const DEFAULT_IMAGE_MS = 8000
const MIN_VIDEO_MS = 3000
const MAX_VIDEO_MS = 120_000

const index = ref(0)
const heartBurst = ref(false)
const expandedDesc = ref(false)
/** Recrée l’animation CSS de la barre du segment courant à chaque story. */
const progressAnimKey = ref(0)
/** Durée du segment courant (barre + auto-suivant). */
const slideDurationMs = ref(DEFAULT_IMAGE_MS)

let advanceTimer: ReturnType<typeof setTimeout> | null = null

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
  advanceTimer = setTimeout(goNext, slideDurationMs.value)
}

function restartCurrentSegment() {
  expandedDesc.value = false
  clearAdvance()
  bumpProgressAnimation()
  const pin = props.pins[index.value]
  if (!pin || !props.modelValue) return
  slideDurationMs.value = DEFAULT_IMAGE_MS
  if (pin.storyVideoUrl?.trim()) {
    return
  }
  scheduleAdvance()
}

watch(
  () => props.modelValue,
  (open) => {
    if (open && props.pins.length > 0) {
      const maxIdx = props.pins.length - 1
      index.value = Math.min(Math.max(0, props.initialIndex ?? 0), maxIdx)
      restartCurrentSegment()
    } else {
      clearAdvance()
    }
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

watch(index, () => {
  if (props.modelValue) restartCurrentSegment()
})

const current = computed(() => props.pins[index.value])

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

/** L'auteur de la story voit le compteur de likes ; les autres non. */
const showLikeCountForStory = computed(() => {
  const pin = current.value
  const u = currentUser.value
  if (!pin || !u) return false
  return pin.username === u.username
})

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
  try {
    await reportPin(pin.slug)
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
  slideDurationMs.value = ms
  bumpProgressAnimation()
  scheduleAdvance()
}

async function doLike() {
  const pin = current.value
  if (!pin || !isAuthenticated.value) {
    router.push('/login')
    return
  }
  heartBurst.value = true
  window.setTimeout(() => {
    heartBurst.value = false
  }, 900)
  try {
    await toggleLike(pin.slug)
  } catch {
    heartBurst.value = false
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
  if (e.key === 'Escape') close()
  else if (e.key === 'ArrowRight') goNext()
  else if (e.key === 'ArrowLeft') goPrev()
}

let lastTap = 0
function onCenterTap() {
  const pin = current.value
  if (!pin || !isAuthenticated.value) return
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
        <div class="flex gap-1">
          <div
            v-for="(_, si) in pins"
            :key="si"
            class="h-0.5 flex-1 rounded-full bg-white/15 overflow-hidden"
          >
            <div v-if="si < index" class="h-full w-full bg-white rounded-full" />
            <div
              v-else-if="si === index"
              :key="`bar-${si}-${progressAnimKey}`"
              class="story-progress-segment h-full bg-white rounded-full"
              :style="{ animationDuration: `${slideDurationMs}ms` }"
            />
          </div>
        </div>
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
                  : current?.userAvatarColor || 'bg-neutral-700'
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
          @dblclick.stop.prevent="doLike"
        />

        <div class="relative flex-1 flex items-center justify-center px-3 pb-28 pt-14 sm:px-8">
          <div
            v-if="current"
            class="relative max-w-[min(100%,520px)] w-full rounded-2xl overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.55)] ring-1 ring-white/10"
          >
            <video
              v-if="current.storyVideoUrl"
              :key="`${current.slug}-video`"
              :src="current.storyVideoUrl"
              class="w-full max-h-[min(78vh,820px)] object-contain bg-black select-none pointer-events-none block"
              playsinline
              muted
              autoplay
              @loadedmetadata="onStoryVideoLoadedMetadata"
              @ended="goNext"
              @contextmenu.prevent
            />
            <img
              v-else-if="current.imageUrl"
              :src="current.imageUrl"
              :alt="current.title"
              class="w-full max-h-[min(78vh,820px)] object-contain bg-black select-none pointer-events-none block"
              draggable="false"
              @contextmenu.prevent
              @dragstart.prevent
            />

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
              type="button"
              class="absolute top-3 right-3 z-40 flex items-center gap-1 rounded-full bg-black/45 backdrop-blur-md px-3 py-2 text-white border border-white/15 hover:bg-black/55 transition"
              @click.stop="doLike"
            >
              <span
                class="material-symbols-outlined text-[26px]"
                :class="current?.liked ? 'fill-1 text-pink-400' : ''"
              >favorite</span>
              <span
                v-if="showLikeCountForStory"
                class="text-xs font-semibold tabular-nums min-w-[1.25rem]"
              >{{ current?.stats.reactions ?? 0 }}</span>
            </button>

            <transition name="fade">
              <div
                v-if="heartBurst"
                class="pointer-events-none absolute inset-0 flex items-center justify-center"
              >
                <span class="material-symbols-outlined text-white text-[100px] drop-shadow-2xl animate-pulse fill-1">
                  favorite
                </span>
              </div>
            </transition>
          </div>
        </div>
      </div>

      <div class="absolute bottom-6 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
        <button
          v-if="current?.slug"
          type="button"
          class="pointer-events-auto px-5 py-2.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white text-xs font-semibold hover:bg-white/25 transition"
          @click="openPinPage"
        >
          {{ t('story.viewPin') }}
        </button>
      </div>
    </div>
  </Teleport>
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
.story-progress-segment {
  width: 0%;
  animation-name: story-progress-grow;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}
@keyframes story-progress-grow {
  from {
    width: 0%;
  }
  to {
    width: 100%;
  }
}
.pt-safe {
  padding-top: env(safe-area-inset-top, 0px);
}
.top-safe {
  top: env(safe-area-inset-top, 0px);
}
</style>
