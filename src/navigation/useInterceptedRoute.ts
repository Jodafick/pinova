/**
 * Composable pour le pattern "intercepted route".
 *
 * Une route avec `meta.presentation !== 'page'` peut s'afficher de 2 façons :
 *
 *  1. Cold-start / accès direct (URL tapée, refresh, lien externe) :
 *     → rendu en page standalone classique via `router-view`.
 *
 *  2. Navigation interne (clic depuis une page déjà montée) :
 *     → ouverte comme couche au-dessus, le contexte d'origine reste vivant.
 *
 * Ce composable expose un helper `openAsLayer(routeName, params)` qui :
 *   - importe dynamiquement le composant de la route cible
 *   - le pousse dans le `layerManager` avec la présentation de la meta
 *   - synchronise l'URL via `router.push` (qui passera par le guard pour ne PAS
 *     rerender le `router-view` si la cible est interceptée)
 *
 * NB : pour le moment ce système est OPT-IN par appel explicite depuis le clic.
 * Une intégration auto via guard global est livrée dans `routerLayerBridge.ts`.
 */

import { defineAsyncComponent } from 'vue'
import { useRoute, useRouter, type RouteLocationRaw, type RouteRecordRaw } from 'vue-router'
import { layerManager } from './layerManager'
import { dismissStrategyOverrideFromMeta, type LayerDismissStrategy, type LayerPresentation, type LayerPushOptions, type LayerRouteMeta } from './layerTypes'

/** Détecte le cold-start : pas de référent interne, donc on ne peut pas overlay. */
export function isColdStartNavigation(): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') return true
  /* Aucun référent OU référent externe = cold start. */
  const ref = document.referrer
  if (!ref) return true
  try {
    const u = new URL(ref)
    return u.origin !== window.location.origin
  } catch {
    return true
  }
}

/**
 * Hook pour ouvrir une route comme couche en gardant le contexte courant.
 *
 * @example
 *   const { openAsLayer } = useInterceptedRoute()
 *   <button @click="openAsLayer('pin-detail', { slug })" />
 */
export function useInterceptedRoute() {
  const router = useRouter()
  const route = useRoute()

  function openAsLayer(
    to: RouteLocationRaw,
    options: Partial<LayerPushOptions> & { fallbackPresentation?: LayerPresentation } = {},
  ): string | null {
    const resolved = router.resolve(to)
    if (!resolved.matched.length) return null
    const targetMeta = (resolved.meta as LayerRouteMeta) || {}
    const presentation: LayerPresentation = targetMeta.presentation ?? options.fallbackPresentation ?? 'modal'

    /* Cherche un composant à rendre : on prend le premier `component` de la route matched. */
    const record = resolved.matched[resolved.matched.length - 1] as RouteRecordRaw
    const rawComponent = (record as unknown as { components?: Record<string, unknown> }).components?.default
      ?? (record as unknown as { component?: unknown }).component
    if (!rawComponent) return null

    /* Async component support : si c'est une fonction, on l'enrobe dans defineAsyncComponent. */
    const component =
      typeof rawComponent === 'function'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? defineAsyncComponent(rawComponent as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        : (rawComponent as any)

    const fromMeta = dismissStrategyOverrideFromMeta(targetMeta.gestureDismiss)
    const mergedDismiss: Partial<LayerDismissStrategy> = {
      ...(fromMeta ?? {}),
      ...(options.dismissStrategy ?? {}),
    }

    const id = layerManager.push({
      ...options,
      component,
      presentation,
      componentProps: {
        ...(options.componentProps ?? {}),
        /* Les pages s'attendent typiquement à utiliser useRoute(), donc on injecte les params en prop dépréciée. */
        $layerRoute: {
          name: resolved.name,
          params: resolved.params,
          query: resolved.query,
        },
      },
      url: resolved.href,
      preserveBackground: options.preserveBackground ?? targetMeta.preserveBackground ?? true,
      statusBar: options.statusBar ?? targetMeta.statusBar,
      disableEdgeBack: options.disableEdgeBack ?? targetMeta.disableEdgeBack ?? false,
      dismissStrategy: Object.keys(mergedDismiss).length ? mergedDismiss : undefined,
    })
    return id
  }

  return {
    /** Route courante (Vue Router). */
    route,
    /** Router. */
    router,
    /** Ouvre une route en couche au-dessus. */
    openAsLayer,
    /** Détecter cold start. */
    isColdStartNavigation,
  }
}
