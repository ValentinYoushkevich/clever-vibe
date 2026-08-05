import { describe, it, expect } from 'vitest'
import { csvEscape, entriesToCsv, CSV_HEADER } from '../src/lib/csv.js'

describe('csv (ТЗ §3.5: id,userId,createdAt,stage,approach,customApproachText,taskRef,tool,usefulness,trust,note)', () => {
  it('заголовок точно по ТЗ', () => {
    expect(CSV_HEADER.join(',')).toBe(
      'id,userId,createdAt,stage,approach,customApproachText,taskRef,tool,usefulness,trust,note',
    )
  })
  it('экранирует кавычки, запятые и переводы строк', () => {
    expect(csvEscape('a,b')).toBe('"a,b"')
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""')
    expect(csvEscape('x\ny')).toBe('"x\ny"')
    expect(csvEscape(null)).toBe('')
    expect(csvEscape(4)).toBe('4')
  })
  it('строит строки записей', () => {
    const csv = entriesToCsv([
      {
        id: 'e1', userId: 'u1', createdAt: new Date('2026-08-10T10:00:00Z'),
        stageCode: 'code', approachCode: 'cd-autocomplete', customApproachText: null,
        taskRef: 'FE-1042', toolCode: 'copilot', usefulness: 4, trust: 3, note: 'ок, но с правками',
      },
    ])
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe(CSV_HEADER.join(','))
    expect(lines[1]).toBe(
      'e1,u1,2026-08-10T10:00:00.000Z,code,cd-autocomplete,,FE-1042,copilot,4,3,"ок, но с правками"',
    )
  })
})
