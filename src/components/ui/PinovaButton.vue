<script setup lang="ts">
/**
 * PinovaButton — bouton premium platform-aware (iOS / Android / Desktop).
 *
 * Variants  : primary, secondary, ghost, floating, danger
 * Sizes     : sm, md (default), lg, icon
 * Density   : auto (suit le profil adaptatif) | dense | comfortable | airy
 * Platform  : auto (default — suit `data-pinova-motion`) | ios | material | desktop
 *
 * Press feedback iOS : scale + filter brightness via classes CSS `pds-btn`,
 * pilotées par `--pinova-press-scale` / `--pinova-press-brightness` qui
 * varient selon `html[data-pinova-motion="..."]`. Donc même composant,
 * même API, rendu adapté.
 *
 * Le ripple Material et le hover glow Desktop sont gérés en CSS pur
 * (cf. `style.css` § « Component Adaptation Layer »).
 *
 *   <PinovaButton variant="primary" @click="install">
 *     <PinovaIcon name="install_mobile" />
 *     Installer
 *   </PinovaButton>
 */
import { computed, type Component } from 'vue'
import { RouterLink } from 'vue-router'
import { usePlatformTokens, type PlatformMode } from '../../theme/platformTokens'

interface Props {
  variant?: 'primary' | 'secondary' | 'ghost' | 'floating' | 'danger'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  /** Densité du bouton — par défaut, suit la plateforme. */
  density?: 'auto' | 'dense' | 'comfortable' | 'airy'
  /** Force une plateforme (rare : previews / embeds). Par défaut on suit `<html>`. */
  platform?: 'auto' | PlatformMode
  /** Vue Router target. Si fourni, on rend un `<RouterLink>`. */
  to?: string | object
  /** Lien HTML standard. Si fourni, on rend un `<a>`. */
  href?: string
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  loading?: boolean
  /** A11y : nom accessible si pas de texte (icon-only). */
  ariaLabel?: string
  /** Forcer fullWidth. */
  block?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  density: 'auto',
  platform: 'auto',
  type: 'button',
  disabled: false,
  loading: false,
  block: false,
})

defineEmits<{ (e: 'click', evt: MouseEvent): void }>()

const { mode } = usePlatformTokens()
const resolvedMode = computed<PlatformMode>(() =>
  props.platform === 'auto' ? mode.value : props.platform,
)

const tag = computed<string | Component>(() => {
  if (props.to) return RouterLink as unknown as Component
  if (props.href) return 'a'
  return 'button'
})

const classes = computed(() => [
  'pds-btn',
  `pds-btn--${props.variant}`,
  props.size !== 'md' && `pds-btn--${props.size}`,
  props.density === 'dense' && 'pds-btn--dense',
  props.density === 'airy' && 'pds-btn--airy',
  props.block && 'pds-btn--block',
  props.loading && 'is-loading',
].filter(Boolean))

const attrs = computed(() => {
  if (props.to) return { to: props.to }
  if (props.href) return { href: props.href, rel: 'noopener' }
  return { type: props.type }
})
</script>

<template>
  <component
    :is="tag"
    :class="classes"
    :data-pinova-platform-variant="resolvedMode"
    :data-pinova-density="density === 'auto' ? undefined : density"
    :disabled="disabled || loading"
    :aria-label="ariaLabel"
    :aria-busy="loading || undefined"
    v-bind="attrs"
    @click="(e: MouseEvent) => !disabled && !loading && $emit('click', e)"
  >
    <span v-if="loading" class="pds-btn__spinner" aria-hidden="true" />
    <span class="pds-btn__content" :class="{ 'pds-btn__content--hidden': loading }">
      <slot />
    </span>
  </component>
</template>

<style scoped>
.pds-btn--block {
  width: 100%;
}

.pds-btn__content {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  flex-wrap: nowrap;
  white-space: nowrap;
  max-width: 100%;
}

.pds-btn__content--hidden {
  visibility: hidden;
}

.pds-btn__spinner {
  position: absolute;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  animation: pds-btn-spin 720ms linear infinite;
}

@keyframes pds-btn-spin {
  to { transform: rotate(360deg); }
}

/* Ensure position relative so spinner can be absolutely centered. */
.pds-btn.is-loading {
  position: relative;
}

@media (prefers-reduced-motion: reduce) {
  .pds-btn__spinner {
    animation-duration: 0.01ms;
  }
}
</style>
