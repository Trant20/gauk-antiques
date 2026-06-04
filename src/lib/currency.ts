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
