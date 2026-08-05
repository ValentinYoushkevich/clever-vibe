export const QUADRANT_MIN_TOTAL = 50

export function pointColor(avgTrust: number): string {
  if (avgTrust < 2.6) return 'var(--bad)'
  if (avgTrust < 3.6) return 'var(--warn)'
  return 'var(--color-accent)'
}

// Диаметр 10 + min(20, N × 1.1) px → радиус
export const pointRadius = (n: number) => (10 + Math.min(20, n * 1.1)) / 2

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
