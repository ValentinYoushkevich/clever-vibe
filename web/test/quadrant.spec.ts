import { describe, it, expect } from 'vitest'
import { pointColor, pointRadius, median, QUADRANT_MIN_TOTAL } from '../src/lib/quadrant.js'

describe('quadrant helpers (ТЗ §3.4, виджет 1)', () => {
  it('цвет по доверию: < 2.6 bad, < 3.6 warn, иначе accent', () => {
    expect(pointColor(2.5)).toBe('var(--bad)')
    expect(pointColor(3.5)).toBe('var(--warn)')
    expect(pointColor(3.6)).toBe('var(--color-accent)')
  })
  it('размер точки: 10 + min(20, N×1.1) px (диаметр)', () => {
    expect(pointRadius(0)).toBe(5)
    expect(pointRadius(10)).toBe((10 + 11) / 2)
    expect(pointRadius(100)).toBe(15) // капается на 20
  })
  it('медиана и порог 50 записей', () => {
    expect(median([1, 5, 3])).toBe(3)
    expect(QUADRANT_MIN_TOTAL).toBe(50)
  })
})
