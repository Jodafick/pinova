<script setup lang="ts">
/**
 * LayerHost — racine du système de couches.
 *
 * À monter UNE SEULE FOIS dans App.vue, au-dessus du `<router-view>`.
 * Reçoit le stack du `layerManager` et délègue chaque couche à un presenter
 * adapté à son type de présentation.
 *
 * Responsabilités :
 *  - Portail (`Teleport`) vers body
 *  - Backdrop progressif (intensifie avec le nombre de couches modales)
 *  - Application de la transformation "scale + blur" sur l'arrière-plan
 *    quand une couche page/fullscreen est ouverte (effet iOS)
 *  - Gestion globale clavier (Esc), edge-back, dismiss backdrop
 */
import { computed, onBeforeUnmount, onMounted, provide, watch } from 'vue'
import { layerManager } from '../../navigation/layerManager'
import { LAYER_CONTEXT_KEY, type LayerContext } from '../../navigation/useLayer'
import type { Layer } from '../../navigation/layerTypes'
import PagePresenter from './presenters/PagePresenter.vue'
import ModalPresenter from './presenters/ModalPresenter.vue'
import FullscreenPresenter from './presenters/FullscreenPresenter.vue'
import SheetPresenter from './presenters/SheetPresenter.vue'
import FloatingCardPresenter from './presenters/FloatingCardPresenter.vue'
import TransparentOverlayPresenter from './presenters/TransparentOverlayPresenter.vue'
import { getLayerLifecycleState } from '../../core/layerLifecycle'
import { getQualityMode } from '../../core/performanceEngine'

const stack = layerManager.stack
const topLayer = layerManager.topLayer

const presenterByPresentation = {
  page: PagePresenter,
  modal: ModalPresenter,
  fullscreen: FullscreenPresenter,
  sheet: SheetPresenter,
  floatingCard: FloatingCardPresenter,
  transparentOverlay: TransparentOverlayPresenter,
} as const

/**
 * Intensité du scale + blur appliqué au contexte d'arrière-plan (router-view)
 * en fonction de la couche au sommet. Effet iOS subtile.
 */
const backgroundTransform = computed(() => {
  const top = topLayer.value
  if (!top) return null
  const quality = getQualityMode()
  const allowShellBlur = quality === 'high'
  /* On n'applique l'effet que pour page / fullscreen / modal. Sheets et overlays restent neutres. */
  if (top.presentation === 'transparentOverlay' || top.presentation === 'floatingCard') return null
  if (top.presentation === 'sheet') {
    return { scale: 0.98, brightness: 0.94, blur: 0, opacity: 1 }
  }
  if (top.presentation === 'modal') {
    return {
      scale: 0.99,
      brightness: 0.9,
      blur: allowShellBlur ? 2 : 0,
      opacity: allowShellBlur ? 1 : 0.92,
    }
  }
  /* page / fullscreen : scale léger ; blur shell uniquement en qualité high. */
  return {
    scale: 0.97,
    brightness: 0.88,
    blur: allowShellBlur ? 3 : 0,
    opacity: allowShellBlur ? 1 : 0.94,
  }
})

/* Applique l'effet de profondeur sur l'élément root `#app-shell`. */
function applyBackgroundEffect() {
  if (typeof document === 'undefined') return
  const shell = document.getElementById('app-shell')
  if (!shell) return
  const t = backgroundTransform.value
  if (!t) {
    shell.style.transform = ''
    shell.style.filter = ''
    shell.style.opacity = ''
    shell.style.willChange = ''
    shell.style.transition = 'transform 360ms cubic-bezier(0.22, 1, 0.36, 1), filter 360ms cubic-bezier(0.22, 1, 0.36, 1)'
    return
  }
  shell.style.transform = `scale(${t.scale})`
  shell.style.opacity = t.opacity != null && t.opacity < 1 ? String(t.opacity) : ''
  shell.style.filter =
    t.blur > 0
      ? `brightness(${t.brightness}) blur(${t.blur}px)`
      : t.brightness < 1
        ? `brightness(${t.brightness})`
        : ''
  shell.style.transition = 'transform 360ms cubic-bezier(0.22, 1, 0.36, 1), filter 360ms cubic-bezier(0.22, 1, 0.36, 1)'
  shell.style.transformOrigin = 'center top'
  shell.style.willChange = 'transform, filter'
}

watch(backgroundTransform, () => applyBackgroundEffect(), { immediate: true })

/* Gestion globale Échap : ferme la couche au sommet si dismiss.escape. */
function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  const top = topLayer.value
  if (!top || !top.dismissStrategy.escape) return
  e.preventDefault()
  layerManager.pop(top.id)
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeydown)
  }
})
onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onKeydown)
  }
  if (typeof document !== 'undefined') {
    const shell = document.getElementById('app-shell')
    if (shell) {
      shell.style.transform = ''
      shell.style.filter = ''
      shell.style.transition = ''
      shell.style.willChange = ''
    }
  }
})

/** Provide minimal vide pour permettre `useLayer()` en dehors d'un presenter (no-op). */
provide<LayerContext>(LAYER_CONTEXT_KEY, {
  layer: computed(() => null),
  close: () => undefined,
})

function presenterFor(layer: Layer) {
  return presenterByPresentation[layer.presentation] ?? ModalPresenter
}

/** Classes lifecycle pour permettre au CSS de couper anim/pointer-events. */
function lifecycleClass(layer: Layer): string {
  const state = getLayerLifecycleState(layer.id)
  if (state === 'sleeping') return 'pinova-layer-sleeping'
  if (state === 'frozen') return 'pinova-layer-frozen'
  return ''
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="stack.length > 0"
      class="pinova-layer-host"
      :class="{ 'pinova-layer-host--has-layers': stack.length > 0 }"
      aria-live="polite"
    >
      <component
        :is="presenterFor(layer)"
        v-for="layer in stack"
        :key="layer.id"
        :layer="layer"
        :class="lifecycleClass(layer)"
      />
    </div>
  </Teleport>
</template>

<style>
/*
  Bloquer le scroll body quand une couche bloquante est ouverte.
  Une classe est ajoutée sur <html> par le layerManager.
*/
html.pinova-layer-scroll-lock,
html.pinova-layer-scroll-lock body {
  overflow: hidden !important;
  /* Évite le saut de scrollbar sur desktop. */
  scrollbar-gutter: stable;
}

/* Empêche les rebond iOS d'apparaître quand la couche est ouverte. */
html.pinova-layer-scroll-lock body {
  position: fixed;
  inset: 0;
  width: 100%;
  /* On garde la position du scroll via JS (layerManager). */
}

.pinova-layer-host {
  position: fixed;
  inset: 0;
  z-index: 200;
  pointer-events: none;
}

.pinova-layer-host > * {
  pointer-events: auto;
}

/*
  Conteneur root de l'app : doit avoir l'id "app-shell" pour recevoir
  l'effet de profondeur (scale + blur léger) lorsqu'une couche est au-dessus.
*/
#app-shell {
  transform-origin: center top;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
</style>
