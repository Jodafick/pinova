/**
 * Layer Navigation System — point d'entrée public.
 *
 * Usage typique :
 *
 *   // Pousser une couche depuis n'importe quel composant :
 *   import { layerManager } from '@/navigation'
 *   import MyPanel from '@/components/MyPanel.vue'
 *   layerManager.push({ component: MyPanel, presentation: 'sheet' })
 *
 *   // Depuis l'intérieur d'une couche, fermer ou inspecter :
 *   import { useLayer } from '@/navigation'
 *   const { close, isTop, depth } = useLayer()
 *
 *   // Pour intercepter une route Vue Router en couche :
 *   import { useInterceptedRoute } from '@/navigation'
 *   const { openAsLayer } = useInterceptedRoute()
 *   openAsLayer('settings')
 */

export * from './layerTypes'
export { layerManager, push, pop, popTo, popAll, replace, findLayer, hasGroup } from './layerManager'
export { useLayer, LAYER_CONTEXT_KEY } from './useLayer'
export type { LayerContext, UseLayerReturn } from './useLayer'
export { useLayerStack } from './useLayerStack'
export type { UseLayerStackReturn } from './useLayerStack'
export { useInterceptedRoute, isColdStartNavigation } from './useInterceptedRoute'
export { installRouterLayerBridge, navigateOrOpenLayer } from './routerLayerBridge'
export type { InstallRouterLayerBridgeOptions } from './routerLayerBridge'
export {
  initAdaptiveNavigator,
  getAdaptiveProfile,
  getAdaptiveGesture,
  getPageTransitionNames,
  useAdaptiveNavigator,
  type PinovaPlatform,
  type MotionLanguage,
  type InputKind,
  type PageNavDirection,
} from './adaptiveNavigator'
export { initInputAbstraction, PINOVA_FEED_KEYBOARD_SCROLL } from './inputAbstraction'
export * from './transitionAdapter'
export { LAYER_HISTORY_STATE_KEY, isLayerHistoryState } from './urlConsistency'
