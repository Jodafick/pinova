/**
 * Motion System Pinova — point d'entrée public.
 *
 * Re-exporte tous les modules d'animation et de gestes pour un import unique.
 *
 *   import {
 *     SPRINGS, EASING, DURATIONS, MOTION,
 *     useSpring, useReducedMotion, useHaptics,
 *     useGestureEngine, useBottomSheetPhysics,
 *     usePressFeedback, emitMicroFeedback,
 *     captureSharedElement, playSharedElement,
 *   } from '@/motion'
 *
 *   import { vPress } from '@/directives/vPress'
 */

export * from '../theme/motion'
export { useSpring } from '../composables/useSpring'
export type { UseSpringReturn, SpringSetOptions } from '../composables/useSpring'
export { useReducedMotion, initReducedMotionWatcher } from '../composables/useReducedMotion'
export type { UseReducedMotionReturn } from '../composables/useReducedMotion'
export { useHaptics, triggerHaptic, isHapticSupported, setHapticsEnabled } from '../composables/useHaptics'
export type { HapticPattern } from '../composables/useHaptics'
export {
  emitMicroFeedback,
  emitLayerOpenFeedback,
  emitLayerCloseFeedback,
  registerFeedbackSound,
  unregisterFeedbackSound,
} from '../composables/useMicroFeedback'
export type { FeedbackIntent, EmitMicroFeedbackOptions } from '../composables/useMicroFeedback'
export { usePressFeedback } from '../composables/usePressFeedback'
export type { UsePressFeedbackOptions } from '../composables/usePressFeedback'
export {
  useGestureEngine,
  pickSnapPoint,
} from '../composables/useGestureEngine'
export type {
  UseGestureEngineOptions,
  UseGestureEngineReturn,
  GestureAxis,
  GestureEdge,
  GestureState,
} from '../composables/useGestureEngine'
export { useBottomSheetPhysics } from '../composables/useBottomSheetPhysics'
export type { UseBottomSheetPhysicsOptions, SheetSnap } from '../composables/useBottomSheetPhysics'
export {
  captureSharedElement,
  consumeSharedElement,
  playSharedElement,
  playSharedElementWhenReady,
  clearAllSharedElements,
} from '../composables/useSharedElementTransition'
export type { CaptureOptions, PlayOptions } from '../composables/useSharedElementTransition'

/* Performance & memory core — bridge for motion-time consumers. */
export {
  acquireMotionSlot,
  canStartAnimation,
  shouldDegradeAnimation,
  setMotionSaver,
  motionSaver,
  motionDeviceTier,
  heavyEffectsEnabled,
} from '../core/motionBudget'
export type { MotionCategory } from '../core/motionBudget'
