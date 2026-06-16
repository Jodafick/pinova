<script setup lang="ts">
/**
 * StoryVideoEditor — éditeur vidéo pro.
 *   - Header collant (sticky), centré, glassy
 *   - Lecteur sans contrôles natifs, muet par défaut, custom play/pause
 *   - Trim « single-bar » double-poignée (range dual) avec preview live
 *     (loop dans la fenêtre [start, end])
 *   - Rotation 90° (4 positions) + miroir H / V
 *   - Export bake les transformations dans un canvas (captureStream)
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from '../i18n'
import { useAppModal } from '../composables/useAppModal'

const props = defineProps<{
  file: File
}>()

const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'apply', file: File): void
}>()

const { t } = useI18n()
const { showAlert } = useAppModal()

const videoRef = ref<HTMLVideoElement | null>(null)
const trackRef = ref<HTMLElement | null>(null)

const previewUrl = ref('')
const duration = ref(0)
const startTime = ref(0)
const endTime = ref(0)
const playheadTime = ref(0)

/** Rotation en degrés : 0, 90, 180, 270. */
const rotation = ref(0)
const mirrorH = ref(false)
const mirrorV = ref(false)
const mutedExport = ref(true)
const isPlaying = ref(false)
const busy = ref(false)

const MIN_SEGMENT = 0.3

const transformStyle = computed(() => {
  const sx = mirrorH.value ? -1 : 1
  const sy = mirrorV.value ? -1 : 1
  return {
    transform: `rotate(${rotation.value}deg) scale(${sx}, ${sy})`,
    transformOrigin: '50% 50%',
    transition: 'transform 220ms cubic-bezier(0.2, 0, 0, 1)',
  }
})

const hasTransform = computed(() =>
  rotation.value !== 0 || mirrorH.value || mirrorV.value,
)

const hasEdits = computed(() =>
  mutedExport.value ||
  hasTransform.value ||
  startTime.value > 0.15 ||
  (duration.value > 0 && endTime.value < duration.value - 0.15),
)

const trimStartPct = computed(() => (duration.value > 0 ? (startTime.value / duration.value) * 100 : 0))
const trimEndPct = computed(() => (duration.value > 0 ? (endTime.value / duration.value) * 100 : 100))
const playheadPct = computed(() => (duration.value > 0 ? (playheadTime.value / duration.value) * 100 : 0))

onMounted(() => {
  previewUrl.value = URL.createObjectURL(props.file)
})

onUnmounted(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})

function onLoadedMetadata() {
  const video = videoRef.value
  const d = Number.isFinite(video?.duration) ? video?.duration ?? 0 : 0
  duration.value = d
  startTime.value = 0
  endTime.value = d
  if (video) video.currentTime = 0
}

function onTimeUpdate() {
  const video = videoRef.value
  if (!video) return
  playheadTime.value = video.currentTime
  if (endTime.value && video.currentTime >= endTime.value) {
    video.currentTime = startTime.value
    if (isPlaying.value) void video.play().catch(() => undefined)
  }
}

function onPlay() {
  isPlaying.value = true
}
function onPause() {
  isPlaying.value = false
}

function togglePlay() {
  const video = videoRef.value
  if (!video) return
  if (video.paused) {
    if (video.currentTime < startTime.value || video.currentTime >= endTime.value) {
      video.currentTime = startTime.value
    }
    void video.play().catch(() => undefined)
  } else {
    video.pause()
  }
}

function formatSeconds(value: number) {
  const v = Math.max(0, value)
  const m = Math.floor(v / 60)
  const s = Math.floor(v % 60).toString().padStart(2, '0')
  const ms = Math.floor((v % 1) * 10)
  return `${m}:${s}.${ms}`
}

/* Trim dual-handle. */
type Handle = 'start' | 'end' | null
const dragging = ref<Handle>(null)

function pctFromClientX(clientX: number) {
  const el = trackRef.value
  if (!el) return 0
  const rect = el.getBoundingClientRect()
  const pct = ((clientX - rect.left) / rect.width) * 100
  return Math.max(0, Math.min(100, pct))
}

function onTrackPointerDown(handle: Exclude<Handle, null>, ev: PointerEvent) {
  ev.preventDefault()
  dragging.value = handle
  ;(ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId)
  applyDrag(ev.clientX)
  window.addEventListener('pointermove', onWindowPointerMove)
  window.addEventListener('pointerup', onWindowPointerUp, { once: true })
}

function onWindowPointerMove(ev: PointerEvent) {
  if (!dragging.value) return
  applyDrag(ev.clientX)
}

function onWindowPointerUp() {
  dragging.value = null
  window.removeEventListener('pointermove', onWindowPointerMove)
}

function applyDrag(clientX: number) {
  if (!duration.value) return
  const pct = pctFromClientX(clientX)
  const time = (pct / 100) * duration.value
  if (dragging.value === 'start') {
    startTime.value = Math.min(time, endTime.value - MIN_SEGMENT)
    if (startTime.value < 0) startTime.value = 0
    const v = videoRef.value
    if (v) v.currentTime = startTime.value
  } else if (dragging.value === 'end') {
    endTime.value = Math.max(time, startTime.value + MIN_SEGMENT)
    if (endTime.value > duration.value) endTime.value = duration.value
  }
}

watch(startTime, () => {
  const v = videoRef.value
  if (v && Math.abs(v.currentTime - startTime.value) > 0.3) v.currentTime = startTime.value
})

function setRotation(delta: number) {
  rotation.value = (rotation.value + delta + 360) % 360
}

function getCaptureStream(el: HTMLVideoElement | HTMLCanvasElement): MediaStream | null {
  const withCapture = el as (HTMLVideoElement | HTMLCanvasElement) & {
    captureStream?: () => MediaStream
    mozCaptureStream?: () => MediaStream
  }
  return withCapture.captureStream?.() ?? withCapture.mozCaptureStream?.() ?? null
}

/** Export via canvas pour appliquer rotation + miroir. */
async function exportEditedVideo(): Promise<File> {
  const video = videoRef.value
  if (!video) return props.file
  if (!hasEdits.value) return props.file
  if (typeof MediaRecorder === 'undefined') {
    await showAlert(t('story.editor.videoExportUnavailable'), { variant: 'warning' })
    return props.file
  }

  /* Cas simple sans transformation : on capture le stream du <video> directement. */
  if (!hasTransform.value) {
    const stream = getCaptureStream(video)
    if (!stream) {
      await showAlert(t('story.editor.videoExportUnavailable'), { variant: 'warning' })
      return props.file
    }
    if (mutedExport.value) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false
        track.stop()
        stream.removeTrack(track)
      })
    }
    const file = await recordStream(stream, video)
    stream.getTracks().forEach((trk) => trk.stop())
    return file ?? props.file
  }

  /* Cas avec rotation/miroir : on dessine chaque frame dans un canvas. */
  const vw = video.videoWidth || 720
  const vh = video.videoHeight || 1280
  const rotated = rotation.value % 180 !== 0
  const cw = rotated ? vh : vw
  const ch = rotated ? vw : vh

  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  if (!ctx) return props.file

  const canvasStream = getCaptureStream(canvas)
  if (!canvasStream) return props.file
  /* On ajoute la piste audio du video si pas muté. */
  if (!mutedExport.value) {
    const audioStream = getCaptureStream(video)
    if (audioStream) {
      audioStream.getAudioTracks().forEach((trk) => canvasStream.addTrack(trk))
    }
  }

  let rafId = 0
  let stopRaf = false
  const draw = () => {
    if (stopRaf) return
    ctx.save()
    ctx.clearRect(0, 0, cw, ch)
    ctx.translate(cw / 2, ch / 2)
    ctx.rotate((rotation.value * Math.PI) / 180)
    ctx.scale(mirrorH.value ? -1 : 1, mirrorV.value ? -1 : 1)
    ctx.drawImage(video, -vw / 2, -vh / 2, vw, vh)
    ctx.restore()
    rafId = window.requestAnimationFrame(draw)
  }
  rafId = window.requestAnimationFrame(draw)

  try {
    const file = await recordStream(canvasStream, video)
    return file ?? props.file
  } finally {
    stopRaf = true
    if (rafId) window.cancelAnimationFrame(rafId)
    canvasStream.getTracks().forEach((trk) => trk.stop())
  }
}

async function recordStream(stream: MediaStream, video: HTMLVideoElement): Promise<File | null> {
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : MediaRecorder.isTypeSupported('video/webm')
      ? 'video/webm'
      : ''
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }
  await new Promise<void>((resolve, reject) => {
    const startRecording = () => {
      video.onseeked = null
      recorder.start()
      video.muted = mutedExport.value
      void video.play().catch(() => undefined)
      window.setTimeout(() => {
        video.pause()
        if (recorder.state !== 'inactive') recorder.stop()
      }, Math.max(350, (endTime.value - startTime.value) * 1000))
    }
    recorder.onerror = () => reject(new Error('video_export_failed'))
    recorder.onstop = () => resolve()
    video.onseeked = startRecording
    if (Math.abs(video.currentTime - startTime.value) < 0.05) startRecording()
    else video.currentTime = startTime.value
  })
  const blob = new Blob(chunks, { type: 'video/webm' })
  return new File([blob], props.file.name.replace(/\.[^.]+$/, '') + '-edited.webm', { type: 'video/webm' })
}

async function apply() {
  busy.value = true
  try {
    emit('apply', await exportEditedVideo())
  } catch {
    await showAlert(t('story.editor.videoExportFailed'), { variant: 'danger', title: t('modal.errorTitle') })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="story-editor-shell flex min-h-0 flex-1 flex-col overflow-hidden bg-[#060408] text-white fotoce-min-vh-fill">
    <header
      class="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]"
    >
      <button type="button" class="story-editor-icon-btn" :aria-label="t('common.cancel')" @click="emit('cancel')">
        <FotoceIcon name="close" class="text-xl" />
      </button>
      <p class="text-sm font-black tracking-tight">{{ t('story.editor.videoTitle') }}</p>
      <button type="button" class="story-editor-text-btn" :disabled="busy" @click="apply">
        <span v-if="busy" class="inline-flex items-center gap-1.5">
          <span class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
          {{ t('story.editor.exporting') }}
        </span>
        <span v-else>{{ t('story.editor.apply') }}</span>
      </button>
    </header>

    <main class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <!-- Lecteur ~ moitié d’écran, pleine largeur, sans padding autour -->
      <div class="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        <section
          class="story-editor-stage relative flex h-[50svh] max-h-[50dvh] w-full shrink-0 items-center justify-center bg-black"
        >
          <div class="story-editor-stage__frame relative h-full w-full overflow-hidden">
            <video
              ref="videoRef"
              :src="previewUrl"
              class="absolute inset-0 m-auto max-h-full max-w-full object-contain"
              :style="transformStyle"
              playsinline
              :muted="mutedExport"
              preload="auto"
              @loadedmetadata="onLoadedMetadata"
              @timeupdate="onTimeUpdate"
              @play="onPlay"
              @pause="onPause"
            />
            <!-- Custom play/pause overlay -->
            <button
              type="button"
              class="absolute inset-0 grid place-items-center text-white transition-opacity"
              :class="isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100'"
              :aria-label="t('story.editor.playPause')"
              @click="togglePlay"
            >
              <span class="grid h-16 w-16 place-items-center rounded-full bg-black/55 ring-1 ring-white/20 backdrop-blur-md">
                <FotoceIcon :name="isPlaying ? 'pause' : 'play_arrow'" class="text-4xl" />
              </span>
            </button>
          </div>
        </section>
      </div>

      <!-- Même logique que l’éditeur image : tout le reste en bas -->
      <footer
        class="shrink-0 border-t border-white/10 bg-[#060408]/95 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-3 backdrop-blur-xl"
      >
        <!-- Trim dual-range -->
        <section class="mx-auto w-full max-w-md rounded-[1.25rem] border border-white/10 bg-white/[0.05] p-3 backdrop-blur sm:p-4">
        <div class="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.12em] text-white/55">
          <span>{{ t('story.editor.trim') }}</span>
          <span class="font-mono text-[10px] text-white/55">{{ formatSeconds(startTime) }} → {{ formatSeconds(endTime || duration) }}</span>
        </div>
        <div
          ref="trackRef"
          class="story-trim-track relative h-11 select-none rounded-full bg-white/[0.06] ring-1 ring-white/10"
          @touchstart.prevent
        >
          <!-- Zone sélectionnée -->
          <div
            class="absolute top-0 bottom-0 rounded-full bg-pink-700/35 ring-1 ring-pink-700/70 dark:ring-pink-600/70"
            :style="{ left: trimStartPct + '%', right: 100 - trimEndPct + '%' }"
          />
          <!-- Playhead -->
          <div
            class="pointer-events-none absolute top-0 h-full w-[2px] bg-white/80"
            :style="{ left: playheadPct + '%' }"
          />
          <!-- Poignée start -->
          <button
            type="button"
            class="story-trim-handle absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            :style="{ left: trimStartPct + '%' }"
            :aria-label="t('story.editor.trimStart')"
            @pointerdown="onTrackPointerDown('start', $event)"
          >
            <span class="block h-9 w-3 rounded-full bg-white shadow-lg ring-1 ring-black/10" />
          </button>
          <!-- Poignée end -->
          <button
            type="button"
            class="story-trim-handle absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            :style="{ left: trimEndPct + '%' }"
            :aria-label="t('story.editor.trimEnd')"
            @pointerdown="onTrackPointerDown('end', $event)"
          >
            <span class="block h-9 w-3 rounded-full bg-white shadow-lg ring-1 ring-black/10" />
          </button>
        </div>
      </section>

      <!-- Transformations -->
      <section class="mx-auto mt-3 w-full max-w-md rounded-[1.25rem] border border-white/10 bg-white/[0.05] p-3 backdrop-blur sm:p-4">
        <p class="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/55">{{ t('story.editor.transform') }}</p>
        <div class="grid grid-cols-4 gap-2">
          <button
            type="button"
            class="story-editor-action"
            :aria-label="t('story.editor.rotateLeft')"
            @click="setRotation(-90)"
          >
            <FotoceIcon name="rotate_left" class="text-xl" />
            <span class="text-[10px] font-bold tracking-wide">−90°</span>
          </button>
          <button
            type="button"
            class="story-editor-action"
            :aria-label="t('story.editor.rotateRight')"
            @click="setRotation(90)"
          >
            <FotoceIcon name="rotate_right" class="text-xl" />
            <span class="text-[10px] font-bold tracking-wide">+90°</span>
          </button>
          <button
            type="button"
            class="story-editor-action"
            :class="{ 'story-editor-action--active': mirrorH }"
            :aria-label="t('story.editor.flipHorizontal')"
            @click="mirrorH = !mirrorH"
          >
            <FotoceIcon name="flip" class="text-xl" />
            <span class="text-[10px] font-bold tracking-wide">{{ t('story.editor.flipHorizontal') }}</span>
          </button>
          <button
            type="button"
            class="story-editor-action"
            :class="{ 'story-editor-action--active': mirrorV }"
            :aria-label="t('story.editor.flipVertical')"
            @click="mirrorV = !mirrorV"
          >
            <FotoceIcon name="flip" class="text-xl rotate-90" />
            <span class="text-[10px] font-bold tracking-wide">{{ t('story.editor.flipVertical') }}</span>
          </button>
        </div>
        <p v-if="hasTransform" class="mt-3 text-[10px] leading-4 text-white/40">{{ t('story.editor.transformNotice') }}</p>
      </section>

      <!-- Audio + hint -->
      <section class="mx-auto mt-3 w-full max-w-md space-y-3 rounded-[1.25rem] border border-white/10 bg-white/[0.05] p-3 backdrop-blur sm:p-4">
        <button
          type="button"
          class="story-editor-toggle"
          :class="{ 'story-editor-toggle--active': mutedExport }"
          @click="mutedExport = !mutedExport"
        >
          <FotoceIcon :name="mutedExport ? 'volume_off' : 'volume_up'" class="text-lg" />
          {{ t('story.editor.mute') }}
        </button>
        <p class="text-[11px] leading-5 text-white/38">{{ t('story.editor.videoHint') }}</p>
      </section>
      </footer>
    </main>
  </div>
</template>

<style scoped>
.story-editor-icon-btn {
  display: grid;
  height: 2.5rem;
  width: 2.5rem;
  place-items: center;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.08);
  transition: background-color 160ms ease;
}
.story-editor-icon-btn:hover { background: rgb(255 255 255 / 0.14); }

.story-editor-text-btn {
  min-width: 5.5rem;
  border-radius: 999px;
  background: linear-gradient(135deg, #ec4899 0%, #db2777 100%);
  padding: 0.6rem 1rem;
  font-size: 0.8rem;
  font-weight: 900;
  letter-spacing: 0.03em;
  box-shadow: 0 8px 22px -8px rgba(219, 39, 119, 0.55);
}
.story-editor-text-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.story-editor-toggle {
  display: inline-flex;
  min-height: 2.75rem;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border-radius: 1rem;
  background: rgb(255 255 255 / 0.08);
  font-size: 0.85rem;
  font-weight: 900;
  color: rgb(255 255 255 / 0.8);
  transition: background-color 160ms ease;
}
.story-editor-toggle--active {
  background: rgb(236 72 153 / 0.22);
  color: #f9a8d4;
}

.story-editor-action {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  border-radius: 1rem;
  background: rgb(255 255 255 / 0.06);
  padding: 0.65rem 0.25rem;
  color: rgb(255 255 255 / 0.85);
  transition: background-color 160ms ease, transform 160ms ease;
}
.story-editor-action:hover { background: rgb(255 255 255 / 0.12); }
.story-editor-action:active { transform: scale(0.96); }
.story-editor-action--active {
  background: rgb(236 72 153 / 0.22);
  color: #f9a8d4;
}

.story-trim-handle {
  touch-action: none;
  background: transparent;
  border: 0;
  cursor: ew-resize;
  padding: 0;
}
.story-trim-track { touch-action: none; }
</style>
