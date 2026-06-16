export type CheckoutFlow = 'boost' | 'campaign' | 'premium' | 'tip'

export type CheckoutMeta = {
  amount?: number
  currency?: string
}

export const CHECKOUT_URL_KEY = 'fotoce_checkout_pending_url'
export const CHECKOUT_FLOW_KEY = 'fotoce_checkout_flow'
export const CHECKOUT_AMOUNT_KEY = 'fotoce_checkout_amount'
export const CHECKOUT_CURRENCY_KEY = 'fotoce_checkout_currency'
export const PREMIUM_CONFIRMED_KEY = 'fotoce_checkout_premium_confirmed'
export const PENDING_SUBSCRIPTION_TX_KEY = 'fotoce_pending_subscription_tx'

export function checkoutFunnelProps(
  flow: CheckoutFlow,
  meta: CheckoutMeta = {},
): Record<string, string | number> {
  const props: Record<string, string | number> = { flow }
  if (meta.amount != null) props.amount = meta.amount
  if (meta.currency) props.currency = meta.currency
  return props
}

export function parseCheckoutMeta(rawAmount: string | null, currency: string | null): CheckoutMeta {
  const amount = rawAmount != null ? Number(rawAmount) : undefined
  return {
    amount: amount != null && Number.isFinite(amount) ? amount : undefined,
    currency: currency || undefined,
  }
}

export function checkoutSuccessPath(flow: CheckoutFlow): string {
  if (flow === 'boost') return '/promote?tab=boost'
  if (flow === 'campaign') return '/promote?tab=stats'
  if (flow === 'premium') return '/premium'
  return '/'
}
