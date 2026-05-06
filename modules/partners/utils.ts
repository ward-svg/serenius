export function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(n)
}

export function formatCompactCurrency(n: number) {
  if (n >= 1000000) {
    return '$' + (n / 1000000).toFixed(1) + 'M'
  }

  if (n >= 1000) {
    return '$' + (n / 1000).toFixed(1) + 'K'
  }

  return formatCurrency(n)
}