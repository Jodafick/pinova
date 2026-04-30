<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from '../i18n'

const { t, currentLangMeta } = useI18n()

const props = defineProps<{
  original: string
  originalLang?: string
  translated?: string
}>()

const showTranslated = ref(false)
const loading = ref(false)
const fakeTranslated = ref(props.translated || '')

const toggleTranslate = async () => {
  if (showTranslated.value) {
    showTranslated.value = false
    return
  }
  if (!fakeTranslated.value) {
    loading.value = true
    await new Promise(r => setTimeout(r, 500))
    fakeTranslated.value = `[${currentLangMeta.value.code.toUpperCase()}] ${props.original}`
    loading.value = false
  }
  showTranslated.value = true
}
</script>

<template>
  <div>
    <p class="text-base text-neutral-600 leading-relaxed">
      {{ showTranslated ? fakeTranslated : original }}
    </p>
    <button
      class="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-pink-600 hover:text-pink-700 transition"
      @click="toggleTranslate"
    >
      <svg v-if="loading" class="animate-spin h-3 w-3" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span v-else class="material-symbols-outlined text-sm">translate</span>
      {{
        showTranslated
          ? t('translate.viewOriginal', { lang: (originalLang || 'EN').toUpperCase() })
          : t('translate.translateTo', { lang: currentLangMeta.label })
      }}
    </button>
  </div>
</template>
