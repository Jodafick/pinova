<script setup lang="ts">
/**
 * FloatingCardPresenter — carte flottante centrée, légère.
 *
 * Conçue pour les notifications subtiles, mini-modales, picker compact.
 * Pas de backdrop opaque (ou très léger), ne bloque PAS le scroll body.
 */
import { computed, provide } from 'vue'
import { layerManager } from '../../../navigation/layerManager'
import { LAYER_CONTEXT_KEY } from '../../../navigation/useLayer'
import type { Layer } from '../../../navigation/layerTypes'

const props = defineProps<{ layer: Layer }>()

function close(result?: unknown) {
  layerManager.pop(props.layer.id, result)
}

function onBackdropClick() {
  if (props.layer.dismissStrategy.backdrop) close()
}

provide(LAYER_CONTEXT_KEY, {
  layer: computed(() => props.layer),
  close,
})
</script>

<template>
  <div
    class="fotoce-layer-floating"
    :style="{ zIndex: layer.zIndex }"
    @click.self="onBackdropClick"
  >
    <div
      class="fotoce-layer-floating__card"
      role="dialog"
      aria-modal="false"
      @click.stop
    >
      <component :is="layer.component" v-bind="layer.componentProps" />
    </div>
  </div>
</template>

<style>
.fotoce-layer-floating {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  /* Pas de fond opaque : seuls les inputs hors carte ferment. */
  background: rgba(15, 23, 42, 0.06);
}

.fotoce-layer-floating__card {
  position: relative;
  width: 100%;
  max-width: 360px;
  border-radius: 22px;
  background: var(--fotoce-bg-surface, #ffffff);
  border: 1px solid var(--fotoce-pink-border, rgba(219, 39, 119, 0.22));
  box-shadow: 0 24px 56px -20px rgba(15, 23, 42, 0.28);
  overflow: hidden;
  animation: fotoce-floating-in 240ms cubic-bezier(0.34, 1.56, 0.64, 1);
  will-change: transform, opacity;
  transform: translate3d(0, 0, 0);
}

html.dark .fotoce-layer-floating__card {
  background: var(--fotoce-bg-surface-dark, rgb(18 16 20));
  border-color: var(--fotoce-pink-border-dark, rgba(219, 39, 119, 0.35));
  box-shadow: 0 28px 64px -24px rgba(0, 0, 0, 0.62);
}

@keyframes fotoce-floating-in {
  from {
    transform: translate3d(0, 12px, 0) scale(0.94);
    opacity: 0;
  }
  to {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .fotoce-layer-floating__card {
    animation-duration: 0.01ms !important;
  }
}
</style>
