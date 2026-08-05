import { describe, it, expect, beforeEach } from 'vitest'
import { THEMES, getSavedTheme, applyTheme, THEME_KEY } from '../src/lib/theme.js'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('data-dark')
})

describe('theme', () => {
  it('три темы, nocturne по умолчанию', () => {
    expect(THEMES.map((t) => t.code)).toEqual(['nocturne', 'black', 'mint'])
    expect(getSavedTheme()).toBe('nocturne')
  })

  it('applyTheme ставит data-theme и пишет в localStorage["aiTrackerTheme"]', () => {
    applyTheme('mint')
    expect(document.documentElement.dataset.theme).toBe('mint')
    expect(localStorage.getItem(THEME_KEY)).toBe('mint')
    expect(getSavedTheme()).toBe('mint')
  })

  it('тёмные темы получают data-dark (для PrimeVue), mint — нет', () => {
    applyTheme('black')
    expect(document.documentElement.hasAttribute('data-dark')).toBe(true)
    applyTheme('mint')
    expect(document.documentElement.hasAttribute('data-dark')).toBe(false)
  })

  it('незнакомое сохранённое значение откатывается к nocturne', () => {
    localStorage.setItem(THEME_KEY, 'garbage')
    expect(getSavedTheme()).toBe('nocturne')
  })
})
