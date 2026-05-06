<template>
  <ul class="space-y-3 animate-pulse" aria-hidden="true">
    <li
      v-for="i in 6"
      :key="i"
      class="rounded-2xl border border-neutral-100 bg-gradient-to-b from-neutral-50/90 to-neutral-100/60 p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="space-y-2.5 flex-1 min-w-0">
        <div class="flex flex-wrap gap-2">
          <div class="h-4 rounded-lg bg-neutral-200 w-24" />
          <div class="h-4 rounded-full bg-neutral-200 w-16" />
          <div class="h-5 rounded-full bg-neutral-200/90 w-20" />
        </div>
        <div class="h-3 rounded-md bg-neutral-200/90 max-w-[14rem]" />
      </div>
      <div class="flex flex-col gap-2 items-stretch sm:items-end">
        <div class="h-7 rounded-lg bg-neutral-200 w-28 sm:ms-auto" />
        <div class="h-9 rounded-full bg-pink-100/80 w-full sm:w-40" />
      </div>
    </li>
  </ul>
</template>
