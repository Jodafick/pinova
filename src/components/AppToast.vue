<script setup lang="ts">
/**
 * AppToast — host singleton de la file de toasts (à monter UNE fois dans App.vue).
 *
 *  Caractéristiques :
 *   - Teleport → body (s'extrait des containers contraints)
 *   - Stack vertical en bas d'écran (mobile) / en haut à droite (desktop)
 *   - Slide-in spring + blur backdrop
 *   - Glass system iOS (`--glass-fill`, `--glass-stroke`)
 *   - Drag-to-dismiss (swipe horizontal ou vers le bas)
 *   - Respect `prefers-reduced-motion` (fade simple)
 *   - Safe-area-aware (bottom inset iOS)
 *   - Dark mode automatique via CSS vars
 *   - Pas d'i18n hardcodé : les messages sont déjà traduits par l'appelant
 *
 *  Pas d'interaction avec les modales ou layers — c'est purement informatif.
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { dismissToast, toastList, type Toast } from '../composables/useToast'
import { useSafeArea } from '../composables/useSafeArea'
import { useReducedMotion } from '../composables/useReducedMotion'

const { bottom: safeBottom } = useSafeArea()
const { prefersReducedMotion } = useReducedMotion()

/* Pour le swipe-to-dismiss (drag X). */
const dragState = ref<Record<number, number>>({})
const draggingId = ref<number | null>(null)
const dragStartX = ref(0)

const list = computed<Toast[]>(() => [...toastList.value])

function onPointerDown(e: PointerEvent, id: number) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  draggingId.value = id
  dragStartX.value = e.clientX
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
}

function onPointerMove(e: PointerEvent, id: number) {
  if (draggingId.value !== id) return
  const dx = e.clientX - dragStartX.value
  dragState.value = { ...dragState.value, [id]: dx }
}

function onPointerUp(e: PointerEvent, id: number) {
  if (draggingId.value !== id) return
  draggingId.value = null
  const dx = dragState.value[id] ?? 0
  ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
  if (Math.abs(dx) > 80) {
    dismissToast(id)
  }
  const next = { ...dragState.value }
  delete next[id]
  dragState.value = next
}

function offsetStyle(toast: Toast): Record<string, string> {
  const dx = dragState.value[toast.id] ?? 0
  const opacity = Math.max(0, 1 - Math.abs(dx) / 240)
  return {
    transform: `translate3d(${dx}px, 0, 0)`,
    opacity: opacity.toFixed(3),
  }
}

function iconFor(kind: Toast['kind']): string {
  switch (kind) {
    case 'success': return 'check_circle'
    case 'warning': return 'warning'
    case 'error':   return 'error'
    default:        return 'info'
  }
}

function handleAction(t: Toast) {
  try { t.onAction?.() } catch (err) { console.warn('[AppToast] onAction', err) }
  dismissToast(t.id)
}

onBeforeUnmount(() => {
  dragState.value = {}
  draggingId.value = null
})
</script>

<template>
  <Teleport to="body">
    <div
      class="pinova-toast-host"
      :class="prefersReducedMotion ? 'pinova-toast-host--rm' : ''"
      :style="{ paddingBottom: `calc(${safeBottom}px + 1rem)` }"
      aria-live="polite"
      aria-atomic="true"
      role="status"
    >
      <transition-group name="pinova-toast" tag="div" class="pinova-toast-stack">
        <div
          v-for="t in list"
          :key="t.id"
          class="pinova-toast"
          :class="[`pinova-toast--${t.kind}`]"
          :style="offsetStyle(t)"
          @pointerdown="onPointerDown($event, t.id)"
          @pointermove="onPointerMove($event, t.id)"
          @pointerup="onPointerUp($event, t.id)"
          @pointercancel="onPointerUp($event, t.id)"
        >
          <span class="pinova-toast__icon material-symbols-outlined" aria-hidden="true">{{ iconFor(t.kind) }}</span>
          <div class="pinova-toast__body">
            <p class="pinova-toast__message">{{ t.message }}</p>
            <p v-if="t.description" class="pinova-toast__desc">{{ t.description }}</p>
          </div>
          <button
            v-if="t.actionLabel"
            type="button"
            class="pinova-toast__action"
            @click.stop="handleAction(t)"
          >{{ t.actionLabel }}</button>
        </div>
      </transition-group>
    </div>
  </Teleport>
</template>

<style scoped>
/* Material 3 Snackbar – toast Android natif avec blur premium.
   - Bottom-centered (mobile + desktop) avec safe-area
   - Inverse surface : sombre sur thème clair, clair sur thème sombre
   - Pill rounded, icône Material, action label CAPS, swipe-to-dismiss */
.pinova-toast-host {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9000;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  padding: 0.5rem 1rem;
}

.pinova-toast-stack {
  display: flex;
  flex-direction: column-reverse;
  gap: 0.5rem;
  width: 100%;
  max-width: 30rem;
  pointer-events: none;
}

.pinova-toast {
  pointer-events: auto;
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 48px;
  padding: 0.625rem 0.5rem 0.625rem 1rem;
  border-radius: 9999px;
  /* Inverse surface : sombre en mode clair (Material 3) */
  background: rgba(32, 28, 32, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.06);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  backdrop-filter: blur(28px) saturate(180%);
  box-shadow: 0 6px 24px -6px rgba(0, 0, 0, 0.35), 0 2px 6px rgba(0, 0, 0, 0.18);
  color: rgba(255, 255, 255, 0.96);
  font-family: inherit;
  touch-action: pan-y;
  will-change: transform, opacity;
  transition: box-shadow 200ms ease;
}

:global(html.dark) .pinova-toast {
  background: rgba(238, 232, 240, 0.92);
  border-color: rgba(0, 0, 0, 0.05);
  color: rgba(28, 24, 28, 0.96);
  box-shadow: 0 8px 28px -8px rgba(0, 0, 0, 0.55), 0 2px 6px rgba(0, 0, 0, 0.25);
}

/* Accent rings via icon background only — keep snackbar shape uniform (Material 3). */
.pinova-toast__icon {
  flex: none;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  line-height: 1;
  font-variation-settings: 'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24;
  color: rgba(255, 255, 255, 0.9);
}
:global(html.dark) .pinova-toast__icon { color: rgba(28, 24, 28, 0.9); }

.pinova-toast--success .pinova-toast__icon { color: #6ee7b7; }
.pinova-toast--warning .pinova-toast__icon { color: #fcd34d; }
.pinova-toast--error   .pinova-toast__icon { color: #fda4af; }
.pinova-toast--info    .pinova-toast__icon { color: #f9a8d4; }
:global(html.dark) .pinova-toast--success .pinova-toast__icon { color: #047857; }
:global(html.dark) .pinova-toast--warning .pinova-toast__icon { color: #b45309; }
:global(html.dark) .pinova-toast--error   .pinova-toast__icon { color: #be123c; }
:global(html.dark) .pinova-toast--info    .pinova-toast__icon { color: #be185d; }

.pinova-toast__body { flex: 1; min-width: 0; padding-block: 2px; }
.pinova-toast__message {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.35;
  font-weight: 500;
  letter-spacing: 0.005em;
}
.pinova-toast__desc {
  margin: 0.125rem 0 0;
  font-size: 0.75rem;
  line-height: 1.4;
  opacity: 0.7;
}

.pinova-toast__action {
  flex: none;
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #f9a8d4;
  background: transparent;
  border: 0;
  padding: 0.5rem 0.875rem;
  border-radius: 9999px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  transition: background-color 160ms ease;
}
.pinova-toast__action:hover { background: rgba(255, 255, 255, 0.08); }
.pinova-toast__action:active { background: rgba(255, 255, 255, 0.14); }
:global(html.dark) .pinova-toast__action { color: #be185d; }
:global(html.dark) .pinova-toast__action:hover { background: rgba(0, 0, 0, 0.06); }
:global(html.dark) .pinova-toast__action:active { background: rgba(0, 0, 0, 0.1); }

/* Material 3 entrance : slide-up + fade. */
.pinova-toast-enter-from {
  transform: translate3d(0, 16px, 0) scale(0.98);
  opacity: 0;
}
.pinova-toast-enter-active {
  transition: transform 260ms cubic-bezier(0.2, 0, 0, 1), opacity 200ms ease-out;
}
.pinova-toast-leave-to {
  transform: translate3d(0, 8px, 0) scale(0.98);
  opacity: 0;
}
.pinova-toast-leave-active {
  transition: transform 200ms cubic-bezier(0.4, 0, 1, 1), opacity 180ms ease-in;
}

/* Stack offset effet "shuffle" derrière le toast actif. */
.pinova-toast-move {
  transition: transform 320ms cubic-bezier(0.32, 0.72, 0, 1);
}

/* Reduced motion : fade simple. */
.pinova-toast-host--rm .pinova-toast-enter-active,
.pinova-toast-host--rm .pinova-toast-leave-active,
.pinova-toast-host--rm .pinova-toast-move {
  transition: opacity 120ms linear !important;
  transform: none !important;
}
.pinova-toast-host--rm .pinova-toast-enter-from,
.pinova-toast-host--rm .pinova-toast-leave-to {
  transform: none;
}
</style>
