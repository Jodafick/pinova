<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n, type LangCode } from '../i18n'
import { useAuth } from '../composables/useAuth'
import { usePointerOutsideDismiss } from '../composables/usePointerOutsideDismiss'
import { useAnchoredDropdown } from '../composables/useAnchoredDropdown'

const { t, languages, currentLangMeta, setLang } = useI18n()
const { isAuthenticated, updateProfile } = useAuth()

const open = ref(false)
const anchorRef = ref<HTMLElement | null>(null)
const floatingRef = ref<HTMLElement | null>(null)

const emit = defineEmits<{
  popoverOpenChange: [opened: boolean]
}>()

watch(open, (v) => emit('popoverOpenChange', v))

const { floatingStyles } = useAnchoredDropdown(anchorRef, floatingRef, {
  open,
  placement: 'bottom-end',
  strategy: 'fixed',
})

usePointerOutsideDismiss(() => [
  {
    isOpen: open,
    getRoots: () => [anchorRef.value, floatingRef.value],
    close: () => {
      open.value = false
    },
  },
])

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

defineExpose({
  close: () => {
    open.value = false
  },
})

function toggle() {
  open.value = !open.value
}
</script>

<template>
  <div ref="anchorRef" class="relative shrink-0">
    <button
      type="button"
      class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-neutral-100 text-neutral-600 transition relative"
      :title="`${t('lang.title')} : ${currentLangMeta.label}`"
      @click.stop="toggle()"
    >
      <span class="material-symbols-outlined text-xl">translate</span>
      <span class="absolute -bottom-0.5 -right-0.5 text-[10px] leading-none">{{ currentLangMeta.flag }}</span>
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="floatingRef"
        class="rounded-2xl shadow-xl border border-neutral-100 overflow-hidden bg-white w-72 max-w-[calc(100vw-1rem)] z-[115]"
        :style="{ ...floatingStyles, zIndex: 115 }"
      >
        <div class="px-4 py-3 border-b border-neutral-100">
          <h3 class="font-semibold text-neutral-900 text-sm">{{ t('lang.title') }}</h3>
          <p class="text-xs text-neutral-500 mt-0.5">{{ t('lang.description') }}</p>
        </div>

        <div class="max-h-80 overflow-y-auto py-1">
          <button
            v-for="lang in languages"
            :key="lang.code"
            type="button"
            class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 transition text-sm"
            :class="
              currentLangMeta.code === lang.code
                ? 'text-pink-600 font-semibold bg-pink-50/50'
                : 'text-neutral-700'
            "
            @click="select(lang.code)"
          >
            <span class="text-lg">{{ lang.flag }}</span>
            <span class="flex-1 text-left">{{ lang.label }}</span>
            <span
              v-if="currentLangMeta.code === lang.code"
              class="material-symbols-outlined text-base text-pink-600"
            >
              check
            </span>
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>
