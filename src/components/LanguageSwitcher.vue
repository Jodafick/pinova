<script setup lang="ts">
import { ref } from 'vue'
import { useI18n, type LangCode } from '../i18n'
import { useAuth } from '../composables/useAuth'

const { t, languages, currentLangMeta, setLang } = useI18n()
const { isAuthenticated, updateProfile } = useAuth()
const open = ref(false)

const select = async (code: LangCode) => {
  setLang(code)
  if (isAuthenticated.value) {
    try {
      await updateProfile({ preferredLanguage: code })
    } catch (err) {
      console.warn('Impossible de synchroniser la langue préférée', err)
    }
  }
  open.value = false
}
</script>

<template>
  <div class="relative">
    <div v-if="open" class="fixed inset-0 z-20" @click="open = false"></div>

    <button
      class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-neutral-100 text-neutral-600 transition relative"
      :title="`${t('lang.title')} : ${currentLangMeta.label}`"
      @click.stop="open = !open"
    >
      <span class="material-symbols-outlined text-xl">translate</span>
      <span class="absolute -bottom-0.5 -right-0.5 text-[10px] leading-none">{{ currentLangMeta.flag }}</span>
    </button>

    <div
      v-if="open"
      class="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-neutral-100 overflow-hidden z-30"
    >
      <div class="px-4 py-3 border-b border-neutral-100">
        <h3 class="font-semibold text-neutral-900 text-sm">{{ t('lang.title') }}</h3>
        <p class="text-xs text-neutral-500 mt-0.5">{{ t('lang.description') }}</p>
      </div>

      <div class="max-h-80 overflow-y-auto py-1">
        <button
          v-for="lang in languages"
          :key="lang.code"
          class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 transition text-sm"
          :class="currentLangMeta.code === lang.code ? 'text-pink-600 font-semibold bg-pink-50/50' : 'text-neutral-700'"
          @click="select(lang.code)"
        >
          <span class="text-lg">{{ lang.flag }}</span>
          <span class="flex-1 text-left">{{ lang.label }}</span>
          <span
            v-if="currentLangMeta.code === lang.code"
            class="material-symbols-outlined text-base text-pink-600"
          >check</span>
        </button>
      </div>
    </div>
  </div>
</template>
