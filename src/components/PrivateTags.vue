<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from '../i18n'

const { t } = useI18n()

const props = defineProps<{
  modelValue?: string[]
  editable?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', tags: string[]): void
}>()

const tags = ref<string[]>(props.modelValue ?? [])
const newTag = ref('')

watch(
  () => props.modelValue,
  (value) => {
    tags.value = value ?? []
  },
)

const addTag = () => {
  const value = newTag.value.trim()
  if (!value) return
  if (tags.value.includes(value)) {
    newTag.value = ''
    return
  }
  tags.value = [...tags.value, value]
  newTag.value = ''
  emit('update:modelValue', tags.value)
}

const removeTag = (tag: string) => {
  tags.value = tags.value.filter(t => t !== tag)
  emit('update:modelValue', tags.value)
}

const presetSuggestions = computed(() => [
  t('tags.suggest.toTry'),
  t('tags.suggest.inspiration'),
  t('tags.suggest.giftIdea'),
  t('tags.suggest.decorProject'),
  t('tags.suggest.recipe'),
  t('tags.suggest.toBuy'),
])

const addPreset = (tag: string) => {
  if (!tags.value.includes(tag)) {
    tags.value = [...tags.value, tag]
    emit('update:modelValue', tags.value)
  }
}
</script>

<template>
  <div class="border border-amber-200 bg-amber-50/40 rounded-2xl p-4">
    <div class="flex items-center gap-2 mb-3">
      <span class="material-symbols-outlined text-amber-600 text-lg fill-1">lock</span>
      <h4 class="text-sm font-bold text-neutral-900">{{ t('tags.private.title') }}</h4>
      <span class="text-[10px] uppercase tracking-wide bg-amber-200/70 text-amber-800 px-1.5 py-0.5 rounded font-bold">{{ t('tags.private.badge') }}</span>
    </div>
    <p class="text-xs text-neutral-500 mb-3 leading-relaxed">
      {{ t('tags.private.desc') }}
    </p>

    <!-- Tags list -->
    <div class="flex flex-wrap gap-2 mb-3">
      <span
        v-for="tag in tags"
        :key="tag"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-300 rounded-full text-xs font-medium text-neutral-700"
      >
        <span class="material-symbols-outlined text-xs text-amber-600">lock</span>
        {{ tag }}
        <button
          v-if="editable !== false"
          class="text-neutral-400 hover:text-neutral-700"
          @click="removeTag(tag)"
        >
          <span class="material-symbols-outlined text-xs">close</span>
        </button>
      </span>
      <span
        v-if="tags.length === 0"
        class="text-xs text-neutral-400 italic"
      >{{ t('tags.private.empty') }}</span>
    </div>

    <!-- Input -->
    <div v-if="editable !== false" class="flex items-center gap-2 mb-3">
      <div class="flex-1 flex items-center gap-2 bg-white border border-amber-200 rounded-full px-3 py-1.5 focus-within:ring-2 focus-within:ring-amber-400">
        <span class="material-symbols-outlined text-sm text-amber-600">add</span>
        <input
          v-model="newTag"
          type="text"
          :placeholder="t('tags.private.placeholder')"
          class="flex-1 bg-transparent outline-none text-xs"
          @keyup.enter="addTag"
        />
      </div>
      <button
        class="px-3 py-1.5 rounded-full bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 disabled:opacity-40"
        :disabled="!newTag.trim()"
        @click="addTag"
      >
        {{ t('common.add') }}
      </button>
    </div>

    <!-- Suggestions -->
    <div v-if="editable !== false">
      <p class="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold mb-1.5">
        {{ t('common.suggestions') }}
      </p>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="s in presetSuggestions"
          :key="s"
          class="px-2 py-1 rounded-full text-[11px] bg-white border border-neutral-200 text-neutral-600 hover:border-amber-400 hover:text-amber-700 transition"
          :disabled="tags.includes(s)"
          :class="{ 'opacity-40 cursor-not-allowed': tags.includes(s) }"
          @click="addPreset(s)"
        >
          + {{ s }}
        </button>
      </div>
    </div>
  </div>
</template>
