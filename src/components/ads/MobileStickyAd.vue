<script setup lang="ts">
import InContentAd from './InContentAd.vue'
defineProps<{ slot: string; enabled?: boolean }>()
</script>

<template>
  <div v-if="enabled !== false" class="fixed bottom-0 left-0 right-0 z-30 border-t border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur sm:hidden p-2">
    <InContentAd :slot="slot" format="auto" />
  </div>
</template>
