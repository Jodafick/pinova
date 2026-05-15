/**
 * URL Consistency — rappels sur le modèle d'URL Pinova (refresh-safe, deep links).
 *
 * - Les routes « page » : historique Vue Router classique (`createWebHistory`).
 * - Les couches (`modal` / `sheet` / `fullscreen` / …) : `history.pushState` avec
 *   marqueur `history.state.__pinovaLayer` (cf. `layerManager`) + `popstate` pour
 *   le bouton retour navigateur / Android system back (même pile d'historique).
 *
 * Ne pas dupliquer la logique ici : uniquement des constantes et helpers typés
 * pour les futurs outils (tests e2e, doc générée).
 */

/** Clé posée dans `history.state` quand une couche synchronise l'URL. */
export const LAYER_HISTORY_STATE_KEY = '__pinovaLayer' as const

export function isLayerHistoryState(state: unknown): state is { __pinovaLayer?: string } {
  return typeof state === 'object' && state !== null && '__pinovaLayer' in state
}
