/**
 * routerLayerBridge — pont entre Vue Router et le layerManager.
 *
 * Mode de fonctionnement :
 *
 *  - **Cold start** (URL tapée / refresh / lien externe) :
 *      Vue Router rend la route normalement (router-view), même si la route a
 *      `meta.presentation !== 'page'`. L'utilisateur arrive directement dessus.
 *
 *  - **Navigation interne** (clic depuis une route déjà montée) :
 *      Si la cible a `meta.presentation !== 'page'`, on intercepte la
 *      navigation : on pousse une couche au-dessus du contexte précédent,
 *      l'URL change mais le `router-view` ne re-render PAS la nouvelle route
 *      à plat (le contexte d'origine reste visible derrière la couche).
 *
 *  - **Back** : le pop ferme la couche, l'URL revient à la précédente.
 *
 * Pour ne pas casser l'existant, ce bridge est **opt-in** : il s'active via
 * `installRouterLayerBridge(router, { enabled: true })`. Tant qu'il est désactivé,
 * le router se comporte comme avant. Les composants peuvent appeler
 * `openAsLayer()` du composable `useInterceptedRoute` à la main.
 */

import { defineAsyncComponent } from 'vue'
import type { RouteLocationNormalized, RouteLocationRaw, Router } from 'vue-router'
import { layerManager } from './layerManager'
import { dismissStrategyOverrideFromMeta, type LayerDismissStrategy, type LayerPresentation, type LayerRouteMeta } from './layerTypes'

/** Indique si la navigation est un cold-start (premier rendu). */
function isInitialNavigation(from: RouteLocationNormalized): boolean {
  /* `from` initial a `name` undefined et `matched.length === 0`. */
  return !from.name && from.matched.length === 0
}

/**
 * Ouvre une route comme couche, sans laisser Vue Router rendre la page.
 * Retourne `false` pour avorter la navigation router (mais l'URL change via
 * history.pushState fait par le layerManager).
 */
function openRouteAsLayer(
  _router: Router,
  to: RouteLocationNormalized,
  presentation: LayerPresentation,
): boolean {
  const record = to.matched[to.matched.length - 1]
  if (!record) return false
  /* Récupère le composant lazy/sync. */
  const components = record.components as Record<string, unknown> | undefined
  const rawComponent = components?.default
  if (!rawComponent) return false
  const component =
    typeof rawComponent === 'function'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? defineAsyncComponent(rawComponent as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : (rawComponent as any)

  const meta = (to.meta as LayerRouteMeta) || {}
  const fromMeta = dismissStrategyOverrideFromMeta(meta.gestureDismiss)
  const mergedDismiss: Partial<LayerDismissStrategy> = { ...(fromMeta ?? {}) }

  layerManager.push({
    component,
    presentation,
    url: to.fullPath,
    componentProps: {
      $layerRoute: {
        name: to.name,
        params: to.params,
        query: to.query,
        fullPath: to.fullPath,
      },
    },
    preserveBackground: meta.preserveBackground ?? true,
    statusBar: meta.statusBar,
    disableEdgeBack: meta.disableEdgeBack ?? false,
    dismissStrategy: Object.keys(mergedDismiss).length ? mergedDismiss : undefined,
  })

  /* L'URL a déjà été poussée par layerManager via history.pushState ; on dit à
     Vue Router d'avorter pour ne pas re-render le router-view. */
  return false
}

export interface InstallRouterLayerBridgeOptions {
  /** Activer le bridge. Tant que false, le router est inchangé. */
  enabled?: boolean
  /** Routes nommées qui ne doivent JAMAIS être interceptées (toujours en page). */
  alwaysPage?: string[]
}

export function installRouterLayerBridge(
  router: Router,
  options: InstallRouterLayerBridgeOptions = {},
): void {
  const { enabled = true, alwaysPage = [] } = options
  if (!enabled) return

  router.beforeEach((to, from) => {
    if (isInitialNavigation(from)) return true
    if (typeof to.name === 'string' && alwaysPage.includes(to.name)) return true

    const meta = (to.meta as LayerRouteMeta) || {}
    const presentation = meta.presentation ?? 'page'
    if (presentation === 'page') return true

    /* Cas particulier déjà géré ailleurs : /foto/:slug redirige vers /?foto=slug
       avec FotoDetailOverlayHost. Si Vue Router a déjà résolu cette redirection,
       on laisse passer. */
    if (to.name === 'foto-detail') return true

    return openRouteAsLayer(router, to, presentation)
  })
}

/**
 * Tente d'intercepter un clic depuis un composant : si la route cible doit
 * apparaître en couche, ouvre la couche. Sinon, navigation router normale.
 * Utile pour `<router-link>` programmatique.
 */
export async function navigateOrOpenLayer(
  router: Router,
  to: RouteLocationRaw,
): Promise<void> {
  const resolved = router.resolve(to)
  const meta = (resolved.meta as LayerRouteMeta) || {}
  const presentation = meta.presentation ?? 'page'
  if (presentation === 'page' || resolved.name === 'foto-detail') {
    await router.push(to)
    return
  }
  /* Push de l'URL via router (qui sera intercepté par beforeEach et ouvrira
     une couche). Pour éviter le double passage si bridge non installé,
     on appelle directement openRouteAsLayer. */
  openRouteAsLayer(router, resolved as unknown as RouteLocationNormalized, presentation)
}
