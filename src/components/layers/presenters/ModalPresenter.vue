<script setup lang="ts">
/**
 * ModalPresenter — modale centrée premium (fade + scale).
 *
 * - Backdrop avec blur léger
 * - Carte centrée, max-w 420, animation FadeInDown spring
 * - Esc, tap backdrop pour fermer (si dismiss.backdrop)
 * - Focus piégé (premier focusable de la modale)
 */
import { computed, onMounted, onBeforeUnmount, provide, ref, nextTick } from 'vue'
import { layerManager } from '../../../navigation/layerManager'
import { LAYER_CONTEXT_KEY } from '../../../navigation/useLayer'
import type { Layer } from '../../../navigation/layerTypes'
import LayerBackdrop from '../LayerBackdrop.vue'
import { useSafeArea } from '../../../composables/useSafeArea'

const props = defineProps<{ layer: Layer }>()

const cardRef = ref<HTMLElement | null>(null)
const { top: safeTop, bottom: safeBottom } = useSafeArea()

function close(result?: unknown) {
  layerManager.pop(props.layer.id, result)
}

provide(LAYER_CONTEXT_KEY, {
  layer: computed(() => props.layer),
  close,
})

/* Focus trap minimal : focus le 1er élément focusable au mount, restitue au unmount. */
let previouslyFocused: HTMLElement | null = null

function focusables(): HTMLElement[] {
  if (!cardRef.value) return []
  const sel = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  return Array.from(cardRef.value.querySelectorAll<HTMLElement>(sel)).filter((el) => !el.hasAttribute('inert'))
}

function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Tab') return
  const list = focusables()
  if (list.length === 0) {
    e.preventDefault()
    return
  }
  const first = list[0]
  const last = list[list.length - 1]
  const active = document.activeElement as HTMLElement | null
  if (e.shiftKey && active === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && active === last) {
    e.preventDefault()
    first.focus()
  }
}

onMounted(async () => {
  previouslyFocused = (document.activeElement as HTMLElement) ?? null
  await nextTick()
  const list = focusables()
  if (list.length > 0) {
    list[0].focus({ preventScroll: true })
  } else {
    cardRef.value?.focus({ preventScroll: true })
  }
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (previouslyFocused && document.body.contains(previouslyFocused)) {
    try {
      previouslyFocused.focus({ preventScroll: true })
    } catch {
      /* ignore */
    }
  }
})
</script>

<template>
  <div
    class="fotoce-layer-modal"
    :style="{
      zIndex: layer.zIndex,
      paddingTop: Math.max(safeTop, 16) + 'px',
      paddingBottom: Math.max(safeBottom, 16) + 'px',
    }"
  >
    <LayerBackdrop :layer="layer" :opacity="0.55" blur tint="rose" />
    <div
      ref="cardRef"
      class="fotoce-layer-modal__card"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <component :is="layer.component" v-bind="layer.componentProps" />
    </div>
  </div>
</template>

<style>
.fotoce-layer-modal {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-inline: 16px;
}

.fotoce-layer-modal__card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: min(100%, 420px);
  max-height: calc(100dvh - 32px);
  border-radius: 26px;
  background: var(--fotoce-bg-surface, #ffffff);
  border: 1px solid var(--fotoce-pink-border, rgba(219, 39, 119, 0.22));
  box-shadow:
    0 0 0 1px rgba(15, 23, 42, 0.04) inset,
    0 40px 80px -24px rgba(15, 23, 42, 0.35),
    0 20px 40px -16px rgba(190, 24, 93, 0.12);
  overflow: hidden;
  /* Spring-like cubic-bezier (équivalent FadeInDown.springify damping 22 stiffness 180). */
  animation: fotoce-modal-in 320ms cubic-bezier(0.22, 1, 0.36, 1);
  /* GPU. */
  transform: translate3d(0, 0, 0);
  will-change: transform, opacity;
  outline: none;
}

html.dark .fotoce-layer-modal__card {
  background: var(--fotoce-bg-surface-dark, rgb(18 16 20));
  border-color: var(--fotoce-pink-border-dark, rgba(219, 39, 119, 0.35));
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.04) inset,
    0 44px 84px -28px rgba(0, 0, 0, 0.58),
    0 20px 44px -16px rgba(190, 24, 93, 0.18);
}

@keyframes fotoce-modal-in {
  from {
    transform: translate3d(0, 18px, 0) scale(0.96);
    opacity: 0;
  }
  to {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .fotoce-layer-modal__card {
    animation-duration: 0.01ms !important;
  }
}
</style>
