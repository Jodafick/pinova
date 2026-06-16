import api from '../api/index'
import { buildCheckoutPendingRecapBody, type CheckoutFlow } from '@fotoce/shared'

let sentForSession = false

/** Email récap + lien retry 1-click (une fois par session checkout). */
export async function requestCheckoutPendingRecap(
  flow: CheckoutFlow,
  transactionId?: string,
): Promise<void> {
  if (sentForSession) return
  sentForSession = true
  try {
    await api.post(
      'monetization/checkout/pending-recap/',
      buildCheckoutPendingRecapBody(flow, 'web', transactionId),
    )
  } catch {
    /* non-bloquant */
  }
}

export function resetCheckoutPendingRecapSession(): void {
  sentForSession = false
}
