import { trackEvent } from '../lib/analytics'
import {
  CHECKOUT_AMOUNT_KEY,
  CHECKOUT_CURRENCY_KEY,
  CHECKOUT_FLOW_KEY,
  CHECKOUT_URL_KEY,
  PREMIUM_CONFIRMED_KEY,
  PENDING_SUBSCRIPTION_TX_KEY,
  checkoutFunnelProps as buildCheckoutFunnelProps,
  checkoutSuccessPath,
  parseCheckoutMeta,
  type CheckoutFlow,
  type CheckoutMeta,
} from '@pinova/shared'

export {
  PENDING_SUBSCRIPTION_TX_KEY,
  checkoutSuccessPath,
  type CheckoutFlow,
  type CheckoutMeta,
}

export function stashCheckoutIntent(flow: CheckoutFlow, checkoutUrl: string, meta?: CheckoutMeta) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(CHECKOUT_FLOW_KEY, flow)
    sessionStorage.setItem(CHECKOUT_URL_KEY, checkoutUrl)
    if (meta?.amount != null && Number.isFinite(meta.amount)) {
      sessionStorage.setItem(CHECKOUT_AMOUNT_KEY, String(meta.amount))
    } else {
      sessionStorage.removeItem(CHECKOUT_AMOUNT_KEY)
    }
    if (meta?.currency) {
      sessionStorage.setItem(CHECKOUT_CURRENCY_KEY, meta.currency)
    } else {
      sessionStorage.removeItem(CHECKOUT_CURRENCY_KEY)
    }
  } catch {
    /* ignore */
  }
}

export function readStashedCheckoutMeta(): CheckoutMeta {
  if (typeof window === 'undefined') return {}
  try {
    return parseCheckoutMeta(
      sessionStorage.getItem(CHECKOUT_AMOUNT_KEY),
      sessionStorage.getItem(CHECKOUT_CURRENCY_KEY),
    )
  } catch {
    return {}
  }
}

export function checkoutFunnelProps(flow: CheckoutFlow): Record<string, string | number> {
  return buildCheckoutFunnelProps(flow, readStashedCheckoutMeta())
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
    sessionStorage.removeItem(CHECKOUT_AMOUNT_KEY)
    sessionStorage.removeItem(CHECKOUT_CURRENCY_KEY)
  } catch {
    /* ignore */
  }
}

/** Ouvre le paiement via page interstitielle (meilleure UX pré-redirect). */
export function openCheckoutFlow(
  router: { push: (loc: { name: string; query?: Record<string, string> }) => void },
  flow: CheckoutFlow,
  checkoutUrl: string,
  meta?: CheckoutMeta,
) {
  stashCheckoutIntent(flow, checkoutUrl, meta)
  trackEvent('checkout_started', checkoutFunnelProps(flow))
  router.push({ name: 'checkout-go', query: { flow } })
}

export function markPremiumCheckoutConfirmed() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(PREMIUM_CONFIRMED_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function consumePremiumCheckoutConfirmed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const v = sessionStorage.getItem(PREMIUM_CONFIRMED_KEY)
    if (!v) return false
    sessionStorage.removeItem(PREMIUM_CONFIRMED_KEY)
    return true
  } catch {
    return false
  }
}
