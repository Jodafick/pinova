<script setup lang="ts">
/** Squelette pleine page pour le dashboard /creator pendant le fetch des stats. */
import CreatorStatsSkeleton from './CreatorStatsSkeleton.vue'
</script>

<template>
  <div class="space-y-10 sm:space-y-12" aria-hidden="true">

    <!-- Breadcrumb / nav bar -->
    <nav class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2 animate-pulse">
        <span class="size-9 rounded-xl bg-neutral-200 dark:bg-neutral-800" />
        <span class="h-4 rounded-full bg-neutral-200 dark:bg-neutral-800 w-16" />
      </div>
      <span class="h-10 rounded-xl bg-neutral-200 dark:bg-neutral-800 w-32 animate-pulse" />
    </nav>

    <!-- Hero banner -->
    <div class="relative overflow-hidden rounded-[1.65rem] sm:rounded-[2rem] animate-pulse">
      <div class="bg-gradient-to-br from-neutral-300 via-neutral-200 to-neutral-300 dark:from-neutral-800 dark:via-neutral-700 dark:to-neutral-800 p-6 sm:p-9 md:p-10">
        <div class="flex flex-col lg:flex-row lg:items-end gap-8 lg:gap-12 lg:justify-between">
          <div class="flex gap-4 sm:gap-6 flex-1 min-w-0">
            <!-- Icon block -->
            <div class="hidden sm:flex size-14 md:size-[4.5rem] shrink-0 rounded-[1rem] md:rounded-2xl bg-white/25 dark:bg-white/10 items-center justify-center ring-2 ring-white/20" />
            <!-- Text lines -->
            <div class="flex-1 min-w-0 space-y-3 sm:space-y-4 pt-1">
              <div class="h-3 rounded-full bg-white/50 dark:bg-white/20 w-28" />
              <div class="h-8 sm:h-10 rounded-xl bg-white/65 dark:bg-white/20 w-[min(100%,20rem)]" />
              <div class="space-y-2 max-w-xl pt-1">
                <div class="h-3 rounded-full bg-white/45 dark:bg-white/15 w-[min(100%,22rem)]" />
                <div class="h-3 rounded-full bg-white/35 dark:bg-white/10 w-[min(100%,16rem)]" />
              </div>
            </div>
          </div>
          <!-- CTA button -->
          <div class="h-10 w-36 rounded-xl bg-white/30 dark:bg-white/10 shrink-0" />
        </div>
      </div>
    </div>

    <!-- KPI cards section -->
    <section>
      <div class="flex items-end justify-between mb-5 sm:mb-6">
        <div class="h-7 rounded-lg bg-neutral-200 dark:bg-neutral-800 w-48 animate-pulse" />
        <div class="h-4 rounded-full bg-neutral-150 dark:bg-neutral-800 w-24 animate-pulse" />
      </div>
      <CreatorStatsSkeleton />
    </section>

    <!-- Weekly pins section -->
    <section>
      <!-- Section header -->
      <div class="rounded-t-[1.5rem] sm:rounded-t-[1.85rem] border border-b-0 border-neutral-200/80 dark:border-neutral-700/80 bg-white/92 dark:bg-neutral-900/92 px-5 py-5 sm:px-7 sm:py-7">
        <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div class="flex-1 min-w-0 space-y-2.5">
            <div class="h-6 rounded-lg bg-neutral-200 dark:bg-neutral-700 w-[min(100%,280px)] animate-pulse" />
            <div class="h-3.5 rounded-full bg-neutral-200 dark:bg-neutral-700 w-[min(100%,360px)] animate-pulse" />
            <div class="h-3.5 rounded-full bg-neutral-150 dark:bg-neutral-800 w-[min(100%,300px)] animate-pulse" />
          </div>
          <div class="h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700 w-52 animate-pulse shrink-0 self-start" />
        </div>
      </div>

      <!-- Pins list -->
      <div class="rounded-b-[1.5rem] sm:rounded-b-[1.85rem] border border-t-0 border-neutral-200/80 dark:border-neutral-700/80 bg-white/92 dark:bg-neutral-900/92 p-4 sm:p-6 md:p-7 space-y-3 md:space-y-4">
        <div
          v-for="i in 5"
          :key="i"
          class="flex items-center gap-3 sm:gap-4 rounded-2xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-800/40 p-3 sm:p-4 animate-pulse"
        >
          <!-- Rank badge -->
          <div class="size-10 rounded-full bg-neutral-200 dark:bg-neutral-700 shrink-0 ring-2 ring-neutral-300 dark:ring-neutral-600" />
          <!-- Thumbnail -->
          <div class="size-[4.75rem] sm:size-[5.25rem] rounded-xl bg-neutral-200 dark:bg-neutral-700 shrink-0" />
          <!-- Text + chips -->
          <div class="flex-1 min-w-0 space-y-2.5 py-1">
            <div class="h-4 rounded-lg bg-neutral-200 dark:bg-neutral-700 w-[min(100%,18rem)]" />
            <div class="h-3.5 rounded-full bg-neutral-200 dark:bg-neutral-700 w-[min(100%,14rem)]" />
            <div class="flex flex-wrap gap-2 mt-1">
              <div class="h-6 rounded-full bg-neutral-100 dark:bg-neutral-700/80 ring-1 ring-neutral-200 dark:ring-neutral-700 w-20" />
              <div class="h-6 rounded-full bg-rose-50 dark:bg-rose-950/40 ring-1 ring-rose-100 dark:ring-rose-900/50 w-16" />
              <div class="h-6 rounded-full bg-teal-50 dark:bg-teal-950/40 ring-1 ring-teal-100 dark:ring-teal-900/50 w-16" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Top all-time section -->
    <section>
      <!-- Section header -->
      <div class="rounded-t-[1.5rem] sm:rounded-t-[1.85rem] border border-b-0 border-neutral-200/80 dark:border-neutral-700/80 bg-gradient-to-r from-neutral-50 to-white dark:from-neutral-900 dark:to-neutral-900 px-5 py-5 sm:px-7 sm:py-6">
        <div class="h-6 rounded-lg bg-neutral-200 dark:bg-neutral-700 w-[min(100%,220px)] animate-pulse" />
      </div>
      <!-- Rows -->
      <div class="rounded-b-[1.5rem] sm:rounded-b-[1.85rem] border border-t-0 border-neutral-200/80 dark:border-neutral-700/80 bg-white/95 dark:bg-neutral-900/95 divide-y divide-neutral-100 dark:divide-neutral-800 overflow-hidden">
        <div
          v-for="j in 6"
          :key="j"
          class="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 px-5 py-4 sm:px-7 animate-pulse"
        >
          <!-- Left: rank + title -->
          <div class="flex items-center gap-4 min-w-0 flex-1">
            <div
              class="size-9 rounded-full shrink-0 ring-2 ring-neutral-200 dark:ring-neutral-700"
              :class="[
                j === 1 ? 'bg-amber-200 dark:bg-amber-800' :
                j === 2 ? 'bg-neutral-200 dark:bg-neutral-700' :
                j === 3 ? 'bg-orange-200 dark:bg-orange-800' :
                'bg-neutral-100 dark:bg-neutral-800'
              ]"
            />
            <div
              class="h-4 rounded-lg bg-neutral-200 dark:bg-neutral-700"
              :style="{ width: `${55 - j * 4}%` }"
            />
          </div>
          <!-- Right: stats chips -->
          <div class="flex items-center gap-4 ps-[3.25rem] sm:ps-0 shrink-0">
            <div class="h-3.5 rounded-full bg-sky-100 dark:bg-sky-900/50 w-12" />
            <div class="h-3.5 rounded-full bg-rose-100 dark:bg-rose-900/50 w-10" />
            <div class="h-3.5 rounded-full bg-teal-100 dark:bg-teal-900/50 w-10" />
          </div>
        </div>
      </div>
    </section>

    <!-- Footer hint -->
    <div class="pt-4 border-t border-neutral-200/80 dark:border-neutral-800 flex items-center gap-3 animate-pulse">
      <div class="size-5 rounded bg-neutral-200 dark:bg-neutral-800 shrink-0" />
      <div class="h-3 rounded-full bg-neutral-200 dark:bg-neutral-800 w-[min(100%,320px)]" />
    </div>

  </div>
</template>