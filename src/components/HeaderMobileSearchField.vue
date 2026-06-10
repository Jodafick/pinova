<script setup lang="ts">
/**
 * Champ recherche style pill du GlobalHeader (home) — sans bouton submit
 * (placé à droite par le parent).
 */
import { useI18n } from '../i18n'

withDefaults(
  defineProps<{
    modelValue: string
    loading?: boolean
    disabled?: boolean
    placeholder?: string
  }>(),
  {
    loading: false,
    disabled: false,
    placeholder: '',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: []
  clear: []
}>()

const { t } = useI18n()

function onClear() {
  emit('clear')
}
</script>

<template>
  <div
    class="header-mobile-search-field pointer-events-auto flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-full bg-neutral-100/90 px-3 py-1.5 text-sm text-neutral-900 shadow-sm ring-1 ring-black/[0.04] transition hover:bg-neutral-200/85 dark:bg-neutral-800/90 dark:text-neutral-100 dark:ring-white/[0.06] dark:hover:bg-neutral-700/85"
  >
    <PinovaIcon name="search" class="shrink-0 text-lg text-neutral-400 dark:text-neutral-500" />
    <input
      :value="modelValue"
      type="search"
      inputmode="search"
      enterkeyhint="search"
      autocomplete="off"
      autocorrect="off"
      spellcheck="false"
      class="min-h-[40px] min-w-0 flex-1 border-0 bg-transparent py-0 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-0 dark:text-neutral-100 dark:placeholder:text-neutral-500 sm:min-h-0"
      :placeholder="placeholder || t('header.search.placeholder')"
      :disabled="disabled"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @keydown.enter.prevent="emit('submit')"
    />
    <button
      v-if="modelValue"
      type="button"
      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-200/90 dark:hover:bg-neutral-600/80"
      :aria-label="t('common.cancel')"
      @click="onClear"
    >
      <PinovaIcon name="close" class="text-base leading-none" />
    </button>
  </div>
</template>
