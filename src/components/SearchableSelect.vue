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
  }>(),
  {
    placeholder: '',
    searchPlaceholder: '',
    disabled: false,
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
  <div class="searchable-select" :class="{ 'searchable-select--open': open }">
    <button
      type="button"
      class="searchable-select-trigger onboarding-select text-left w-full flex items-center justify-between gap-2"
      :disabled="disabled"
      @click="toggleOpen"
    >
      <span :class="selectedLabel ? 'text-neutral-900 dark:text-white' : 'text-neutral-400'">
        {{ selectedLabel || placeholder }}
      </span>
      <span class="material-symbols-outlined text-[20px] text-neutral-400 shrink-0">
        {{ open ? 'expand_less' : 'expand_more' }}
      </span>
    </button>

    <div v-if="open" class="searchable-select-panel">
      <input
        v-model="query"
        type="search"
        autocomplete="off"
        class="searchable-select-search onboarding-select"
        :placeholder="searchPlaceholder || placeholder"
      />
      <ul class="searchable-select-list" role="listbox">
        <li v-if="modelValue">
          <button type="button" class="searchable-select-option searchable-select-option--muted" @click="clearSelection">
            {{ placeholder }}
          </button>
        </li>
        <li v-for="opt in filtered" :key="opt.value">
          <button
            type="button"
            class="searchable-select-option"
            :class="{ 'searchable-select-option--active': modelValue === opt.value }"
            @click="pick(opt.value)"
          >
            {{ opt.label }}
          </button>
        </li>
        <li v-if="!filtered.length" class="searchable-select-empty">—</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.searchable-select {
  position: relative;
}

.searchable-select-trigger:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.searchable-select-panel {
  position: absolute;
  z-index: 40;
  left: 0;
  right: 0;
  margin-top: 6px;
  border-radius: 14px;
  border: 1px solid rgba(244, 63, 94, 0.2);
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.12);
  overflow: hidden;
}

:global(html.dark) .searchable-select-panel,
.onboarding-root--dark .searchable-select-panel {
  background: rgba(23, 23, 23, 0.98);
  border-color: rgba(244, 63, 94, 0.35);
}

.searchable-select-search {
  border: 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 0;
}

:global(html.dark) .searchable-select-search {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.searchable-select-list {
  max-height: 220px;
  overflow-y: auto;
  margin: 0;
  padding: 4px;
  list-style: none;
}

.searchable-select-option {
  display: block;
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 14px;
  color: #171717;
}

:global(html.dark) .searchable-select-option {
  color: #fafafa;
}

.searchable-select-option:hover {
  background: rgba(244, 63, 94, 0.08);
}

.searchable-select-option--active {
  background: rgba(244, 63, 94, 0.14);
  font-weight: 700;
}

.searchable-select-option--muted {
  color: #737373;
  font-style: italic;
}

.searchable-select-empty {
  padding: 12px;
  text-align: center;
  color: #737373;
  font-size: 13px;
}
</style>
