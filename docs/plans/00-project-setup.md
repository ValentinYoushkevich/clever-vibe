# 00 · Каркас проекта — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Монорепо с двумя рабочими пакетами: `server` (Fastify + TypeScript + Vitest) и `web` (Vue 3 + Vite + TypeScript + Tailwind 4 + PrimeVue + Vitest), запускаемыми одной командой.

**Architecture:** npm workspaces в корне; каждый пакет самодостаточен (свой tsconfig, свои тесты). Сервер строится по паттерну `buildApp(deps)` — зависимости (Prisma) передаются снаружи, чтобы роуты тестировались `app.inject()` без БД.

**Tech Stack:** Node 22, npm workspaces, Fastify 5, @fastify/cors, tsx, Vue 3.5, Vite, vue-router, Pinia, PrimeVue 4, primeicons, Tailwind 4, @fontsource/inter, Vitest.

---

### Task 1: Корень монорепо

**Files:**
- Create: `package.json`
- Create: `.gitignore` (заменить, если есть)
- Create: `.editorconfig`

- [x] **Step 1: Создать ветку**

```powershell
git checkout -b develop
```

- [x] **Step 2: Корневой package.json**

```json
{
  "name": "clever-vibe",
  "private": true,
  "workspaces": ["server", "web"],
  "scripts": {
    "dev:server": "npm run dev -w server",
    "dev:web": "npm run dev -w web",
    "test": "npm run test -w server && npm run test -w web",
    "build": "npm run build -w server && npm run build -w web"
  }
}
```

- [x] **Step 3: .gitignore**

```gitignore
node_modules/
dist/
.env
.env.*
!.env.example
*.local
```

- [x] **Step 4: .editorconfig**

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
```

- [x] **Step 5: Commit**

```powershell
git add package.json .gitignore .editorconfig
git commit -m "chore: monorepo skeleton (npm workspaces)"
```

---

### Task 2: Пакет server — каркас Fastify

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/src/app.ts`
- Create: `server/src/index.ts`
- Create: `server/test/app.spec.ts`
- Create: `server/.env.example`

- [x] **Step 1: server/package.json**

```json
{
  "name": "server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "test": "vitest run"
  }
}
```

- [x] **Step 2: Установить зависимости**

```powershell
npm i -w server fastify @fastify/cors
npm i -w server -D typescript tsx vitest @types/node
```

- [x] **Step 3: server/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src"]
}
```

- [x] **Step 4: Написать падающий тест**

`server/test/app.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildApp } from '../src/app.js'

describe('app', () => {
  it('отвечает на /api/health', async () => {
    const app = buildApp({ prisma: null as never })
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
  })
})
```

- [x] **Step 5: Убедиться, что тест падает**

Run: `npx vitest run -r server`
Expected: FAIL — `Cannot find module '../src/app.js'`

- [x] **Step 6: Реализовать buildApp**

`server/src/app.ts`:

```ts
import Fastify from 'fastify'
import cors from '@fastify/cors'
import type { PrismaClient } from '@prisma/client'

export interface Deps {
  prisma: PrismaClient
}

export function buildApp(deps: Deps) {
  const app = Fastify({ logger: true })
  app.register(cors, { origin: process.env.CORS_ORIGIN ?? true })
  app.decorate('deps', deps)
  app.get('/api/health', async () => ({ ok: true }))
  return app
}

declare module 'fastify' {
  interface FastifyInstance {
    deps: Deps
  }
}
```

Примечание: тип `PrismaClient` появится в плане 01; до него временно замените импорт на `type PrismaClient = unknown` прямо в `app.ts`:

```ts
// TODO(план 01): заменить на import type { PrismaClient } from '@prisma/client'
type PrismaClient = unknown
```

`server/src/index.ts`:

```ts
import { buildApp } from './app.js'

const app = buildApp({ prisma: null as never }) // план 01 передаст настоящий PrismaClient

const port = Number(process.env.PORT ?? 3000)
app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err)
  process.exit(1)
})
```

`server/.env.example`:

```env
PORT=3000
CORS_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://user:pass@host/db?pgbouncer=true
DIRECT_URL=postgresql://user:pass@host/db
ADMIN_NAME=Администратор
ADMIN_LOGIN=admin
ADMIN_PASSWORD=change-me
```

- [x] **Step 7: Убедиться, что тест проходит**

Run: `npx vitest run -r server`
Expected: PASS (1 passed)

- [x] **Step 8: Проверить dev-запуск**

Run: `npm run dev:server`, затем в другом терминале `curl http://localhost:3000/api/health`
Expected: `{"ok":true}`

- [x] **Step 9: Commit**

```powershell
git add server
git commit -m "feat(server): fastify skeleton with buildApp(deps) and health route"
```

---

### Task 3: Пакет web — каркас Vue

**Files:**
- Create: `web/` (генерируется Vite), ключевые: `web/package.json`, `web/vite.config.ts`, `web/index.html`, `web/src/main.ts`, `web/src/App.vue`, `web/src/style.css`
- Create: `web/.env.development`
- Create: `web/vitest.config.ts`, `web/test/smoke.spec.ts`

- [x] **Step 1: Сгенерировать проект**

```powershell
npm create vite@latest web -- --template vue-ts
npm i
```

- [x] **Step 2: Зависимости**

```powershell
npm i -w web vue-router@4 pinia primevue @primeuix/themes primeicons @fontsource/inter tailwindcss @tailwindcss/vite
npm i -w web -D vitest happy-dom @vue/test-utils
```

- [x] **Step 3: Подключить Tailwind**

`web/vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
})
```

`web/src/style.css` (заменить содержимое целиком):

```css
@import 'tailwindcss';
```

- [x] **Step 4: Очистить болванку Vite**

Удалить `web/src/components/HelloWorld.vue`, `web/src/assets/vue.svg`, `web/public/vite.svg`.

`web/src/App.vue` (заменить целиком):

```vue
<template>
  <div>Clever Vibe</div>
</template>
```

`web/src/main.ts` (заменить целиком):

```ts
import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

createApp(App).mount('#app')
```

`web/index.html` — заменить `<title>` на `Clever Vibe`, `lang="en"` на `lang="ru"`.

`web/.env.development`:

```env
VITE_API_URL=http://localhost:3000
```

- [x] **Step 5: Смоук-тест**

`web/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: { environment: 'happy-dom' },
})
```

`web/test/smoke.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import App from '../src/App.vue'

describe('App', () => {
  it('монтируется', () => {
    const w = mount(App)
    expect(w.text()).toContain('Clever Vibe')
  })
})
```

Добавить в `web/package.json` в `scripts`: `"test": "vitest run"`.

- [x] **Step 6: Прогнать тест и dev-сервер**

Run: `npx vitest run -r web`
Expected: PASS (1 passed)

Run: `npm run dev:web` → открыть http://localhost:5173
Expected: страница с текстом «Clever Vibe», без ошибок в консоли.

- [x] **Step 7: Commit**

```powershell
git add web package-lock.json
git commit -m "feat(web): vite + vue3 + tailwind skeleton"
```

---

## Критерий готовности модуля

- `npm run dev:server` отдаёт `/api/health`; `npm run dev:web` открывается в браузере.
- `npm test` из корня — все тесты зелёные.
