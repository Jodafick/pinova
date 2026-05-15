<script setup lang="ts">
/**
 * Barre fixe mobile (< lg) : retour | centre (titre ou slot) | actions droite optionnelles.
 * Alignée verticalement avec l’ancien bouton retour flottant (safe-area, hauteur cohérente).
 */
import { computed } from 'vue'
import { useI18n } from '../i18n'

const props = withDefaults(
  defineProps<{
    title?: string
    /** Ligne sous le titre (ex. compteur non lues). */
    subtitle?: string
    showBack?: boolean
    backAriaLabel?: string
    /** Fond vitré + blur après scroll (barre page mobile). */
    elevated?: boolean
  }>(),
  {
    title: '',
    subtitle: '',
    showBack: true,
    backAriaLabel: '',
    elevated: false,
  },
)

const emit = defineEmits<{ back: [] }>()

const { t } = useI18n()
const resolvedBackAria = computed(() => props.backAriaLabel || t('common.back'))
</script>

<template>
  <header
    class="app-mobile-page-header lg:hidden pointer-events-none fixed inset-x-0 top-0 z-[55] bg-transparent transition-[background-color,backdrop-filter,box-shadow] duration-200 ease-out"
    :class="
      elevated
        ? 'border-b border-neutral-200/55 bg-white/72 shadow-sm backdrop-blur-xl backdrop-saturate-150 dark:border-white/10 dark:bg-neutral-950/65'
        : ''
    "
    data-pinova-no-edge-back
  >
    <div
      class="pinova-app-chrome-safe-pt pinova-app-chrome-safe-inner-min-h flex items-center gap-2 px-2 sm:px-3 pb-1.5 pointer-events-none"
    >
      <div class="pointer-events-auto flex w-10 shrink-0 items-center justify-start">
        <slot name="leading">
          <button
            v-if="showBack"
            type="button"
            class="flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-neutral-800 shadow-md ring-1 ring-black/5 transition hover:bg-white active:scale-95 dark:bg-neutral-900/95 dark:text-neutral-100 dark:ring-white/10 dark:hover:bg-neutral-900"
            :aria-label="resolvedBackAria"
            @click="emit('back')"
          >
            <span class="material-symbols-outlined text-[22px] leading-none">arrow_back_ios_new</span>
          </button>
        </slot>
      </div>

      <div class="flex min-w-0 flex-1 items-stretch justify-center px-1">
        <slot name="center">
          <div
            v-if="title || subtitle"
            class="flex max-w-[min(72vw,20rem)] min-w-0 flex-col items-center gap-0.5 self-center text-center"
          >
            <p
              v-if="title"
              class="w-full truncate text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100 [text-shadow:0_1px_2px_rgba(255,255,255,0.95),0_2px_12px_rgba(0,0,0,0.12)] dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.9),0_0_20px_rgba(0,0,0,0.45)]"
            >
              {{ title }}
            </p>
            <p
              v-if="subtitle"
              class="w-full truncate text-xs font-semibold text-neutral-900 dark:text-neutral-100 [text-shadow:0_1px_2px_rgba(255,255,255,0.9),0_1px_8px_rgba(0,0,0,0.1)] dark:[text-shadow:0_1px_2px_rgba(0,0,0,0.85),0_0_12px_rgba(0,0,0,0.4)]"
            >
              {{ subtitle }}
            </p>
          </div>
        </slot>
      </div>

      <div class="pointer-events-auto flex shrink-0 items-center justify-end gap-1 pl-1.5">
        <slot name="trailing" />
      </div>
    </div>
  </header>
</template>
