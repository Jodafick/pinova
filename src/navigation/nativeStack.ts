/**
 * nativeStack — façade haut-niveau de navigation iOS-like.
 *
 * S'appuie sur :
 *  - Vue Router (URL canonique, deep-link, SEO, refresh)
 *  - layerManager (couches en mémoire, scroll preservation, gestes)
 *
 * Donne une API ergonomique du style UINavigationController :
 *
 *   nativeStack.push('settings')            // pile : nouvelle page slide droite → gauche
 *   nativeStack.pop()                       // retour : slide gauche → droite
 *   nativeStack.replace('home')             // remplace la page courante (pas de back)
 *   nativeStack.presentModal('share', {...})// modale fade + scale
 *   nativeStack.presentSheet('comments')    // bottom sheet
 *   nativeStack.presentFullscreen('pin')    // fullscreen immersif
 *   nativeStack.dismissModal()              // ferme le sommet (modal/sheet/fullscreen)
 *   nativeStack.dismissAllModals()
 *
 * Synchronisation URL :
 *  - `push` / `replace` : passe par Vue Router (history pushState/replaceState classique).
 *  - `presentModal/Sheet/Fullscreen` : passe par le layerManager qui appelle
 *    history.pushState pour matcher l'URL voulue, sans rerender le router-view.
 *
 * Browser back :
 *  - Si une couche est ouverte → ferme la couche (cf. layerManager popstate listener).
 *  - Sinon : Vue Router gère le retour normal.
 *
 * Cold start sur une URL "modal" :
 *  - Vue Router rend la page en plein écran (pas de couche, pas d'arrière-plan).
 *    → cohérent : deep-link partageable, page autonome.
 *
 * NB : pour brancher l'interception automatique de navigations Vue Router en
 * couches (ex: clic interne sur `/pin/abc` ouvre fullscreen au-dessus du feed),
 * appeler `installRouterLayerBridge(router)` au boot.
 */

import { defineAsyncComponent } from 'vue'
import type { Component, ConcreteComponent } from 'vue'
import type { RouteLocationRaw, Router } from 'vue-router'
import { layerManager } from './layerManager'
import type { LayerId, LayerPushOptions } from './layerTypes'

let routerRef: Router | null = null

/**
 * À appeler UNE SEULE FOIS au boot (depuis main.ts) avec l'instance Vue Router.
 * Sans cet appel, `push/pop/replace` (route-bound) sont des no-op.
 */
export function bindNativeStack(router: Router): void {
  routerRef = router
}

function requireRouter(): Router {
  if (!routerRef) {
    throw new Error('[nativeStack] router not bound. Call bindNativeStack(router) at boot.')
  }
  return routerRef
}

/* ─────────────────────────── Push / Pop / Replace ─────────────────────────── */

export interface PushOptions {
  /** Remplace au lieu d'empiler (équivalent `router.replace`). */
  replace?: boolean
}

/**
 * Empile une nouvelle route dans la stack iOS.
 * Si la route a `meta.presentation !== 'page'` ET qu'on a installé
 * `installRouterLayerBridge`, elle sera automatiquement ouverte comme couche.
 *
 * Sinon, c'est un `router.push` classique avec animation slide droite → gauche
 * fournie via Vue transitions sur `<router-view>` (présentes côté CSS).
 */
export async function push(to: RouteLocationRaw, options: PushOptions = {}): Promise<void> {
  const router = requireRouter()
  if (options.replace) await router.replace(to)
  else await router.push(to)
}

/**
 * Remplace la route courante (pas d'entrée d'historique).
 * Équivalent UIKit `setViewControllers(_:animated:)` avec un seul VC.
 */
export async function replace(to: RouteLocationRaw): Promise<void> {
  const router = requireRouter()
  await router.replace(to)
}

/**
 * Dépile la route courante :
 *  - Si une couche est ouverte → ferme la couche (priorité au modal stack).
 *  - Sinon → `router.back()` (revient à la route précédente).
 *
 * Android : le bouton « retour » système dépile l'historique natif ; les
 * couches synchronisées (`history.state.__pinovaLayer`) sont fermées par
 * `layerManager` sur `popstate` avant/après la navigation.
 *
 * Reflète le geste edge-back iOS et le bouton retour PWA.
 */
export function pop(result?: unknown): void {
  if (layerManager.hasLayers.value) {
    layerManager.pop(undefined, result)
    return
  }
  const router = requireRouter()
  /* Vérification anti-sortie PWA : si on est à l'entrée initiale de la session
     standalone, on ne sort pas violemment l'app. On va à la home à la place. */
  const navEntries = typeof window !== 'undefined' && window.history.length > 1
  if (navEntries) {
    router.back()
  } else {
    /* Fallback : nav vers home pour éviter de fermer la PWA. */
    void router.replace('/').catch(() => undefined)
  }
}

/**
 * Ferme TOUTES les couches puis ramène à la route donnée (ou actuelle).
 */
export async function popToRoot(to?: RouteLocationRaw): Promise<void> {
  layerManager.popAll()
  if (to) {
    await requireRouter().push(to)
  }
}

/* ─────────────────────── Modal / Sheet / Fullscreen ─────────────────────── */

/**
 * Présente une couche en mémoire avec un composant Vue déjà importé.
 *
 * Cas d'usage : composant local qui n'a pas de route (ex: confirm dialog).
 * Pour brancher à une URL, utiliser `presentModalRoute` à la place.
 */
export function presentModalComponent<P = Record<string, unknown>>(
  component: Component,
  options: Partial<LayerPushOptions<P>> = {},
): LayerId {
  return layerManager.push({
    component,
    presentation: options.presentation ?? 'modal',
    componentProps: (options.componentProps as P) ?? ({} as P),
    onClose: options.onClose,
    statusBar: options.statusBar,
    dismissStrategy: options.dismissStrategy,
    preserveBackground: options.preserveBackground ?? true,
    disableEdgeBack: options.disableEdgeBack,
    group: options.group,
    url: options.url ?? undefined,
  })
}

/** Alias court : présente une bottom sheet à partir d'un composant local. */
export function presentSheetComponent<P = Record<string, unknown>>(
  component: Component,
  options: Partial<LayerPushOptions<P>> = {},
): LayerId {
  return presentModalComponent(component, { ...options, presentation: 'sheet' })
}

/** Alias court : présente un fullscreen à partir d'un composant local. */
export function presentFullscreenComponent<P = Record<string, unknown>>(
  component: Component,
  options: Partial<LayerPushOptions<P>> = {},
): LayerId {
  return presentModalComponent(component, { ...options, presentation: 'fullscreen' })
}

/**
 * Présente une route comme modale (route-bound).
 *
 * - L'URL est synchronisée (`/settings` → `/settings`).
 * - La couche est rendue au-dessus du contexte actuel (route précédente).
 * - Le bouton retour navigateur ferme la couche.
 * - L'accès direct à `/settings` (refresh / lien externe) rend la route en
 *   plein écran (page standalone), pas en modale (cold-start = standalone).
 */
export function presentModalRoute(
  to: RouteLocationRaw,
  options: { presentation?: 'modal' | 'sheet' | 'fullscreen' | 'floatingCard' } = {},
): LayerId | null {
  const router = requireRouter()
  const resolved = router.resolve(to)
  if (!resolved.matched.length) return null
  const record = resolved.matched[resolved.matched.length - 1]
  const raw = (record.components?.default ?? null) as Component | (() => Promise<Component>) | null
  if (!raw) return null
  const component: Component =
    typeof raw === 'function'
      ? defineAsyncComponent(raw as () => Promise<Component>)
      : (raw as ConcreteComponent)

  return layerManager.push({
    component,
    presentation: options.presentation ?? (resolved.meta?.presentation as 'modal' | 'sheet' | 'fullscreen' | 'floatingCard') ?? 'modal',
    url: resolved.fullPath,
    componentProps: {
      $layerRoute: {
        name: resolved.name,
        params: resolved.params,
        query: resolved.query,
        fullPath: resolved.fullPath,
      },
    },
    preserveBackground: resolved.meta?.preserveBackground ?? true,
    statusBar: resolved.meta?.statusBar,
    disableEdgeBack: resolved.meta?.disableEdgeBack ?? false,
  })
}

/** Alias : route en bottom sheet. */
export function presentSheetRoute(to: RouteLocationRaw): LayerId | null {
  return presentModalRoute(to, { presentation: 'sheet' })
}

/** Alias : route en fullscreen immersif. */
export function presentFullscreenRoute(to: RouteLocationRaw): LayerId | null {
  return presentModalRoute(to, { presentation: 'fullscreen' })
}

/**
 * Ferme la couche au sommet (équivalent `dismiss(animated:)` UIKit).
 */
export function dismissModal(result?: unknown): boolean {
  if (!layerManager.hasLayers.value) return false
  layerManager.pop(undefined, result)
  return true
}

/** Ferme toutes les couches. */
export function dismissAllModals(): void {
  layerManager.popAll()
}

/* ────────────────────────────── Utilitaires ────────────────────────────── */

/** Est-on dans une PWA standalone (iOS) ? */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  /* iOS Safari : navigator.standalone (déprécié mais toujours fonctionnel). */
  const nav = navigator as Navigator & { standalone?: boolean }
  if (nav.standalone === true) return true
  /* PWA Android : matchMedia display-mode standalone. */
  try {
    return window.matchMedia('(display-mode: standalone)').matches
  } catch {
    return false
  }
}

/** Stack courante (lecture seule). */
export const stack = layerManager.stack
export const topLayer = layerManager.topLayer
export const hasLayers = layerManager.hasLayers

/** Façade exportée. */
export const nativeStack = {
  /* Vue Router */
  push,
  pop,
  replace,
  popToRoot,

  /* Layer manager (composants locaux) */
  presentModalComponent,
  presentSheetComponent,
  presentFullscreenComponent,

  /* Layer manager (routes) */
  presentModalRoute,
  presentSheetRoute,
  presentFullscreenRoute,

  /* Dismiss */
  dismissModal,
  dismissAllModals,

  /* État */
  stack,
  topLayer,
  hasLayers,

  /* Plateforme */
  isStandalone,
  bind: bindNativeStack,
}

export type NativeStack = typeof nativeStack
