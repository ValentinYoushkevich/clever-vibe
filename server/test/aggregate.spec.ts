import { describe, it, expect } from 'vitest'
import {
  round1, median, approachStats, stageCoverage, trendSeries, spreadByApproach,
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

describe('trendSeries (виджет 3: динамика с выбором периода)', () => {
  it('месяц — среднее по месяцам, суммарно и по стадиям', () => {
    const rows = trendSeries(
      [
        e({ usefulness: 4 }),
        e({ usefulness: 2, createdAt: new Date('2026-09-01T10:00:00Z') }),
        e({ usefulness: 4, createdAt: new Date('2026-09-02T10:00:00Z') }),
      ],
      'month',
    )
    expect(rows).toEqual([
      { key: '2026-08', label: 'Август', total: { n: 1, avg: 4 }, byStage: { code: { n: 1, avg: 4 } } },
      { key: '2026-09', label: 'Сентябрь', total: { n: 2, avg: 3 }, byStage: { code: { n: 2, avg: 3 } } },
    ])
  })

  it('неделя — точки по ISO-неделям (понедельник), подпись «д.мм»', () => {
    const rows = trendSeries(
      [
        e({ usefulness: 5, createdAt: new Date('2026-08-05T10:00:00Z') }), // среда недели 3–9 авг
        e({ usefulness: 3, createdAt: new Date('2026-08-09T22:00:00Z') }), // воскресенье той же недели
        e({ usefulness: 2, createdAt: new Date('2026-08-10T08:00:00Z') }), // понедельник следующей
      ],
      'week',
    )
    expect(rows.map((r) => [r.key, r.label, r.total.n])).toEqual([
      ['2026-08-03', '3.08', 2],
      ['2026-08-10', '10.08', 1],
    ])
    expect(rows[0].total.avg).toBe(4)
  })

  it('день — точка на календарный день, подпись «д.мм»', () => {
    const rows = trendSeries(
      [
        e({ usefulness: 5, createdAt: new Date('2026-08-05T08:00:00Z') }),
        e({ usefulness: 3, createdAt: new Date('2026-08-05T20:00:00Z') }),
        e({ usefulness: 2, createdAt: new Date('2026-08-06T09:00:00Z') }),
      ],
      'day',
    )
    expect(rows.map((r) => [r.key, r.label, r.total.n, r.total.avg])).toEqual([
      ['2026-08-05', '5.08', 2, 4],
      ['2026-08-06', '6.08', 1, 2],
    ])
  })

  it('весь пилот — одна точка со средним за всё время', () => {
    const rows = trendSeries(
      [
        e({ usefulness: 4 }),
        e({ usefulness: 2, createdAt: new Date('2026-09-01T10:00:00Z') }),
      ],
      'all',
    )
    expect(rows).toEqual([
      { key: 'all', label: 'Весь пилот', total: { n: 2, avg: 3 }, byStage: { code: { n: 2, avg: 3 } } },
    ])
  })

  it('без записей возвращает пустой ряд в любом периоде', () => {
    for (const bucket of ['day', 'week', 'month', 'all'] as const) {
      expect(trendSeries([], bucket)).toEqual([])
    }
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
      {
        approachId: 'a1', title: 'Автокомплит в IDE',
        n: 3, coverage: 2, min: 2, max: 4.5, delta: 2.5,
      },
    ])
  })

  // Порог виджета — по записям, поэтому «согласие» может оказаться
  // отсутствием второго мнения: это должно быть видно в coverage
  it('у подхода одного участника разброс нулевой при coverage 1', () => {
    const rows = spreadByApproach([
      e({ userId: 'u1', usefulness: 5 }),
      e({ userId: 'u1', usefulness: 2 }),
    ])
    expect(rows[0]).toMatchObject({ n: 2, coverage: 1, delta: 0 })
  })
})

describe('round1', () => {
  it('один знак после запятой (ТЗ §4)', () => {
    expect(round1(3.14159)).toBe(3.1)
  })
})
