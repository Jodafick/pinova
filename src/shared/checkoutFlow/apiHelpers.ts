import type { CheckoutFlow } from './types.js'
import type { SignupPlatform } from '../analytics/businessMetrics.js'

export type CheckoutSocialProof = {
  boostsActivated: number
  periodDays: number
}

export const CHECKOUT_SOCIAL_PROOF_TTL_MS = 5 * 60 * 1000

export type CheckoutSocialProofApiPayload = {
  boosts_activated_7d?: number
  boosts_activated_period?: number
  period_days?: number
}

export function parseCheckoutSocialProofResponse(
  data: CheckoutSocialProofApiPayload | null | undefined,
): CheckoutSocialProof {
  const boosts = Number(data?.boosts_activated_period ?? data?.boosts_activated_7d ?? 0)
  return {
    boostsActivated: Number.isFinite(boosts) ? boosts : 0,
    periodDays: Number(data?.period_days) || 7,
  }
}

export function buildCheckoutPendingRecapBody(
  flow: CheckoutFlow,
  platform: SignupPlatform,
  transactionId?: string,
): Record<string, unknown> {
  return {
    flow,
    transaction_id: transactionId || undefined,
    platform,
  }
}
