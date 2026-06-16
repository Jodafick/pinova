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
    /** Accentue l’ombre après scroll (le fond vitré est toujours présent). */
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
    class="app-mobile-page-header lg:hidden pointer-events-none fixed inset-x-0 top-0 z-[55] border-b border-neutral-200/70 bg-white/85 backdrop-blur-xl backdrop-saturate-150 shadow-[0_8px_24px_-18px_rgba(0,0,0,0.18)] transition-[box-shadow] duration-200 ease-out dark:border-neutral-800/70 dark:bg-neutral-950/80 dark:shadow-[0_10px_28px_-20px_rgba(0,0,0,0.6)]"
    :class="
      elevated
        ? 'shadow-[0_12px_28px_-14px_rgba(0,0,0,0.22)] dark:shadow-[0_14px_32px_-18px_rgba(0,0,0,0.62)]'
        : ''
    "
    data-fotoce-no-edge-back
  >
    <div
      class="fotoce-app-chrome-safe-pt fotoce-app-chrome-safe-inner-min-h flex items-center gap-2 px-2 sm:px-3 pb-1.5 pointer-events-none"
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
            <FotoceIcon name="arrow_back_ios_new" class="text-[22px] leading-none" />
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
