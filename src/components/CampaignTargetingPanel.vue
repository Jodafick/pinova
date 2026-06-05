<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '../i18n'
import {
  useCampaignTargetingOptions,
  type CampaignTargeting,
} from '../composables/useCampaignTargeting'

const props = defineProps<{ modelValue: CampaignTargeting }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: CampaignTargeting): void }>()

const { t } = useI18n()
const { options, loading } = useCampaignTargetingOptions()
const cityInput = ref('')
const interestInput = ref('')
const hobbyInput = ref('')

const value = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

function toggleList(key: keyof CampaignTargeting, code: string) {
  const cur = [...(value.value[key] as string[])]
  const idx = cur.indexOf(code)
  if (idx >= 0) cur.splice(idx, 1)
  else cur.push(code)
  value.value = { ...value.value, [key]: cur }
}

function isOn(key: keyof CampaignTargeting, code: string) {
  return (value.value[key] as string[]).includes(code)
}

function addCity() {
  const c = cityInput.value.trim().toLowerCase()
  if (!c || value.value.cities.includes(c)) return
  value.value = { ...value.value, cities: [...value.value.cities, c] }
  cityInput.value = ''
}

function addTag(key: 'interests' | 'hobbies', raw: string) {
  const t = raw.trim().toLowerCase()
  if (!t || value.value[key].includes(t)) return
  value.value = { ...value.value, [key]: [...value.value[key], t] }
}

function removeTag(key: 'cities' | 'interests' | 'hobbies', item: string) {
  value.value = {
    ...value.value,
    [key]: value.value[key].filter((x) => x !== item),
  }
}
</script>

<template>
  <div class="campaign-targeting space-y-4 rounded-2xl border app-divider-subtle p-4 bg-neutral-50/50 dark:bg-neutral-900/40">
    <div>
      <p class="text-sm font-semibold">{{ t('promote.targeting.title') }}</p>
      <p class="text-xs text-neutral-500 mt-0.5">{{ t('promote.targeting.hint') }}</p>
    </div>

    <div v-if="loading" class="text-xs text-neutral-400">{{ t('common.loading') }}</div>

    <template v-else-if="options">
      <div v-for="block in ([
        { key: 'countries', label: t('promote.targeting.countries'), items: options.countries },
        { key: 'languages', label: t('promote.targeting.languages'), items: options.languages },
        { key: 'currencies', label: t('promote.targeting.currencies'), items: options.currencies },
        { key: 'plans', label: t('promote.targeting.plans'), items: options.plans },
        { key: 'genders', label: t('promote.targeting.genders'), items: options.genders },
      ] as const)" :key="block.key" class="space-y-1.5">
        <p class="text-xs font-medium text-neutral-600 dark:text-neutral-400">{{ block.label }}</p>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="item in block.items"
            :key="item.code"
            type="button"
            class="rounded-full px-2.5 py-1 text-[11px] font-semibold border transition"
            :class="isOn(block.key, item.code)
              ? 'border-pink-600 bg-pink-600 text-white'
              : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300'"
            @click="toggleList(block.key, item.code)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <div class="space-y-1.5">
        <p class="text-xs font-medium text-neutral-600 dark:text-neutral-400">{{ t('promote.targeting.topics') }}</p>
        <div class="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
          <button
            v-for="topic in options.topics"
            :key="topic.slug"
            type="button"
            class="rounded-full px-2.5 py-1 text-[11px] font-semibold border transition"
            :class="isOn('topics', topic.slug)
              ? 'border-pink-600 bg-pink-600 text-white'
              : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300'"
            @click="toggleList('topics', topic.slug)"
          >
            {{ topic.name }}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <label class="text-xs font-medium space-y-1">
          {{ t('promote.targeting.ageMin') }}
          <input
            :value="value.age_min ?? ''"
            type="number"
            min="13"
            max="99"
            class="w-full rounded-xl border app-divider-subtle px-3 py-2 text-sm"
            @input="value = { ...value, age_min: ($event.target as HTMLInputElement).value ? Number(($event.target as HTMLInputElement).value) : null }"
          />
        </label>
        <label class="text-xs font-medium space-y-1">
          {{ t('promote.targeting.ageMax') }}
          <input
            :value="value.age_max ?? ''"
            type="number"
            min="13"
            max="99"
            class="w-full rounded-xl border app-divider-subtle px-3 py-2 text-sm"
            @input="value = { ...value, age_max: ($event.target as HTMLInputElement).value ? Number(($event.target as HTMLInputElement).value) : null }"
          />
        </label>
      </div>

      <div class="space-y-1.5">
        <p class="text-xs font-medium">{{ t('promote.targeting.cities') }}</p>
        <div class="flex gap-2">
          <input v-model="cityInput" class="flex-1 rounded-xl border app-divider-subtle px-3 py-2 text-sm" :placeholder="t('promote.targeting.cityPlaceholder')" @keydown.enter.prevent="addCity" />
          <button type="button" class="rounded-xl border app-divider-subtle px-3 text-xs font-semibold" @click="addCity">+</button>
        </div>
        <div class="flex flex-wrap gap-1">
          <span v-for="c in value.cities" :key="c" class="inline-flex items-center gap-1 rounded-full bg-neutral-200 dark:bg-neutral-800 px-2 py-0.5 text-[10px]">
            {{ c }}
            <button type="button" class="opacity-60" @click="removeTag('cities', c)">×</button>
          </span>
        </div>
      </div>

      <div class="space-y-1.5">
        <p class="text-xs font-medium">{{ t('promote.targeting.interests') }}</p>
        <div class="flex flex-wrap gap-1 mb-1">
          <button
            v-for="s in options.interest_suggestions"
            :key="s"
            type="button"
            class="rounded-full px-2 py-0.5 text-[10px] border border-dashed app-divider-subtle"
            @click="addTag('interests', s)"
          >
            + {{ s }}
          </button>
        </div>
        <input v-model="interestInput" class="w-full rounded-xl border app-divider-subtle px-3 py-2 text-sm" @keydown.enter.prevent="addTag('interests', interestInput); interestInput = ''" />
        <div class="flex flex-wrap gap-1">
          <span v-for="i in value.interests" :key="i" class="inline-flex items-center gap-1 rounded-full bg-pink-100 dark:bg-pink-950/50 text-pink-800 dark:text-pink-200 px-2 py-0.5 text-[10px]">
            {{ i }}
            <button type="button" @click="removeTag('interests', i)">×</button>
          </span>
        </div>
      </div>

      <div class="space-y-1.5">
        <p class="text-xs font-medium">{{ t('promote.targeting.hobbies') }}</p>
        <div class="flex flex-wrap gap-1 mb-1">
          <button
            v-for="s in options.hobby_suggestions"
            :key="s"
            type="button"
            class="rounded-full px-2 py-0.5 text-[10px] border border-dashed app-divider-subtle"
            @click="addTag('hobbies', s)"
          >
            + {{ s }}
          </button>
        </div>
        <input v-model="hobbyInput" class="w-full rounded-xl border app-divider-subtle px-3 py-2 text-sm" @keydown.enter.prevent="addTag('hobbies', hobbyInput); hobbyInput = ''" />
        <div class="flex flex-wrap gap-1">
          <span v-for="h in value.hobbies" :key="h" class="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100 px-2 py-0.5 text-[10px]">
            {{ h }}
            <button type="button" @click="removeTag('hobbies', h)">×</button>
          </span>
        </div>
      </div>
    </template>
  </div>
</template>
