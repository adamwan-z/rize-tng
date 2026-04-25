// Malaysian Ringgit. Always 2 decimals. Comma thousands.
// formatRm(847.5)    => "RM 847.50"
// formatRm(1234567)  => "RM 1,234,567.00"
export function formatRm(amount: number): string {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    currencyDisplay: 'code',
  })
    .format(amount)
    .replace('MYR', 'RM ')
    .trim()
    .replace(/^RM\s+/, 'RM ');
}

// formatPercent(12)     => "+12%"
// formatPercent(-3.4)   => "-3.4%"
// formatPercent(0)      => "0%"
export function formatPercent(value: number): string {
  if (value === 0) return '0%';
  const sign = value > 0 ? '+' : '';
  const fixed = Number.isInteger(value) ? value : value.toFixed(1);
  return `${sign}${fixed}%`;
}

// Splits an array of numbers into bar heights normalized to 0..1.
// normalizeForSparkline([1, 2, 3, 4]) => [0.25, 0.5, 0.75, 1]
export function normalizeForSparkline(values: number[]): number[] {
  if (values.length === 0) return [];
  const max = Math.max(...values);
  if (max === 0) return values.map(() => 0);
  return values.map((v) => v / max);
}
