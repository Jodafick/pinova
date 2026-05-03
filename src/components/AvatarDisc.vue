<script setup lang="ts">
import { computed } from 'vue'
import { avatarBgStyle, avatarBgTailwindClass } from '../utils/avatarBackground'

const props = withDefaults(
  defineProps<{
    /** Classe Tailwind (`bg-…`) ou couleur CSS (`#rrggbb`, `rgb()`, …). */
    color?: string | null
    /** Ex. `w-9 h-9` — taille + positionnement éventuel. */
    frameClass: string
    /** Avec photo : fond neutre sous l’image. */
    hasImage?: boolean
    /** Classes typographiques (initiales). */
    textClass?: string
  }>(),
  { hasImage: false, textClass: 'text-white' },
)

const twBg = computed(() => {
  if (props.hasImage) return 'bg-neutral-100'
  return avatarBgTailwindClass(props.color ?? null)
})

const inlineBg = computed(() => {
  if (props.hasImage) return {}
  return avatarBgStyle(props.color ?? null)
})
</script>

<template>
  <div
    :class="[
      frameClass,
      'rounded-full flex items-center justify-center font-bold shrink-0 overflow-hidden avatar-shadow',
      textClass,
      twBg,
    ]"
    :style="inlineBg"
  >
    <slot />
  </div>
</template>
