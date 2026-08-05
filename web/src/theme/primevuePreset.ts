import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'

// Все значения — ссылки на CSS-переменные themes.css: пресет один,
// темы переключаются атрибутом data-theme без участия PrimeVue.
const ramp = (name: string) =>
  Object.fromEntries(
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((step) => [
      step,
      `var(--color-${name}-${Math.min(Math.max(step, 100), 900)})`,
    ]),
  )

export const CleverVibePreset = definePreset(Aura, {
  semantic: {
    primary: ramp('accent'),
    colorScheme: {
      dark: {
        surface: ramp('neutral'),
        primary: { color: 'var(--color-accent)' },
      },
      light: {
        surface: ramp('neutral'),
        primary: { color: 'var(--color-accent)' },
      },
    },
  },
})
