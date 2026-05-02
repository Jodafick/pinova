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
  else finishPrompt(false)
}

function onKeydown(e: KeyboardEvent) {
  if (!open.value) return
  if (e.key === 'Escape') {
    e.preventDefault()
    if (mode.value === 'alert') dismissAlert()
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
          class="absolute inset-0 bg-neutral-950/45 backdrop-blur-[2px]"
          aria-hidden="true"
          @click="onBackdropClick"
        />
        <div
          class="relative w-full max-w-[min(100%,420px)] scale-100 rounded-2xl bg-white shadow-[0_24px_64px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.06] overflow-hidden"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="title ? 'app-modal-title' : undefined"
          aria-describedby="app-modal-desc"
          @click.stop
        >
          <div class="p-6 sm:p-7">
            <div class="flex flex-col items-center text-center gap-3">
              <div
                class="flex h-12 w-12 items-center justify-center rounded-2xl ring-1 shrink-0"
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
                class="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition"
                :placeholder="inputPlaceholder || t('modal.prompt.placeholder')"
                autocomplete="off"
                @keydown.enter.prevent="finishPrompt(true)"
              />
              <p class="mt-2 text-[11px] text-neutral-400 text-center">
                {{ t('modal.prompt.hint') }}
              </p>
            </div>

            <div
              class="mt-6 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end sm:gap-3"
            >
              <button
                v-if="mode === 'prompt'"
                type="button"
                class="w-full sm:w-auto px-4 py-2.5 rounded-xl text-sm font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 transition"
                @click="finishPrompt(false)"
              >
                {{ t('common.cancel') }}
              </button>
              <button
                ref="okButtonRef"
                type="button"
                class="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-pink-600 hover:bg-pink-700 shadow-sm shadow-pink-600/25 transition"
                @click="mode === 'alert' ? dismissAlert() : finishPrompt(true)"
              >
                {{ t('common.ok') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
