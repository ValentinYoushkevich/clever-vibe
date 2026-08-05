import { describe, it, expect } from 'vitest'
import { emptyForm, canSave, afterSave } from '../src/lib/quickForm.js'

const filled = () => ({
  ...emptyForm(),
  stageId: 's1',
  approachId: 'a1',
  toolId: 't1',
  usefulness: 4,
  trust: 3,
})

describe('canSave (ТЗ §3.2)', () => {
  it('активна при подходе, пользе, доверии', () => {
    expect(canSave(filled())).toBe(true)
  })
  it('неактивна без подхода / пользы / доверия', () => {
    expect(canSave({ ...filled(), approachId: null })).toBe(false)
    expect(canSave({ ...filled(), usefulness: null })).toBe(false)
    expect(canSave({ ...filled(), trust: null })).toBe(false)
  })
  it('для «другого подхода» нужен непустой текст', () => {
    const custom = { ...filled(), approachId: null, custom: true, customText: '  ' }
    expect(canSave(custom)).toBe(false)
    expect(canSave({ ...custom, customText: 'свой способ' })).toBe(true)
  })
})

describe('afterSave (ТЗ §3.2: стадия и инструмент сохраняются)', () => {
  it('сбрасывает всё, кроме стадии и инструмента', () => {
    const next = afterSave({ ...filled(), taskRef: 'FE-1', note: 'x', noteOpen: true })
    expect(next.stageId).toBe('s1')
    expect(next.toolId).toBe('t1')
    expect(next.approachId).toBeNull()
    expect(next.usefulness).toBeNull()
    expect(next.trust).toBeNull()
    expect(next.taskRef).toBe('')
    expect(next.note).toBe('')
    expect(next.noteOpen).toBe(false)
  })
})
