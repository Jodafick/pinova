<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { resolveMaterialIcon } from '../../utils/appIcons'

const props = withDefaults(
  defineProps<{
    /** Nom Material Symbols (`favorite`, `home`, …). */
    name?: string | null
    filled?: boolean
    spin?: boolean
  }>(),
  {
    name: '',
    filled: false,
    spin: false,
  },
)

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()

const meta = computed(() =>
  resolveMaterialIcon(props.name, { filled: props.filled, spin: props.spin }),
)

const variationStyle = computed(() => ({
  fontVariationSettings: `'FILL' ${meta.value.filled ? 1 : 0}, 'wght' ${
    meta.value.filled ? 600 : 400
  }, 'GRAD' 0, 'opsz' 24`,
}))
</script>

<template>
  <span
    :class="[
      'material-symbols-outlined',
      'fotoce-icon',
      meta.spin ? 'fotoce-icon--spin' : '',
      attrs.class,
    ]"
    :style="[variationStyle, attrs.style]"
    :aria-hidden="attrs['aria-hidden'] === 'false' ? false : true"
    :aria-label="attrs['aria-label'] as string | undefined"
  >{{ meta.glyph }}</span>
</template>
