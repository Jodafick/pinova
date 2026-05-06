<script setup lang="ts">
/** KPI créateur pendant GET stats — utilisé par le dashboard /creator et par le bloc profil. */
</script>

<template>
  <div
    class="app-skeleton-wave grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 animate-pulse"
    aria-hidden="true"
  >
    <div
      v-for="i in 5"
      :key="i"
      class="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/80 bg-gradient-to-br from-neutral-50 to-white dark:from-neutral-900 dark:to-neutral-900 p-4 sm:p-5 min-h-[9.5rem] flex flex-col items-center text-center gap-3 ring-4 ring-neutral-200/70 dark:ring-neutral-700/45"
    >
      <div class="w-full flex justify-center">
        <div class="size-11 sm:size-[3.125rem] rounded-xl bg-neutral-200 dark:bg-neutral-700 shrink-0" />
      </div>
      <div class="w-full space-y-2 flex flex-col items-center">
        <div class="h-3 bg-neutral-200 dark:bg-neutral-700 rounded-full w-[5.25rem]" />
        <div class="h-8 bg-neutral-200 dark:bg-neutral-700 rounded-xl w-16" />
        <div class="h-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-full w-20 mt-1" />
      </div>
    </div>
  </div>
</template>
