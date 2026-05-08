<script setup lang="ts">
import InContentAd from './InContentAd.vue'

defineProps<{ slot: string }>()
</script>

<template>
  <article class="rounded-3xl border border-pink-100 dark:border-pink-900/40 bg-gradient-to-b from-pink-50/70 to-white dark:from-pink-950/20 dark:to-neutral-900 p-3">
    <p class="text-[11px] font-semibold uppercase tracking-wide text-pink-600 dark:text-pink-400 mb-2">
      Sponsorise
    </p>
    <InContentAd :slot="slot" format="fluid" />
  </article>
</template>
