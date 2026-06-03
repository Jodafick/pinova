<script setup lang="ts">
import { computed, ref, watch } from 'vue'

export type SearchableSelectOption = {
  value: string
  label: string
  searchText?: string
}

const props = withDefaults(
  defineProps<{
    modelValue: string
    options: SearchableSelectOption[]
    placeholder?: string
    searchPlaceholder?: string
    disabled?: boolean
    /** `field` = paramètres / profil ; `glass` = onboarding. */
    variant?: 'field' | 'glass'
  }>(),
  {
    placeholder: '',
    searchPlaceholder: '',
    disabled: false,
    variant: 'field',
  },
)

const emit = defineEmits<{ 'update:modelValue': [string] }>()

const open = ref(false)
const query = ref('')

const selectedLabel = computed(
  () => props.options.find((o) => o.value === props.modelValue)?.label ?? '',
)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = q
    ? props.options.filter((o) => {
        const hay = (o.searchText ?? o.label).toLowerCase()
        return hay.includes(q)
      })
    : props.options
  return list.slice(0, 100)
})

const triggerClass = computed(() =>
  props.variant === 'glass'
    ? 'mt-[0.45rem] rounded-[0.9rem] border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50'
    : 'rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-pink-700 dark:focus:ring-pink-600 focus:border-transparent',
)

watch(
  () => props.modelValue,
  () => {
    if (!props.modelValue) return
    open.value = false
    query.value = ''
  },
)

function toggleOpen() {
  if (props.disabled) return
  open.value = !open.value
  if (!open.value) query.value = ''
}

function pick(value: string) {
  emit('update:modelValue', value)
  open.value = false
  query.value = ''
}

function clearSelection() {
  emit('update:modelValue', '')
  query.value = ''
}
</script>

<template>
  <div class="searchable-select relative" :class="{ 'searchable-select--open': open }">
    <button
      type="button"
      class="searchable-select-trigger w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-sm transition focus:outline-none disabled:cursor-not-allowed disabled:opacity-55"
      :class="triggerClass"
      :disabled="disabled"
      @click="toggleOpen"
    >
      <span :class="selectedLabel ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-400 dark:text-neutral-500'">
        {{ selectedLabel || placeholder }}
      </span>
      <span class="material-symbols-outlined text-[20px] text-neutral-400 dark:text-neutral-500 shrink-0">
        {{ open ? 'expand_less' : 'expand_more' }}
      </span>
    </button>

    <div
      v-if="open"
      class="searchable-select-panel absolute z-40 left-0 right-0 mt-1.5 overflow-hidden rounded-[14px] border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-[0_16px_40px_rgba(15,23,42,0.12)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.5)]"
    >
      <input
        v-model="query"
        type="search"
        autocomplete="off"
        class="searchable-select-search w-full border-0 border-b border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-3 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-0"
        :placeholder="searchPlaceholder || placeholder"
      />
      <ul class="searchable-select-list max-h-[220px] overflow-y-auto m-0 list-none p-1" role="listbox">
        <li v-if="modelValue">
          <button
            type="button"
            class="searchable-select-option searchable-select-option--muted block w-full rounded-[10px] px-3 py-2.5 text-left text-sm italic text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            @click="clearSelection"
          >
            {{ placeholder }}
          </button>
        </li>
        <li v-for="opt in filtered" :key="opt.value">
          <button
            type="button"
            class="searchable-select-option block w-full rounded-[10px] px-3 py-2.5 text-left text-sm text-neutral-900 dark:text-neutral-100 hover:bg-pink-50 dark:hover:bg-pink-950/40"
            :class="{ 'bg-pink-100 dark:bg-pink-950/50 font-bold text-pink-800 dark:text-pink-300': modelValue === opt.value }"
            @click="pick(opt.value)"
          >
            {{ opt.label }}
          </button>
        </li>
        <li v-if="!filtered.length" class="px-3 py-3 text-center text-sm text-neutral-500 dark:text-neutral-400">—</li>
      </ul>
    </div>
  </div>
</template>
