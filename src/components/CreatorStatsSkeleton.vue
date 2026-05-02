<script setup lang="ts">
/** KPI créateur pendant GET stats — utilisé par le dashboard /creator et par le bloc profil. */
</script>

<template>
  <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 animate-pulse" aria-hidden="true">
    <div
      v-for="i in 5"
      :key="i"
      class="rounded-2xl border border-neutral-200/80 bg-gradient-to-br from-neutral-50 to-white p-4 flex flex-col gap-3 items-center text-center justify-center min-h-[6.75rem]"
    >
      <div class="size-10 rounded-xl bg-neutral-200 shrink-0" />
      <div class="w-full space-y-2 flex flex-col items-center">
        <div class="h-3 bg-neutral-200 rounded-full w-[4.75rem]" />
        <div class="h-8 bg-neutral-200 rounded-xl w-14" />
      </div>
    </div>
  </div>
</template>
