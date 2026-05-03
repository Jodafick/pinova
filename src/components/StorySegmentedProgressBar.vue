<script setup lang="ts">
/**
 * Barre de progression segmentée type stories (Instagram / Snapchat).
 * Purement visuelle : le parent pilote durée et index (`animationKey` recrée l’animation du segment actif).
 */
defineProps<{
  segmentCount: number
  currentIndex: number
  /** Durée CSS + référence pour le timer parent (segment actif uniquement). */
  activeDurationMs: number
  /** Incrémenter pour relancer l’animation du segment courant. */
  animationKey: number
}>()
</script>

<template>
  <div
    class="flex gap-1.5 px-1"
    role="progressbar"
    :aria-valuemin="0"
    :aria-valuemax="100"
    :aria-valuenow="segmentCount <= 1 ? 100 : Math.round(((currentIndex + 1) / segmentCount) * 100)"
    aria-label="Progression du carrousel de stories"
  >
    <div
      v-for="si in segmentCount"
      :key="si"
      class="h-1.5 flex-1 min-w-0 rounded-full bg-white/25"
    >
      <div v-if="si - 1 < currentIndex" class="h-full w-full rounded-full bg-pink-400 shadow-[0_0_8px_rgba(244,114,182,0.45)]" />
      <div
        v-else-if="si - 1 === currentIndex"
        :key="`${si - 1}-${animationKey}`"
        class="story-segment-active h-full rounded-full bg-gradient-to-r from-pink-300 to-pink-500 shadow-[0_0_10px_rgba(244,114,182,0.5)]"
        :style="{ animationDuration: `${activeDurationMs}ms` }"
      />
    </div>
  </div>
</template>

<style scoped>
.story-segment-active {
  width: 100%;
  transform: scaleX(0);
  transform-origin: left center;
  animation-name: story-segment-fill;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}
@keyframes story-segment-fill {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}
</style>