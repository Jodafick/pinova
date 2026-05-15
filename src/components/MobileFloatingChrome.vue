<script setup lang="ts">
/**
 * MobileFloatingChrome — chrome flottant mobile premium iOS-style.
 *
 *  Port web de `Pinova-Mobile/src/components/FloatingChrome.tsx`. Reproduit :
 *   - blur 72px (iOS glass), 58px en dark
 *   - presets visuels du bouton retour (standard / modal / search / gradient / profile)
 *   - position fixed top, safe-area top inset
 *   - hide-on-scroll-down / show-on-scroll-up
 *   - slot center (titre OU custom — typiquement champ de recherche)
 *   - slot trailing (CTA droit)
 *   - slot leading (override total du bouton retour, ex. avatar)
 *
 *  Stratégie d'intégration : NE REMPLACE PAS `GlobalHeader` automatiquement.
 *  Le parent décide d'afficher l'un ou l'autre selon `< lg` / route.
 *
 *  Exemple :
 *
 *    <MobileFloatingChrome
 *      :title="t('settings.title')"
 *      back-preset="settings"
 *      @back="router.back()"
 *    >
 *      <template #trailing>
 *        <PinovaButton variant="ghost" size="icon" :aria-label="t('common.help')">
 *          <i-mdi-help-circle />
 *        </PinovaButton>
 *      </template>
 *    </MobileFloatingChrome>
 */
import { computed } from 'vue'
import { useScrollDirection } from '../composables/useScrollDirection'
import { useSafeArea } from '../composables/useSafeArea'
import { useReducedMotion } from '../composables/useReducedMotion'
import { useI18n } from '../i18n'

/** Presets reproduisant 1:1 ceux du mobile. */
export type FloatingBackPreset =
  | 'standard'      /* glass blur (default) */
  | 'modal'         /* cercle sombre + cross */
  | 'search'        /* pill rose-soft → bg-elevated */
  | 'gradient'      /* pill dégradé rose start→end (contest / referral / create / etc.) */
  | 'profile'       /* pill élévée mat (bg-elevated → bg-surface) */
  | 'soft'          /* pill rose-soft + border-pink, icône rose700 */

interface Props {
  /** Titre central (ignoré si slot `#center` fourni). */
  title?: string
  /** Variante du bouton retour. Default 'standard'. */
  backPreset?: FloatingBackPreset
  /** Afficher le bouton retour. Default true. */
  showBack?: boolean
  /** Cacher au scroll vers le bas. Default true. */
  hideOnScrollDown?: boolean
  /** Transparent quand `atTop`. Default true. */
  transparentAtTop?: boolean
  /** Label aria pour le bouton retour. Default t('common.back'). */
  backLabel?: string
  /** Forcer l'élargissement du slot center jusqu'au bord droit (utile pour search). */
  centerExtendsToTrailingEdge?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  backPreset: 'standard',
  showBack: true,
  hideOnScrollDown: true,
  transparentAtTop: true,
  centerExtendsToTrailingEdge: false,
})

const emit = defineEmits<{ (e: 'back'): void }>()

const { t } = useI18n()
const { top: safeTop } = useSafeArea()
const { prefersReducedMotion } = useReducedMotion()
const { atTop, isScrollingDown } = useScrollDirection({ threshold: 8 })

const isHidden = computed(() => props.hideOnScrollDown && isScrollingDown.value)
const isTransparent = computed(() => props.transparentAtTop && atTop.value)

const backLabelComputed = computed(() => props.backLabel ?? t('common.back'))

const presetClass = computed(() => `mfc__back--${props.backPreset}`)
const presetIcon = computed(() => (props.backPreset === 'modal' ? 'close' : 'back'))

function onBackClick() {
  emit('back')
}
</script>

<template>
  <div
    class="mfc"
    :class="[
      isHidden && !prefersReducedMotion ? 'mfc--hidden' : '',
      isTransparent ? 'mfc--transparent' : '',
      prefersReducedMotion ? 'mfc--rm' : '',
    ]"
    :style="{ paddingTop: `${safeTop}px` }"
  >
    <!-- Couche de verre (blur) — purement visuelle. -->
    <div class="mfc__veil" aria-hidden="true" />

    <div
      class="mfc__row"
      :class="centerExtendsToTrailingEdge ? 'mfc__row--flush-end' : ''"
    >
      <!-- Leading : bouton retour ou slot custom. -->
      <div class="mfc__side mfc__side--leading">
        <slot name="leading">
          <button
            v-if="showBack"
            type="button"
            class="mfc__back"
            :class="presetClass"
            :aria-label="backLabelComputed"
            @click="onBackClick"
          >
            <svg v-if="presetIcon === 'back'" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M15 6 L9 12 L15 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <svg v-else viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M6 6 L18 18 M18 6 L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
        </slot>
      </div>

      <!-- Center : titre ou slot personnalisé. -->
      <div
        class="mfc__center"
        :class="centerExtendsToTrailingEdge ? 'mfc__center--flush-end' : ''"
      >
        <slot name="center">
          <h1 v-if="title" class="mfc__title">{{ title }}</h1>
        </slot>
      </div>

      <!-- Trailing : action droite. -->
      <div
        class="mfc__side mfc__side--trailing"
        :class="centerExtendsToTrailingEdge ? 'mfc__side--minimal' : ''"
      >
        <slot name="trailing">
          <span v-if="!centerExtendsToTrailingEdge" class="mfc__spacer" aria-hidden="true" />
        </slot>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Hôte fixe top : reste invisible aux pointeurs sauf sur ses éléments. */
.mfc {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  pointer-events: none;
  transition: transform 320ms cubic-bezier(0.32, 0.72, 0, 1), opacity 240ms ease;
  will-change: transform, opacity;
}

.mfc__veil {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: var(--glass-fill, rgba(255, 255, 255, 0.6));
  border-bottom: 1px solid var(--glass-stroke, rgba(255, 255, 255, 0.55));
  -webkit-backdrop-filter: blur(72px) saturate(180%);
  backdrop-filter: blur(72px) saturate(180%);
  opacity: 1;
  transition: opacity 240ms ease;
}

.mfc--transparent .mfc__veil {
  opacity: 0;
}

.mfc--hidden {
  transform: translate3d(0, -100%, 0);
  opacity: 0;
}

.mfc__row {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: 44px 1fr 44px;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem 0.25rem;
  min-height: 44px;
}

.mfc__row--flush-end {
  grid-template-columns: 44px 1fr auto;
  padding-right: 0.375rem;
}

.mfc__side {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
}

.mfc__side--minimal { width: auto; }
.mfc__spacer { width: 36px; height: 36px; display: inline-block; }

.mfc__center {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
}
.mfc__center--flush-end { padding-left: 2px; padding-right: 0; }

.mfc__title {
  font-size: 1.0625rem;
  font-weight: 600;
  line-height: 1.2;
  margin: 0;
  color: var(--pinova-text, #0f0a0d);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
  letter-spacing: -0.01em;
}
:global(html.dark) .mfc__title { color: #f7f2f5; }

/* ─── Variants du bouton retour ─── */
.mfc__back {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 19px;
  background: var(--glass-fill, rgba(255, 255, 255, 0.7));
  border: 1px solid var(--glass-stroke, rgba(255, 255, 255, 0.7));
  -webkit-backdrop-filter: blur(48px) saturate(180%);
  backdrop-filter: blur(48px) saturate(180%);
  color: var(--pinova-text, #0f0a0d);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  transition: transform 160ms cubic-bezier(0.32, 0.72, 0, 1), background 160ms ease;
}
.mfc__back:active { transform: scale(0.9); }
:global(html.dark) .mfc__back { color: #f7f2f5; }

.mfc__back--modal {
  background: rgba(15, 10, 13, 0.62);
  color: #fff;
  width: 40px; height: 40px; border-radius: 20px;
  border-color: transparent;
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}

.mfc__back--search {
  width: 42px; height: 42px; border-radius: 21px;
  background: linear-gradient(135deg, var(--pinova-pink-soft, rgba(219, 39, 119, 0.08)), var(--pinova-bg-elevated, #fffafd));
  border: 1px solid var(--pinova-pink-border, rgba(219, 39, 119, 0.22));
  color: var(--pinova-pink-700, #be185d);
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}

.mfc__back--gradient {
  width: 42px; height: 42px; border-radius: 21px;
  background: linear-gradient(135deg, var(--pinova-rose-gradient-start, #f472b6), var(--pinova-rose-gradient-end, #db2777));
  color: #fff;
  border-color: transparent;
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}

.mfc__back--profile {
  min-width: 44px; height: 44px; border-radius: 22px;
  padding: 0 12px;
  background: linear-gradient(135deg, var(--pinova-bg-elevated, #fffafd), var(--pinova-bg-surface, #fff));
  border: 1px solid var(--pinova-pink-border, rgba(219, 39, 119, 0.22));
  color: var(--pinova-pink-strong, #db2777);
  box-shadow: var(--pinova-shadow-soft, 0 10px 24px -10px rgba(190, 24, 93, 0.16));
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}

.mfc__back--soft {
  width: 42px; height: 42px; border-radius: 21px;
  background: var(--pinova-pink-soft, rgba(219, 39, 119, 0.08));
  border: 1px solid var(--pinova-pink-border, rgba(219, 39, 119, 0.22));
  color: var(--pinova-pink-700, #be185d);
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}

/* Reduced motion : pas de translate, fade discret. */
.mfc--rm {
  transition: opacity 120ms linear !important;
  transform: none !important;
}
.mfc--rm .mfc__back { transition: none; }
.mfc--rm .mfc__back:active { transform: none; opacity: 0.78; }

/* Tap target accessibilité — chacun ≥ 44×44 pixels. */
.mfc__back, .mfc__side { -webkit-tap-highlight-color: transparent; }
</style>
