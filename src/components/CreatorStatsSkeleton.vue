<script setup lang="ts">
/** KPI créateur (cartes chiffrées) pendant GET stats. */
</script>

<template>
  <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 animate-pulse" aria-hidden="true">
    <div v-for="i in 5" :key="i" class="rounded-xl bg-neutral-100 py-4 px-2 space-y-2">
      <div class="h-3 bg-neutral-200 rounded mx-auto w-16" />
      <div class="h-6 bg-neutral-200 rounded-lg w-12 mx-auto" />
    </div>
  </div>
</template>
