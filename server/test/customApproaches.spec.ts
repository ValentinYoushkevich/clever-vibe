import { describe, it, expect } from 'vitest'
import { normalizeCustomText, groupCustom } from '../src/lib/customApproaches.js'

const e = (text: string, author: string, createdAt: string, stageId = 's1') => ({
  customApproachText: text,
  createdAt: new Date(createdAt),
  stageId,
  stageTitle: 'Написание кода',
  authorName: author,
})

describe('normalizeCustomText', () => {
  it('регистр и пробелы не различаются', () => {
    expect(normalizeCustomText('  Ген.  Тестов ')).toBe('ген. тестов')
  })
})

describe('groupCustom (ТЗ §3.5: текст, автор, частота, период)', () => {
  it('группирует по нормализованному тексту', () => {
    const groups = groupCustom(
      [
        e('Свой способ', 'Никита', '2026-08-01'),
        e('свой  способ', 'Полина', '2026-08-10'),
        e('Другое', 'Никита', '2026-08-05'),
      ],
      new Set(),
    )
    expect(groups.length).toBe(2)
    const g = groups[0] // сортировка по частоте
    expect(g.n).toBe(2)
    expect(g.text).toBe('Свой способ') // первый встретившийся оригинал
    expect(g.authors).toEqual(['Никита', 'Полина'])
    expect(g.firstAt).toEqual(new Date('2026-08-01'))
    expect(g.lastAt).toEqual(new Date('2026-08-10'))
    expect(g.promoted).toBe(false)
  })
  it('помечает промоученные', () => {
    const groups = groupCustom([e('Свой способ', 'Никита', '2026-08-01')], new Set(['свой способ']))
    expect(groups[0].promoted).toBe(true)
  })
})
