<script setup lang="ts">
/** Bandeau tableau (titre, auteur, compteur, menu ⋮) pendant GET board — aligné sur l’en-tête chargé. */
</script>

<template>
  <div class="mb-8 flex items-start justify-between gap-3 w-full min-w-0" aria-hidden="true">
    <div class="min-w-0 flex-1 space-y-3 pr-2">
      <div
        class="h-8 sm:h-10 bg-neutral-200 dark:bg-neutral-700 rounded-lg w-[min(100%,18rem)] sm:w-72 max-w-full animate-pulse"
      />
      <div class="h-4 bg-neutral-100 dark:bg-neutral-800 rounded w-36 animate-pulse" />
      <div class="h-3.5 bg-neutral-100 dark:bg-neutral-800 rounded w-44 animate-pulse" />
    </div>
    <div class="h-11 w-11 shrink-0 rounded-full bg-neutral-200 dark:bg-neutral-700 animate-pulse max-lg:hidden" />
  </div>
</template>
