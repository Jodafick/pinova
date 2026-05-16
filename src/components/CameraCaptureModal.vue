<script setup lang="ts">
/**
 * CameraCaptureModal — capture photo (canvas JPEG) ou vidéo (MediaRecorder) via getUserMedia.
 * Les permissions caméra (+ micro pour la vidéo) ne sont demandées qu’à l’ouverture du flux,
 * après que l’utilisateur a explicitement choisi « Caméra ».
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from '../i18n'
import { pushToast } from '../composables/useToast'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    filenamePrefix?: string
    /** Active l’onglet / mode vidéo (story mobile). Les pins mobile restent photo uniquement. */
    allowVideo?: boolean
    /** Durée max d’un clip caméra (secondes). */
    maxVideoSeconds?: number
  }>(),
  {
    filenamePrefix: 'capture',
    allowVideo: false,
    maxVideoSeconds: 120,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', open: boolean): void
  (e: 'capture', file: File): void
}>()

const { t } = useI18n()

const videoEl = ref<HTMLVideoElement | null>(null)
const stream = ref<MediaStream | null>(null)
const initializing = ref(false)
const errorMessage = ref<string | null>(null)
const facing = ref<'user' | 'environment'>('environment')
const hasMultipleDevices = ref(false)

/** Mode UX : photo ou vidéo (uniquement si allowVideo). */
const captureKind = ref<'photo' | 'video'>('photo')

const isRecording = ref(false)
let mediaRecorder: MediaRecorder | null = null
let recordingChunks: BlobPart[] = []
let recordingMimeType = ''
let recordTimerId: ReturnType<typeof setTimeout> | null = null

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const modalTitle = computed(() =>
  captureKind.value === 'video' && props.allowVideo ? t('camera.titleVideo') : t('camera.title'),
)

async function detectMultipleCameras() {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) return
    const devices = await navigator.mediaDevices.enumerateDevices()
    hasMultipleDevices.value = devices.filter((d) => d.kind === 'videoinput').length > 1
  } catch {
    hasMultipleDevices.value = false
  }
}

function preferredRecorderMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  const candidates = [
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ]
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime
  }
  return undefined
}

/** Annule un enregistrement sans émettre de fichier (fermeture modale, changement de flux). */
function abortActiveRecordingDiscard() {
  if (recordTimerId) {
    clearTimeout(recordTimerId)
    recordTimerId = null
  }
  if (mediaRecorder) {
    mediaRecorder.onstop = null
    if (mediaRecorder.state !== 'inactive') {
      try {
        mediaRecorder.stop()
      } catch {
        /* ignore */
      }
    }
    mediaRecorder = null
  }
  recordingChunks = []
  isRecording.value = false
}

/** Arrêt demandé par l’utilisateur : laisse `onstop` assembler le fichier. */
function stopRecordingUserFinalize() {
  if (recordTimerId) {
    clearTimeout(recordTimerId)
    recordTimerId = null
  }
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try {
      mediaRecorder.stop()
    } catch {
      finalizeRecording()
    }
  } else {
    finalizeRecording()
  }
}

async function startStream() {
  errorMessage.value = null
  initializing.value = true
  abortActiveRecordingDiscard()
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      errorMessage.value = t('camera.error.unsupported')
      return
    }
    stopStreamInner()
    const wantAudio = props.allowVideo && captureKind.value === 'video'
    const constraints: MediaStreamConstraints = {
      audio: wantAudio ? { echoCancellation: true, noiseSuppression: true } : false,
      video: {
        facingMode: { ideal: facing.value },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    }
    stream.value = await navigator.mediaDevices.getUserMedia(constraints)
    await nextTick()
    if (videoEl.value) {
      videoEl.value.srcObject = stream.value
      try {
        await videoEl.value.play()
      } catch {
        /* autoplay refusé */
      }
    }
    void detectMultipleCameras()
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name || ''
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      errorMessage.value =
        captureKind.value === 'video' && props.allowVideo
          ? t('camera.error.permissionAV')
          : t('camera.error.permission')
    } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      errorMessage.value = t('camera.error.noDevice')
    } else {
      errorMessage.value = t('camera.error.generic')
    }
  } finally {
    initializing.value = false
  }
}

function stopStreamInner() {
  abortActiveRecordingDiscard()
  if (stream.value) {
    stream.value.getTracks().forEach((trk) => trk.stop())
    stream.value = null
  }
  if (videoEl.value) {
    try {
      videoEl.value.srcObject = null
    } catch {
      /* ignore */
    }
  }
}

function close() {
  stopStreamInner()
  open.value = false
}

async function flipCamera() {
  if (isRecording.value) return
  facing.value = facing.value === 'environment' ? 'user' : 'environment'
  await startStream()
}

async function setCaptureKind(kind: 'photo' | 'video') {
  if (!props.allowVideo && kind === 'video') return
  if (captureKind.value === kind) return
  captureKind.value = kind
  await startStream()
}

async function capturePhoto() {
  if (!videoEl.value || !stream.value) return
  const v = videoEl.value
  const w = v.videoWidth
  const h = v.videoHeight
  if (!w || !h) {
    pushToast({ message: t('camera.error.notReady'), kind: 'warning' })
    return
  }
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  if (facing.value === 'user') {
    ctx.translate(w, 0)
    ctx.scale(-1, 1)
  }
  ctx.drawImage(v, 0, 0, w, h)

  const blob: Blob | null = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
  })
  if (!blob) {
    pushToast({ message: t('camera.error.encode'), kind: 'error' })
    return
  }
  const prefix = props.filenamePrefix || 'capture'
  const file = new File([blob], `${prefix}-${Date.now()}.jpg`, { type: 'image/jpeg' })
  emit('capture', file)
  close()
}

function finalizeRecording() {
  isRecording.value = false
  const mime = recordingMimeType || 'video/webm'
  const blob = new Blob(recordingChunks, { type: mime })
  recordingChunks = []
  mediaRecorder = null
  if (!blob.size) {
    pushToast({ message: t('camera.error.recordEmpty'), kind: 'warning' })
    return
  }
  const prefix = props.filenamePrefix || 'capture'
  const ext = mime.includes('mp4') ? 'mp4' : 'webm'
  const file = new File([blob], `${prefix}-${Date.now()}.${ext}`, { type: mime })
  emit('capture', file)
  close()
}

function toggleVideoRecord() {
  if (!stream.value || initializing.value || errorMessage.value) return
  if (!props.allowVideo || captureKind.value !== 'video') return

  if (typeof MediaRecorder === 'undefined') {
    pushToast({ message: t('camera.error.recordUnsupported'), kind: 'warning' })
    return
  }

  if (!isRecording.value) {
    const mimeType = preferredRecorderMime()
    recordingChunks = []
    recordingMimeType = mimeType || 'video/webm'
    try {
      mediaRecorder = mimeType
        ? new MediaRecorder(stream.value, { mimeType })
        : new MediaRecorder(stream.value)
    } catch {
      pushToast({ message: t('camera.error.recordUnsupported'), kind: 'warning' })
      return
    }
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordingChunks.push(e.data)
    }
    mediaRecorder.onstop = () => finalizeRecording()
    mediaRecorder.start(250)
    isRecording.value = true
    const ms = Math.max(5, props.maxVideoSeconds) * 1000
    recordTimerId = window.setTimeout(() => {
      stopRecordingUserFinalize()
    }, ms)
    return
  }

  stopRecordingUserFinalize()
}

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      if (!props.allowVideo) captureKind.value = 'photo'
      void startStream()
    } else {
      stopStreamInner()
    }
  },
)

watch(
  () => props.allowVideo,
  (av) => {
    if (!av) captureKind.value = 'photo'
  },
)

onBeforeUnmount(() => {
  stopStreamInner()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="camera-capture-root fixed inset-0 z-[140] flex flex-col bg-black/40 sm:items-center sm:justify-center app-modal-backdrop"
      @click.self="close"
    >
      <div
        class="camera-capture-panel relative flex min-h-0 flex-1 basis-0 flex-col overflow-hidden bg-neutral-100/95 text-neutral-900 shadow-xl ring-1 ring-black/[0.08] backdrop-blur-2xl dark:bg-black/85 dark:text-white dark:ring-white/10 sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:flex-none sm:basis-auto sm:rounded-3xl"
      >
        <!-- Header -->
        <div class="flex shrink-0 items-center justify-between border-b border-neutral-200/90 px-4 py-3 dark:border-white/10">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-neutral-800 dark:text-white">
            {{ modalTitle }}
          </h2>
          <button
            type="button"
            class="grid h-9 w-9 place-items-center rounded-full bg-neutral-200/80 text-neutral-800 transition hover:bg-neutral-300/90 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
            :aria-label="t('common.close')"
            @click="close"
          >
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div
          v-if="allowVideo"
          class="flex shrink-0 justify-center gap-2 border-b border-neutral-200/80 px-4 py-2 dark:border-white/10"
        >
          <button
            type="button"
            class="rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide transition"
            :class="
              captureKind === 'photo'
                ? 'bg-pink-700 text-white dark:bg-pink-600'
                : 'bg-neutral-200/80 text-neutral-600 dark:bg-white/10 dark:text-white/70'
            "
            @click="void setCaptureKind('photo')"
          >
            {{ t('camera.mode.photo') }}
          </button>
          <button
            type="button"
            class="rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide transition"
            :class="
              captureKind === 'video'
                ? 'bg-pink-700 text-white dark:bg-pink-600'
                : 'bg-neutral-200/80 text-neutral-600 dark:bg-white/10 dark:text-white/70'
            "
            @click="void setCaptureKind('video')"
          >
            {{ t('camera.mode.video') }}
          </button>
        </div>

        <!-- Preview (WebKit : flex-1 + basis-0 + min-h-0 évite hauteur 0 sur la vidéo). -->
        <div class="relative min-h-0 flex-1 basis-0 bg-neutral-950 dark:bg-black">
          <video
            ref="videoEl"
            class="absolute inset-0 h-full w-full object-contain"
            :class="facing === 'user' ? 'scale-x-[-1]' : ''"
            playsinline
            muted
            autoplay
          />
          <div
            v-if="initializing"
            class="absolute inset-0 grid place-items-center text-sm text-neutral-100"
          >
            <div class="flex flex-col items-center gap-3">
              <div class="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              <span>{{ t('camera.initializing') }}</span>
            </div>
          </div>
          <div
            v-else-if="errorMessage"
            class="absolute inset-0 grid place-items-center px-6 text-center text-sm text-white/85"
          >
            <div class="flex max-w-sm flex-col items-center gap-3">
              <span class="material-symbols-outlined text-4xl text-rose-300">videocam_off</span>
              <p>{{ errorMessage }}</p>
              <button
                type="button"
                class="mt-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider hover:bg-white/20"
                @click="startStream"
              >
                {{ t('camera.retry') }}
              </button>
            </div>
          </div>
          <div
            v-if="isRecording"
            class="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-xs font-bold text-white ring-1 ring-white/15 backdrop-blur-md"
          >
            <span class="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            {{ t('camera.recording') }}
          </div>
        </div>

        <!-- Controls -->
        <div class="flex shrink-0 items-center justify-around border-t border-white/10 bg-black/40 px-4 py-4 backdrop-blur-md">
          <button
            type="button"
            class="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-30"
            :disabled="!hasMultipleDevices || initializing || isRecording"
            :aria-label="t('camera.flip')"
            @click="flipCamera"
          >
            <span class="material-symbols-outlined">cameraswitch</span>
          </button>

          <!-- Photo shutter -->
          <button
            v-if="captureKind === 'photo' || !allowVideo"
            type="button"
            class="relative grid h-16 w-16 place-items-center rounded-full bg-white text-pink-700 shadow-xl ring-4 ring-white/20 transition hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!stream || initializing || !!errorMessage"
            :aria-label="t('camera.shutter')"
            @click="capturePhoto"
          >
            <span class="material-symbols-outlined text-3xl" style="font-variation-settings: 'FILL' 1">photo_camera</span>
          </button>

          <!-- Video record -->
          <button
            v-else
            type="button"
            class="relative grid h-16 w-16 place-items-center rounded-full shadow-xl ring-4 transition hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            :class="
              isRecording
                ? 'bg-red-600 text-white ring-red-400/40'
                : 'bg-white text-red-600 ring-white/20'
            "
            :disabled="!stream || initializing || !!errorMessage"
            :aria-label="isRecording ? t('camera.stopRecording') : t('camera.startRecording')"
            @click="toggleVideoRecord"
          >
            <span
              v-if="isRecording"
              class="h-7 w-7 rounded-md bg-white"
            />
            <span
              v-else
              class="material-symbols-outlined text-4xl"
              style="font-variation-settings: 'FILL' 1"
            >fiber_manual_record</span>
          </button>

          <span class="h-11 w-11" aria-hidden="true" />
        </div>

        <p
          v-if="allowVideo && captureKind === 'video' && !errorMessage"
          class="shrink-0 px-4 pb-3 text-center text-[11px] leading-relaxed text-white/50"
        >
          {{ t('camera.videoModeHint') }}
        </p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.camera-capture-root {
  min-height: 100vh;
  min-height: 100svh;
  min-height: -webkit-fill-available;
}
</style>
