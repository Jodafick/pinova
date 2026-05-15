<script setup lang="ts">
/**
 * LayerBackdrop — scrim partagé entre presenters.
 *
 * - Tap → dismiss (si layer.dismissStrategy.backdrop)
 * - Animation de fade-in 220ms
 * - Optionnellement floute le contenu derrière (`blur` prop)
 * - Respecte `prefers-reduced-motion`
 */
import { layerManager } from '../../navigation/layerManager'
import type { Layer } from '../../navigation/layerTypes'

const props = defineProps<{
  layer: Layer
  /** Intensité du backdrop (0..1). Par défaut 0.55 pour modal, ajustable par presenter. */
  opacity?: number
  /** Active le backdrop-filter blur (coûteux : à éviter sur > 2 couches simultanées). */
  blur?: boolean
  /** Teinte custom (par défaut neutre). */
  tint?: 'neutral' | 'rose' | 'black'
}>()

function onTap() {
  if (!props.layer.dismissStrategy.backdrop) return
  layerManager.pop(props.layer.id)
}
</script>

<template>
  <div
    class="pinova-layer-backdrop"
    :class="[
      `pinova-layer-backdrop--${tint || 'neutral'}`,
      blur ? 'pinova-layer-backdrop--blur' : null,
    ]"
    :style="{ '--pinova-backdrop-opacity': opacity ?? 0.55 } as Record<string, string | number>"
    aria-hidden="true"
    @click="onTap"
  />
</template>

<style>
.pinova-layer-backdrop {
  position: absolute;
  inset: 0;
  background-color: rgba(12, 12, 17, var(--pinova-backdrop-opacity, 0.55));
  /* Animation par défaut. */
  animation: pinova-backdrop-in 220ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
  /* GPU friendly. */
  will-change: opacity;
}

.pinova-layer-backdrop--rose {
  background:
    radial-gradient(circle at 50% -10%, rgba(251, 207, 232, 0.22), transparent 42%),
    rgba(12, 12, 17, var(--pinova-backdrop-opacity, 0.55));
}

.pinova-layer-backdrop--black {
  background: rgba(0, 0, 0, var(--pinova-backdrop-opacity, 0.7));
}

.pinova-layer-backdrop--blur {
  backdrop-filter: blur(14px) saturate(140%);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
}

@keyframes pinova-backdrop-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .pinova-layer-backdrop {
    animation-duration: 0.01ms !important;
  }
}
</style>
