/**
 * Augmentation des types Vue Router pour ajouter le typage `meta` Layer.
 *
 * Permet à TypeScript de valider `to.meta.presentation`, `to.meta.statusBar`,
 * etc. depuis n'importe quel guard, composant ou composable.
 */
import 'vue-router'
import type { LayerPresentation, LayerStatusBar } from './layerTypes'

declare module 'vue-router' {
  interface RouteMeta {
    /** Authentification requise. */
    requiresAuth?: boolean
    /** Désactive le geste tirer pour actualiser (mobile). */
    disablePullToRefresh?: boolean
    /** Réservé aux invités (déjà connecté → redirige home). */
    guest?: boolean
    /** Pont OAuth mobile : accessible même si une session web existe déjà. */
    mobileOAuthBridge?: boolean
    /** Conserver le composant en cache (KeepAlive). */
    keepAlive?: boolean
    /** Réservé (non utilisé) : ancienne intention de deep-link automatique — l’app n’est proposée que via bannière ou `?openApp=1`. */
    preferAppRedirect?: boolean

    /* ───── Layer System (iOS-first) ───── */

    /**
     * Comment cette route s'affiche-t-elle si elle est ouverte depuis une
     * autre route déjà montée ? Par défaut `page`.
     */
    presentation?: LayerPresentation
    /** Active le geste de dismiss (swipe-down ou edge-back) sur la couche. */
    gestureDismiss?: boolean | 'header'
    /** Conserver l'arrière-plan vivant (par défaut `true`). */
    preserveBackground?: boolean
    /** Style de status bar quand la route est au sommet. */
    statusBar?: LayerStatusBar
    /** Désactive le geste edge-back iOS pour cette route. */
    disableEdgeBack?: boolean

    /** Active J/K clavier pour faire défiler le feed (desktop / productivité). */
    keyboardFeedNav?: boolean
    /** Désactive les transitions router-view sur cette route. */
    noTransition?: boolean
    /** Charge Font Awesome à la demande (creator / contest). */
    loadFontAwesome?: boolean
    /** Précharge nsfwjs + TensorFlow.js (routes création média). */
    preloadNsfwScanner?: boolean
  }
}

export {}
