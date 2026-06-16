<script setup lang="ts">
withDefaults(
  defineProps<{
    rows?: number
    compact?: boolean
  }>(),
  { rows: 6, compact: false },
)
</script>

<template>
  <div class="app-skeleton-wave space-y-3" aria-hidden="true">
    <div
      v-for="i in rows"
      :key="`notif-skel-${i}`"
      class="flex w-full min-w-0 items-start gap-3 rounded-2xl border border-white/40 bg-white/45 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/40"
      :class="compact ? 'py-3' : ''"
    >
      <div
        class="shrink-0 animate-pulse rounded-full bg-neutral-200/80 dark:bg-neutral-700/80"
        :class="compact ? 'h-10 w-10' : 'h-11 w-11'"
      />
      <div class="min-w-0 flex-1 space-y-2">
        <div
          v-if="!compact"
          class="h-2.5 w-full max-w-[7.5rem] animate-pulse rounded bg-neutral-200/70 dark:bg-neutral-700/70"
        />
        <div class="h-3.5 w-full animate-pulse rounded bg-neutral-200/80 dark:bg-neutral-700/80" />
        <div
          class="h-3.5 w-full animate-pulse rounded bg-neutral-100/90 dark:bg-neutral-800/80"
          :class="compact ? 'max-w-[72%]' : 'max-w-[94%]'"
        />
        <div
          v-if="!compact"
          class="h-2.5 w-full max-w-[5.5rem] animate-pulse rounded bg-neutral-100/80 dark:bg-neutral-800/70"
        />
      </div>
      <div
        v-if="!compact && i % 2 === 1"
        class="mt-1 h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-pink-200/80 dark:bg-pink-800/60"
      />
    </div>
  </div>
</template>
