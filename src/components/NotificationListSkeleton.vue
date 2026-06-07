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
      class="flex items-start gap-3 rounded-2xl border border-white/40 bg-white/45 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/40"
      :class="compact ? 'py-3' : ''"
    >
      <div class="h-10 w-10 shrink-0 animate-pulse rounded-full bg-neutral-200/80 dark:bg-neutral-700/80" />
      <div class="flex-1 space-y-2">
        <div class="h-3 w-1/3 animate-pulse rounded bg-neutral-200/80 dark:bg-neutral-700/80" />
        <div class="h-3 w-4/5 animate-pulse rounded bg-neutral-100/90 dark:bg-neutral-800/80" />
        <div v-if="!compact" class="h-2.5 w-1/4 animate-pulse rounded bg-neutral-100/80 dark:bg-neutral-800/70" />
      </div>
    </div>
  </div>
</template>
