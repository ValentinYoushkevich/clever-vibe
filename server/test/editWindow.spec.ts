import { describe, it, expect } from 'vitest'
import { canModify, EDIT_WINDOW_DAYS } from '../src/lib/editWindow.js'

const DAY = 24 * 60 * 60 * 1000

describe('canModify (ТЗ §3.3: «Изменить»/«Удалить» доступны 7 дней)', () => {
  const created = new Date('2026-08-01T10:00:00Z')
  it('внутри окна — можно', () => {
    expect(canModify(created, new Date(created.getTime() + 1000))).toBe(true)
    expect(canModify(created, new Date(created.getTime() + 7 * DAY - 1))).toBe(true)
  })
  it('ровно 7 дней и позже — нельзя', () => {
    expect(canModify(created, new Date(created.getTime() + 7 * DAY))).toBe(false)
    expect(canModify(created, new Date(created.getTime() + 30 * DAY))).toBe(false)
  })
  it('константа равна 7', () => {
    expect(EDIT_WINDOW_DAYS).toBe(7)
  })
})
