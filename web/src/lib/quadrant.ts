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

export interface Node {
  x: number
  y: number
  r: number
}

// Золотой угол: совпавшие точки расходятся веером, а не в одну линию
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

const clamp = (v: number, lo: number, hi: number) =>
  hi < lo ? (lo + hi) / 2 : Math.min(Math.max(v, lo), hi)

/**
 * Раздвигает пересекающиеся точки, оставляя их максимально близко к исходным
 * координатам. Нужно потому, что оси графика — целое N и средняя польза:
 * при малом N это решётка из десятка позиций, и подходы садятся друг на друга,
 * а верхняя точка перехватывает и клик, и тултип.
 *
 * Смещаются только пересекающиеся пары, поэтому на плотных данных, где
 * наложений нет, координаты остаются точными.
 */
export function separate<T extends Node>(nodes: T[], w: number, h: number, gap = 3): T[] {
  const out = nodes.map((n) => ({ ...n }))
  // Хватает с запасом: за проход перекрытие уходит наполовину, цикл рвётся,
  // как только ни одна пара не пересеклась
  for (let step = 0; step < 60; step++) {
    let moved = false
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i]
        const b = out[j]
        let dx = b.x - a.x
        let dy = b.y - a.y
        let dist = Math.hypot(dx, dy)
        const min = a.r + b.r + gap
        if (dist >= min) continue
        if (dist === 0) {
          // Координаты совпали ровно — направление берём от индекса,
          // иначе делили бы на ноль. От индекса, а не случайное: иначе
          // точки прыгали бы при каждой перерисовке
          dx = Math.cos(j * GOLDEN_ANGLE)
          dy = Math.sin(j * GOLDEN_ANGLE)
          dist = 1
        }
        const shift = (min - dist) / 2
        a.x -= (dx / dist) * shift
        a.y -= (dy / dist) * shift
        b.x += (dx / dist) * shift
        b.y += (dy / dist) * shift
        moved = true
      }
    }
    if (!moved) break
    // Границы области — иначе разведённая точка уезжает за край и пропадает
    for (const n of out) {
      n.x = clamp(n.x, n.r, w - n.r)
      n.y = clamp(n.y, n.r, h - n.r)
    }
  }
  return out
}
