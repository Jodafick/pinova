/**
 * Pin Contextual Menu — store singleton pour le menu long-press iOS-style.
 *
 *  Ce fichier contient l'API publique (types + open/close) ; le composant
 *  visuel est `src/components/PinContextualMenu.vue` (singleton monté UNE fois
 *  dans `App.vue`).
 *
 *  Le store a été extrait du SFC car Vue 3 interdit les `export` dans un
 *  `<script setup>` (RFC 227).
 *
 *  Usage :
 *
 *    import { openPinContextualMenu } from '@/composables/usePinContextualMenu'
 *    openPinContextualMenu({
 *      point: { x, y },
 *      items: [{ id: 'save', label: 'Enregistrer', icon: 'bookmark_add' }],
 *      onSelect: (id) => { ... },
 *    })
 */

import { ref, type Ref } from 'vue'

export interface PinContextualMenuItem {
  id: string
  label: string
  icon?: string
  danger?: boolean
  disabled?: boolean
}

export interface PinContextualMenuRequest {
  point: { x: number; y: number }
  items: PinContextualMenuItem[]
  onSelect: (id: string) => void
  onClose?: () => void
  /** Largeur souhaitée (px). Default 232. */
  width?: number
}

/** State singleton — un seul menu contextuel ouvert à la fois. */
export const pinContextualMenuState: Ref<PinContextualMenuRequest | null> = ref(null)

export function openPinContextualMenu(req: PinContextualMenuRequest): void {
  pinContextualMenuState.value = req
}

export function closePinContextualMenu(): void {
  const cb = pinContextualMenuState.value?.onClose
  pinContextualMenuState.value = null
  if (cb) {
    try { cb() } catch (e) { console.warn('[PinContextualMenu] onClose error', e) }
  }
}
