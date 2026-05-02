<template>
  <ul class="space-y-2 animate-pulse" aria-hidden="true">
    <li
      v-for="i in 6"
      :key="i"
      class="rounded-xl border border-neutral-200/90 bg-neutral-50/80 px-3 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
    >
      <div class="space-y-2 flex-1 min-w-0">
        <div class="h-3.5 rounded-lg bg-neutral-200 max-w-[16rem]" />
        <div class="h-3 rounded-full bg-neutral-200 max-w-[12rem]" />
      </div>
      <div class="h-6 rounded-full bg-neutral-200 w-[7.25rem] shrink-0 ms-auto sm:ms-0" />
    </li>
  </ul>
</template>
