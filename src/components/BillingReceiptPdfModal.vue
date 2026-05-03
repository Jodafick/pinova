<script setup lang="ts">
import { computed, watch, onUnmounted } from 'vue'
import { useI18n } from '../i18n'

const props = defineProps<{
  open: boolean
  url: string | null
}>()

const emit = defineEmits<{ (e: 'close'): void }>()
const { t } = useI18n()

/** Affichage : hash optionnel PDF (Adobe / navigateur natif dans l’iframe) */
const viewerSrc = computed(() => {
  if (!props.url) return ''
  try {
    const u = new URL(props.url)
    const pathLo = u.pathname.toLowerCase()
    if (pathLo.endsWith('.pdf') && !props.url.includes('#')) {
      return `${props.url}#view=FitH`
    }
  } catch {
    /* URL non absolue : afficher telle quelle */
  }
  return props.url
})

const downloadHref = computed(() => props.url ?? '')

let escCleanup: (() => void) | null = null

watch(
  () => props.open,
  (on) => {
    if (typeof document === 'undefined') return
    document.body.style.overflow = on ? 'hidden' : ''
    escCleanup?.()
    escCleanup = null
    if (on) {
      const fn = (ev: KeyboardEvent) => {
        if (ev.key === 'Escape') emit('close')
      }
      window.addEventListener('keydown', fn)
      escCleanup = () => window.removeEventListener('keydown', fn)
    }
  },
  { flush: 'post' },
)

onUnmounted(() => {
  escCleanup?.()
  if (typeof document !== 'undefined') document.body.style.overflow = ''
})

const onBackdrop = (ev: MouseEvent) => {
  const el = ev.target as HTMLElement | null
  if (el?.dataset?.backdrop === '1') emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/55 backdrop-blur-[1px]"
      data-backdrop="1"
      role="presentation"
      @mousedown="onBackdrop"
    >
      <div
        class="relative flex flex-col w-full max-w-5xl h-[85vh] max-h-[900px] bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden motion-safe:animate-[receipt_modal_in_.18s_ease-out_both]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-pdf-title"
        tabindex="-1"
        @mousedown.stop
      >
        <header
          class="shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-neutral-100 bg-neutral-50"
        >
          <h2 id="receipt-pdf-title" class="text-sm font-semibold text-neutral-900">
            {{ t('billing.receiptModal.title') }}
          </h2>
          <div class="flex items-center gap-2">
            <a
              v-if="downloadHref"
              :href="downloadHref"
              download=""
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-pink-600 text-white text-xs font-semibold hover:bg-pink-700 transition"
            >
              <span class="material-symbols-outlined text-base">download</span>
              {{ t('billing.receiptModal.download') }}
            </a>
            <button
              type="button"
              class="inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-neutral-200 text-neutral-600 transition shrink-0"
              :aria-label="t('billing.receiptModal.close')"
              @click="emit('close')"
            >
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
        </header>

        <div class="relative flex-1 min-h-0 bg-neutral-950">
          <iframe
            v-if="viewerSrc"
            title="Receipt"
            class="absolute inset-0 w-full h-full border-0 bg-white"
            referrerpolicy="no-referrer-when-downgrade"
            :src="viewerSrc"
          />
          <div
            v-else
            class="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center text-sm text-neutral-700 bg-neutral-50"
          >
            <span class="material-symbols-outlined text-5xl text-neutral-300">description</span>
            <p>{{ t('billing.receiptModal.noUrl') }}</p>
          </div>
          <div
            v-if="viewerSrc"
            class="pointer-events-none absolute bottom-4 left-1/2 max-w-[min(90%,42rem)] -translate-x-1/2 px-3 py-2 rounded-xl bg-white/92 border border-neutral-200 shadow-sm text-center"
          >
            <p class="text-[11px] text-neutral-500 leading-snug">
              {{ t('billing.receiptModal.hintIframe') }}
            </p>
          </div>
        </div>

        <footer class="lg:hidden shrink-0 px-3 py-2 border-t border-neutral-100 bg-neutral-50">
          <button
            type="button"
            class="w-full py-2.5 text-xs font-semibold text-neutral-700 hover:text-neutral-900"
            @click="emit('close')"
          >
            {{ t('billing.receiptModal.close') }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
@keyframes receipt_modal_in {
  from {
    opacity: 0;
    transform: scale(0.98);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
