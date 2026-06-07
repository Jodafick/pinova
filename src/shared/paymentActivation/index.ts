export type PaymentActivationPhase =
  | 'confirming'
  | 'payment_confirmed'
  | 'activating'
  | 'success'
  | 'pending'
  | 'error'

export const ACTIVATION_DURATION_MS = 10_000
export const PROGRESS_TICK_MS = 120
export const INITIAL_PROGRESS = 8
export const MAX_ANIMATED_PROGRESS = 90

export function computeActivationProgress(
  elapsedMs: number,
  durationMs: number = ACTIVATION_DURATION_MS,
): number {
  const ratio = Math.min(1, elapsedMs / durationMs)
  const eased = INITIAL_PROGRESS + ratio * (100 - INITIAL_PROGRESS - (100 - MAX_ANIMATED_PROGRESS))
  return Math.min(MAX_ANIMATED_PROGRESS, Math.round(eased))
}

export function isActivationAnimationComplete(
  elapsedMs: number,
  durationMs: number = ACTIVATION_DURATION_MS,
): boolean {
  return elapsedMs >= durationMs
}

export function isCanceledOrFailedCheckoutStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase()
  return (
    normalized === 'canceled' ||
    normalized === 'cancelled' ||
    normalized === 'failed' ||
    normalized === 'declined'
  )
}

export function isTerminalPaymentPhase(phase: PaymentActivationPhase): boolean {
  return phase === 'success' || phase === 'pending' || phase === 'error'
}
