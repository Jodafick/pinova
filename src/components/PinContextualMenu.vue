<script setup lang="ts">
/**
 * PinContextualMenu — menu contextuel iOS-style (haptic touch / 3D touch).
 *
 * Apparaît à la position du tap long-press avec :
 *  - backdrop blur (saturate + blur)
 *  - "pop" anim (scale 0.8 → 1 + spring)
 *  - items en glass card flottante
 *  - dismiss au tap hors menu, scroll, ou Escape
 *  - position auto-ajustée pour rester dans le viewport
 *
 * Le composant est un singleton à monter UNE FOIS au niveau App.vue, et
 * exposer via une store réactive (`pinContextualMenu`) ouvert/fermé.
 *
 * Usage minimal :
 *
 *   <PinContextualMenu />            (singleton dans App.vue)
 *   openPinContextualMenu({
 *     point: { x, y },
 *     items: [
 *       { id: 'save',   label: 'Enregistrer', icon: 'bookmark_add' },
 *       { id: 'share',  label: 'Partager',    icon: 'share' },
 *       { id: 'report', label: 'Signaler',    icon: 'flag', danger: true },
 *     ],
 *     onSelect: (id) => { ... },
 *   })
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  closePinContextualMenu,
  pinContextualMenuState as state,
  type PinContextualMenuItem,
} from '../composables/usePinContextualMenu'

/* ───────────────────── Component ───────────────────── */

const menuRef = ref<HTMLElement | null>(null)
const isOpen = computed(() => state.value !== null)

const positionStyles = computed(() => {
  const req = state.value
  if (!req) return { display: 'none' }
  const w = req.width ?? 232
  const h = Math.min(360, 56 * req.items.length + 16)
  /* Ajustement viewport (évite débordement). */
  const vw = typeof window !== 'undefined' ? window.innerWidth : 360
  const vh = typeof window !== 'undefined' ? window.innerHeight : 720
  const margin = 12
  let x = req.point.x - w / 2
  let y = req.point.y + 12
  if (x + w + margin > vw) x = vw - w - margin
  if (x < margin) x = margin
  if (y + h + margin > vh) y = req.point.y - h - 12
  if (y < margin) y = margin
  return {
    left: `${x}px`,
    top: `${y}px`,
    width: `${w}px`,
  }
})

function handleSelect(item: PinContextualMenuItem) {
  if (item.disabled) return
  const req = state.value
  if (!req) return
  /* Capture avant fermeture pour éviter race. */
  const cb = req.onSelect
  closePinContextualMenu()
  try { cb(item.id) } catch (e) { console.warn('[PinContextualMenu] onSelect error', e) }
}

function onBackdropClick(e: MouseEvent) {
  /* Tap hors menu → ferme. */
  if (!menuRef.value) return
  const target = e.target as Node
  if (!menuRef.value.contains(target)) closePinContextualMenu()
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') closePinContextualMenu()
}

function onScrollOrResize() {
  closePinContextualMenu()
}

watch(isOpen, (open) => {
  if (open) {
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScrollOrResize, { passive: true, capture: true })
    window.addEventListener('resize', onScrollOrResize)
  } else {
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('scroll', onScrollOrResize, true)
    window.removeEventListener('resize', onScrollOrResize)
  }
}, { immediate: true })

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('scroll', onScrollOrResize, true)
  window.removeEventListener('resize', onScrollOrResize)
})
</script>

<template>
  <Teleport to="body">
    <transition name="ctx-menu">
      <div
        v-if="state"
        class="pin-ctx-menu__backdrop"
        @click="onBackdropClick"
        @pointerdown.self="closePinContextualMenu"
        @contextmenu.prevent
      >
        <div
          ref="menuRef"
          class="pin-ctx-menu"
          :style="positionStyles"
          role="menu"
          aria-orientation="vertical"
        >
          <button
            v-for="item in state.items"
            :key="item.id"
            type="button"
            role="menuitem"
            class="pin-ctx-menu__item"
            :class="{
              'is-danger': item.danger,
              'is-disabled': item.disabled,
            }"
            :disabled="item.disabled"
            @click="handleSelect(item)"
          >
            <PinovaIcon :name="item.icon" class="pin-ctx-menu__icon" />
            <span class="pin-ctx-menu__label">{{ item.label }}</span>
          </button>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.pin-ctx-menu__backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  background-color: rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(2px) saturate(110%);
  -webkit-backdrop-filter: blur(2px) saturate(110%);
}

.pin-ctx-menu {
  position: absolute;
  display: flex;
  flex-direction: column;
  padding: 4px;
  border-radius: 14px;
  background-color: rgba(255, 255, 255, 0.92);
  backdrop-filter: saturate(180%) blur(22px);
  -webkit-backdrop-filter: saturate(180%) blur(22px);
  box-shadow:
    0 10px 28px rgba(0, 0, 0, 0.18),
    0 1px 0 rgba(255, 255, 255, 0.6) inset,
    0 -1px 0 rgba(0, 0, 0, 0.04) inset;
  border: 1px solid rgba(255, 255, 255, 0.4);
  transform-origin: top left;
  animation: pin-ctx-menu-pop var(--pinova-dur-medium, 260ms) var(--pinova-ease-iosOvershoot, cubic-bezier(0.34, 1.56, 0.64, 1));
  overflow: hidden;
}

:global(.dark) .pin-ctx-menu {
  background-color: rgba(28, 28, 32, 0.88);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow:
    0 12px 32px rgba(0, 0, 0, 0.6),
    0 1px 0 rgba(255, 255, 255, 0.08) inset;
}

.pin-ctx-menu__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  color: #1a1a1f;
  border-radius: 10px;
  transition: background-color 120ms ease;
}

:global(.dark) .pin-ctx-menu__item {
  color: #f5f5f7;
}

.pin-ctx-menu__item:hover:not(:disabled),
.pin-ctx-menu__item:active:not(:disabled) {
  background-color: rgba(0, 0, 0, 0.06);
}

:global(.dark) .pin-ctx-menu__item:hover:not(:disabled),
:global(.dark) .pin-ctx-menu__item:active:not(:disabled) {
  background-color: rgba(255, 255, 255, 0.06);
}

.pin-ctx-menu__item.is-danger {
  color: #d6234c;
}

:global(.dark) .pin-ctx-menu__item.is-danger {
  color: #ff6b8b;
}

.pin-ctx-menu__item.is-disabled,
.pin-ctx-menu__item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pin-ctx-menu__icon {
  font-size: 20px !important;
  color: inherit;
  flex-shrink: 0;
}

.pin-ctx-menu__label {
  flex: 1;
  min-width: 0;
}

.ctx-menu-enter-active,
.ctx-menu-leave-active {
  transition: opacity var(--pinova-dur-fast, 180ms) var(--pinova-ease-iosOut, cubic-bezier(0.22, 1, 0.36, 1));
}

.ctx-menu-enter-from,
.ctx-menu-leave-to { opacity: 0; }

@keyframes pin-ctx-menu-pop {
  0%   { transform: scale(0.86); opacity: 0; }
  60%  { transform: scale(1.04); opacity: 1; }
  100% { transform: scale(1);    opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .pin-ctx-menu { animation: none; }
}
</style>
