/**
 * Theme — système de design Pinova unifié.
 *
 * Export public unique. Tous les composants importent depuis ici :
 *
 *   import { GLASS, GRADIENTS, SHADOW, TYPOGRAPHY, ROSE } from '@/theme'
 *
 * Sous-modules disponibles :
 *  - colors      : palette + tokens sémantiques
 *  - shadow      : ombres stratifiées (5 niveaux)
 *  - typography  : hiérarchie typographique
 *  - spacing     : espacements + radius + layout
 *  - glass       : surfaces translucides iOS
 *  - motion      : durations + easings + springs
 */

export * from './motion'
export * from './glass'
export * from './colors'
export * from './shadow'
export * from './typography'
export * from './spacing'
export * from './platformTokens'
