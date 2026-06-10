<script setup lang="ts">
withDefaults(
  defineProps<{
    icon?: string
    title: string
    description?: string
  }>(),
  { icon: 'inbox', description: '' },
)
</script>

<template>
  <div class="pds-empty flex flex-col items-center justify-center text-center px-6 py-12 gap-3">
    <div
      class="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500"
    >
      <PinovaIcon :name="icon" class="text-3xl" />
    </div>
    <h3 class="text-base font-extrabold text-neutral-900 dark:text-neutral-50">{{ title }}</h3>
    <p v-if="description" class="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm leading-relaxed">
      {{ description }}
    </p>
    <div v-if="$slots.action" class="mt-2 w-full max-w-xs">
      <slot name="action" />
    </div>
  </div>
</template>
