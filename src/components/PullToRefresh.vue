<script setup lang="ts">
/**
 * PullToRefresh — wrapper qui ajoute un pull-to-refresh iOS premium au
 * contenu en slot.
 *
 * - Détection gesture via `usePullToRefresh` (rubber band + spring + velocity)
 * - Spinner circulaire qui se remplit progressivement (premium, pas mécanique)
 * - Haptic feedback : light à l'arm, medium au déclenchement
 * - Respect `prefers-reduced-motion` (fade simple au lieu de spring)
 *
 * Usage :
 *
 *   <PullToRefresh :on-refresh="async () => await fetchHomeFeed(true)">
 *     <PinGrid :pins="pins" />
 *   </PullToRefresh>
 *
 * IMPORTANT : le slot doit être scrollable (le composant prend la fenêtre
 * comme scroll-host par défaut).
 */
import { computed, ref } from 'vue'
import { usePullToRefresh } from '../composables/usePullToRefresh'

interface Props {
  onRefresh: () => void | Promise<void>
  disabled?: boolean
  /** Distance px avant l'armement (default 64). */
  threshold?: number
  /** Distance max du pull (default 120). */
  maxPull?: number
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  threshold: 64,
  maxPull: 120,
})

const rootRef = ref<HTMLElement | null>(null)
const { pull, progress, armed, refreshing } = usePullToRefresh(rootRef, {
  onRefresh: () => props.onRefresh(),
  threshold: props.threshold,
  maxPull: props.maxPull,
  disabled: () => props.disabled,
})

/* Visuel : on étire un container caché au-dessus du contenu. */
const indicatorTransform = computed(() => `translate3d(0, ${pull.value}px, 0)`)
const contentTransform = computed(() => `translate3d(0, ${pull.value}px, 0)`)

/* Le spinner se "remplit" progressivement (stroke-dasharray) avant l'armement.
   Une fois armé, il devient un spinner qui tourne. */
const dashOffset = computed(() => {
  const circumference = 2 * Math.PI * 14
  const filled = Math.min(1, progress.value) * circumference
  return circumference - filled
})

const showSpinner = computed(() => pull.value > 4 || refreshing.value)
</script>

<template>
  <div
    ref="rootRef"
    class="pull-to-refresh"
    :class="{ 'is-refreshing': refreshing, 'is-armed': armed }"
  >
    <div
      class="pull-to-refresh__indicator"
      :style="{ transform: indicatorTransform, opacity: showSpinner ? 1 : 0 }"
      aria-hidden="true"
    >
      <svg
        class="pull-to-refresh__spinner"
        :class="{ 'is-spinning': refreshing }"
        viewBox="0 0 32 32"
        width="32"
        height="32"
      >
        <circle
          cx="16"
          cy="16"
          r="14"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          :stroke-dasharray="2 * Math.PI * 14"
          :stroke-dashoffset="dashOffset"
          transform="rotate(-90 16 16)"
        />
      </svg>
    </div>
    <div
      class="pull-to-refresh__content"
      :style="{ transform: contentTransform }"
    >
      <slot />
    </div>
  </div>
</template>

<style scoped>
.pull-to-refresh {
  position: relative;
  width: 100%;
  /* Évite que le pull crée un débordement visible. */
  overflow: visible;
}

.pull-to-refresh__indicator {
  position: absolute;
  top: -44px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  pointer-events: none;
  color: #e0245e; /* rose pinova */
  transition: opacity var(--pinova-dur-fast, 180ms) var(--pinova-ease-iosOut, cubic-bezier(0.22, 1, 0.36, 1));
  z-index: 5;
}

:global(.dark) .pull-to-refresh__indicator {
  color: #ff6b9c;
}

.pull-to-refresh__spinner {
  filter: drop-shadow(0 1px 4px rgba(224, 36, 94, 0.18));
}

.pull-to-refresh__spinner.is-spinning {
  animation: pull-to-refresh-spin 0.9s linear infinite;
}

.pull-to-refresh__content {
  position: relative;
  width: 100%;
  /* GPU layer pour le translate3d. */
  will-change: transform;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.pull-to-refresh.is-armed .pull-to-refresh__indicator {
  transform: scale(1.08);
  transition:
    transform var(--pinova-dur-ultraFast, 120ms) var(--pinova-ease-iosOut, cubic-bezier(0.22, 1, 0.36, 1)),
    opacity var(--pinova-dur-fast, 180ms) var(--pinova-ease-iosOut, cubic-bezier(0.22, 1, 0.36, 1));
}

@keyframes pull-to-refresh-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .pull-to-refresh__spinner.is-spinning {
    animation: pull-to-refresh-spin 2s linear infinite;
  }
}
</style>
