<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useI18n, type LangCode } from '../i18n'
import { useAuth } from '../composables/useAuth'
import { usePointerOutsideDismiss } from '../composables/usePointerOutsideDismiss'
import { useAnchoredDropdown } from '../composables/useAnchoredDropdown'
import PinovaButton from './ui/PinovaButton.vue'
import LanguagePickerPanel from './LanguagePickerPanel.vue'

const { t, currentLang, currentLangMeta, setLang } = useI18n()
const { isAuthenticated, updateProfile } = useAuth()

const open = ref(false)
const anchorRef = ref<HTMLElement | null>(null)
const floatingRef = ref<HTMLElement | null>(null)
const pickerRef = ref<InstanceType<typeof LanguagePickerPanel> | null>(null)

const emit = defineEmits<{
  popoverOpenChange: [opened: boolean]
}>()

watch(open, async (v) => {
  emit('popoverOpenChange', v)
  if (v) {
    await nextTick()
    pickerRef.value?.focusSearch()
  }
})

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
  await setLang(code)
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
    <PinovaButton
      variant="ghost"
      size="icon"
      class="relative"
      :aria-label="`${t('lang.title')} : ${currentLangMeta.nativeLabel}`"
      @click.stop="toggle()"
    >
      <PinovaIcon name="translate" class="text-xl" />
      <span class="absolute -bottom-0.5 -right-0.5 text-[10px] leading-none">{{ currentLangMeta.flag }}</span>
    </PinovaButton>

    <Teleport to="body">
      <div
        v-if="open"
        ref="floatingRef"
        class="app-floating-panel rounded-2xl overflow-hidden w-[min(22rem,calc(100vw-1rem))] z-[115]"
        :style="{ ...floatingStyles, zIndex: 115 }"
      >
        <LanguagePickerPanel
          ref="pickerRef"
          :model-value="currentLang"
          @select="select"
        />
      </div>
    </Teleport>
  </div>
</template>
