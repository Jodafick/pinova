<script setup lang="ts">
/**
 * ProgressiveImage — image premium iOS-first.
 *
 * Pipeline progressive :
 *   1. Placeholder INSTANTANÉ (blurhash decoded, ou couleur dominante, ou skel)
 *   2. Image low-res (si `lowResSrc` fournie) en CSS background (decode bg-stage)
 *   3. Image full-res décodée en async (`HTMLImageElement.decode()`) hors thread
 *   4. Fade-in 240ms (cubic-bezier iOS) une fois pixel-ready (jamais de saut)
 *
 * Caractéristiques :
 *  - IntersectionObserver : ne décode QUE quand l'image entre dans (ou est proche du) viewport
 *  - `fetchpriority` adaptable (`high` pour above-the-fold, `auto` ailleurs)
 *  - `loading="lazy"` natif en fallback (browsers récents)
 *  - Pas de Layout Shift : ratio aspect réservé via `aspectRatio` ou width/height
 *  - Anti-flicker en SSR : placeholder rendu immédiatement
 *
 * Performance Safari iOS :
 *  - `image.decode()` évite le jank thread principal au paint
 *  - Pas de filtre CSS animé (coût GPU)
 *  - Pas de `box-shadow` sur l'élément animé (uniquement opacity + transform)
 *
 * Usage :
 *
 *   <ProgressiveImage
 *     :src="pin.imageUrl"
 *     :blurhash="pin.blurhash"
 *     :aspect-ratio="pin.aspectRatio"
 *     alt="Foto de l'utilisateur"
 *     priority="high"
 *   />
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { blurhashToDataUrl } from '../../composables/useBlurhash'
import { trackBudget } from '../../core/domBudget'
import { loadImage, mediaProfile } from '../../media'

interface Props {
  /** URL source haute résolution. */
  src: string
  /** URL low-res (optionnel) — affichée pendant que `src` se décode. */
  lowResSrc?: string
  /** Hash blurhash backend (32 bytes typique). */
  blurhash?: string
  /** Couleur dominante fallback (hex / rgb / oklch). */
  fallbackColor?: string
  /** Texte alternatif (accessibilité). */
  alt?: string
  /** Ratio width/height (ex: 0.75 = portrait 4:3). Sans ça → layout shift. */
  aspectRatio?: number | string
  /** Largeur en px (preferred over aspectRatio si fourni). */
  width?: number | string
  /** Hauteur en px. */
  height?: number | string
  /** Priorité de fetch : high pour above-the-fold, auto par défaut. */
  priority?: 'high' | 'auto' | 'low'
  /** Forcer le decode immédiat (skip intersection observer). */
  eager?: boolean
  /** Object-fit : 'cover' (défaut) ou 'contain'. */
  fit?: 'cover' | 'contain' | 'fill'
  /** Margin pour IntersectionObserver (preload anticipé). */
  rootMargin?: string
  /** Class à ajouter sur le wrapper. */
  wrapperClass?: string
  /** Disable interactions (drag, contextmenu, save). */
  antiLeak?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  priority: 'auto',
  eager: false,
  fit: 'cover',
  rootMargin: '200px',
  antiLeak: false,
})

/* Marge adaptative : on prend le max(prop, profile) pour préserver
   d'éventuelles overrides metiers tout en bénéficiant de la stratégie
   `aggressive` iOS / `bandwidth-aware` desktop. */
const adaptiveRootMargin = computed(() => {
  const profileMargin = mediaProfile().preloadMarginPx
  /* Convertit la prop string (`200px`) → number si possible. */
  const propMarginMatch = /^([\d.]+)\s*px$/.exec(String(props.rootMargin))
  const propMargin = propMarginMatch ? parseFloat(propMarginMatch[1]) : NaN
  if (!Number.isFinite(propMargin)) return props.rootMargin
  return `${Math.max(propMargin, profileMargin)}px`
})

const emit = defineEmits<{
  (e: 'loaded', src: string): void
  (e: 'error', err: Event | Error): void
}>()

const wrapperRef = ref<HTMLElement | null>(null)
const shouldDecode = ref(props.eager)
const isDecoded = ref(false)
const hasError = ref(false)

/* Placeholder calculé (priorité blurhash > fallbackColor > skel default). */
const placeholderDataUrl = computed(() => {
  if (!props.blurhash) return ''
  try {
    return blurhashToDataUrl(props.blurhash, 32, 32)
  } catch {
    return ''
  }
})

const placeholderBackground = computed<string>(() => {
  if (placeholderDataUrl.value) return `url(${placeholderDataUrl.value}) center/cover no-repeat`
  if (props.fallbackColor) return props.fallbackColor
  return 'var(--fotoce-skel-base, #f1f0f2)'
})

const aspectRatioStyle = computed(() => {
  if (props.width && props.height) return undefined
  if (typeof props.aspectRatio === 'number') return `${props.aspectRatio} / 1`
  if (typeof props.aspectRatio === 'string') return props.aspectRatio
  return undefined
})

/* ─── IntersectionObserver lazy-load ─── */

let observer: IntersectionObserver | null = null

function setupObserver() {
  if (props.eager || shouldDecode.value) return
  if (!wrapperRef.value || typeof IntersectionObserver === 'undefined') {
    /* Pas d'IO dispo → fallback decode immédiat. */
    shouldDecode.value = true
    return
  }
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          shouldDecode.value = true
          observer?.disconnect()
          observer = null
          break
        }
      }
    },
    { rootMargin: adaptiveRootMargin.value, threshold: 0.01 },
  )
  observer.observe(wrapperRef.value)
}

let releaseBudget: (() => void) | null = null

onMounted(() => {
  setupObserver()
  releaseBudget = trackBudget('mountedImages')
})
onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  releaseBudget?.()
  releaseBudget = null
})

/* ─── Decode async une fois `shouldDecode` true ─── */

watch([shouldDecode, () => props.src], async ([decode, src]) => {
  if (!decode || !src) return
  isDecoded.value = false
  hasError.value = false
  try {
    /* Délègue au mediaEngine : cache LRU global, decode async, concurrence
       bornée par le profil adaptatif. Idempotent : un autre composant qui
       monte la même `src` ne déclenchera pas un 2e fetch. */
    await loadImage(src, { priority: props.priority })
    isDecoded.value = true
    emit('loaded', src)
  } catch (err) {
    hasError.value = true
    emit('error', err as Error)
  }
}, { immediate: true })

/* ─── Anti-leak handlers (no-op si !antiLeak) ─── */

const antiLeakAttrs = computed(() => {
  if (!props.antiLeak) return {}
  return {
    draggable: false,
    onContextmenu: (e: Event) => { e.preventDefault() },
    onDragstart: (e: Event) => { e.preventDefault() },
  }
})
</script>

<template>
  <div
    ref="wrapperRef"
    class="progressive-image"
    :class="[wrapperClass, { 'progressive-image--decoded': isDecoded, 'progressive-image--error': hasError }]"
    :style="{
      background: placeholderBackground,
      aspectRatio: aspectRatioStyle,
      width: typeof width === 'number' ? `${width}px` : width,
      height: typeof height === 'number' ? `${height}px` : height,
    }"
  >
    <!-- Low-res preview : affichée pendant que la full-res se décode. -->
    <img
      v-if="lowResSrc && !isDecoded && !hasError"
      :src="lowResSrc"
      class="progressive-image__lowres"
      :class="{ 'object-cover': fit === 'cover', 'object-contain': fit === 'contain' }"
      :alt="alt"
      aria-hidden="true"
      decoding="async"
      v-bind="antiLeakAttrs"
    />

    <!-- Full-res, fade-in une fois décodée. -->
    <img
      v-if="shouldDecode && !hasError"
      :src="src"
      :alt="alt"
      class="progressive-image__main"
      :class="{
        'progressive-image__main--ready': isDecoded,
        'object-cover': fit === 'cover',
        'object-contain': fit === 'contain',
        'object-fill': fit === 'fill',
      }"
      :loading="priority === 'high' ? 'eager' : 'lazy'"
      :fetchpriority="priority"
      decoding="async"
      v-bind="antiLeakAttrs"
    />

    <!-- Error state minimal. -->
    <div v-if="hasError" class="progressive-image__error" aria-live="polite">
      <FotoceIcon name="broken_image" />
    </div>
  </div>
</template>

<style scoped>
.progressive-image {
  position: relative;
  overflow: hidden;
  display: block;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  /* GPU layer pour éviter repaint pendant fade-in. */
  transform: translate3d(0, 0, 0);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  isolation: isolate;
}

.progressive-image__lowres,
.progressive-image__main {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.progressive-image__lowres {
  z-index: 1;
  /* Léger blur sur la low-res, supprimé via mise à l'échelle / saturation. */
  filter: blur(8px) saturate(1.05);
  transform: scale(1.04);
  pointer-events: none;
}

.progressive-image__main {
  z-index: 2;
  opacity: 0;
  transition: opacity 240ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: opacity;
}

.progressive-image__main--ready {
  opacity: 1;
}

.progressive-image__error {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--fotoce-text-tertiary, #75717a);
  z-index: 3;
  background: var(--fotoce-skel-base, #f1f0f2);
}

.progressive-image__error .fotoce-icon {
  font-size: 38px;
  opacity: 0.5;
}

@media (prefers-reduced-motion: reduce) {
  .progressive-image__main {
    transition: opacity 80ms linear;
  }
  .progressive-image__lowres {
    filter: blur(4px);
  }
}
</style>
