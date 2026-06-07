<script setup lang="ts">
/**
 * AppToast — host singleton de la file de toasts (à monter UNE fois dans App.vue).
 *
 *  - Mobile : pile en haut (safe-area)
 *  - Desktop (lg+) : bas droite
 *  - Surface `notification` : glass blur, coins arrondis (pas pill)
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { dismissToast, toastList, type Toast } from '../composables/useToast'
import { useSafeArea } from '../composables/useSafeArea'
import { useReducedMotion } from '../composables/useReducedMotion'

const { top: safeTop, bottom: safeBottom } = useSafeArea()
const { prefersReducedMotion } = useReducedMotion()

const dragState = ref<Record<number, number>>({})
const draggingId = ref<number | null>(null)
const dragStartX = ref(0)
const dragStartY = ref(0)
const dragAxis = ref<'x' | 'y' | null>(null)

const list = computed<Toast[]>(() => [...toastList.value])

function onPointerDown(e: PointerEvent, id: number) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  draggingId.value = id
  dragStartX.value = e.clientX
  dragStartY.value = e.clientY
  dragAxis.value = null
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
}

function onPointerMove(e: PointerEvent, id: number) {
  if (draggingId.value !== id) return
  const dx = e.clientX - dragStartX.value
  const dy = e.clientY - dragStartY.value
  if (!dragAxis.value) {
    if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return
    dragAxis.value = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x'
  }
  if (dragAxis.value === 'y') {
    dragState.value = { ...dragState.value, [id]: dy }
  } else {
    dragState.value = { ...dragState.value, [id]: dx }
  }
}

function onPointerUp(e: PointerEvent, id: number) {
  if (draggingId.value !== id) return
  draggingId.value = null
  dragAxis.value = null
  const offset = dragState.value[id] ?? 0
  ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
  if (Math.abs(offset) > 72) {
    dismissToast(id)
  }
  const next = { ...dragState.value }
  delete next[id]
  dragState.value = next
}

function offsetStyle(toast: Toast): Record<string, string> {
  const offset = dragState.value[toast.id] ?? 0
  const opacity = Math.max(0, 1 - Math.abs(offset) / 240)
  if (Math.abs(offset) > 0 && Math.abs(offset) !== Math.abs(dragState.value[toast.id] ?? 0)) {
    /* noop — keep template stable */
  }
  const isVertical = Math.abs(offset) > 0 && dragAxis.value === 'y'
  return {
    transform: isVertical
      ? `translate3d(0, ${offset}px, 0)`
      : `translate3d(${offset}px, 0, 0)`,
    opacity: opacity.toFixed(3),
  }
}

function iconFor(kind: Toast['kind']): string {
  switch (kind) {
    case 'success': return 'check_circle'
    case 'warning': return 'warning'
    case 'error':   return 'error'
    default:        return 'notifications'
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
      :style="{
        paddingTop: `calc(${safeTop}px + 0.75rem)`,
        paddingBottom: `calc(${safeBottom}px + 1rem)`,
      }"
      aria-live="polite"
      aria-atomic="true"
      role="status"
    >
      <transition-group name="pinova-toast" tag="div" class="pinova-toast-stack">
        <div
          v-for="t in list"
          :key="t.id"
          class="pinova-toast"
          :class="[
            `pinova-toast--${t.kind}`,
            t.surface === 'notification' ? 'pinova-toast--notification' : 'pinova-toast--default',
          ]"
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
.pinova-toast-host {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9000;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: stretch;
  padding-left: 0.875rem;
  padding-right: 0.875rem;
}

@media (min-width: 1024px) {
  .pinova-toast-host {
    justify-content: flex-end;
    align-items: flex-end;
    padding-left: 1rem;
    padding-right: 1.25rem;
  }
}

.pinova-toast-stack {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  width: 100%;
  max-width: 30rem;
  pointer-events: none;
}

@media (min-width: 1024px) {
  .pinova-toast-stack {
    width: min(100%, 22rem);
    margin-left: auto;
  }
}

.pinova-toast {
  pointer-events: auto;
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 52px;
  padding: 0.75rem 0.625rem 0.75rem 0.95rem;
  border-radius: 1.125rem;
  background: rgba(32, 28, 32, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.08);
  -webkit-backdrop-filter: blur(24px) saturate(165%);
  backdrop-filter: blur(24px) saturate(165%);
  box-shadow:
    0 10px 32px -12px rgba(0, 0, 0, 0.38),
    0 2px 8px rgba(0, 0, 0, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.96);
  font-family: inherit;
  touch-action: pan-y;
  will-change: transform, opacity;
}

.pinova-toast--notification {
  border-color: rgba(244, 114, 182, 0.22);
  background: rgba(24, 20, 26, 0.78);
  box-shadow:
    0 12px 36px -14px rgba(190, 24, 93, 0.35),
    0 4px 14px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.07);
}

:global(html.dark) .pinova-toast {
  background: rgba(238, 232, 240, 0.88);
  border-color: rgba(0, 0, 0, 0.06);
  color: rgba(28, 24, 28, 0.96);
  box-shadow:
    0 10px 34px -12px rgba(0, 0, 0, 0.55),
    0 2px 8px rgba(0, 0, 0, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

:global(html.dark) .pinova-toast--notification {
  background: rgba(250, 245, 248, 0.9);
  border-color: rgba(190, 24, 93, 0.14);
}

.pinova-toast__icon {
  flex: none;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  line-height: 1;
  font-variation-settings: 'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24;
  color: rgba(255, 255, 255, 0.92);
}
:global(html.dark) .pinova-toast__icon { color: rgba(28, 24, 28, 0.88); }

.pinova-toast--success .pinova-toast__icon { color: #6ee7b7; }
.pinova-toast--warning .pinova-toast__icon { color: #fcd34d; }
.pinova-toast--error   .pinova-toast__icon { color: #fda4af; }
.pinova-toast--info    .pinova-toast__icon { color: #f9a8d4; }
.pinova-toast--notification .pinova-toast__icon { color: #f472b6; }
:global(html.dark) .pinova-toast--success .pinova-toast__icon { color: #047857; }
:global(html.dark) .pinova-toast--warning .pinova-toast__icon { color: #b45309; }
:global(html.dark) .pinova-toast--error   .pinova-toast__icon { color: #be123c; }
:global(html.dark) .pinova-toast--info    .pinova-toast__icon { color: #be185d; }
:global(html.dark) .pinova-toast--notification .pinova-toast__icon { color: #db2777; }

.pinova-toast__body { flex: 1; min-width: 0; padding-block: 1px; }
.pinova-toast__message {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.35;
  font-weight: 600;
  letter-spacing: 0.005em;
}
.pinova-toast__desc {
  margin: 0.125rem 0 0;
  font-size: 0.75rem;
  line-height: 1.4;
  opacity: 0.78;
}

.pinova-toast__action {
  flex: none;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #f9a8d4;
  background: rgba(255, 255, 255, 0.06);
  border: 0;
  padding: 0.45rem 0.75rem;
  border-radius: 0.75rem;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  transition: background-color 160ms ease;
}
.pinova-toast__action:hover { background: rgba(255, 255, 255, 0.12); }
.pinova-toast__action:active { background: rgba(255, 255, 255, 0.16); }
:global(html.dark) .pinova-toast__action { color: #be185d; background: rgba(0, 0, 0, 0.05); }
:global(html.dark) .pinova-toast__action:hover { background: rgba(0, 0, 0, 0.08); }

.pinova-toast-enter-from {
  transform: translate3d(0, -14px, 0) scale(0.98);
  opacity: 0;
}
.pinova-toast-enter-active {
  transition: transform 260ms cubic-bezier(0.2, 0, 0, 1), opacity 200ms ease-out;
}
.pinova-toast-leave-to {
  transform: translate3d(0, -8px, 0) scale(0.98);
  opacity: 0;
}
.pinova-toast-leave-active {
  transition: transform 200ms cubic-bezier(0.4, 0, 1, 1), opacity 180ms ease-in;
}

@media (min-width: 1024px) {
  .pinova-toast-enter-from {
    transform: translate3d(0, 16px, 0) scale(0.98);
  }
  .pinova-toast-leave-to {
    transform: translate3d(0, 10px, 0) scale(0.98);
  }
}

.pinova-toast-move {
  transition: transform 320ms cubic-bezier(0.32, 0.72, 0, 1);
}

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
