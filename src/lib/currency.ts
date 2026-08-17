/** GAUK Network currency formatting — single source of truth */

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: '£',
  USD: '$',
  NZD: 'NZ$',
  AUD: 'AU$',
  EUR: '€',
  CAD: 'CA$',
  SGD: 'S$',
  ZAR: 'R'
}

/** Format a single price in the user's currency */
export function formatPrice(amount: number, currency = 'GBP'): string {
  if (!amount) return '—'
  const symbol = CURRENCY_SYMBOLS[currency] || currency + ' '
  return `${symbol}${amount.toLocaleString('en', { maximumFractionDigits: 0 })}`
}

/** Format a price range in the user's currency */
export function formatPriceRange(low: number, high: number, currency = 'GBP'): string {
  if (!low && !high) return '—'
  const symbol = CURRENCY_SYMBOLS[currency] || currency + ' '
  const lo = low.toLocaleString('en', { maximumFractionDigits: 0 })
  const hi = high.toLocaleString('en', { maximumFractionDigits: 0 })
  return `${symbol}${lo} – ${symbol}${hi}`
}

// ── Legacy aliases — being phased out in sprint 012 ──────────────────────────
// These exist only to prevent build errors during migration.
// Remove once GA and GI cards are updated to use formatPrice/formatPriceRange.

/** @deprecated Use formatPriceRange(low, high, currency) */
export function formatValueRange(low: number, high: number): string {
  return formatPriceRange(low, high, 'GBP')
}

/** @deprecated Use formatPrice(value, currency) */
export function formatSingleValue(value: number): string {
  return formatPrice(value, 'GBP')
}

/** @deprecated Use formatPriceRange(low, high, currency) */
export function formatGIValueRange(low: number, high: number, currency = 'GBP'): string {
  return formatPriceRange(low, high, currency)
}

/** @deprecated Use formatPrice(value, currency) */
export function formatGISingleValue(value: number, currency = 'GBP'): string {
  return formatPrice(value, currency)
}
