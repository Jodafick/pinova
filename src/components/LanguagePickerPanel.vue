<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  useI18n,
  PINOVA_LANGUAGES,
  languageSearchHaystack,
  REGION_ORDER,
  REGION_LABELS,
  type LangCode,
} from '../i18n'

const props = withDefaults(
  defineProps<{
    modelValue: LangCode
    compact?: boolean
    showSuggested?: boolean
  }>(),
  {
    compact: false,
    showSuggested: true,
  },
)

const emit = defineEmits<{
  'update:modelValue': [code: LangCode]
  select: [code: LangCode]
}>()

const { t, currentLang, browserLang } = useI18n()
const query = ref('')
const searchRef = ref<HTMLInputElement | null>(null)
const listRef = ref<HTMLElement | null>(null)

const normalizedQuery = computed(() => query.value.trim().toLowerCase())

watch(normalizedQuery, () => {
  listRef.value?.scrollTo({ top: 0 })
})

const filteredLanguages = computed(() => {
  const q = normalizedQuery.value
  if (!q) return [...PINOVA_LANGUAGES]
  return PINOVA_LANGUAGES.filter((lang) => languageSearchHaystack(lang).toLowerCase().includes(q))
})

const suggestedLanguages = computed(() => {
  if (!props.showSuggested || normalizedQuery.value) return []
  const codes = new Set<LangCode>()
  const add = (code: LangCode | undefined) => {
    if (code && PINOVA_LANGUAGES.some((l) => l.code === code)) codes.add(code)
  }
  add(props.modelValue)
  add(currentLang.value)
  add(browserLang.value)
  return PINOVA_LANGUAGES.filter((l) => codes.has(l.code as LangCode))
})

const groupedLanguages = computed(() => {
  const used = new Set(suggestedLanguages.value.map((l) => l.code))
  const groups: { region: (typeof REGION_ORDER)[number]; items: typeof PINOVA_LANGUAGES }[] = []
  for (const region of REGION_ORDER) {
    const items = filteredLanguages.value.filter(
      (l) => l.region === region && !used.has(l.code),
    )
    if (items.length) groups.push({ region, items })
  }
  return groups
})

const showGrouped = computed(() => !normalizedQuery.value)

function pick(code: LangCode) {
  emit('update:modelValue', code)
  emit('select', code)
}

function regionLabel(region: (typeof REGION_ORDER)[number]) {
  const uiLang = currentLang.value === 'en' ? 'en' : 'fr'
  return REGION_LABELS[region][uiLang]
}

watch(
  () => props.modelValue,
  () => {
    query.value = ''
  },
)

defineExpose({
  focusSearch: async () => {
    await nextTick()
    searchRef.value?.focus()
  },
})
</script>

<template>
  <div class="flex flex-col min-h-0" :class="compact ? 'gap-2' : 'gap-0'">
    <div
      class="shrink-0"
      :class="compact ? '' : 'px-4 py-3 border-b border-neutral-200/70 dark:border-neutral-700/80'"
    >
      <div v-if="!compact" class="mb-3">
        <h3 class="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">{{ t('lang.title') }}</h3>
        <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{{ t('lang.description') }}</p>
      </div>

      <label class="relative block">
        <span class="sr-only">{{ t('lang.searchPlaceholder') }}</span>
        <span
          class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-lg pointer-events-none"
          aria-hidden="true"
        >
          search
        </span>
        <input
          ref="searchRef"
          v-model="query"
          type="search"
          autocomplete="off"
          :placeholder="t('lang.searchPlaceholder')"
          class="w-full pl-10 pr-9 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/80 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-pink-600/40"
        />
        <button
          v-if="query"
          type="button"
          class="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
          :aria-label="t('lang.clearSearch')"
          @click="query = ''"
        >
          <span class="material-symbols-outlined text-lg">close</span>
        </button>
      </label>

      <p v-if="browserLang && showSuggested && !query" class="text-[11px] text-neutral-500 dark:text-neutral-400 mt-2">
        {{ t('lang.deviceDefault') }}:
        <span class="font-medium text-neutral-700 dark:text-neutral-300">
          {{ PINOVA_LANGUAGES.find((l) => l.code === browserLang)?.nativeLabel ?? browserLang }}
        </span>
      </p>
    </div>

    <div
      ref="listRef"
      class="overflow-y-auto overscroll-contain min-h-0"
      :class="compact ? 'max-h-64 py-1' : 'max-h-[min(24rem,60vh)] py-1'"
      role="listbox"
      :aria-label="t('lang.title')"
    >
      <template v-if="filteredLanguages.length === 0">
        <p class="px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
          {{ t('lang.noResults') }}
        </p>
      </template>

      <template v-else>
        <section v-if="suggestedLanguages.length && showSuggested && !query">
          <p class="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
            {{ t('lang.suggested') }}
          </p>
          <button
            v-for="lang in suggestedLanguages"
            :key="`s-${lang.code}`"
            type="button"
            role="option"
            :aria-selected="modelValue === lang.code"
            class="app-menu-item w-full flex items-center gap-3 px-4 py-2.5 transition text-sm"
            :class="
              modelValue === lang.code
                ? 'is-active text-pink-700 dark:text-pink-600 font-semibold'
                : 'text-neutral-700 dark:text-neutral-200'
            "
            @click="pick(lang.code as LangCode)"
          >
            <span class="text-lg shrink-0" aria-hidden="true">{{ lang.flag }}</span>
            <span class="flex-1 min-w-0 text-left">
              <span class="block truncate">{{ lang.nativeLabel }}</span>
              <span
                v-if="lang.nativeLabel !== lang.label"
                class="block text-xs text-neutral-500 dark:text-neutral-400 truncate"
              >
                {{ lang.label }}
              </span>
            </span>
            <span
              v-if="modelValue === lang.code"
              class="material-symbols-outlined text-base text-pink-700 shrink-0"
              aria-hidden="true"
            >
              check
            </span>
          </button>
        </section>

        <template v-if="showGrouped">
          <section v-for="group in groupedLanguages" :key="group.region">
            <p class="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
              {{ regionLabel(group.region) }}
            </p>
            <button
              v-for="lang in group.items"
              :key="lang.code"
              type="button"
              role="option"
              :aria-selected="modelValue === lang.code"
              class="app-menu-item w-full flex items-center gap-3 px-4 py-2.5 transition text-sm"
              :class="
                modelValue === lang.code
                  ? 'is-active text-pink-700 dark:text-pink-600 font-semibold'
                  : 'text-neutral-700 dark:text-neutral-200'
              "
              @click="pick(lang.code as LangCode)"
            >
              <span class="text-lg shrink-0" aria-hidden="true">{{ lang.flag }}</span>
              <span class="flex-1 min-w-0 text-left">
                <span class="block truncate">{{ lang.nativeLabel }}</span>
                <span
                  v-if="lang.nativeLabel !== lang.label"
                  class="block text-xs text-neutral-500 dark:text-neutral-400 truncate"
                >
                  {{ lang.label }}
                </span>
              </span>
              <span
                v-if="modelValue === lang.code"
                class="material-symbols-outlined text-base text-pink-700 shrink-0"
                aria-hidden="true"
              >
                check
              </span>
            </button>
          </section>
        </template>

        <template v-else>
          <button
            v-for="lang in filteredLanguages"
            :key="lang.code"
            type="button"
            role="option"
            :aria-selected="modelValue === lang.code"
            class="app-menu-item w-full flex items-center gap-3 px-4 py-2.5 transition text-sm"
            :class="
              modelValue === lang.code
                ? 'is-active text-pink-700 dark:text-pink-600 font-semibold'
                : 'text-neutral-700 dark:text-neutral-200'
            "
            @click="pick(lang.code as LangCode)"
          >
            <span class="text-lg shrink-0" aria-hidden="true">{{ lang.flag }}</span>
            <span class="flex-1 min-w-0 text-left">
              <span class="block truncate">{{ lang.nativeLabel }}</span>
              <span
                v-if="lang.nativeLabel !== lang.label"
                class="block text-xs text-neutral-500 dark:text-neutral-400 truncate"
              >
                {{ lang.label }}
              </span>
            </span>
            <span
              v-if="modelValue === lang.code"
              class="material-symbols-outlined text-base text-pink-700 shrink-0"
              aria-hidden="true"
            >
              check
            </span>
          </button>
        </template>
      </template>
    </div>
  </div>
</template>
