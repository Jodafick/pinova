/**
 * Layer Navigation System — Types
 *
 * Architecture SPA immersive iOS-first.
 * Un Layer est une couche rendue au-dessus du contexte de fond (router-view).
 * Le contexte de fond reste vivant : scroll, état, images, cache.
 */

import type { Component } from 'vue'

/**
 * Type de présentation d'une couche.
 *
 * - `page` : pile iOS classique (slide horizontal droite→gauche, conserve le fond figé)
 * - `modal` : modale centrée premium (fade + scale + blur de fond)
 * - `fullscreen` : full-screen immersif (slide vertical bas→haut, ex: PinDetail)
 * - `sheet` : bottom-sheet (drag-to-dismiss, safe-area)
 * - `floatingCard` : carte flottante centrée (≤ 420px, légère)
 * - `transparentOverlay` : overlay temporaire transparent (toasts, contextual menus)
 */
export type LayerPresentation =
  | 'page'
  | 'modal'
  | 'fullscreen'
  | 'sheet'
  | 'floatingCard'
  | 'transparentOverlay'

/**
 * Style de status-bar à appliquer pendant que la couche est au sommet.
 * Met à jour `<meta name="theme-color">` et l'apparence iOS si display: standalone.
 */
export type LayerStatusBar = 'light' | 'dark' | 'auto'

/** Stratégie de dismiss user-initiated. */
export type LayerDismissStrategy = {
  /** Tap sur le scrim ferme la couche. */
  backdrop: boolean
  /** Touche Échap ferme la couche. */
  escape: boolean
  /** Swipe-down ferme (sheet / fullscreen). */
  swipeDown: boolean
  /**
   * Si true, le swipe vertical ne démarre que lorsque le `pointerdown` vient
   * d’un descendant de `[data-pinova-swipe-dismiss-handle]` (ex. barre du haut).
   */
  swipeFromHeaderOnly: boolean
  /** Swipe-right depuis le bord gauche ferme (page iOS). */
  edgeBack: boolean
}

/**
 * Snapshot du scroll de la couche derrière, à restaurer à la fermeture.
 * Capturé automatiquement au push, restauré au pop.
 */
export type ScrollSnapshot = {
  /** Scroll racine document. */
  rootX: number
  rootY: number
  /** Scroll d'éventuels conteneurs internes identifiés par data-scroll-id. */
  scrollers?: Record<string, { x: number; y: number }>
}

/**
 * Origine optionnelle pour l'animation (rect du tile cliqué, comme un partage iOS).
 * Utilisé pour interpoler depuis l'élément source vers le layer.
 */
export type LayerOriginRect = {
  left: number
  top: number
  width: number
  height: number
}

/** Identifiant unique d'une couche. */
export type LayerId = string

/** Options consommées par `layerManager.push()`. */
export interface LayerPushOptions<P = Record<string, unknown>> {
  /** Composant Vue à rendre dans la couche (peut être un async component). */
  component: Component
  /** Props passées au composant. */
  componentProps?: P
  /** Type de présentation. Par défaut `modal`. */
  presentation?: LayerPresentation
  /**
   * URL synchronisée à la couche. Si défini, `history.pushState` est utilisé
   * et le bouton retour navigateur ferme la couche (pas la session entière).
   */
  url?: string
  /** Empêcher la fermeture automatique au clic backdrop / Échap. */
  dismissStrategy?: Partial<LayerDismissStrategy>
  /**
   * Quand `false`, la couche derrière est démontée (pour économiser la RAM,
   * ex: paramètres profonds). Par défaut `true` pour rester en pile vivante.
   */
  preserveBackground?: boolean
  /** Style de status bar pendant que cette couche est au sommet. */
  statusBar?: LayerStatusBar
  /** Désactiver le geste edge-back iOS pour cette couche. */
  disableEdgeBack?: boolean
  /** Origine de l'animation (rect source). */
  originRect?: LayerOriginRect | null
  /** Identifiant logique (sinon généré). Utile pour `popTo` / `replace`. */
  id?: LayerId
  /** Identifiant logique de groupe (sert au de-duplication, ex: alert). */
  group?: string
  /** Callback appelé à la fermeture, avec le résultat éventuel. */
  onClose?: (result?: unknown) => void
}

/** Couche au sein du stack runtime. */
export interface Layer {
  readonly id: LayerId
  readonly presentation: LayerPresentation
  readonly component: Component
  readonly componentProps: Record<string, unknown>
  readonly url: string | null
  readonly dismissStrategy: LayerDismissStrategy
  readonly preserveBackground: boolean
  readonly statusBar: LayerStatusBar
  readonly disableEdgeBack: boolean
  readonly originRect: LayerOriginRect | null
  readonly zIndex: number
  readonly createdAt: number
  readonly group: string | null
  /** Snapshot capturé au moment du push, restauré au pop. */
  readonly scrollSnapshot: ScrollSnapshot | null
  /**
   * Une couche peut être marquée "frozen" : son composant reste monté mais
   * `pointer-events: none` et inactif (économise CPU pendant qu'elle est
   * recouverte par d'autres couches sans être démontée).
   */
  frozen: boolean
  /** Callback de fermeture. */
  readonly onClose: ((result?: unknown) => void) | null
}

/** Métadonnée de route Vue Router pour le système layer. */
export interface LayerRouteMeta {
  /**
   * Comment cette route doit-elle être présentée si elle est ouverte depuis
   * une autre route déjà montée (navigation interne) ? Par défaut `page`.
   * Pour un accès direct (URL tapée, refresh), elle reste rendue en `page`.
   */
  presentation?: LayerPresentation
  /**
   * Geste de dismiss vertical (fullscreen / sheet).
   * - `true` : toute la surface
   * - `false` : désactivé
   * - `'header'` : uniquement depuis une zone marquée `data-pinova-swipe-dismiss-handle`
   */
  gestureDismiss?: boolean | 'header'
  /** Conserver l'arrière-plan vivant. Par défaut `true`. */
  preserveBackground?: boolean
  /** Style de status bar pour cette route. */
  statusBar?: LayerStatusBar
  /** Désactiver le geste edge-back. */
  disableEdgeBack?: boolean
}

/** Politique par défaut pour chaque type de présentation. */
export const DEFAULT_DISMISS_STRATEGY: Record<LayerPresentation, LayerDismissStrategy> = {
  page: { backdrop: false, escape: true, swipeDown: false, swipeFromHeaderOnly: false, edgeBack: true },
  modal: { backdrop: true, escape: true, swipeDown: false, swipeFromHeaderOnly: false, edgeBack: false },
  fullscreen: { backdrop: false, escape: true, swipeDown: true, swipeFromHeaderOnly: false, edgeBack: false },
  sheet: { backdrop: true, escape: true, swipeDown: true, swipeFromHeaderOnly: false, edgeBack: false },
  floatingCard: { backdrop: true, escape: true, swipeDown: false, swipeFromHeaderOnly: false, edgeBack: false },
  transparentOverlay: { backdrop: true, escape: true, swipeDown: false, swipeFromHeaderOnly: false, edgeBack: false },
}

/**
 * Surcharge partielle de `dismissStrategy` à partir de `route.meta.gestureDismiss`.
 */
export function dismissStrategyOverrideFromMeta(
  gestureDismiss: LayerRouteMeta['gestureDismiss'],
): Partial<LayerDismissStrategy> | undefined {
  if (gestureDismiss === undefined) return undefined
  if (gestureDismiss === false) return { swipeDown: false, swipeFromHeaderOnly: false }
  if (gestureDismiss === true) return { swipeDown: true, swipeFromHeaderOnly: false }
  return { swipeDown: true, swipeFromHeaderOnly: true }
}

/**
 * Plage de z-index réservée au layer system.
 * On part haut pour passer au-dessus du header global et tab bar.
 */
export const LAYER_Z_INDEX_BASE = 220
export const LAYER_Z_INDEX_STEP = 10
