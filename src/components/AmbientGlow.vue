<script setup lang="ts">
/**
 * AmbientGlow — wash rose ambient subtil + atmospheric depth.
 *
 * Composant fixe en arrière-plan (`position: fixed`, z-index -1) qui crée :
 *  - Un halo rose en haut (radial gradient blur)
 *  - Un veil bottom subtil (gradient noir transparent)
 *  - Intensité optionnelle via la prop `intensity` (sync `--glow-opacity`).
 *
 * Très subtil — JAMAIS kitsch. Apple Music night mode style.
 * Performance : pas d'écouteur scroll — halo statique, GPU-friendly.
 *
 * Monté UNE FOIS dans App.vue.
 */
import { computed } from 'vue'

interface Props {
  /** Désactive le glow (ex: page médias fullscreen). */
  disabled?: boolean
  /** Intensité 0..1 (Default 1 — un peu présent, jamais saturé). */
  intensity?: number
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  intensity: 1,
})

/**
 * Fond décoratif fixe au viewport (aligné avec `body::before` + dégradé global).
 * Pas de parallax ni de fade au scroll : le wash reste stable pendant le défilement.
 */
const glowStyleVars = computed(() => ({
  '--glow-translate': '0px',
  '--glow-opacity': String(Math.max(0, Math.min(1, props.intensity))),
}))
</script>

<template>
  <div
    v-if="!disabled"
    class="fotoce-ambient-glow"
    :style="glowStyleVars"
    aria-hidden="true"
  >
    <!-- Halo rose top — radial gradient flou GPU. -->
    <div class="fotoce-ambient-glow__top" />
    <!-- Veil bottom très discret (le dégradé principal est sur `body::before`). -->
    <div class="fotoce-ambient-glow__bottom" />
  </div>
</template>

<style scoped>
.fotoce-ambient-glow {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  overflow: hidden;
  /* GPU layer dédié — évite le repaint sur scroll. */
  transform: translate3d(0, 0, 0);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  will-change: transform;
}

.fotoce-ambient-glow__top {
  position: absolute;
  /* Le glow déborde volontairement en haut, l'effet de "lumière entrante" iOS. */
  top: -160px;
  left: 50%;
  width: 760px;
  height: 600px;
  margin-left: -380px;
  border-radius: 50%;
  background:
    radial-gradient(circle at center,
      rgba(255, 95, 145, 0.32) 0%,
      rgba(255, 95, 145, 0.18) 28%,
      rgba(224, 36, 94, 0.08) 55%,
      transparent 78%);
  /* Halo fixe (plus de parallax scroll). */
  transform: translate3d(0, var(--glow-translate, 0), 0);
  opacity: var(--glow-opacity, 1);
  /* Pas de blur CSS coûteux — le gradient lui-même fait le travail. */
  transition: opacity 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.fotoce-ambient-glow__bottom {
  position: absolute;
  bottom: -120px;
  left: -20%;
  right: -20%;
  height: 360px;
  background:
    radial-gradient(ellipse at center,
      rgba(255, 138, 175, 0.10) 0%,
      transparent 65%);
  opacity: var(--glow-opacity, 1);
  transition: opacity 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

/* Dark mode : on diminue l'intensité (les noirs OLED ne tolèrent pas
   un grand wash sans devenir kitsch). */
:global(.dark) .fotoce-ambient-glow__top {
  background:
    radial-gradient(circle at center,
      rgba(255, 95, 145, 0.18) 0%,
      rgba(224, 36, 94, 0.10) 30%,
      rgba(155, 18, 60, 0.04) 60%,
      transparent 80%);
}
:global(.dark) .fotoce-ambient-glow__bottom {
  background:
    radial-gradient(ellipse at center,
      rgba(236, 72, 153, 0.035) 0%,
      transparent 58%);
}

</style>
