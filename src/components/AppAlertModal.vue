<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useAppModal } from '../composables/useAppModal'
import { useI18n } from '../i18n'

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

function onBackdropClick() {
  if (mode.value === 'alert') dismissAlert()
  else if (mode.value === 'confirm') finishConfirm(false)
  else finishPrompt(false)
}

function onKeydown(e: KeyboardEvent) {
  if (!open.value) return
  if (e.key === 'Escape') {
    e.preventDefault()
    if (mode.value === 'alert') dismissAlert()
    else if (mode.value === 'confirm') finishConfirm(false)
    else finishPrompt(false)
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

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
      return 'bg-emerald-50 text-emerald-600 ring-emerald-100'
    case 'warning':
      return 'bg-amber-50 text-amber-600 ring-amber-100'
    case 'danger':
      return 'bg-red-50 text-red-600 ring-red-100'
    default:
      return 'bg-pink-50 text-pink-600 ring-pink-100'
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6"
        role="presentation"
      >
        <div
          class="absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(251,207,232,0.25),transparent_42%)] bg-neutral-950/55 backdrop-blur-md"
          aria-hidden="true"
          @click="onBackdropClick"
        />
        <div
          class="relative w-full max-w-[min(100%,420px)] scale-100 lux-alert-panel"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="title ? 'app-modal-title' : undefined"
          aria-describedby="app-modal-desc"
          @click.stop
        >
          <div class="p-7 sm:p-8 pt-8">
            <div class="flex flex-col items-center text-center gap-4">
              <div
                class="flex h-14 w-14 items-center justify-center rounded-2xl ring-1 ring-inset shrink-0 shadow-inner"
                :class="variantStyles()"
              >
                <span class="material-symbols-outlined text-[28px]">{{ variantIcon() }}</span>
              </div>
              <h2
                v-if="title"
                id="app-modal-title"
                class="text-base sm:text-lg font-semibold text-neutral-900 tracking-tight"
              >
                {{ title }}
              </h2>
              <p
                id="app-modal-desc"
                class="text-sm text-neutral-600 leading-relaxed whitespace-pre-wrap w-full text-left sm:text-center"
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
                class="lux-input-elegant text-sm text-neutral-900 placeholder:text-neutral-400"
                :placeholder="inputPlaceholder || t('modal.prompt.placeholder')"
                autocomplete="off"
                @keydown.enter.prevent="finishPrompt(true)"
              />
              <p class="mt-2 text-[11px] text-neutral-400 text-center">
                {{ t('modal.prompt.hint') }}
              </p>
            </div>

            <div
              class="mt-7 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end"
            >
              <button
                v-if="mode === 'prompt' || mode === 'confirm'"
                type="button"
                class="w-full sm:w-auto lux-btn-secondary"
                @click="mode === 'confirm' ? finishConfirm(false) : finishPrompt(false)"
              >
                {{ t('common.cancel') }}
              </button>
              <button
                ref="okButtonRef"
                type="button"
                class="w-full sm:w-auto lux-btn-primary min-w-[7.5rem]"
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
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
