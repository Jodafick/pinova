<script setup lang="ts">
/** En-tête profil (avatar, nom, stats, actions) — shimmer type Pinterest. */
</script>

<template>
  <section class="flex flex-col items-center text-center mb-10 animate-pulse" aria-hidden="true">
    <div class="w-28 h-28 rounded-full bg-neutral-200 mb-4 shrink-0" />
    <div class="h-8 sm:h-9 bg-neutral-200 rounded-lg w-48 sm:w-56 max-w-full mb-3" />
    <div class="h-4 bg-neutral-100 rounded w-32 mb-4" />
    <div class="h-4 bg-neutral-100 rounded w-[min(90%,20rem)] mb-2" />
    <div class="h-4 bg-neutral-100 rounded w-[min(70%,16rem)] mb-6" />
    <div class="flex items-center justify-center gap-4 mb-6">
      <div class="h-4 bg-neutral-100 rounded w-20" />
      <div class="h-4 bg-neutral-100 rounded w-24" />
      <div class="h-4 bg-neutral-100 rounded w-16" />
    </div>
    <div class="flex items-center justify-center gap-3 flex-wrap">
      <div class="h-10 bg-neutral-200 rounded-full w-36" />
      <div class="h-10 bg-neutral-100 rounded-full w-24" />
      <div class="h-10 w-10 rounded-full bg-neutral-100 shrink-0" />
    </div>
  </section>
</template>
