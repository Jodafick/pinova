<script setup lang="ts">
/**
 * MobileFloatingHeader — chrome de navigation translucide iOS-style.
 *
 * Caractéristiques :
 *  - blur backdrop progressif (selon scroll Y)
 *  - opacity adaptative (transparent en haut → opaque après scroll)
 *  - hide/show selon direction de scroll
 *  - safe-area-inset-top automatique
 *  - bouton retour intégré qui appelle `nativeStack.pop()`
 *  - slot start / center / end pour customisation
 *
 * Usage minimal :
 *
 *   <MobileFloatingHeader title="Paramètres" />
 *
 * Avec actions :
 *
 *   <MobileFloatingHeader title="Profil">
 *     <template #end>
 *       <button class="material-symbols-outlined">more_horiz</button>
 *     </template>
 *   </MobileFloatingHeader>
 */
import { computed, onMounted, ref } from 'vue'
import { useScrollDirection } from '../composables/useScrollDirection'
import { nativeStack } from '../navigation/nativeStack'

interface Props {
  /** Titre central. */
  title?: string
  /** Afficher le bouton retour. Default true. */
  back?: boolean
  /** Action exécutée au clic sur back. Override `nativeStack.pop()`. */
  onBack?: () => void
  /**
   * Mode de transparence :
   *  - 'auto' : transparent en haut, opaque après scroll (default)
   *  - 'translucent' : toujours translucide avec blur
   *  - 'opaque' : opaque immédiatement (utile sur pages contenu plein)
   */
  surface?: 'auto' | 'translucent' | 'opaque'
  /** Cacher dynamiquement quand on scrolle vers le bas. Default false. */
  hideOnScroll?: boolean
  /** Titre transparent au début, apparaît en scroll. Default true. */
  fadeTitleOnTop?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  back: true,
  surface: 'auto',
  hideOnScroll: false,
  fadeTitleOnTop: true,
})

const { scrollY, atTop, isScrollingDown } = useScrollDirection()

const mounted = ref(false)
onMounted(() => { mounted.value = true })

const opacity = computed(() => {
  if (props.surface === 'opaque') return 1
  if (props.surface === 'translucent') return 0.85
  /* auto : opacity de 0 → 0.9 entre 0 et 80px. */
  return Math.min(0.92, scrollY.value / 80)
})

const blur = computed(() => {
  if (props.surface === 'opaque') return 0
  /* blur de 6 → 20px progressif. */
  const base = props.surface === 'translucent' ? 18 : 6
  return base + Math.min(14, scrollY.value / 8)
})

const showTitle = computed(() => {
  if (!props.fadeTitleOnTop) return true
  return scrollY.value > 24
})

const hidden = computed(() => props.hideOnScroll && isScrollingDown.value && !atTop.value)

function handleBack() {
  if (props.onBack) {
    try { props.onBack() } catch (e) { console.warn('[MobileFloatingHeader] onBack error', e) }
    return
  }
  nativeStack.pop()
}
</script>

<template>
  <header
    class="mobile-floating-header"
    :class="{
      'is-hidden': hidden,
      'is-mounted': mounted,
      'is-opaque': surface === 'opaque',
    }"
    :style="{
      '--mfh-bg-alpha': opacity,
      '--mfh-blur': `${blur}px`,
    }"
  >
    <div class="mobile-floating-header__bg" aria-hidden="true" />
    <div class="mobile-floating-header__inner">
      <div class="mobile-floating-header__start">
        <slot name="start">
          <button
            v-if="back"
            type="button"
            class="mobile-floating-header__back pinova-tap"
            aria-label="Retour"
            @click="handleBack"
          >
            <span class="material-symbols-outlined">arrow_back_ios_new</span>
          </button>
        </slot>
      </div>
      <div class="mobile-floating-header__center">
        <slot name="center">
          <h1
            v-if="title"
            class="mobile-floating-header__title"
            :class="{ 'is-visible': showTitle }"
          >{{ title }}</h1>
        </slot>
      </div>
      <div class="mobile-floating-header__end">
        <slot name="end" />
      </div>
    </div>
  </header>
</template>

<style scoped>
.mobile-floating-header {
  position: sticky;
  top: 0;
  z-index: 30;
  padding-top: env(safe-area-inset-top, 0px);
  transition: transform var(--pinova-dur-medium, 260ms) var(--pinova-ease-iosOut, cubic-bezier(0.22, 1, 0.36, 1));
  will-change: transform;
  transform: translate3d(0, 0, 0);
  pointer-events: auto;
}

.mobile-floating-header.is-hidden {
  transform: translate3d(0, -110%, 0);
}

.mobile-floating-header__bg {
  position: absolute;
  inset: 0;
  background-color: rgba(255, 255, 255, var(--mfh-bg-alpha, 0));
  backdrop-filter: saturate(180%) blur(var(--mfh-blur, 8px));
  -webkit-backdrop-filter: saturate(180%) blur(var(--mfh-blur, 8px));
  pointer-events: none;
  transition:
    background-color var(--pinova-dur-fast, 180ms) var(--pinova-ease-iosOut, cubic-bezier(0.22, 1, 0.36, 1)),
    backdrop-filter var(--pinova-dur-fast, 180ms) var(--pinova-ease-iosOut, cubic-bezier(0.22, 1, 0.36, 1));
}

:global(.dark) .mobile-floating-header__bg {
  background-color: rgba(10, 10, 14, var(--mfh-bg-alpha, 0));
}

.mobile-floating-header.is-opaque .mobile-floating-header__bg {
  background-color: white;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

:global(.dark) .mobile-floating-header.is-opaque .mobile-floating-header__bg {
  background-color: rgb(10, 10, 14);
}

.mobile-floating-header__inner {
  position: relative;
  display: grid;
  grid-template-columns: 56px 1fr 56px;
  align-items: center;
  height: 48px;
  padding: 0 4px;
}

.mobile-floating-header__start {
  display: flex;
  justify-content: flex-start;
  align-items: center;
}

.mobile-floating-header__center {
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 0;
}

.mobile-floating-header__end {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.mobile-floating-header__back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 0;
  background: transparent;
  color: var(--text, #111);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

:global(.dark) .mobile-floating-header__back {
  color: #f5f5f5;
}

.mobile-floating-header__back .material-symbols-outlined {
  font-size: 22px;
}

.mobile-floating-header__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text, #111);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0;
  transform: translate3d(0, 6px, 0);
  transition:
    opacity var(--pinova-dur-fast, 180ms) var(--pinova-ease-iosOut, cubic-bezier(0.22, 1, 0.36, 1)),
    transform var(--pinova-dur-fast, 180ms) var(--pinova-ease-iosOut, cubic-bezier(0.22, 1, 0.36, 1));
  margin: 0;
}

:global(.dark) .mobile-floating-header__title {
  color: #f5f5f5;
}

.mobile-floating-header__title.is-visible {
  opacity: 1;
  transform: translate3d(0, 0, 0);
}

@media (prefers-reduced-motion: reduce) {
  .mobile-floating-header,
  .mobile-floating-header__bg,
  .mobile-floating-header__title {
    transition: none !important;
  }
}
</style>
