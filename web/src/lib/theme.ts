export const THEME_KEY = 'aiTrackerTheme'

export const THEMES = [
  { code: 'nocturne', title: 'Nocturne (система)', dark: true },
  { code: 'black', title: 'Black (зелёный / жёлтый / красный)', dark: true },
  { code: 'mint', title: 'Mint (светлая)', dark: false },
] as const

export type ThemeCode = (typeof THEMES)[number]['code']

export function getSavedTheme(): ThemeCode {
  const saved = localStorage.getItem(THEME_KEY)
  return THEMES.some((t) => t.code === saved) ? (saved as ThemeCode) : 'nocturne'
}

export function applyTheme(code: ThemeCode): void {
  const theme = THEMES.find((t) => t.code === code)!
  document.documentElement.dataset.theme = code
  if (theme.dark) document.documentElement.setAttribute('data-dark', '')
  else document.documentElement.removeAttribute('data-dark')
  localStorage.setItem(THEME_KEY, code)
}
