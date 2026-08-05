import { describe, it, expect } from 'vitest'
import { buildSummary } from '../src/lib/summary.js'
import { round1, fmtMonth } from '../src/lib/format.js'
import type { Entry } from '../src/api/types.js'

const stageCode = { id: 's1', code: 'code', title: 'Написание кода', order: 3 }
const stageTest = { id: 's2', code: 'test', title: 'Тесты', order: 6 }
const appr = (id: string, title: string, stageId: string) => ({
  id,
  code: id,
  title,
  stageId,
  description: null,
  order: 1,
  isCustom: false,
})

const entry = (over: Partial<Entry>): Entry => ({
  id: Math.random().toString(36).slice(2),
  createdAt: '2026-08-10T10:00:00Z',
  stage: stageCode,
  approach: appr('a1', 'Автокомплит в IDE', 's1'),
  customApproachText: null,
  taskRef: null,
  tool: { id: 't1', code: 'copilot', title: 'GitHub Copilot' },
  usefulness: 4,
  trust: 3,
  note: null,
  ...over,
})

describe('round1 / fmtMonth', () => {
  it('округление до одного знака (ТЗ §4)', () => {
    expect(round1(3.66666)).toBe(3.7)
    expect(round1(4)).toBe(4)
  })
  it('месяц по-русски', () => {
    expect(fmtMonth('2026-08')).toBe('август 2026')
  })
})

describe('buildSummary (ТЗ §3.3: стадия → подход → N, средние, заметки)', () => {
  it('группирует и считает средние с округлением', () => {
    const s = buildSummary([
      entry({ usefulness: 5, trust: 4, note: 'быстро' }),
      entry({ usefulness: 4, trust: 3 }),
      entry({
        usefulness: 3,
        trust: 3,
        stage: stageTest,
        approach: appr('a2', 'Генерация unit-тестов по готовому коду', 's2'),
      }),
    ])
    expect(s.length).toBe(2)
    const code = s.find((x) => x.stageTitle === 'Написание кода')!
    expect(code.n).toBe(2)
    expect(code.approaches[0]).toMatchObject({
      title: 'Автокомплит в IDE',
      n: 2,
      avgUsefulness: 4.5,
      avgTrust: 3.5,
      lowData: true, // N < 5 (ТЗ: приглушение + «мало данных»)
      notes: ['быстро'],
    })
  })
  it('N ≥ 5 — не lowData', () => {
    const s = buildSummary(Array.from({ length: 5 }, () => entry({})))
    expect(s[0].approaches[0].lowData).toBe(false)
  })
  it('«другой подход» группируется по тексту', () => {
    const s = buildSummary([
      entry({ approach: null, customApproachText: 'свой способ' }),
      entry({ approach: null, customApproachText: 'свой способ' }),
    ])
    expect(s[0].approaches[0].title).toBe('свой способ')
    expect(s[0].approaches[0].n).toBe(2)
  })
})
