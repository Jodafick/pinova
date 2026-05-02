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
    class="flex gap-1"
    role="progressbar"
    :aria-valuemin="0"
    :aria-valuemax="100"
    :aria-valuenow="segmentCount <= 1 ? 100 : Math.round(((currentIndex + 1) / segmentCount) * 100)"
    aria-label="Progression du carrousel de stories"
  >
    <div
      v-for="si in segmentCount"
      :key="si"
      class="h-0.5 flex-1 min-w-0 rounded-full bg-white/15 overflow-hidden"
    >
      <div v-if="si - 1 < currentIndex" class="h-full w-full bg-white rounded-full" />
      <div
        v-else-if="si - 1 === currentIndex"
        :key="`${si - 1}-${animationKey}`"
        class="story-segment-active h-full bg-white rounded-full"
        :style="{ animationDuration: `${activeDurationMs}ms` }"
      />
    </div>
  </div>
</template>

<style scoped>
.story-segment-active {
  width: 0%;
  animation-name: story-segment-fill;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}
@keyframes story-segment-fill {
  from {
    width: 0%;
  }
  to {
    width: 100%;
  }
}
</style>
