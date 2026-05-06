<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from '../i18n'
import type { ReportCategoryCode } from '../constants/reportCategories'
import { REPORT_CATEGORY_CODES } from '../constants/reportCategories'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    /** Sous-titre contextuel (titre du pin, @user, etc.) */
    contextLabel?: string
  }>(),
  { contextLabel: '' },
)

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'submit', payload: { category: ReportCategoryCode; details: string }): void
}>()

const { t } = useI18n()

const category = ref<ReportCategoryCode>('spam')
const details = ref('')
const error = ref('')

const minLen = 10

const categories = computed(() =>
  REPORT_CATEGORY_CODES.map((code) => ({
    code,
    label: t(`report.category.${code}` as const),
  })),
)

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      category.value = 'spam'
      details.value = ''
      error.value = ''
    }
  },
)

function close() {
  emit('update:modelValue', false)
}

function submit() {
  const d = details.value.trim()
  if (d.length < minLen) {
    error.value = t('report.errorMinDetails', { n: minLen })
    return
  }
  error.value = ''
  emit('submit', { category: category.value, details: d })
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[radial-gradient(circle_at_50%_0%,rgba(251,207,232,0.2),transparent_50%)] bg-neutral-950/55 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      @click.self="close"
    >
      <div
        class="w-full sm:max-w-md lux-alert-panel rounded-t-[1.75rem] sm:rounded-[1.75rem] max-h-[min(92vh,640px)] flex flex-col"
        @click.stop
      >
        <div class="shrink-0 px-5 pt-5 pb-3 border-b border-neutral-200/70 flex items-start justify-between gap-2 bg-white/25">
          <div>
            <h2 class="text-lg font-semibold text-neutral-900">{{ t('report.title') }}</h2>
            <p v-if="contextLabel" class="text-xs text-neutral-500 mt-0.5 line-clamp-2">{{ contextLabel }}</p>
          </div>
          <button
            type="button"
            class="p-2 rounded-full text-neutral-500 hover:bg-white/90 hover:text-neutral-900 transition shadow-sm ring-1 ring-transparent hover:ring-neutral-200/80"
            :aria-label="t('common.close')"
            @click="close"
          >
            <span class="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-4">
          <div>
            <p class="text-xs font-medium text-neutral-600 mb-2">{{ t('report.categoryLabel') }}</p>
            <div class="grid grid-cols-1 gap-1.5 max-h-[220px] overflow-y-auto pr-1">
              <label
                v-for="c in categories"
                :key="c.code"
                class="flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 cursor-pointer transition text-sm shadow-sm"
                :class="
                  category === c.code
                    ? 'border-pink-400 bg-gradient-to-br from-pink-50 to-white ring-1 ring-pink-200/90 shadow-pink-900/5'
                    : 'border-neutral-200/90 bg-white/50 hover:border-pink-200/80 hover:bg-white'
                "
              >
                <input v-model="category" type="radio" :value="c.code" class="sr-only" />
                <span class="text-neutral-800 leading-snug">{{ c.label }}</span>
              </label>
            </div>
          </div>

          <div>
            <label class="text-xs font-medium text-neutral-600 block mb-1.5" for="report-details">{{ t('report.detailsLabel') }}</label>
            <textarea
              id="report-details"
              v-model="details"
              rows="4"
              maxlength="2000"
              class="lux-input-elegant resize-y min-h-[96px] text-sm text-neutral-900 placeholder:text-neutral-400"
              :placeholder="t('report.detailsPlaceholder')"
            />
            <p class="text-[11px] text-neutral-400 mt-1 text-right">{{ details.length }} / 2000</p>
            <p v-if="error" class="text-xs text-red-600 mt-1">{{ error }}</p>
          </div>
        </div>

        <div class="shrink-0 px-5 py-4 border-t border-neutral-200/70 flex justify-end gap-3 bg-white/20">
          <button
            type="button"
            class="lux-btn-secondary"
            @click="close"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            class="lux-btn-primary"
            @click="submit"
          >
            {{ t('report.submit') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
