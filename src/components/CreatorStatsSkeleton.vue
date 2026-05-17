<script setup lang="ts">
/** KPI créateur pendant GET stats — utilisé par le dashboard /creator et par le bloc profil. */
</script>

<template>
  <div
    class="app-skeleton-wave grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-5 animate-pulse"
    aria-hidden="true"
  >
    <div
      v-for="i in 5"
      :key="i"
      class="flex min-h-[11rem] flex-col items-center gap-5 rounded-[1.35rem] border border-neutral-200/80 bg-gradient-to-b from-neutral-50 to-white p-6 ring-1 ring-black/[0.03] dark:border-neutral-700/80 dark:from-neutral-900 dark:to-neutral-950 dark:ring-white/[0.04]"
    >
      <div class="size-[3.75rem] shrink-0 rounded-full bg-neutral-200 dark:bg-neutral-700 ring-1 ring-black/[0.05] dark:ring-white/10" />
      <div class="flex w-full flex-col items-center gap-2">
        <div class="h-3 w-[5.5rem] rounded-full bg-neutral-200 dark:bg-neutral-700" />
        <div class="h-9 w-14 rounded-lg bg-neutral-200 dark:bg-neutral-700" />
      </div>
    </div>
  </div>
</template>
