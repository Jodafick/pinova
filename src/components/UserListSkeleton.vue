<script setup lang="ts">
withDefaults(
  defineProps<{
    rows?: number
    thumb?: 'circle' | 'rounded'
    /** Ligne avec séparateur (modales); sinon espacement léger */
    divided?: boolean
  }>(),
  { rows: 8, thumb: 'circle', divided: true },
)
</script>

<template>
  <div :class="divided ? 'divide-y divide-neutral-100' : 'space-y-3'" aria-hidden="true">
    <div
      v-for="i in rows"
      :key="i"
      class="flex items-center gap-3 animate-pulse"
      :class="[thumb === 'circle' ? (divided ? 'px-5 py-3' : 'py-2') : 'p-2']"
    >
      <div
        class="shrink-0 bg-neutral-200"
        :class="thumb === 'circle' ? 'w-9 h-9 rounded-full' : 'w-12 h-12 rounded-lg'"
      />
      <div class="flex-1 min-w-0 space-y-2">
        <div class="h-3 bg-neutral-200 rounded w-2/5 max-w-[200px]" />
        <div class="h-2.5 bg-neutral-100 rounded w-1/4 max-w-[120px]" />
      </div>
      <div v-if="thumb === 'rounded'" class="w-6 h-6 rounded bg-neutral-100 shrink-0" />
    </div>
  </div>
</template>
