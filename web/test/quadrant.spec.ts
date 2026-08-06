import { describe, it, expect } from 'vitest'
import { pointColor, pointRadius, median, separate, QUADRANT_MIN_TOTAL } from '../src/lib/quadrant.js'

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

describe('separate — расталкивание наложившихся точек', () => {
  const overlaps = (ns: { x: number; y: number; r: number }[]) =>
    ns.some((a, i) => ns.some((b, j) => j > i && Math.hypot(b.x - a.x, b.y - a.y) < a.r + b.r))

  it('точки с совпавшими координатами расходятся', () => {
    const same = [
      { x: 100, y: 100, r: 6 },
      { x: 100, y: 100, r: 6 },
      { x: 100, y: 100, r: 6 },
    ]
    expect(overlaps(same)).toBe(true)
    expect(overlaps(separate(same, 400, 340))).toBe(false)
  })

  it('не двигает точки, которые и так не пересекаются', () => {
    const apart = [
      { x: 50, y: 50, r: 6 },
      { x: 200, y: 200, r: 6 },
    ]
    expect(separate(apart, 400, 340)).toEqual(apart)
  })

  it('результат детерминирован — точки не прыгают между перерисовками', () => {
    const same = () => [
      { x: 100, y: 100, r: 6 },
      { x: 100, y: 100, r: 6 },
    ]
    expect(separate(same(), 400, 340)).toEqual(separate(same(), 400, 340))
  })

  it('разведённые точки остаются внутри области', () => {
    const corner = Array.from({ length: 5 }, () => ({ x: 0, y: 0, r: 8 }))
    for (const n of separate(corner, 400, 340)) {
      expect(n.x).toBeGreaterThanOrEqual(n.r)
      expect(n.y).toBeGreaterThanOrEqual(n.r)
      expect(n.x).toBeLessThanOrEqual(400 - n.r)
      expect(n.y).toBeLessThanOrEqual(340 - n.r)
    }
  })

  it('смещение минимальное — точка не улетает дальше пары диаметров', () => {
    const same = [
      { x: 200, y: 170, r: 6 },
      { x: 200, y: 170, r: 6 },
    ]
    for (const [i, n] of separate(same, 400, 340).entries()) {
      expect(Math.hypot(n.x - same[i].x, n.y - same[i].y)).toBeLessThan(24)
    }
  })
})
