/**
 * Core performance & memory primitives — point d'entrée public.
 *
 *   import {
 *     initMemoryManager, registerReclaimable, reclaim, reclaimCritical,
 *     trackBudget, getBudgetValue,
 *     useSWR, readCache, writeCache, invalidateCache,
 *     canStartAnimation, shouldDegradeAnimation, acquireMotionSlot,
 *     useLayerLifecycle, useLayerSleepHooks,
 *     enablePerfMonitor, getPerfStore,
 *     throttleRaf, debounce, nextFrame, idleCallback,
 *   } from '@/core'
 */

export * from './memoryManager'
export * from './domBudget'
export * from './motionBudget'
export * from './swrCache'
export * from './renderScheduler'
export * from './layerLifecycle'
export * from './perfMonitor'
export * from './observerRegistry'
export * from './performanceEngine'
export * from './uxOrchestrator'
