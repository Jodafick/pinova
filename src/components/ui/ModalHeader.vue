<script setup lang="ts">
/**
 * ModalHeader — header iOS-style universel pour `PinovaModal`.
 *
 * Disposition :
 *   ┌────────────────────────────────────────────────┐
 *   │             ────── drag handle ─────           │   (optionnel, sheets only)
 *   │  [start]            [title]            [end]   │
 *   │                    [subtitle]                  │   (optionnel)
 *   └────────────────────────────────────────────────┘
 *
 * - `start` slot : bouton "Annuler" / icône close (style texte iOS rose)
 * - `title` prop : titre centré (poids 600, taille 17px iOS standard)
 * - `subtitle` prop : sous-titre discret (12px, dimmed)
 * - `end` slot   : bouton "Enregistrer" / "OK" (rose accent par défaut)
 * - `handle` prop : afficher la drag handle bar (16px x 4px, gris translucide)
 *
 * Caractéristiques :
 * - Background absent par défaut (transparent) : le ModalHeader s'intègre
 *   au glass de la modale qui l'embarque.
 * - Mode "sticky" avec blur progressif au scroll (via prop `sticky`).
 * - Safe-area-top respecté (`padding-top: env(safe-area-inset-top)`).
 *
 * Usage minimal :
 *
 *   <ModalHeader title="Filtres" handle>
 *     <template #start>
 *       <button @click="close" class="modal-header__action">Annuler</button>
 *     </template>
 *     <template #end>
 *       <button @click="apply" class="modal-header__action modal-header__action--primary">Appliquer</button>
 *     </template>
 *   </ModalHeader>
 */
import { computed } from 'vue'

interface Props {
  title?: string
  subtitle?: string
  /** Afficher la drag handle (par défaut sur bottom sheets). */
  handle?: boolean
  /** Mode sticky avec blur progressif (à mettre dans un sheet scrollable). */
  sticky?: boolean
  /** Respect safe-area-top (utile en mode fullscreen). */
  safeTop?: boolean
  /** Variante visuelle : 'transparent' (default) | 'glass' (background blur). */
  variant?: 'transparent' | 'glass'
}

const props = withDefaults(defineProps<Props>(), {
  handle: false,
  sticky: false,
  safeTop: false,
  variant: 'transparent',
})

const rootClasses = computed(() => ({
  'modal-header': true,
  'modal-header--sticky': props.sticky,
  'modal-header--safe-top': props.safeTop,
  'modal-header--glass': props.variant === 'glass',
}))
</script>

<template>
  <header :class="rootClasses">
    <div v-if="handle" class="modal-header__handle" aria-hidden="true" />
    <div class="modal-header__row">
      <div class="modal-header__start">
        <slot name="start" />
      </div>
      <div class="modal-header__center">
        <h2 v-if="title" class="modal-header__title">{{ title }}</h2>
        <p v-if="subtitle" class="modal-header__subtitle">{{ subtitle }}</p>
        <slot name="center" />
      </div>
      <div class="modal-header__end">
        <slot name="end" />
      </div>
    </div>
  </header>
</template>

<style scoped>
.modal-header {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 4px 4px 6px;
  background: transparent;
  position: relative;
  z-index: 2;
}

.modal-header--safe-top {
  padding-top: calc(env(safe-area-inset-top, 0px) + 4px);
}

.modal-header--sticky {
  position: sticky;
  top: 0;
  z-index: 3;
}

.modal-header--glass {
  background-color: var(--glass-fill);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-bottom: 1px solid var(--glass-border);
}

.modal-header__handle {
  width: 38px;
  height: 4px;
  border-radius: 999px;
  background-color: rgba(120, 120, 128, 0.36);
  margin: 8px auto 6px auto;
  flex-shrink: 0;
  transition: background-color var(--pinova-dur-fast, 180ms) var(--pinova-ease-iosOut, cubic-bezier(0.22, 1, 0.36, 1));
}

.modal-header__row {
  display: grid;
  grid-template-columns: minmax(56px, auto) 1fr minmax(56px, auto);
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  min-height: 44px;
}

.modal-header__start {
  display: flex;
  justify-content: flex-start;
  align-items: center;
}

.modal-header__center {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-width: 0;
  text-align: center;
}

.modal-header__end {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.modal-header__title {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--pn-text, #0f0a0d);
  margin: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.modal-header__subtitle {
  font-size: 12px;
  font-weight: 500;
  color: var(--pn-text-muted, rgba(60, 60, 67, 0.6));
  margin: 1px 0 0 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/*
  Actions iOS — usage `class="modal-header__action"`.
  Variante primaire `modal-header__action--primary` = rose Pinova.
*/
:deep(.modal-header__action) {
  border: 0;
  background: transparent;
  padding: 8px 4px;
  min-height: 44px;
  font-size: 16px;
  font-weight: 500;
  color: var(--pinova-rose-500, #e0245e);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: opacity var(--pinova-dur-ultraFast, 120ms) var(--pinova-ease-iosOut, cubic-bezier(0.22, 1, 0.36, 1));
}

:deep(.modal-header__action:disabled) {
  opacity: 0.45;
  cursor: not-allowed;
}

:deep(.modal-header__action:active:not(:disabled)) {
  opacity: 0.55;
}

:deep(.modal-header__action--primary) {
  font-weight: 600;
}

:deep(.modal-header__action--ghost) {
  color: var(--pn-text, #0f0a0d);
}
</style>
