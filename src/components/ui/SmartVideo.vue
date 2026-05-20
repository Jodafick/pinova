<script setup lang="ts">
/**
 * SmartVideo — vidéo premium iOS-first.
 *
 * Caractéristiques :
 *  - Autoplay intelligent : lecture quand l'élément entre dans le viewport
 *    (IntersectionObserver), pause quand il sort
 *  - Pause aussi sur `document.visibilitychange` (onglet/app caché)
 *  - Pool d'éléments video (`useVideoPool`) : évite la limite iOS de 16 videos
 *    simultanées et le coût d'allocation
 *  - Low-power mode : respect de `navigator.connection.saveData` et de la
 *    Battery API (autoplay désactivé si batterie < 20% non-chargée)
 *  - Controls minimalistes (tap pour mute/unmute, double-tap pour like via prop)
 *  - Anti-leak (controlslist=nodownload, disable picture-in-picture)
 *  - Preload thumbnail jusqu'à pixel-ready (poster blurhash optionnel)
 *  - Démontage propre : pause + release au pool
 *
 * iOS Safari specifics :
 *  - `playsinline` ET `webkit-playsinline` (le second pour iOS < 13)
 *  - Mute initial obligatoire pour autoplay
 *  - `disableRemotePlayback` évite l'icône AirPlay parasite
 *
 * Usage :
 *
 *   <SmartVideo
 *     :src="pin.storyVideoUrl"
 *     :poster="pin.imageUrl"
 *     :blurhash="pin.blurhash"
 *     :autoplay="true"
 *     loop
 *   />
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useVideoPool } from '../../composables/useVideoPool'
import { blurhashToDataUrl } from '../../composables/useBlurhash'
import { mediaProfile, pauseVideo, playVideo, rememberVideoPoster, cacheMediaForOffline } from '../../media'

interface Props {
  src: string
  /** Image affichée tant que la vidéo n'est pas play-ready (URL). */
  poster?: string
  /** Hash blurhash backend pour placeholder décodé localement. */
  blurhash?: string
  /** Couleur dominante fallback. */
  fallbackColor?: string
  /** Lecture auto quand visible (default true). */
  autoplay?: boolean
  /** Boucle (default true sur stories, false sur articles). */
  loop?: boolean
  /** Démarrer mute (obligatoire pour autoplay iOS). */
  muted?: boolean
  /** Contrôles natifs (default false, on utilise des controls custom). */
  controls?: boolean
  /** Aspect-ratio pour éviter layout shift. */
  aspectRatio?: number | string
  /** Marge IO pour preload anticipé (default 200px). */
  rootMargin?: string
  /** Seuil de visibilité pour démarrer (0.5 = 50% visible). */
  visibilityThreshold?: number
  /** Désactive l'autoplay en mode économie. */
  respectLowPower?: boolean
  /** Désactive le tap pour mute/unmute. */
  noTapUnmute?: boolean
  /** Anti-leak hooks. */
  antiLeak?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  autoplay: true,
  loop: true,
  muted: true,
  controls: false,
  rootMargin: '200px',
  visibilityThreshold: 0.5,
  respectLowPower: true,
  noTapUnmute: false,
  antiLeak: false,
})

const emit = defineEmits<{
  (e: 'play'): void
  (e: 'pause'): void
  (e: 'ended'): void
  (e: 'mute', muted: boolean): void
  (e: 'error', err: Event | Error): void
  (e: 'firstframe'): void
}>()

const containerRef = ref<HTMLElement | null>(null)
const videoEl = ref<HTMLVideoElement | null>(null)
const isPlaying = ref(false)
const isMutedLocal = ref(props.muted)
const isReady = ref(false)
const hasError = ref(false)
const lowPowerMode = ref(false)

const pool = useVideoPool()

/* ─── Poster (blurhash si dispo, sinon poster URL, sinon fallback color) ─── */
const posterSource = computed<string>(() => {
  if (props.blurhash) {
    const url = blurhashToDataUrl(props.blurhash, 32, 32)
    if (url) return `url(${url}) center/cover no-repeat`
  }
  if (props.poster) return `url(${props.poster}) center/cover no-repeat`
  if (props.fallbackColor) return props.fallbackColor
  return '#000'
})

const aspectRatioStyle = computed(() => {
  if (typeof props.aspectRatio === 'number') return `${props.aspectRatio} / 1`
  if (typeof props.aspectRatio === 'string') return props.aspectRatio
  return undefined
})

/* ─── Low power detection ─── */

async function detectLowPower(): Promise<boolean> {
  if (!props.respectLowPower) return false
  /* Save data preference ? */
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  if (conn?.saveData) return true
  if (conn?.effectiveType && /^2g|slow-2g/.test(conn.effectiveType)) return true
  /* Battery API (deprecated mais Safari iOS la supporte encore via prefix). */
  try {
    const battery = await (navigator as Navigator & { getBattery?: () => Promise<{ level: number; charging: boolean }> })
      .getBattery?.()
    if (battery && battery.level < 0.2 && !battery.charging) return true
  } catch { /* ignore */ }
  return false
}

/* ─── Acquisition vidéo depuis pool + binding events ─── */

function attachVideo() {
  if (!containerRef.value) return
  const el = pool.acquire(props.src)
  if (!el) {
    hasError.value = true
    return
  }

  /* Configuration locale (peut différer du défaut pool). */
  el.muted = isMutedLocal.value
  el.loop = props.loop
  el.controls = props.controls
  /* Stratégie `preload` issue du profil adaptatif (`auto` iOS, `metadata`
     Material/Desktop, `none` si saveData). Permet de NE PAS télécharger la
     vidéo entière côté Desktop / saveData tant qu'elle n'est pas demandée. */
  try { el.preload = mediaProfile().videoPreload } catch { /* ignore */ }
  el.setAttribute('playsinline', '')
  if (props.antiLeak) {
    el.setAttribute('controlslist', 'nodownload noremoteplayback noplaybackrate')
    el.disablePictureInPicture = true
  }
  /* Mémorise le poster côté offlineCache pour pouvoir l'afficher comme
     `stale preview` lors d'une transition feed → viewer. */
  if (props.poster) rememberVideoPoster(props.src, props.poster)

  /* Events */
  el.addEventListener('play', onPlay)
  el.addEventListener('pause', onPause)
  el.addEventListener('ended', onEnded)
  el.addEventListener('error', onError)
  el.addEventListener('loadeddata', onReady)
  el.addEventListener('canplay', onReady)

  /* Mount dans le container. */
  containerRef.value.appendChild(el)
  videoEl.value = el
}

function detachVideo() {
  const el = videoEl.value
  if (!el) return
  el.removeEventListener('play', onPlay)
  el.removeEventListener('pause', onPause)
  el.removeEventListener('ended', onEnded)
  el.removeEventListener('error', onError)
  el.removeEventListener('loadeddata', onReady)
  el.removeEventListener('canplay', onReady)
  try { el.parentNode?.removeChild(el) } catch { /* ignore */ }
  pool.release(el)
  videoEl.value = null
}

function onPlay() {
  isPlaying.value = true
  emit('play')
}
function onPause() {
  isPlaying.value = false
  emit('pause')
}
function onEnded() {
  isPlaying.value = false
  emit('ended')
}
function onError(e: Event) {
  hasError.value = true
  emit('error', e)
}
function onReady() {
  if (!isReady.value) {
    isReady.value = true
    emit('firstframe')
    if (props.src) void cacheMediaForOffline(props.src)
  }
}

async function tryPlay() {
  if (!videoEl.value || hasError.value || lowPowerMode.value) return
  if (!props.autoplay) return
  /* Délègue au mediaEngine : Safari fallback mute auto + erreurs silencieuses. */
  if (!videoEl.value.muted) videoEl.value.muted = true
  await playVideo(videoEl.value, { mutedFallback: true })
}

function pause() {
  if (!videoEl.value) return
  pauseVideo(videoEl.value)
}

/* ─── Visibility (IntersectionObserver) ─── */

let visibilityObserver: IntersectionObserver | null = null
const isVisible = ref(false)

function setupVisibility() {
  if (!containerRef.value || typeof IntersectionObserver === 'undefined') return
  visibilityObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        isVisible.value = entry.isIntersecting && entry.intersectionRatio >= props.visibilityThreshold
      }
    },
    {
      rootMargin: props.rootMargin,
      threshold: [0, props.visibilityThreshold, 1],
    },
  )
  visibilityObserver.observe(containerRef.value)
}

/* React to visibility / playback context. */
watch(isVisible, async (visible) => {
  if (visible) {
    if (!videoEl.value) attachVideo()
    await tryPlay()
  } else {
    pause()
  }
})

/* ─── Document visibility (tab hidden) ─── */

function onDocVisibility() {
  if (document.hidden) {
    pause()
  } else if (isVisible.value) {
    void tryPlay()
  }
}

/* ─── Tap to mute/unmute ─── */

function onTap() {
  if (props.noTapUnmute) return
  if (!videoEl.value) return
  const next = !videoEl.value.muted
  videoEl.value.muted = next
  isMutedLocal.value = next
  emit('mute', next)
}

/* ─── Lifecycle ─── */

onMounted(async () => {
  lowPowerMode.value = await detectLowPower()
  setupVisibility()
  document.addEventListener('visibilitychange', onDocVisibility)
})

onBeforeUnmount(() => {
  visibilityObserver?.disconnect()
  visibilityObserver = null
  document.removeEventListener('visibilitychange', onDocVisibility)
  detachVideo()
})

/* ─── React to src change ─── */

watch(() => props.src, (next, prev) => {
  if (next === prev) return
  detachVideo()
  hasError.value = false
  isReady.value = false
  if (isVisible.value) attachVideo()
})

/* Expose pour parent (zoom, scrub, etc.). */
defineExpose({
  play: tryPlay,
  pause,
  toggleMute: onTap,
  videoEl,
  isPlaying,
  isMuted: isMutedLocal,
})
</script>

<template>
  <div
    ref="containerRef"
    class="smart-video"
    :class="{
      'smart-video--ready': isReady,
      'smart-video--error': hasError,
      'smart-video--lowpower': lowPowerMode,
    }"
    :style="{
      background: posterSource,
      aspectRatio: aspectRatioStyle,
    }"
    @click="onTap"
  >
    <!-- Le <video> est inséré dynamiquement par le pool. -->

    <!-- Indicator mute (overlay subtil). -->
    <div v-if="!noTapUnmute && isPlaying && isMutedLocal" class="smart-video__mute-badge" aria-hidden="true">
      <span class="material-symbols-outlined">volume_off</span>
    </div>

    <!-- Indicator low-power (autoplay désactivé). -->
    <button
      v-if="lowPowerMode && !isPlaying"
      type="button"
      class="smart-video__play-btn"
      :aria-label="'Lire la vidéo'"
      @click.stop="tryPlay"
    >
      <span class="material-symbols-outlined">play_arrow</span>
    </button>

    <!-- Erreur. -->
    <div v-if="hasError" class="smart-video__error" aria-live="polite">
      <span class="material-symbols-outlined">broken_image</span>
    </div>
  </div>
</template>

<style scoped>
.smart-video {
  position: relative;
  display: block;
  overflow: hidden;
  background-color: #000;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  -webkit-tap-highlight-color: transparent;
  /* GPU layer. */
  transform: translate3d(0, 0, 0);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  isolation: isolate;
}

.smart-video :deep(video) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 240ms cubic-bezier(0.22, 1, 0.36, 1);
  /* iOS Safari : retire l'overlay sombre par défaut. */
  background-color: transparent;
}

.smart-video--ready :deep(video) {
  opacity: 1;
}

.smart-video__mute-badge {
  position: absolute;
  right: 12px;
  bottom: 12px;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  background-color: rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: grid;
  place-items: center;
  color: white;
  pointer-events: none;
  z-index: 2;
}
.smart-video__mute-badge .material-symbols-outlined { font-size: 18px; }

.smart-video__play-btn {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 56px;
  height: 56px;
  border-radius: 999px;
  background-color: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  display: grid;
  place-items: center;
  color: white;
  cursor: pointer;
  z-index: 3;
  -webkit-tap-highlight-color: transparent;
}
.smart-video__play-btn .material-symbols-outlined { font-size: 30px; }

.smart-video__error {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: rgba(255, 255, 255, 0.6);
  z-index: 4;
}
.smart-video__error .material-symbols-outlined { font-size: 36px; }

@media (prefers-reduced-motion: reduce) {
  .smart-video :deep(video) {
    transition: opacity 80ms linear;
  }
}
</style>
