<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from '../i18n'
import type { ReportCategoryCode } from '../constants/reportCategories'
import { REPORT_CATEGORY_CODES } from '../constants/reportCategories'
import PinovaModal from './ui/PinovaModal.vue'
import PinovaButton from './ui/PinovaButton.vue'

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

const category = ref<ReportCategoryCode>('harmful')
const details = ref('')
const error = ref('')

const minLen = 10

const categories = computed(() =>
  REPORT_CATEGORY_CODES.map((code) => ({
    code,
    label: t(`report.category.${code}` as const),
    hint: t(`report.categoryHint.${code}` as const),
  })),
)

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      category.value = 'harmful'
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
  <PinovaModal
    :open="modelValue"
    presentation="tallSheet"
    presentation-lg="center"
    :title="t('report.title')"
    :subtitle="contextLabel || undefined"
    :max-width="480"
    @update:open="(v: boolean) => emit('update:modelValue', v)"
  >
    <div class="px-4 py-3 space-y-4">
      <div>
        <p class="text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-2">{{ t('report.categoryLabel') }}</p>
        <div class="grid grid-cols-1 gap-2">
          <label
            v-for="c in categories"
            :key="c.code"
            class="flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 cursor-pointer transition text-sm shadow-sm"
            :class="
              category === c.code
                ? 'border-pink-700 bg-gradient-to-br from-pink-50 to-white ring-1 ring-pink-200/90 shadow-pink-900/5 dark:bg-pink-950/30 dark:border-pink-700'
                : 'border-neutral-200/90 bg-white/50 hover:border-pink-200/80 hover:bg-white dark:bg-neutral-900/40 dark:border-neutral-700'
            "
          >
            <input v-model="category" type="radio" :value="c.code" class="sr-only" />
            <span class="min-w-0">
              <span class="block text-neutral-800 dark:text-neutral-100 leading-snug font-semibold">{{ c.label }}</span>
              <span class="block text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{{ c.hint }}</span>
            </span>
          </label>
        </div>
      </div>

      <div>
        <label class="text-xs font-medium text-neutral-600 dark:text-neutral-300 block mb-1.5" for="report-details">{{ t('report.detailsLabel') }}</label>
        <textarea
          id="report-details"
          v-model="details"
          rows="4"
          maxlength="2000"
          class="lux-input-elegant resize-y min-h-[96px] text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400"
          :placeholder="t('report.detailsPlaceholder')"
        />
        <p class="text-[11px] text-neutral-400 mt-1 text-right">{{ details.length }} / 2000</p>
        <p v-if="error" class="text-xs text-red-600 mt-1">{{ error }}</p>
      </div>
    </div>

    <template #footer>
      <div class="flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <PinovaButton variant="secondary" class="w-full sm:w-auto min-h-[44px]" @click="close">
          {{ t('common.cancel') }}
        </PinovaButton>
        <PinovaButton variant="primary" class="w-full sm:w-auto min-h-[44px]" @click="submit">
          {{ t('report.submit') }}
        </PinovaButton>
      </div>
    </template>
  </PinovaModal>
</template>
