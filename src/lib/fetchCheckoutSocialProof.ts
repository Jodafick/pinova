import api from '../api/index'
import {
  CHECKOUT_SOCIAL_PROOF_TTL_MS,
  parseCheckoutSocialProofResponse,
  type CheckoutSocialProof,
  type CheckoutSocialProofApiPayload,
} from '@fotoce/shared'

export type { CheckoutSocialProof }

let cache: { at: number; data: CheckoutSocialProof } | null = null

export async function fetchCheckoutSocialProof(): Promise<CheckoutSocialProof | null> {
  if (cache && Date.now() - cache.at < CHECKOUT_SOCIAL_PROOF_TTL_MS) return cache.data
  try {
    const { data } = await api.get<CheckoutSocialProofApiPayload>('monetization/stats/public/')
    const proof = parseCheckoutSocialProofResponse(data)
    cache = { at: Date.now(), data: proof }
    return proof
  } catch {
    return null
  }
}
