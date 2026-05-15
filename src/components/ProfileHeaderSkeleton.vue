<script setup lang="ts">
/** Miroir de l’en-tête profil chargé : avatar 28, titre, @, bio, stats (3), actions. */
</script>

<template>
  <section
    class="flex flex-col items-center text-center mb-10 w-full max-w-2xl mx-auto"
    aria-hidden="true"
  >
    <div class="w-28 h-28 rounded-full bg-neutral-200 dark:bg-neutral-700 mb-4 shrink-0 animate-pulse" />

    <div
      class="h-8 sm:h-9 bg-neutral-200 dark:bg-neutral-700 rounded-lg w-[min(18rem,88vw)] sm:w-64 max-w-full mb-2 animate-pulse"
    />

    <div class="h-4 bg-neutral-100 dark:bg-neutral-800 rounded w-28 mx-auto mb-3 animate-pulse" />

    <div class="w-full max-w-md mx-auto space-y-2 mb-4 px-1">
      <div class="h-3.5 bg-neutral-100 dark:bg-neutral-800 rounded-md w-full animate-pulse" />
      <div class="h-3.5 bg-neutral-100 dark:bg-neutral-800 rounded-md w-[88%] mx-auto animate-pulse" />
    </div>

    <div
      class="flex items-center justify-center gap-2.5 sm:gap-6 mb-6 flex-wrap text-sm"
    >
      <div class="h-4 w-[4.25rem] sm:w-20 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
      <span class="w-1 h-1 rounded-full bg-neutral-300 dark:bg-neutral-600 shrink-0" />
      <div class="h-4 w-24 sm:w-28 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
      <span class="w-1 h-1 rounded-full bg-neutral-300 dark:bg-neutral-600 shrink-0" />
      <div class="h-4 w-14 sm:w-16 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
    </div>

    <div class="flex items-center justify-center gap-3 flex-wrap w-full px-1">
      <div class="h-10 w-32 sm:w-36 rounded-full bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
      <div class="h-10 w-28 sm:w-32 rounded-full bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
      <div class="h-10 w-10 rounded-full bg-neutral-100 dark:bg-neutral-800 shrink-0 animate-pulse" />
    </div>
  </section>
</template>
