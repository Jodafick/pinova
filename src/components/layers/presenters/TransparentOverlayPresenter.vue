<script setup lang="ts">
/**
 * TransparentOverlayPresenter — overlay temporaire transparent.
 *
 * Pour les toasts, infobulles globales, popovers ancrés.
 * Aucun backdrop visible, ne bloque PAS le scroll.
 * Le composant interne se positionne lui-même.
 */
import { computed, provide } from 'vue'
import { layerManager } from '../../../navigation/layerManager'
import { LAYER_CONTEXT_KEY } from '../../../navigation/useLayer'
import type { Layer } from '../../../navigation/layerTypes'

const props = defineProps<{ layer: Layer }>()

function close(result?: unknown) {
  layerManager.pop(props.layer.id, result)
}

provide(LAYER_CONTEXT_KEY, {
  layer: computed(() => props.layer),
  close,
})
</script>

<template>
  <div
    class="fotoce-layer-transparent"
    :style="{ zIndex: layer.zIndex }"
  >
    <component :is="layer.component" v-bind="layer.componentProps" />
  </div>
</template>

<style>
.fotoce-layer-transparent {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.fotoce-layer-transparent > * {
  pointer-events: auto;
}
</style>
