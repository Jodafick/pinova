<script setup lang="ts">
/**
 * FeedWashLayers — couches décoratives pour donner au feed une sensation
 * "premium iOS" inspirée du mobile RN (feedWashTop / feedWashBottom / glassFill).
 *
 * Composé de :
 *  - Un wash rose subtil en haut (fade pin → transparent) qui rend la scroll-area
 *    plus chaleureuse et adoucit l'éventuelle status bar.
 *  - Un wash bas (transparent → fade neutral) qui crée une "fondue" sous la tab bar.
 *  - Optionnel : couche glass (saturate + blur) au-dessus pour les pages plein écran.
 *
 * Tout est rendu en `position: fixed` derrière le contenu, GPU-friendly,
 * sans bloquer les events (`pointer-events: none`).
 */
import { computed } from 'vue'

interface Props {
  /** Intensité globale (0 → 1). Default 1. */
  intensity?: number
  /** Active le wash bas. Default true. */
  bottom?: boolean
  /** Active le wash haut. Default true. */
  top?: boolean
  /** Couche glass plein écran (blur + saturate). Default false. */
  glass?: boolean
  /** Décalage top en px pour s'aligner sous une status bar / header. Default 0. */
  topOffset?: number
  /** Décalage bottom en px pour s'aligner au-dessus d'une tab bar. Default 0. */
  bottomOffset?: number
}

const props = withDefaults(defineProps<Props>(), {
  intensity: 1,
  bottom: true,
  top: true,
  glass: false,
  topOffset: 0,
  bottomOffset: 0,
})

const styleVars = computed(() => ({
  '--wash-intensity': String(Math.max(0, Math.min(1, props.intensity))),
  '--wash-top-offset': `${props.topOffset}px`,
  '--wash-bottom-offset': `${props.bottomOffset}px`,
}))
</script>

<template>
  <div class="feed-wash-layers" :style="styleVars" aria-hidden="true">
    <div v-if="glass" class="feed-wash-glass" />
    <div v-if="top" class="feed-wash-top" />
    <div v-if="bottom" class="feed-wash-bottom" />
  </div>
</template>

<style scoped>
.feed-wash-layers {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  contain: strict;
}

.feed-wash-top {
  position: absolute;
  left: 0;
  right: 0;
  top: var(--wash-top-offset, 0px);
  height: 180px;
  background: linear-gradient(
    to bottom,
    rgba(255, 220, 232, calc(0.55 * var(--wash-intensity, 1))) 0%,
    rgba(255, 220, 232, calc(0.18 * var(--wash-intensity, 1))) 45%,
    rgba(255, 220, 232, 0) 100%
  );
  will-change: opacity;
  /* Préserve la profondeur sans solid color (laisse passer le contenu en dessous). */
  mix-blend-mode: normal;
}

:global(.dark) .feed-wash-top {
  background: linear-gradient(
    to bottom,
    rgba(255, 80, 130, calc(0.16 * var(--wash-intensity, 1))) 0%,
    rgba(120, 30, 60, calc(0.08 * var(--wash-intensity, 1))) 45%,
    rgba(0, 0, 0, 0) 100%
  );
}

.feed-wash-bottom {
  position: absolute;
  left: 0;
  right: 0;
  bottom: var(--wash-bottom-offset, 0px);
  height: 220px;
  background: linear-gradient(
    to top,
    rgba(249, 250, 251, calc(0.85 * var(--wash-intensity, 1))) 0%,
    rgba(249, 250, 251, calc(0.45 * var(--wash-intensity, 1))) 38%,
    rgba(249, 250, 251, 0) 100%
  );
}

:global(.dark) .feed-wash-bottom {
  background: linear-gradient(
    to top,
    rgba(2, 2, 4, calc(0.96 * var(--wash-intensity, 1))) 0%,
    rgba(6, 5, 8, calc(0.62 * var(--wash-intensity, 1))) 40%,
    rgba(6, 5, 8, 0) 100%
  );
}

.feed-wash-glass {
  position: absolute;
  inset: 0;
  backdrop-filter: saturate(160%) blur(0.5px);
  -webkit-backdrop-filter: saturate(160%) blur(0.5px);
}
</style>
