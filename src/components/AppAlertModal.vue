<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useAppModal } from '../composables/useAppModal'
import { useI18n } from '../i18n'
import PinovaModal from './ui/PinovaModal.vue'

const {
  open,
  mode,
  title,
  message,
  variant,
  inputValue,
  inputPlaceholder,
  dismissAlert,
  finishPrompt,
  finishConfirm,
} = useAppModal()

const { t } = useI18n()

const okButtonRef = ref<HTMLButtonElement | null>(null)
const promptInputRef = ref<HTMLInputElement | null>(null)

watch(open, (isOpen) => {
  if (!isOpen) return
  nextTick(() => {
    if (mode.value === 'prompt') {
      promptInputRef.value?.focus()
      promptInputRef.value?.select()
    } else {
      okButtonRef.value?.focus()
    }
  })
})

function onUpdateOpen(v: boolean) {
  if (v) return
  if (mode.value === 'alert') dismissAlert()
  else if (mode.value === 'confirm') finishConfirm(false)
  else finishPrompt(false)
}

function variantIcon(): string {
  switch (variant.value) {
    case 'success':
      return 'check_circle'
    case 'warning':
      return 'warning'
    case 'danger':
      return 'error'
    default:
      return 'info'
  }
}

function variantStyles(): string {
  switch (variant.value) {
    case 'success':
      return 'bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800/60'
    case 'warning':
      return 'bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-950/45 dark:text-amber-300 dark:ring-amber-800/50'
    case 'danger':
      return 'bg-red-50 text-red-600 ring-red-100 dark:bg-red-950/45 dark:text-red-300 dark:ring-red-800/55'
    default:
      return 'bg-pink-50 text-pink-700 ring-pink-100 dark:bg-pink-950/40 dark:text-pink-600 dark:ring-pink-800/50'
  }
}
</script>

<template>
  <PinovaModal
    :open="open"
    presentation="tallSheet"
    presentation-lg="center"
    :show-header="false"
    :max-width="440"
    :depth-effect="true"
    @update:open="onUpdateOpen"
  >
    <div class="px-2 pt-1 pb-1">
      <div class="flex flex-col items-center text-center gap-4">
        <div
          class="flex h-14 w-14 items-center justify-center rounded-2xl ring-1 ring-inset shrink-0 shadow-inner"
          :class="variantStyles()"
        >
          <span class="material-symbols-outlined text-[28px]">{{ variantIcon() }}</span>
        </div>
        <h2
          v-if="title"
          class="text-base sm:text-lg font-semibold text-neutral-900 dark:text-neutral-100 tracking-tight"
        >
          {{ title }}
        </h2>
        <p
          class="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap w-full text-left sm:text-center"
          :class="title ? '' : 'mt-1'"
        >
          {{ message }}
        </p>
      </div>

      <div v-if="mode === 'prompt'" class="mt-5">
        <input
          ref="promptInputRef"
          v-model="inputValue"
          type="text"
          class="lux-input-elegant text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400"
          :placeholder="inputPlaceholder || t('modal.prompt.placeholder')"
          autocomplete="off"
          @keydown.enter.prevent="finishPrompt(true)"
        />
        <p class="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400 text-center">
          {{ t('modal.prompt.hint') }}
        </p>
      </div>
    </div>

    <template #footer>
      <div class="flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          v-if="mode === 'prompt' || mode === 'confirm'"
          type="button"
          class="app-btn app-btn-secondary w-full sm:w-auto min-h-[44px]"
          @click="mode === 'confirm' ? finishConfirm(false) : finishPrompt(false)"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          ref="okButtonRef"
          type="button"
          class="app-btn app-btn-primary w-full sm:w-auto min-h-[44px] min-w-[7.5rem]"
          @click="
            mode === 'alert'
              ? dismissAlert()
              : mode === 'confirm'
                ? finishConfirm(true)
                : finishPrompt(true)
          "
        >
          {{ mode === 'confirm' ? t('modal.confirm.ok') : t('common.ok') }}
        </button>
      </div>
    </template>
  </PinovaModal>
</template>
