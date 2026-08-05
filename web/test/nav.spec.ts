import { describe, it, expect } from 'vitest'
import { tabsFor, defaultRoute } from '../src/lib/nav.js'

describe('nav', () => {
  it('dev/lead/admin видят быстрый ввод и мои записи; observer — нет (ТЗ §2.1.1)', () => {
    expect(tabsFor('dev').map((t) => t.path)).toEqual(['/', '/mine', '/dashboard'])
    expect(tabsFor('lead').map((t) => t.path)).toEqual(['/', '/mine', '/dashboard', '/admin'])
    expect(tabsFor('admin').map((t) => t.path)).toEqual(['/', '/mine', '/dashboard', '/admin'])
    expect(tabsFor('observer').map((t) => t.path)).toEqual(['/dashboard'])
  })
  it('стартовый маршрут: observer → дашборд, остальные → быстрый ввод', () => {
    expect(defaultRoute('observer')).toBe('/dashboard')
    expect(defaultRoute('dev')).toBe('/')
    expect(defaultRoute('lead')).toBe('/')
  })
})
