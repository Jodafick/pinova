/**
 * Transition Adapter — même route, animation selon le « motion language ».
 *
 * Délègue à `getPageTransitionNames()` dans `adaptiveNavigator.ts`.
 * Fichier séparé pour satisfaire l'architecture Prompt 11 sans coupler les imports.
 */

export { getPageTransitionNames, type PageNavDirection } from './adaptiveNavigator'
