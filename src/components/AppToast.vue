<script setup lang="ts">
/**
 * AppToast — host singleton de la file de toasts (à monter UNE fois dans App.vue).
 *
 * Gestes notification / toast :
 *  - gauche ou haut : fermer (animation suit le doigt)
 *  - droite : ouvrir (onAction) si CTA présent
 *  - desktop : bouton croix
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { dismissToast, toastList, type Toast } from '../composables/useToast'
import { useSafeArea } from '../composables/useSafeArea'
import { useReducedMotion } from '../composables/useReducedMotion'
import { useIsLgDown } from '../composables/useIsLgDown'
import { useI18n } from '../i18n'

const { t } = useI18n()

const { top: safeTop, bottom: safeBottom } = useSafeArea()
const { prefersReducedMotion } = useReducedMotion()
const { isLgDown } = useIsLgDown()

type DragMeta = { offset: number; axis: 'x' | 'y' | null }

const dragById = ref<Record<number, DragMeta>>({})
const draggingId = ref<number | null>(null)
const dragStartX = ref(0)
const dragStartY = ref(0)
const snapBackId = ref<number | null>(null)

const list = computed<Toast[]>(() => [...toastList.value])

function dragMeta(id: number): DragMeta {
  return dragById.value[id] ?? { offset: 0, axis: null }
}

function setDrag(id: number, meta: DragMeta) {
  dragById.value = { ...dragById.value, [id]: meta }
}

function clearDrag(id: number) {
  const next = { ...dragById.value }
  delete next[id]
  dragById.value = next
}

function onPointerDown(e: PointerEvent, id: number) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  draggingId.value = id
  snapBackId.value = null
  dragStartX.value = e.clientX
  dragStartY.value = e.clientY
  setDrag(id, { offset: 0, axis: null })
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
}

function onPointerMove(e: PointerEvent, id: number) {
  if (draggingId.value !== id) return
  const dx = e.clientX - dragStartX.value
  const dy = e.clientY - dragStartY.value
  const prev = dragMeta(id)
  let axis = prev.axis
  if (!axis) {
    if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return
    axis = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x'
  }
  const offset = axis === 'y' ? Math.min(0, dy) : dx
  setDrag(id, { offset, axis })
}

function onPointerUp(e: PointerEvent, toast: Toast) {
  const id = toast.id
  if (draggingId.value !== id) return
  draggingId.value = null
  ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)

  const { offset, axis } = dragMeta(id)
  const dismissByLeft = axis === 'x' && offset < -72
  const dismissByUp = axis === 'y' && offset < -48
  const openByRight = axis === 'x' && offset > 72 && !!toast.actionLabel

  if (openByRight) {
    clearDrag(id)
    handleAction(toast)
    return
  }
  if (dismissByLeft || dismissByUp) {
    clearDrag(id)
    dismissToast(id)
    return
  }

  snapBackId.value = id
  clearDrag(id)
  window.setTimeout(() => {
    if (snapBackId.value === id) snapBackId.value = null
  }, 220)
}

function offsetStyle(toast: Toast): Record<string, string> {
  const meta = dragMeta(toast.id)
  const offset = meta.offset
  const opacity = Math.max(0.25, 1 - Math.abs(offset) / 220)
  const snap = snapBackId.value === toast.id
  if (meta.axis === 'y') {
    return {
      transform: `translate3d(0, ${offset}px, 0)`,
      opacity: opacity.toFixed(3),
      transition: snap ? 'transform 220ms cubic-bezier(0.32, 0.72, 0, 1), opacity 180ms ease' : 'none',
    }
  }
  if (meta.axis === 'x') {
    return {
      transform: `translate3d(${offset}px, 0, 0)`,
      opacity: opacity.toFixed(3),
      transition: snap ? 'transform 220ms cubic-bezier(0.32, 0.72, 0, 1), opacity 180ms ease' : 'none',
    }
  }
  return {}
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

function closeToast(t: Toast) {
  dismissToast(t.id)
}

onBeforeUnmount(() => {
  dragById.value = {}
  draggingId.value = null
})
</script>

<template>
  <Teleport to="body">
    <div
      class="fotoce-toast-host"
      :class="prefersReducedMotion ? 'fotoce-toast-host--rm' : ''"
      :style="{
        paddingTop: `calc(${safeTop}px + 0.75rem)`,
        paddingBottom: `calc(${safeBottom}px + 1rem)`,
      }"
      aria-live="polite"
      aria-atomic="true"
      role="status"
    >
      <transition-group name="fotoce-toast" tag="div" class="fotoce-toast-stack">
        <div
          v-for="toast in list"
          :key="toast.id"
          class="fotoce-toast"
          :class="[
            `fotoce-toast--${toast.kind}`,
            toast.surface === 'notification' ? 'fotoce-toast--notification' : 'fotoce-toast--default',
            draggingId === toast.id ? 'fotoce-toast--dragging' : '',
          ]"
          :style="offsetStyle(toast)"
          @pointerdown="onPointerDown($event, toast.id)"
          @pointermove="onPointerMove($event, toast.id)"
          @pointerup="onPointerUp($event, toast)"
          @pointercancel="onPointerUp($event, toast)"
        >
          <FotoceIcon :name="iconFor(toast.kind)" class="fotoce-toast__icon" />
          <div class="fotoce-toast__body">
            <p class="fotoce-toast__message">{{ toast.message }}</p>
            <p v-if="toast.description" class="fotoce-toast__desc">{{ toast.description }}</p>
            <p v-if="toast.surface === 'notification' && isLgDown && toast.actionLabel" class="fotoce-toast__hint">
              ← / ↑ {{ t('notifications.live.dismissHint') }}
            </p>
          </div>
          <button
            v-if="toast.actionLabel"
            type="button"
            class="fotoce-toast__action max-lg:hidden"
            @click.stop="handleAction(toast)"
          >{{ toast.actionLabel }}</button>
          <button
            type="button"
            class="fotoce-toast__close"
            :aria-label="t('common.close')"
            @click.stop="closeToast(toast)"
          >
            <FotoceIcon name="close" class="text-[18px] leading-none" />
          </button>
        </div>
      </transition-group>
    </div>
  </Teleport>
</template>

<style scoped>
.fotoce-toast-host {
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
  .fotoce-toast-host {
    justify-content: flex-end;
    align-items: flex-end;
    padding-left: 1rem;
    padding-right: 1.25rem;
  }
}

.fotoce-toast-stack {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  width: 100%;
  max-width: 30rem;
  pointer-events: none;
}

@media (min-width: 1024px) {
  .fotoce-toast-stack {
    width: min(100%, 22rem);
    margin-left: auto;
  }
}

.fotoce-toast {
  pointer-events: auto;
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 52px;
  padding: 0.75rem 0.5rem 0.75rem 0.95rem;
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
  touch-action: none;
  will-change: transform, opacity;
  user-select: none;
}

.fotoce-toast--dragging {
  cursor: grabbing;
}

.fotoce-toast--notification {
  border-color: rgba(244, 114, 182, 0.22);
  background: rgba(24, 20, 26, 0.78);
  box-shadow:
    0 12px 36px -14px rgba(190, 24, 93, 0.35),
    0 4px 14px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.07);
}

:global(html.dark) .fotoce-toast {
  background: rgba(238, 232, 240, 0.88);
  border-color: rgba(0, 0, 0, 0.06);
  color: rgba(28, 24, 28, 0.96);
  box-shadow:
    0 10px 34px -12px rgba(0, 0, 0, 0.55),
    0 2px 8px rgba(0, 0, 0, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

:global(html.dark) .fotoce-toast--notification {
  background: rgba(250, 245, 248, 0.9);
  border-color: rgba(190, 24, 93, 0.14);
}

.fotoce-toast__icon {
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
:global(html.dark) .fotoce-toast__icon { color: rgba(28, 24, 28, 0.88); }

.fotoce-toast--success .fotoce-toast__icon { color: #6ee7b7; }
.fotoce-toast--warning .fotoce-toast__icon { color: #fcd34d; }
.fotoce-toast--error   .fotoce-toast__icon { color: #fda4af; }
.fotoce-toast--info    .fotoce-toast__icon { color: #f9a8d4; }
.fotoce-toast--notification .fotoce-toast__icon { color: #f472b6; }
:global(html.dark) .fotoce-toast--success .fotoce-toast__icon { color: #047857; }
:global(html.dark) .fotoce-toast--warning .fotoce-toast__icon { color: #b45309; }
:global(html.dark) .fotoce-toast--error   .fotoce-toast__icon { color: #be123c; }
:global(html.dark) .fotoce-toast--info    .fotoce-toast__icon { color: #be185d; }
:global(html.dark) .fotoce-toast--notification .fotoce-toast__icon { color: #db2777; }

.fotoce-toast__body { flex: 1; min-width: 0; padding-block: 1px; }
.fotoce-toast__message {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.35;
  font-weight: 600;
  letter-spacing: 0.005em;
}
.fotoce-toast__desc {
  margin: 0.125rem 0 0;
  font-size: 0.75rem;
  line-height: 1.4;
  opacity: 0.78;
}
.fotoce-toast__hint {
  margin: 0.35rem 0 0;
  font-size: 0.65rem;
  line-height: 1.3;
  opacity: 0.55;
  letter-spacing: 0.02em;
}

.fotoce-toast__action {
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
.fotoce-toast__action:hover { background: rgba(255, 255, 255, 0.12); }
.fotoce-toast__action:active { background: rgba(255, 255, 255, 0.16); }
:global(html.dark) .fotoce-toast__action { color: #be185d; background: rgba(0, 0, 0, 0.05); }
:global(html.dark) .fotoce-toast__action:hover { background: rgba(0, 0, 0, 0.08); }

.fotoce-toast__close {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.88);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.fotoce-toast__close:hover { background: rgba(255, 255, 255, 0.14); }
:global(html.dark) .fotoce-toast__close {
  background: rgba(0, 0, 0, 0.06);
  color: rgba(28, 24, 28, 0.78);
}

.fotoce-toast-enter-from {
  transform: translate3d(0, -14px, 0) scale(0.98);
  opacity: 0;
}
.fotoce-toast-enter-active {
  transition: transform 260ms cubic-bezier(0.2, 0, 0, 1), opacity 200ms ease-out;
}
.fotoce-toast-leave-to {
  transform: translate3d(0, -8px, 0) scale(0.98);
  opacity: 0;
}
.fotoce-toast-leave-active {
  transition: transform 200ms cubic-bezier(0.4, 0, 1, 1), opacity 180ms ease-in;
}

@media (min-width: 1024px) {
  .fotoce-toast-enter-from {
    transform: translate3d(0, 16px, 0) scale(0.98);
  }
  .fotoce-toast-leave-to {
    transform: translate3d(0, 10px, 0) scale(0.98);
  }
}

.fotoce-toast-move {
  transition: transform 320ms cubic-bezier(0.32, 0.72, 0, 1);
}

.fotoce-toast-host--rm .fotoce-toast-enter-active,
.fotoce-toast-host--rm .fotoce-toast-leave-active,
.fotoce-toast-host--rm .fotoce-toast-move {
  transition: opacity 120ms linear !important;
  transform: none !important;
}
.fotoce-toast-host--rm .fotoce-toast-enter-from,
.fotoce-toast-host--rm .fotoce-toast-leave-to {
  transform: none;
}
</style>
