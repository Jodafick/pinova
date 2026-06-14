<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'

const props = defineProps<{ active?: boolean }>()

const pieces = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  left: `${(i * 17) % 100}%`,
  delay: `${(i % 7) * 0.08}s`,
  color: ['#e11d48', '#a855f7', '#f59e0b', '#10b981', '#3b82f6'][i % 5],
}))

const show = ref(false)
let hideTimer: ReturnType<typeof setTimeout> | null = null

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function clearHideTimer() {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

function triggerBurst() {
  clearHideTimer()
  if (!props.active || prefersReducedMotion()) {
    show.value = false
    return
  }
  show.value = true
  hideTimer = setTimeout(() => {
    show.value = false
    hideTimer = null
  }, 2800)
}

watch(
  () => props.active,
  (active) => {
    if (active) triggerBurst()
    else {
      clearHideTimer()
      show.value = false
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  clearHideTimer()
})
</script>

<template>
  <div v-if="show" class="confetti-root" aria-hidden="true">
    <span
      v-for="p in pieces"
      :key="p.id"
      class="confetti-piece"
      :style="{ left: p.left, animationDelay: p.delay, backgroundColor: p.color }"
    />
  </div>
</template>

<style scoped>
.confetti-root {
  pointer-events: none;
  position: absolute;
  inset: 0;
  overflow: hidden;
  z-index: 2;
}

.confetti-piece {
  position: absolute;
  top: -12px;
  width: 8px;
  height: 12px;
  border-radius: 2px;
  opacity: 0.9;
  animation: confetti-fall 2.4s ease-in forwards;
}

@keyframes confetti-fall {
  0% {
    transform: translateY(0) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateY(320px) rotate(540deg);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .confetti-piece {
    animation: none;
    opacity: 0;
  }
}
</style>
