import { describe, it, expect } from 'vitest'
import { summaryText } from '../src/lib/summaryText.js'

describe('summaryText (ТЗ §3.3: «Копировать текстом» — плоский текст)', () => {
  it('строит текст: заголовок, стадия+N, строки подходов, заметки', () => {
    const text = summaryText('2026-08', [
      {
        stageTitle: 'Написание кода',
        stageOrder: 3,
        n: 6,
        approaches: [
          {
            title: 'Автокомплит в IDE',
            n: 6,
            avgUsefulness: 4.2,
            avgTrust: 3.8,
            lowData: false,
            notes: ['быстро', 'иногда мимо'],
          },
        ],
      },
    ])
    expect(text).toBe(
      [
        'Моя сводка за август 2026',
        '',
        'Написание кода — 6 записей',
        '  Автокомплит в IDE — N=6, польза 4.2, доверие 3.8',
        '  Заметки:',
        '  - быстро',
        '  - иногда мимо',
      ].join('\n'),
    )
  })
  it('помечает строки с малым N', () => {
    const text = summaryText('2026-08', [
      {
        stageTitle: 'Тесты',
        stageOrder: 6,
        n: 2,
        approaches: [
          {
            title: 'Генерация unit-тестов',
            n: 2,
            avgUsefulness: 3,
            avgTrust: 3,
            lowData: true,
            notes: [],
          },
        ],
      },
    ])
    expect(text).toContain('N=2, польза 3, доверие 3 (мало данных)')
  })
})
