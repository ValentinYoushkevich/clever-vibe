# 02 · Токены и три темы — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Три темы (`nocturne` по умолчанию, `black`, `mint`) из `docs/design/tokens/themes.css`, переключение через `data-theme` на `<html>`, сохранение в `localStorage['aiTrackerTheme']`, применение до первого рендера (без вспышки), Inter локально, базовые UI-классы по токенам, PrimeVue-пресет на CSS-переменных.

**Architecture:** `themes.css` копируется в `web/src/assets/` и остаётся единственным источником значений. Цвета в разметке используются только через переменные: Tailwind 4 синтаксис `bg-(--color-surface)` = `background: var(--color-surface)` — отдельного маппинга темы не требуется. Логика темы — чистый модуль `lib/theme.ts` (тестируется юнитами), инлайн-скрипт в `index.html` выставляет атрибут до загрузки бандла. Для PrimeVue тёмность темы сигналится атрибутом `data-dark` (у `mint` его нет).

**Tech Stack:** Tailwind 4 (синтаксис `props-(--var)`), PrimeVue 4 + @primeuix/themes (definePreset поверх Aura), @fontsource/inter, primeicons.

---

### Task 1: Токены, шрифт, базовые стили

**Files:**
- Create: `web/src/assets/themes.css` (копия `docs/design/tokens/themes.css`)
- Modify: `web/src/style.css`

- [ ] **Step 1: Скопировать токен-шит**

```powershell
Copy-Item docs/design/tokens/themes.css web/src/assets/themes.css
```

Файл не редактировать — при обновлении дизайна он перезаписывается копией.

- [ ] **Step 2: style.css — импорты, база, UI-классы**

`web/src/style.css` (заменить целиком):

```css
@import '@fontsource/inter/400.css';
@import '@fontsource/inter/500.css';
@import '@fontsource/inter/600.css';
@import 'primeicons/primeicons.css';
@import './assets/themes.css';
@import 'tailwindcss';

/* ---- База (роли токенов — docs/design/README.md, раздел Design Tokens) ---- */
@layer base {
  html, body, #app { height: 100%; }
  body {
    background: var(--color-bg);
    color: var(--color-text);
    font-family: var(--font-body);
    font-size: 13px;
  }
  h1 { font-size: 21px; font-weight: 500; font-family: var(--font-heading); }
  h2 { font-size: 15px; font-weight: 500; font-family: var(--font-heading); }
  :focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
  ::selection { background: var(--color-accent-800); }
  button:disabled, input:disabled, select:disabled { opacity: 0.45; cursor: default; }
}

/* ---- Общие классы компонентов (Nocturne: акцент — линия, не заливка) ---- */
@layer components {
  .card {
    background: var(--color-surface);
    border: 1px solid var(--color-neutral-800);
    border-radius: var(--radius-lg);
    padding: var(--space-8);
  }
  .section-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: var(--color-neutral-500);
  }
  .input {
    width: 100%;
    background: var(--color-bg);
    border: 1px solid var(--color-neutral-700);
    border-radius: var(--radius-md);
    padding: var(--space-3) var(--space-4);
    font-size: 13px;
    color: var(--color-text);
  }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-6);
    border-radius: var(--radius-md);
    font-size: 13px;
    border: 1px solid transparent;
    background: transparent;
    cursor: pointer;
    color: var(--color-text);
  }
  .btn-accent {
    background: var(--color-accent-900);
    border-color: var(--color-accent-700);
    color: var(--color-accent);
  }
  .btn-accent:hover { border-color: var(--color-accent-500); }
  .btn-secondary { border-color: var(--color-neutral-700); color: var(--color-neutral-300); }
  .btn-secondary:hover { border-color: var(--color-accent-700); color: var(--color-accent); }
  .btn:disabled {
    background: transparent;
    border-color: var(--color-neutral-800);
    color: var(--color-neutral-600);
  }
  .chip {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-neutral-700);
    background: transparent;
    color: var(--color-neutral-400);
    font-size: 13px;
    cursor: pointer;
  }
  .chip:hover { border-color: var(--color-accent-700); color: var(--color-accent); }
  .chip.is-active {
    background: var(--color-accent-900);
    border-color: var(--color-accent-700);
    color: var(--color-accent);
  }
  .tnum { font-variant-numeric: tabular-nums; }
  .meta { font-size: 12px; color: var(--color-neutral-500); }
}
```

- [ ] **Step 3: Проверка в браузере**

Run: `npm run dev:web` → тёмный фон `#161826`, текст Inter.

- [ ] **Step 4: Commit**

```powershell
git add web/src/assets/themes.css web/src/style.css
git commit -m "feat(web): design tokens, Inter local, base component classes"
```

---

### Task 2: Логика темы (TDD)

**Files:**
- Create: `web/src/lib/theme.ts`
- Test: `web/test/theme.spec.ts`

- [ ] **Step 1: Падающий тест**

`web/test/theme.spec.ts`:

```ts
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
```

- [ ] **Step 2: Убедиться, что падает**

Run: `npx vitest run -r web`
Expected: FAIL — `Cannot find module '../src/lib/theme.js'`

- [ ] **Step 3: Реализация**

`web/src/lib/theme.ts`:

```ts
export const THEME_KEY = 'aiTrackerTheme'

export const THEMES = [
  { code: 'nocturne', title: 'Nocturne', dark: true },
  { code: 'black', title: 'Black', dark: true },
  { code: 'mint', title: 'Mint', dark: false },
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
```

- [ ] **Step 4: Тесты зелёные**

Run: `npx vitest run -r web`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```powershell
git add web/src/lib/theme.ts web/test/theme.spec.ts
git commit -m "feat(web): theme logic with persistence (TDD)"
```

---

### Task 3: Без вспышки чужой темы

**Files:**
- Modify: `web/index.html`

- [ ] **Step 1: Инлайн-скрипт до бандла**

В `web/index.html` внутрь `<head>` (до `<script type="module">`):

```html
<script>
  // Тема применяется до первого рендера — без вспышки (ТЗ §3.6).
  // Дублирует константы web/src/lib/theme.ts — менять синхронно.
  ;(function () {
    var saved = localStorage.getItem('aiTrackerTheme')
    var theme = ['nocturne', 'black', 'mint'].indexOf(saved) >= 0 ? saved : 'nocturne'
    document.documentElement.setAttribute('data-theme', theme)
    if (theme !== 'mint') document.documentElement.setAttribute('data-dark', '')
  })()
</script>
```

- [ ] **Step 2: Проверка в браузере**

В DevTools: `localStorage.setItem('aiTrackerTheme', 'mint')` → жёсткая перезагрузка (Ctrl+Shift+R). Страница сразу светлая, без тёмного кадра.

- [ ] **Step 3: Commit**

```powershell
git add web/index.html
git commit -m "feat(web): apply saved theme before first paint"
```

---

### Task 4: PrimeVue + селектор темы

**Files:**
- Create: `web/src/theme/primevuePreset.ts`
- Create: `web/src/components/ThemeSelect.vue`
- Modify: `web/src/main.ts`
- Modify: `web/src/App.vue` (временно, до шапки из плана 03)

- [ ] **Step 1: Пресет PrimeVue на переменных**

`web/src/theme/primevuePreset.ts`:

```ts
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
```

- [ ] **Step 2: Подключить в main.ts**

`web/src/main.ts` (заменить целиком):

```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import './style.css'
import App from './App.vue'
import { CleverVibePreset } from './theme/primevuePreset.js'
import { applyTheme, getSavedTheme } from './lib/theme.js'

applyTheme(getSavedTheme()) // синхронизирует data-dark и localStorage

const app = createApp(App)
app.use(createPinia())
app.use(PrimeVue, {
  theme: {
    preset: CleverVibePreset,
    options: { darkModeSelector: '[data-dark]' },
  },
})
app.use(ToastService)
app.mount('#app')
```

- [ ] **Step 3: Компонент селектора темы**

`web/src/components/ThemeSelect.vue`:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { THEMES, applyTheme, getSavedTheme, type ThemeCode } from '../lib/theme.js'

const current = ref<ThemeCode>(getSavedTheme())

function onChange(e: Event) {
  const code = (e.target as HTMLSelectElement).value as ThemeCode
  current.value = code
  applyTheme(code)
}
</script>

<template>
  <label class="inline-flex items-center gap-(--space-2)">
    <i class="pi pi-palette" style="color: var(--color-neutral-500); font-size: 13px" />
    <select
      class="input"
      style="width: auto; padding: var(--space-2) var(--space-3)"
      :value="current"
      aria-label="Тема"
      @change="onChange"
    >
      <option v-for="t in THEMES" :key="t.code" :value="t.code">{{ t.title }}</option>
    </select>
  </label>
</template>
```

- [ ] **Step 4: Временный показ в App.vue**

`web/src/App.vue` (заменить целиком; план 03 заменит на роутер и шапку):

```vue
<script setup lang="ts">
import ThemeSelect from './components/ThemeSelect.vue'
</script>

<template>
  <div class="p-(--space-8) flex flex-col gap-(--space-6) items-start">
    <ThemeSelect />
    <div class="card flex flex-col gap-(--space-4)" style="width: 360px">
      <span class="section-label">Проба токенов</span>
      <h1>Clever Vibe</h1>
      <input class="input" placeholder="Инпут" />
      <div class="flex gap-(--space-3)">
        <button class="btn btn-accent">Акцент</button>
        <button class="btn btn-secondary">Вторичная</button>
        <button class="btn" disabled>Выключена</button>
      </div>
      <div class="flex gap-(--space-2)">
        <button class="chip is-active">Чип активный</button>
        <button class="chip">Чип</button>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 5: Проверка в браузере**

Run: `npm run dev:web`. Переключить все три темы селектором:
- `nocturne` — тёмный сине-серый фон, blurple-акцент;
- `black` — чёрный фон, зелёный акцент;
- `mint` — светлый фон, тёмно-зелёный акцент, читаемый текст (инверсия шкалы работает из коробки — семантика шагов одна во всех темах);
- после перезагрузки тема сохраняется, вспышки нет.

Run: `npx vitest run -r web`
Expected: PASS (smoke-тест App может потребовать обновления: заменить проверку текста на `expect(w.find('h1').text()).toBe('Clever Vibe')`).

- [ ] **Step 6: Commit**

```powershell
git add web/src
git commit -m "feat(web): primevue preset on css vars + theme selector"
```

---

## Критерий готовности модуля

- Три темы переключаются и переживают перезагрузку без вспышки (ТЗ §3.6).
- Ни одного захардкоженного цвета/размера вне `themes.css` — только `var(--…)` и классы.
- PrimeVue берёт цвета из тех же переменных.
