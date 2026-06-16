<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../i18n'
import {
  PASSWORD_RULE_IDS,
  PASSWORD_VALID_EXAMPLE,
  allPasswordRulesMet,
  evaluatePasswordRules,
  passwordStrengthLabelKey,
  passwordStrengthScore,
  type PasswordRuleId,
} from '../utils/passwordPolicy'

const props = withDefaults(
  defineProps<{
    modelValue: string
    email?: string
    username?: string
    label?: string
    placeholder?: string
    inputId?: string
    showToggle?: boolean
    error?: string
  }>(),
  {
    email: '',
    username: '',
    label: '',
    placeholder: '',
    inputId: 'password',
    showToggle: true,
    error: '',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:valid': [valid: boolean]
}>()

const { t } = useI18n()
const showPassword = defineModel<boolean>('showPassword', { default: false })

const context = computed(() => ({
  email: props.email,
  username: props.username || (props.email ? props.email.split('@')[0] : ''),
}))

const rules = computed(() => evaluatePasswordRules(props.modelValue, context.value))
const score = computed(() => passwordStrengthScore(props.modelValue, context.value))

const strengthLabel = computed(() => t(passwordStrengthLabelKey(score.value)))
const strengthPercent = computed(() => (score.value / PASSWORD_RULE_IDS.length) * 100)

const strengthBarClass = computed(() => {
  if (score.value <= 1) return 'bg-red-500'
  if (score.value <= 3) return 'bg-amber-500'
  return 'bg-green-500'
})

function onInput(event: Event) {
  const value = (event.target as HTMLInputElement).value
  emit('update:modelValue', value)
  emit('update:valid', allPasswordRulesMet(value, context.value))
}

function ruleLabel(id: PasswordRuleId): string {
  return t(`passwordPolicy.rules.${id}`)
}
</script>

<template>
  <div>
    <label v-if="label" :for="inputId" class="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2 ml-1">
      {{ label }}
    </label>

    <div class="relative group">
      <FotoceIcon name="lock" class="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-pink-700 transition-colors" />
      <input
        :id="inputId"
        :value="modelValue"
        :type="showPassword ? 'text' : 'password'"
        :placeholder="placeholder"
        autocomplete="new-password"
        :class="[
          'w-full pl-12 pr-12 py-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-pink-700/20 dark:focus:ring-pink-600/20 focus:border-pink-700 dark:border-pink-600 transition-all',
          error ? 'border-red-400 focus:ring-red-300/20 focus:border-red-500' : 'border-neutral-200 dark:border-neutral-700',
        ]"
        @input="onInput"
      />
      <button
        v-if="showToggle"
        type="button"
        class="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
        @click="showPassword = !showPassword"
      >
        <FotoceIcon :name="showPassword ? 'visibility_off' : 'visibility'" class="text-xl" />
      </button>
    </div>

    <p v-if="error" class="mt-1 ml-1 text-xs text-red-600">{{ error }}</p>

    <div class="mt-3 space-y-2" aria-live="polite">
      <div class="flex items-center justify-between gap-3">
        <span class="text-xs font-semibold text-neutral-500 dark:text-neutral-400">{{ t('passwordPolicy.strengthLabel') }}</span>
        <span class="text-xs font-bold text-neutral-700 dark:text-neutral-300">{{ strengthLabel }}</span>
      </div>
      <div class="h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-300"
          :class="strengthBarClass"
          :style="{ width: `${strengthPercent}%` }"
        />
      </div>

      <p class="text-xs font-semibold text-neutral-600 dark:text-neutral-400 pt-1">
        {{ t('passwordPolicy.checklistTitle') }}
      </p>
      <ul class="space-y-1">
        <li
          v-for="ruleId in PASSWORD_RULE_IDS"
          :key="ruleId"
          class="flex items-start gap-2 text-xs"
          :class="rules[ruleId] ? 'text-green-700 dark:text-green-400' : 'text-neutral-500 dark:text-neutral-400'"
        >
          <FotoceIcon
            :name="rules[ruleId] ? 'check_circle' : 'cancel'"
            class="text-sm shrink-0 mt-0.5"
            :class="rules[ruleId] ? 'text-green-600 dark:text-green-400' : 'text-neutral-400 dark:text-neutral-500'"
            aria-hidden="true"
          />
          <span>{{ ruleLabel(ruleId) }}</span>
        </li>
      </ul>
      <p class="text-xs text-neutral-500 dark:text-neutral-400">
        {{ t('passwordPolicy.example', { example: PASSWORD_VALID_EXAMPLE }) }}
      </p>
    </div>
  </div>
</template>
