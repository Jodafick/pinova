<script setup lang="ts">
/** Squelette pleine page pour le dashboard /creator pendant le fetch des stats. */
import CreatorStatsSkeleton from './CreatorStatsSkeleton.vue'
</script>

<template>
  <div class="space-y-8 sm:space-y-10" aria-hidden="true">
    <div class="flex flex-wrap items-center gap-3 justify-between">
      <div class="flex flex-wrap items-center gap-2 animate-pulse">
        <span class="h-10 w-10 rounded-xl bg-neutral-200" />
        <span class="h-4 rounded-full bg-neutral-200 w-24" />
        <span class="h-5 w-5 rounded-full bg-neutral-100" aria-hidden="true">/</span>
        <span class="h-5 rounded-full bg-neutral-200 w-28" />
      </div>
      <span class="h-11 rounded-xl bg-neutral-200 w-[9.5rem] animate-pulse" />
    </div>

    <div
      class="rounded-[1.65rem] sm:rounded-3xl overflow-hidden bg-gradient-to-br from-neutral-200 via-neutral-100 to-neutral-200 p-6 sm:p-8 md:p-10 animate-pulse"
    >
      <div class="flex flex-col lg:flex-row lg:items-end gap-8 lg:gap-12">
        <div class="flex gap-4 sm:gap-6 flex-1 min-w-0">
          <div class="hidden sm:block size-16 md:size-[4.75rem] shrink-0 rounded-2xl bg-white/60 shadow-inner" />
          <div class="flex-1 space-y-3 sm:space-y-4 pt-1">
            <div class="h-4 rounded-full bg-white/70 w-36 max-w-[50%]" />
            <div class="h-8 sm:h-10 rounded-xl bg-white/80 w-[min(100%,22rem)]" />
            <div class="space-y-2 max-w-xl">
              <div class="h-3 rounded-full bg-white/60 w-[min(100%,18rem)]" />
              <div class="h-3 rounded-full bg-white/50 w-[min(100%,14rem)]" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <section>
      <div class="mb-5 h-7 rounded-lg bg-neutral-200 w-[min(100%,220px)] animate-pulse sm:mx-0" />
      <CreatorStatsSkeleton />
    </section>

    <section>
      <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
        <div class="space-y-2 flex-1 min-w-0">
          <div class="h-7 rounded-lg bg-neutral-200 w-[min(100%,300px)] animate-pulse" />
          <div class="h-3.5 rounded-full bg-neutral-200 w-[min(100%,340px)] animate-pulse" />
        </div>
        <div class="h-3.5 rounded-full bg-neutral-200 w-44 animate-pulse shrink-0" />
      </div>
      <div
        class="rounded-2xl border border-neutral-200/70 bg-white/85 backdrop-blur-[2px] p-4 sm:p-6 shadow-[0_1px_0_rgba(0,0,0,0.04)] space-y-3"
      >
        <div v-for="i in 5" :key="i" class="flex gap-3 sm:gap-4 animate-pulse">
          <div class="flex items-start shrink-0 gap-3 sm:gap-4 w-full rounded-xl bg-neutral-100/95 p-3 sm:p-4">
            <div class="size-7 rounded-full bg-neutral-300 shrink-0 mt-0.5" />
            <div class="size-14 sm:size-[4.75rem] rounded-xl bg-neutral-300 shrink-0" />
            <div class="flex-1 py-2 min-w-0 space-y-2.5">
              <div class="h-4 rounded-lg bg-neutral-300 max-w-[min(100%,16rem)]" />
              <div class="h-3 rounded-full bg-neutral-200 w-28" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <section>
      <div class="mb-5 h-7 rounded-lg bg-neutral-200 w-[min(100%,200px)] animate-pulse" />
      <div
        class="rounded-2xl border border-neutral-200/70 divide-y divide-neutral-200 bg-white/80 overflow-hidden animate-pulse"
      >
        <div v-for="j in 4" :key="j" class="flex justify-between gap-4 items-center px-4 py-4 sm:px-5 bg-neutral-50/80">
          <div class="h-4 rounded-lg bg-neutral-200 flex-1 max-w-[60%]" />
          <div class="flex gap-2 shrink-0">
            <div class="h-3 rounded-full bg-neutral-200 w-16" />
            <div class="h-3 rounded-full bg-neutral-200 w-12" />
          </div>
        </div>
      </div>
    </section>

    <div class="h-4 rounded-full bg-neutral-200 w-[min(100%,260px)] animate-pulse pb-8" />
  </div>
</template>
