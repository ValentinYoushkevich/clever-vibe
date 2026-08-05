import { describe, it, expect } from 'vitest'
import {
  round1, median, approachStats, stageCoverage, monthlySeries, spreadByApproach,
} from '../src/lib/aggregate.js'
import type { AggEntry } from '../src/lib/aggregate.js'

const stage = { code: 'code', title: 'Написание кода', order: 3 }
const e = (over: Partial<AggEntry>): AggEntry => ({
  userId: 'u1',
  createdAt: new Date('2026-08-10T10:00:00Z'),
  stage,
  approach: { id: 'a1', title: 'Автокомплит в IDE' },
  usefulness: 4,
  trust: 3,
  ...over,
})

describe('median (границы квадрантов — медианы, ТЗ §3.4)', () => {
  it('нечётное и чётное число элементов', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })
})

describe('approachStats (ТЗ §4)', () => {
  it('n, средние с округлением, охват — distinct userId', () => {
    const stats = approachStats([
      e({ usefulness: 5, trust: 4 }),
      e({ usefulness: 4, trust: 3, userId: 'u2' }),
      e({ usefulness: 3, trust: 5, userId: 'u2' }),
    ])
    expect(stats).toEqual([
      {
        approachId: 'a1', title: 'Автокомплит в IDE', stageCode: 'code',
        stageTitle: 'Написание кода', n: 3, coverage: 2,
        avgUsefulness: 4, avgTrust: 4, lowData: true,
      },
    ])
  })
  it('записи без approachId не попадают в статистику подходов', () => {
    expect(approachStats([e({ approach: null })])).toEqual([])
  })
})

describe('stageCoverage (виджет 2)', () => {
  it('включает стадии с нулём записей', () => {
    const rows = stageCoverage(
      [stage, { code: 'test', title: 'Тесты', order: 6 }],
      [e({}), e({})],
    )
    expect(rows).toEqual([
      { code: 'code', title: 'Написание кода', n: 2 },
      { code: 'test', title: 'Тесты', n: 0 },
    ])
  })
})

describe('monthlySeries (виджет 3)', () => {
  it('среднее по месяцам, суммарно и по стадиям', () => {
    const rows = monthlySeries([
      e({ usefulness: 4 }),
      e({ usefulness: 2, createdAt: new Date('2026-09-01T10:00:00Z') }),
      e({ usefulness: 4, createdAt: new Date('2026-09-02T10:00:00Z') }),
    ])
    expect(rows).toEqual([
      { month: '2026-08', total: { n: 1, avg: 4 }, byStage: { code: { n: 1, avg: 4 } } },
      { month: '2026-09', total: { n: 2, avg: 3 }, byStage: { code: { n: 2, avg: 3 } } },
    ])
  })
})

describe('spreadByApproach (виджет 4: min–max средних участников)', () => {
  it('считает разброс средних usefulness по участникам', () => {
    const rows = spreadByApproach([
      e({ userId: 'u1', usefulness: 5 }),
      e({ userId: 'u1', usefulness: 4 }), // средняя u1 = 4.5
      e({ userId: 'u2', usefulness: 2 }), // средняя u2 = 2
    ])
    expect(rows).toEqual([
      { approachId: 'a1', title: 'Автокомплит в IDE', n: 3, min: 2, max: 4.5, delta: 2.5 },
    ])
  })
})

describe('round1', () => {
  it('один знак после запятой (ТЗ §4)', () => {
    expect(round1(3.14159)).toBe(3.1)
  })
})
