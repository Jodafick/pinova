<script setup lang="ts">
/**
 * MediaChrome — chrome immersif iOS pour viewer média.
 *
 * Composant headerless qui pose au-dessus d'un média plein-écran :
 *  - Top bar : back button, title optionnel, actions (share/more)
 *  - Bottom actions bar : like / comment / save / share
 *  - Auto-hide : disparaît après 2.4s d'inactivité (souris/touch),
 *    réapparaît à l'interaction
 *  - Style : glassmorphisme translucide, safe-areas respectées
 *
 * UX iOS-native :
 *  - Fade in/out 220ms (cubic-bezier iOS)
 *  - Forcer visible si modal stack active (back button important)
 *  - Skip auto-hide si `pinned`
 *
 * Le composant N'IMPOSE PAS de slot — il propose des slots flexibles.
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

interface Props {
  /** Affichage forcé visible (override auto-hide). */
  pinned?: boolean
  /** Délai d'inactivité avant masquage (ms). */
  inactivityMs?: number
  /** Cible des évents (souris/touch) qui maintiennent visible. Default `window`. */
  trackTarget?: HTMLElement
  /** Désactive complètement le chrome (cache). */
  hidden?: boolean
  /** Variant : 'dark' (default — sur média sombre) ou 'auto' (suit le theme). */
  variant?: 'dark' | 'auto'
}

const props = withDefaults(defineProps<Props>(), {
  pinned: false,
  inactivityMs: 2400,
  hidden: false,
  variant: 'dark',
})

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'visibility-change', visible: boolean): void
}>()

const isVisible = ref(true)
let hideTimer: ReturnType<typeof setTimeout> | null = null

function show() {
  if (!isVisible.value) {
    isVisible.value = true
    emit('visibility-change', true)
  }
  scheduleHide()
}

function hide() {
  if (props.pinned) return
  if (isVisible.value) {
    isVisible.value = false
    emit('visibility-change', false)
  }
}

function scheduleHide() {
  if (hideTimer) clearTimeout(hideTimer)
  if (props.pinned) return
  hideTimer = setTimeout(hide, props.inactivityMs)
}

function onUserActivity() { show() }

function bindActivityListeners() {
  const target = props.trackTarget ?? (typeof window !== 'undefined' ? window : null)
  if (!target) return
  target.addEventListener('mousemove', onUserActivity, { passive: true })
  target.addEventListener('touchstart', onUserActivity, { passive: true })
  target.addEventListener('keydown', onUserActivity)
}

function unbindActivityListeners() {
  const target = props.trackTarget ?? (typeof window !== 'undefined' ? window : null)
  if (!target) return
  target.removeEventListener('mousemove', onUserActivity)
  target.removeEventListener('touchstart', onUserActivity)
  target.removeEventListener('keydown', onUserActivity)
}

watch(() => props.pinned, (pinned) => {
  if (pinned) {
    if (hideTimer) clearTimeout(hideTimer)
    isVisible.value = true
  } else {
    scheduleHide()
  }
})

onMounted(() => {
  bindActivityListeners()
  scheduleHide()
})

onBeforeUnmount(() => {
  if (hideTimer) clearTimeout(hideTimer)
  unbindActivityListeners()
})

defineExpose({ show, hide })
</script>

<template>
  <transition name="media-chrome-fade">
    <div
      v-if="!hidden && isVisible"
      class="media-chrome"
      :class="`media-chrome--${variant}`"
      role="toolbar"
      aria-label="Media controls"
    >
      <!-- TOP BAR -->
      <div class="media-chrome__top">
        <div class="media-chrome__top-bg" aria-hidden="true" />
        <div class="media-chrome__top-row">
          <button
            type="button"
            class="media-chrome__btn media-chrome__btn--icon"
            aria-label="Retour"
            @click="$emit('back')"
          >
            <PinovaIcon name="arrow_back_ios_new" />
          </button>
          <div class="media-chrome__center">
            <slot name="title" />
          </div>
          <div class="media-chrome__top-actions">
            <slot name="actions" />
          </div>
        </div>
      </div>

      <!-- BOTTOM ACTIONS -->
      <div v-if="$slots.bottom" class="media-chrome__bottom">
        <div class="media-chrome__bottom-bg" aria-hidden="true" />
        <div class="media-chrome__bottom-row">
          <slot name="bottom" />
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.media-chrome {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 10;
}

/* Top bar */
.media-chrome__top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding-top: env(safe-area-inset-top, 0px);
}

.media-chrome__top-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.55) 0%, rgba(0, 0, 0, 0.25) 60%, transparent 100%);
  pointer-events: none;
}

.media-chrome__top-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px 14px;
  pointer-events: auto;
}

.media-chrome__center {
  flex: 1;
  min-width: 0;
  text-align: center;
  color: white;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.005em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.media-chrome__top-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Boutons translucides iOS. */
.media-chrome__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
  border-radius: 999px;
  background-color: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(14px) saturate(180%);
  -webkit-backdrop-filter: blur(14px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  transition:
    transform 120ms cubic-bezier(0.22, 1, 0.36, 1),
    background-color 180ms ease;
}

.media-chrome__btn:active:not(:disabled) {
  transform: scale3d(0.94, 0.94, 1);
  background-color: rgba(0, 0, 0, 0.6);
}

.media-chrome__btn--icon {
  width: 38px;
  height: 38px;
  padding: 0;
}

.media-chrome__btn--icon .pinova-icon {
  font-size: 18px;
}

/* Bottom actions bar */
.media-chrome__bottom {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.media-chrome__bottom-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(0deg, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0.35) 55%, transparent 100%);
  pointer-events: none;
}

.media-chrome__bottom-row {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-around;
  gap: 8px;
  padding: 14px 18px 18px;
  pointer-events: auto;
}

/* Variant auto : adapter au theme courant (peu utilisé — par défaut dark). */
.media-chrome--auto .media-chrome__btn {
  background-color: var(--glass-fill, rgba(255, 255, 255, 0.78));
  color: var(--pinova-text-primary, #161417);
  border-color: var(--glass-border, rgba(255, 255, 255, 0.42));
}

/* Transitions enter/leave. */
.media-chrome-fade-enter-active,
.media-chrome-fade-leave-active {
  transition:
    opacity 220ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.media-chrome-fade-enter-from .media-chrome__top,
.media-chrome-fade-leave-to .media-chrome__top {
  transform: translate3d(0, -8px, 0);
  opacity: 0;
}

.media-chrome-fade-enter-from .media-chrome__bottom,
.media-chrome-fade-leave-to .media-chrome__bottom {
  transform: translate3d(0, 8px, 0);
  opacity: 0;
}

.media-chrome-fade-enter-from,
.media-chrome-fade-leave-to { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .media-chrome-fade-enter-active,
  .media-chrome-fade-leave-active {
    transition: opacity 120ms linear;
  }
}
</style>
