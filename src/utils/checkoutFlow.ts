const CHECKOUT_URL_KEY = 'pinova_checkout_pending_url'
const CHECKOUT_FLOW_KEY = 'pinova_checkout_flow'

export type CheckoutFlow = 'boost' | 'campaign' | 'premium' | 'tip'

export function stashCheckoutIntent(flow: CheckoutFlow, checkoutUrl: string) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(CHECKOUT_FLOW_KEY, flow)
    sessionStorage.setItem(CHECKOUT_URL_KEY, checkoutUrl)
  } catch {
    /* ignore */
  }
}

export function readStashedCheckout(): { flow: CheckoutFlow | null; url: string | null } {
  if (typeof window === 'undefined') return { flow: null, url: null }
  try {
    const flow = sessionStorage.getItem(CHECKOUT_FLOW_KEY) as CheckoutFlow | null
    const url = sessionStorage.getItem(CHECKOUT_URL_KEY)
    return { flow, url }
  } catch {
    return { flow: null, url: null }
  }
}

export function clearStashedCheckout() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(CHECKOUT_FLOW_KEY)
    sessionStorage.removeItem(CHECKOUT_URL_KEY)
  } catch {
    /* ignore */
  }
}

/** Ouvre le paiement via page interstitielle (meilleure UX pré-redirect). */
export function openCheckoutFlow(router: { push: (loc: { name: string; query?: Record<string, string> }) => void }, flow: CheckoutFlow, checkoutUrl: string) {
  stashCheckoutIntent(flow, checkoutUrl)
  router.push({ name: 'checkout-go', query: { flow } })
}

export function checkoutSuccessPath(flow: CheckoutFlow): string {
  if (flow === 'boost') return '/promote?tab=boost'
  if (flow === 'campaign') return '/promote?tab=stats'
  if (flow === 'premium') return '/premium'
  return '/'
}
