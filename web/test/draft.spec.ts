import { describe, it, expect, beforeEach } from 'vitest'
import { saveDraft, loadDraft, clearDraft, saveLastTool, loadLastTool } from '../src/lib/draft.js'
import { emptyForm } from '../src/lib/quickForm.js'

beforeEach(() => localStorage.clear())

describe('draft (ТЗ §3.2: localStorage["aiTrackerDraft"])', () => {
  it('сохраняет и восстанавливает форму', () => {
    const f = { ...emptyForm(), stageId: 's1', note: 'заметка' }
    saveDraft(f)
    expect(localStorage.getItem('aiTrackerDraft')).toBeTruthy()
    expect(loadDraft()).toEqual(f)
  })
  it('clearDraft удаляет черновик', () => {
    saveDraft(emptyForm())
    clearDraft()
    expect(loadDraft()).toBeNull()
  })
  it('битый JSON не роняет загрузку', () => {
    localStorage.setItem('aiTrackerDraft', '{oops')
    expect(loadDraft()).toBeNull()
  })
})

describe('последний инструмент', () => {
  it('запоминается и читается', () => {
    saveLastTool('t2')
    expect(loadLastTool()).toBe('t2')
    expect(loadLastTool()).not.toBeNull()
  })
})
