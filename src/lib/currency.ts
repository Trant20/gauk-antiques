const USD_RATE = 1.27

/** Format a GBP value range with USD equivalent */
export function formatValueRange(low: number, high: number): string {
  if (!low && !high) return '—'
  const lo = low.toLocaleString()
  const hi = high.toLocaleString()
  const loUsd = Math.round(low * USD_RATE).toLocaleString()
  const hiUsd = Math.round(high * USD_RATE).toLocaleString()
  return `£${lo} – £${hi} / $${loUsd} – $${hiUsd}`
}

/** Format a single GBP value with USD equivalent */
export function formatSingleValue(gbp: number): string {
  if (!gbp) return '—'
  return `£${gbp.toLocaleString()} / $${Math.round(gbp * USD_RATE).toLocaleString()}`
}

/** Currency symbols map for GI */
const CURRENCY_SYMBOLS: Record<string, string> = {
  NZD: 'NZ$',
  AUD: 'AU$',
  GBP: '£',
  USD: '$',
  CAD: 'CA$',
  EUR: '€',
  SGD: 'S$',
  ZAR: 'R',
}

/** Format a GI value range using the currency stored in result_json */
export function formatGIValueRange(low: number, high: number, currency = 'USD'): string {
  if (!low && !high) return '—'
  const symbol = CURRENCY_SYMBOLS[currency] || '$'
  const lo = low.toLocaleString()
  const hi = high.toLocaleString()
  return `${symbol}${lo} – ${symbol}${hi}`
}

/** Format a single GI value using the currency stored in result_json */
export function formatGISingleValue(value: number, currency = 'USD'): string {
  if (!value) return '—'
  const symbol = CURRENCY_SYMBOLS[currency] || '$'
  return `${symbol}${value.toLocaleString()}`
}
