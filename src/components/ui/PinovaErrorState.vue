<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    description?: string
    icon?: string
  }>(),
  { description: '', icon: 'error' },
)
</script>

<template>
  <div class="pds-error flex flex-col items-center justify-center text-center px-6 py-10 gap-3">
    <div
      class="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400"
    >
      <PinovaIcon :name="icon" class="text-3xl" />
    </div>
    <h3 class="text-base font-extrabold text-neutral-900 dark:text-neutral-50">{{ title }}</h3>
    <p v-if="description" class="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm leading-relaxed">
      {{ description }}
    </p>
    <div v-if="$slots.action" class="mt-2 w-full max-w-xs flex flex-col gap-2">
      <slot name="action" />
    </div>
  </div>
</template>
