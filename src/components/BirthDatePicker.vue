<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from '../i18n'

const props = withDefaults(
  defineProps<{
    modelValue: string
    selectClass?: string
  }>(),
  { selectClass: 'onboarding-select' },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const { t, currentLang } = useI18n()

const day = ref('')
const month = ref('')
const year = ref('')

const maxDate = computed(() => {
  const d = new Date()
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() }
})

const localeTag = computed(() => (currentLang.value === 'en' ? 'en-US' : 'fr-FR'))

const years = computed(() => {
  const maxY = maxDate.value.y
  return Array.from({ length: 101 }, (_, i) => String(maxY - i))
})

const monthOptions = computed(() =>
  Array.from({ length: 12 }, (_, i) => {
    const num = i + 1
    return {
      value: String(num).padStart(2, '0'),
      label: new Date(2000, i, 1).toLocaleDateString(localeTag.value, { month: 'long' }),
      num,
    }
  }),
)

const days = computed(() => {
  if (!year.value || !month.value) {
    return Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'))
  }
  const y = Number(year.value)
  const m = Number(month.value)
  let limit = new Date(y, m, 0).getDate()
  if (y === maxDate.value.y && m === maxDate.value.m) {
    limit = Math.min(limit, maxDate.value.d)
  }
  return Array.from({ length: limit }, (_, i) => String(i + 1).padStart(2, '0'))
})

function syncFromModel() {
  const v = props.modelValue.trim().slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-')
    year.value = y
    month.value = m
    day.value = d
    return
  }
  year.value = ''
  month.value = ''
  day.value = ''
}

function emitValue() {
  if (!year.value || !month.value || !day.value) {
    emit('update:modelValue', '')
    return
  }
  const nextDay = day.value.padStart(2, '0')
  if (!days.value.includes(nextDay)) {
    day.value = days.value[days.value.length - 1] ?? ''
  }
  if (!year.value || !month.value || !day.value) {
    emit('update:modelValue', '')
    return
  }
  emit(
    'update:modelValue',
    `${year.value}-${month.value.padStart(2, '0')}-${day.value.padStart(2, '0')}`,
  )
}

watch(() => props.modelValue, syncFromModel, { immediate: true })

watch([day, month, year], () => {
  if (day.value) {
    const padded = day.value.padStart(2, '0')
    if (!days.value.includes(padded)) {
      day.value = days.value[days.value.length - 1] ?? ''
    }
  }
  emitValue()
})
</script>

<template>
  <div class="birth-date-picker">
    <select v-model="day" :class="selectClass" autocomplete="bday-day">
      <option value="">{{ t('birthDatePicker.col.day') }}</option>
      <option v-for="d in days" :key="d" :value="d">{{ d }}</option>
    </select>
    <select v-model="month" :class="selectClass" autocomplete="bday-month">
      <option value="">{{ t('birthDatePicker.col.month') }}</option>
      <option v-for="m in monthOptions" :key="m.value" :value="m.value">{{ m.label }}</option>
    </select>
    <select v-model="year" :class="selectClass" autocomplete="bday-year">
      <option value="">{{ t('birthDatePicker.col.year') }}</option>
      <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
    </select>
  </div>
</template>

<style scoped>
.birth-date-picker {
  display: grid;
  grid-template-columns: 0.85fr 1.35fr 1fr;
  gap: 0.65rem;
}

@media (max-width: 480px) {
  .birth-date-picker {
    grid-template-columns: 1fr;
  }
}
</style>
