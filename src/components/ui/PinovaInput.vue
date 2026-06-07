<script setup lang="ts">
import { computed, useId } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    label?: string
    hint?: string
    error?: string
    placeholder?: string
    type?: string
    inputId?: string
    testId?: string
    disabled?: boolean
    autocomplete?: string
    icon?: string
  }>(),
  {
    modelValue: '',
    label: '',
    hint: '',
    error: '',
    placeholder: '',
    type: 'text',
    disabled: false,
  },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const autoId = useId()
const fieldId = computed(() => props.inputId || `pinova-input-${autoId}`)
const hasError = computed(() => !!props.error?.trim())

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <div class="pds-field">
    <label
      v-if="label"
      :for="fieldId"
      class="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2 ml-1"
    >
      {{ label }}
    </label>

    <div class="relative group">
      <span
        v-if="icon"
        class="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-400 group-focus-within:text-pink-700 dark:group-focus-within:text-pink-500 transition-colors"
      >
        {{ icon }}
      </span>
      <slot name="prefix" />
      <input
        :id="fieldId"
        :data-testid="testId || undefined"
        :value="modelValue"
        :type="type"
        :placeholder="placeholder"
        :disabled="disabled"
        :autocomplete="autocomplete"
        :aria-invalid="hasError || undefined"
        :class="[
          'w-full py-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 transition-all',
          icon || $slots.prefix ? 'pl-12 pr-4' : 'px-4',
          hasError
            ? 'border-red-400 focus:ring-red-300/20 focus:border-red-500 dark:focus:border-red-500'
            : 'border-neutral-200 dark:border-neutral-700 focus:ring-pink-700/20 dark:focus:ring-pink-600/20 focus:border-pink-700 dark:focus:border-pink-600',
          disabled && 'opacity-60 cursor-not-allowed',
        ]"
        @input="onInput"
      />
      <slot name="suffix" />
    </div>

    <p v-if="error" class="mt-1 ml-1 text-xs font-semibold text-red-600 dark:text-red-400">{{ error }}</p>
    <p v-else-if="hint" class="mt-1 ml-1 text-xs text-neutral-500 dark:text-neutral-400">{{ hint }}</p>
  </div>
</template>
