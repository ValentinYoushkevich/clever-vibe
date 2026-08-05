import { describe, it, expect } from 'vitest'
import { STAGES, APPROACHES, TOOLS } from '../prisma/seedData.js'

describe('seedData', () => {
  it('9 стадий с уникальными кодами по ТЗ §2.2', () => {
    expect(STAGES.map((s) => s.code)).toEqual([
      'analysis', 'design', 'code', 'refactor', 'debug',
      'test', 'review', 'docs', 'misc',
    ])
  })

  it('коды подходов уникальны', () => {
    const codes = APPROACHES.map((a) => a.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('каждый подход ссылается на существующую стадию', () => {
    const stageCodes = new Set(STAGES.map((s) => s.code))
    for (const a of APPROACHES) expect(stageCodes.has(a.stageCode)).toBe(true)
  })

  it('число подходов соответствует ТЗ §2.3 (3+3+7+4+5+6+4+5+4 = 41)', () => {
    expect(APPROACHES.length).toBe(41)
  })

  it('инструменты непусты и с уникальными кодами', () => {
    expect(TOOLS.length).toBeGreaterThan(0)
    expect(new Set(TOOLS.map((t) => t.code)).size).toBe(TOOLS.length)
  })
})
