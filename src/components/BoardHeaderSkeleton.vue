<script setup lang="ts">
/** Bandeau tableau (titre, lien auteur, actions) pendant GET board. */
</script>

<template>
  <div class="mb-8 flex flex-wrap items-start justify-between gap-4 animate-pulse" aria-hidden="true">
    <div class="min-w-0 flex-1 space-y-3">
      <div class="h-8 sm:h-10 bg-neutral-200 rounded-lg w-[min(100%,280px)]" />
      <div class="h-4 bg-neutral-100 rounded w-32" />
      <div class="h-3 bg-neutral-100 rounded w-40" />
    </div>
    <div class="flex flex-wrap gap-2 shrink-0 w-full sm:w-auto justify-end">
      <div class="h-10 bg-neutral-200 rounded-full w-36" />
      <div class="h-10 bg-neutral-100 rounded-full w-28" />
    </div>
  </div>
</template>
