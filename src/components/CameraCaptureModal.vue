<script setup lang="ts">
/**
 * CameraCaptureModal — capture photo via getUserMedia (webcam PC + caméra mobile).
 * Modal plein écran, blur, preview live, snap → File.
 *
 * Usage :
 *   <CameraCaptureModal v-model="open" @capture="(file) => onFile(file)" />
 *
 * - PC : utilise getUserMedia (front/back si dispo)
 * - Mobile : idem (résultat plus fiable que <input capture> sur PWA)
 * - Émet un File JPEG ~92 % qualité, dimensions natives du flux
 * - Permission refusée / pas de caméra : message d'erreur clair
 * - Bascule front / arrière si plusieurs devices
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from '../i18n'
import { pushToast } from '../composables/useToast'

const props = defineProps<{
  modelValue: boolean
  /** Préfixe nom de fichier (ex. "pin", "story"). Default "capture". */
  filenamePrefix?: string
}>()

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

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

async function detectMultipleCameras() {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) return
    const devices = await navigator.mediaDevices.enumerateDevices()
    hasMultipleDevices.value = devices.filter((d) => d.kind === 'videoinput').length > 1
  } catch {
    hasMultipleDevices.value = false
  }
}

async function startStream() {
  errorMessage.value = null
  initializing.value = true
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      errorMessage.value = t('camera.error.unsupported')
      return
    }
    /* Stop existing stream avant de relancer (switch facing). */
    stopStream()
    const constraints: MediaStreamConstraints = {
      audio: false,
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
        /* autoplay refusé : l'utilisateur doit toucher la vidéo */
      }
    }
    void detectMultipleCameras()
  } catch (err: any) {
    const name = err?.name || ''
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      errorMessage.value = t('camera.error.permission')
    } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      errorMessage.value = t('camera.error.noDevice')
    } else {
      errorMessage.value = t('camera.error.generic')
    }
  } finally {
    initializing.value = false
  }
}

function stopStream() {
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
  stopStream()
  open.value = false
}

async function flipCamera() {
  facing.value = facing.value === 'environment' ? 'user' : 'environment'
  await startStream()
}

async function capture() {
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
  /* Miroir horizontal si caméra front (UX naturelle, mais on enregistre l'image
     telle qu'elle apparaît). */
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

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      void startStream()
    } else {
      stopStream()
    }
  },
)

onBeforeUnmount(() => {
  stopStream()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[140] flex items-center justify-center app-modal-backdrop"
      @click.self="close"
    >
      <div
        class="relative w-full h-full sm:h-auto sm:max-w-3xl sm:max-h-[90vh] sm:rounded-3xl overflow-hidden bg-black/85 backdrop-blur-2xl backdrop-saturate-150 ring-1 ring-white/10 flex flex-col"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 text-white border-b border-white/10">
          <h2 class="text-sm font-semibold tracking-wide uppercase">
            {{ t('camera.title') }}
          </h2>
          <button
            type="button"
            class="grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/20 transition"
            :aria-label="t('common.close')"
            @click="close"
          >
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <!-- Preview -->
        <div class="relative flex-1 min-h-0 bg-black">
          <video
            ref="videoEl"
            class="w-full h-full object-contain"
            :class="facing === 'user' ? 'scale-x-[-1]' : ''"
            playsinline
            muted
            autoplay
          />
          <div
            v-if="initializing"
            class="absolute inset-0 grid place-items-center text-white/80 text-sm"
          >
            <div class="flex flex-col items-center gap-3">
              <div class="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              <span>{{ t('camera.initializing') }}</span>
            </div>
          </div>
          <div
            v-else-if="errorMessage"
            class="absolute inset-0 grid place-items-center text-center text-white/85 text-sm px-6"
          >
            <div class="flex flex-col items-center gap-3 max-w-sm">
              <span class="material-symbols-outlined text-4xl text-rose-300">videocam_off</span>
              <p>{{ errorMessage }}</p>
              <button
                type="button"
                class="mt-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold uppercase tracking-wider"
                @click="startStream"
              >
                {{ t('camera.retry') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Controls -->
        <div class="flex items-center justify-around px-4 py-4 bg-black/40 backdrop-blur-md border-t border-white/10">
          <button
            type="button"
            class="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 transition disabled:opacity-30"
            :disabled="!hasMultipleDevices || initializing"
            :aria-label="t('camera.flip')"
            @click="flipCamera"
          >
            <span class="material-symbols-outlined">cameraswitch</span>
          </button>
          <button
            type="button"
            class="relative grid h-16 w-16 place-items-center rounded-full bg-white text-pink-700 shadow-xl ring-4 ring-white/20 hover:scale-105 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!stream || initializing || !!errorMessage"
            :aria-label="t('camera.shutter')"
            @click="capture"
          >
            <span class="material-symbols-outlined text-3xl" style="font-variation-settings: 'FILL' 1">photo_camera</span>
          </button>
          <span class="h-11 w-11" aria-hidden="true" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
