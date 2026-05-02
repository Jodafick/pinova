<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from '../i18n'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    sensitive: boolean
    viewerCanReveal: boolean
    /** Si false (Plus/Pro + préférence), pas de flou par défaut pour un spectateur majeur. */
    blurByDefault?: boolean
    wrapperClass?: string
  }>(),
  { blurByDefault: true },
)

const { t } = useI18n()
const revealed = ref(false)

const showOverlay = computed(() => {
  if (!props.sensitive) return false
  if (!props.viewerCanReveal) return true
  if (!props.blurByDefault) return false
  return !revealed.value
})
</script>

<template>
  <div class="relative overflow-hidden w-full" :class="props.wrapperClass">
    <div
      class="transition-[filter,transform] duration-300 w-full"
      :class="showOverlay ? 'blur-2xl scale-[1.05]' : ''"
    >
      <slot />
    </div>
    <div
      v-if="showOverlay"
      class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40 px-4 text-center z-[25] pointer-events-none"
    >
      <span class="material-symbols-outlined text-white text-3xl opacity-90">visibility_off</span>
      <p class="text-white text-sm font-semibold drop-shadow-md max-w-[240px] leading-snug">
        {{ t('moderation.sensitiveOverlay') }}
      </p>
      <button
        v-if="viewerCanReveal && blurByDefault"
        type="button"
        class="pointer-events-auto px-4 py-2 rounded-full bg-white text-neutral-900 text-sm font-bold shadow-lg hover:bg-neutral-100 transition-colors"
        @click.stop.prevent="revealed = true"
      >
        {{ t('moderation.revealContent') }}
      </button>
    </div>
  </div>
</template>
