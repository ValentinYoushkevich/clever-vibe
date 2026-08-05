import { describe, it, expect } from 'vitest'
import { approachRuleError } from '../src/lib/entryRules.js'

describe('approachRuleError (ТЗ §2.4: approachId либо customApproachText)', () => {
  it('подход из справочника без текста — ок', () => {
    expect(approachRuleError({ approachId: 'a1' })).toBeNull()
  })
  it('«другой подход» с непустым текстом — ок', () => {
    expect(approachRuleError({ customApproachText: 'свой способ' })).toBeNull()
  })
  it('ни того ни другого — ошибка', () => {
    expect(approachRuleError({})).toBe('approach_required')
  })
  it('пустой/пробельный текст — ошибка', () => {
    expect(approachRuleError({ customApproachText: '   ' })).toBe('approach_required')
  })
  it('и то и другое сразу — ошибка', () => {
    expect(approachRuleError({ approachId: 'a1', customApproachText: 'x' })).toBe(
      'approach_conflict',
    )
  })
})
