<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { resolveFaIcon } from '../../utils/appIcons'

const props = withDefaults(
  defineProps<{
    /** Clé icône (Material legacy ou nom FA sans préfixe). */
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
  resolveFaIcon(props.name, { filled: props.filled, spin: props.spin }),
)
</script>

<template>
  <i
    :class="[
      meta.family,
      meta.icon,
      meta.spin ? 'fa-spin' : '',
      'pinova-icon',
      'not-italic',
      'leading-none',
      attrs.class,
    ]"
    :style="attrs.style"
    :aria-hidden="attrs['aria-hidden'] === 'false' ? false : true"
    :aria-label="attrs['aria-label'] as string | undefined"
  />
</template>
