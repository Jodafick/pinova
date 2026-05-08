<script setup lang="ts">
import InContentAd from './InContentAd.vue'
defineProps<{ slot: string }>()
</script>

<template>
  <aside class="hidden xl:block sticky top-24">
    <InContentAd :slot="slot" format="rectangle" />
  </aside>
</template>
