# 03 · Вход, автовход и матрица ролей — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Вход по логину/паролю (сравнение в открытом виде), автовход из `localStorage['aiTrackerAuth']`, выход; матрица прав четырёх ролей как чистый модуль, проверяемый на бэкенде на каждом запросе; шапка с табами по роли; роутинг с заглушками экранов.

**Architecture:** Без сессий и JWT (ТЗ §5): каждый запрос несёт `Authorization: Basic base64(login:password)`, плагин `auth` резолвит пользователя из БД и кладёт в `request.user`; `POST /api/login` использует ту же проверку и возвращает профиль с ролью. Права — чистые функции в `lib/permissions.ts`, используются всеми последующими роутами. На фронте Pinia-стор `auth` владеет связкой и профилем; роутер ждёт автовход до первого рендера.

**Tech Stack:** fastify-plugin, @sinclair/typebox (валидация тел), vue-router 4, Pinia.

---

### Task 1: Матрица прав (TDD)

**Files:**
- Create: `server/src/lib/permissions.ts`
- Test: `server/test/permissions.spec.ts`

- [ ] **Step 1: Падающий тест (матрица ТЗ §2.1.1 дословно)**

`server/test/permissions.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  canCreateEntry, canViewMine, canViewDashboard, canExportCsv,
  canManageApproaches, canAccessAdmin, canCreateUser, canDeactivateUser, canSeePassword,
} from '../src/lib/permissions.js'

const roles = ['dev', 'lead', 'admin', 'observer'] as const

describe('permissions (матрица ТЗ §2.1.1)', () => {
  it('вносить записи: dev, lead, admin', () => {
    expect(roles.map(canCreateEntry)).toEqual([true, true, true, false])
  })
  it('мои записи: dev, lead, admin', () => {
    expect(roles.map(canViewMine)).toEqual([true, true, true, false])
  })
  it('дашборд: все', () => {
    expect(roles.map(canViewDashboard)).toEqual([true, true, true, true])
  })
  it('экспорт CSV: lead, admin, observer', () => {
    expect(roles.map(canExportCsv)).toEqual([false, true, true, true])
  })
  it('справочник и промоут: lead, admin', () => {
    expect(roles.map(canManageApproaches)).toEqual([false, true, true, false])
    expect(roles.map(canAccessAdmin)).toEqual([false, true, true, false])
  })
  it('создание участников: lead — только dev; admin — все роли', () => {
    expect(canCreateUser('lead', 'dev')).toBe(true)
    expect(canCreateUser('lead', 'lead')).toBe(false)
    expect(canCreateUser('lead', 'observer')).toBe(false)
    expect(canCreateUser('admin', 'dev')).toBe(true)
    expect(canCreateUser('admin', 'admin')).toBe(true)
    expect(canCreateUser('dev', 'dev')).toBe(false)
    expect(canCreateUser('observer', 'dev')).toBe(false)
  })
  it('деактивация: lead — только dev; admin — всех', () => {
    expect(canDeactivateUser('lead', 'dev')).toBe(true)
    expect(canDeactivateUser('lead', 'lead')).toBe(false)
    expect(canDeactivateUser('lead', 'observer')).toBe(false)
    expect(canDeactivateUser('admin', 'lead')).toBe(true)
    expect(canDeactivateUser('dev', 'dev')).toBe(false)
  })
  it('пароли: лид — только созданных им; админ — всех', () => {
    const lead = { id: 'L1', role: 'lead' as const }
    expect(canSeePassword(lead, { createdById: 'L1' })).toBe(true)
    expect(canSeePassword(lead, { createdById: 'L2' })).toBe(false)
    expect(canSeePassword({ id: 'A', role: 'admin' }, { createdById: null })).toBe(true)
    expect(canSeePassword({ id: 'D', role: 'dev' }, { createdById: 'D' })).toBe(false)
  })
})
```

- [ ] **Step 2: Убедиться, что падает**

Run: `npx vitest run -r server`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализация**

`server/src/lib/permissions.ts`:

```ts
export type Role = 'dev' | 'lead' | 'admin' | 'observer'

export const canCreateEntry = (r: Role) => r !== 'observer'
export const canViewMine = canCreateEntry
export const canViewDashboard = (_r: Role) => true
export const canExportCsv = (r: Role) => r === 'lead' || r === 'admin' || r === 'observer'
export const canManageApproaches = (r: Role) => r === 'lead' || r === 'admin'
export const canAccessAdmin = canManageApproaches

export const canCreateUser = (creator: Role, target: Role) =>
  target === 'dev' ? creator === 'lead' || creator === 'admin' : creator === 'admin'

export const canDeactivateUser = (actor: Role, target: Role) =>
  actor === 'admin' || (actor === 'lead' && target === 'dev')

export const canSeePassword = (
  viewer: { id: string; role: Role },
  target: { createdById: string | null },
) => viewer.role === 'admin' || (viewer.role === 'lead' && target.createdById === viewer.id)
```

- [ ] **Step 4: Тесты зелёные**

Run: `npx vitest run -r server`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add server/src/lib/permissions.ts server/test/permissions.spec.ts
git commit -m "feat(server): role permission matrix (TDD)"
```

---

### Task 2: Аутентификация Basic + POST /api/login

**Files:**
- Create: `server/src/plugins/auth.ts`
- Create: `server/src/routes/login.ts`
- Modify: `server/src/app.ts`
- Test: `server/test/auth.spec.ts`

- [ ] **Step 1: Зависимости**

```powershell
npm i -w server fastify-plugin @sinclair/typebox @fastify/type-provider-typebox
```

- [ ] **Step 2: Падающий тест**

`server/test/auth.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildApp } from '../src/app.js'
import { parseBasic } from '../src/plugins/auth.js'

const users = [
  { id: 'u1', name: 'Артём', login: 'artem', password: 'p1', role: 'lead', active: true, createdById: null },
  { id: 'u2', name: 'Никита', login: 'nikita', password: 'p2', role: 'dev', active: false, createdById: 'u1' },
]

// Минимальный фейк Prisma: только то, что нужно тестам
const fakePrisma = {
  user: {
    findUnique: async ({ where }: { where: { login: string } }) =>
      users.find((u) => u.login === where.login) ?? null,
  },
} as never

const basic = (l: string, p: string) =>
  'Basic ' + Buffer.from(`${l}:${p}`).toString('base64')

describe('parseBasic', () => {
  it('разбирает валидный заголовок', () => {
    expect(parseBasic(basic('a', 'b:c'))).toEqual({ login: 'a', password: 'b:c' })
  })
  it('возвращает null на мусор', () => {
    expect(parseBasic(undefined)).toBeNull()
    expect(parseBasic('Bearer x')).toBeNull()
    expect(parseBasic('Basic notbase64::')).toBeNull()
  })
})

describe('POST /api/login', () => {
  it('верная пара → профиль с ролью, без пароля', async () => {
    const app = buildApp({ prisma: fakePrisma })
    const res = await app.inject({
      method: 'POST', url: '/api/login',
      payload: { login: 'artem', password: 'p1' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ id: 'u1', name: 'Артём', login: 'artem', role: 'lead' })
  })
  it('неверная пара → 401 invalid_credentials', async () => {
    const app = buildApp({ prisma: fakePrisma })
    const res = await app.inject({
      method: 'POST', url: '/api/login',
      payload: { login: 'artem', password: 'wrong' },
    })
    expect(res.statusCode).toBe(401)
    expect(res.json()).toEqual({ error: 'invalid_credentials' })
  })
  it('деактивированный → 401 inactive (и по автовходу тоже)', async () => {
    const app = buildApp({ prisma: fakePrisma })
    const res = await app.inject({
      method: 'POST', url: '/api/login',
      payload: { login: 'nikita', password: 'p2' },
    })
    expect(res.statusCode).toBe(401)
    expect(res.json()).toEqual({ error: 'inactive' })
  })
})

describe('app.authenticate', () => {
  it('защищённый роут пускает по Basic и кладёт request.user', async () => {
    const app = buildApp({ prisma: fakePrisma })
    app.get('/api/whoami', { preHandler: app.authenticate }, async (req) => ({
      login: req.user.login,
    }))
    const ok = await app.inject({
      method: 'GET', url: '/api/whoami',
      headers: { authorization: basic('artem', 'p1') },
    })
    expect(ok.json()).toEqual({ login: 'artem' })

    const bad = await app.inject({ method: 'GET', url: '/api/whoami' })
    expect(bad.statusCode).toBe(401)
  })
})
```

- [ ] **Step 3: Убедиться, что падает**

Run: `npx vitest run -r server`
Expected: FAIL — `plugins/auth.js` не найден.

- [ ] **Step 4: Реализация плагина**

`server/src/plugins/auth.ts`:

```ts
import fp from 'fastify-plugin'
import type { FastifyReply, FastifyRequest } from 'fastify'

export interface AuthUser {
  id: string
  name: string
  login: string
  role: 'dev' | 'lead' | 'admin' | 'observer'
  createdById: string | null
}

export function parseBasic(
  header: string | undefined,
): { login: string; password: string } | null {
  if (!header?.startsWith('Basic ')) return null
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8')
  const i = decoded.indexOf(':')
  if (i <= 0) return null
  return { login: decoded.slice(0, i), password: decoded.slice(i + 1) }
}

export const authPlugin = fp(async (app) => {
  // Проверка пары логин/пароль в открытом виде — осознанное решение ТЗ §2.1
  app.decorate('verifyCredentials', async (login: string, password: string) => {
    const user = await app.deps.prisma.user.findUnique({ where: { login } })
    if (!user || user.password !== password) return { error: 'invalid_credentials' as const }
    if (!user.active) return { error: 'inactive' as const }
    const { password: _pw, ...safe } = user
    return { user: safe as AuthUser }
  })

  app.decorate(
    'authenticate',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const creds = parseBasic(req.headers.authorization)
      if (!creds) return reply.code(401).send({ error: 'invalid_credentials' })
      const result = await app.verifyCredentials(creds.login, creds.password)
      if ('error' in result) return reply.code(401).send({ error: result.error })
      req.user = result.user
    },
  )
})

declare module 'fastify' {
  interface FastifyInstance {
    verifyCredentials(
      login: string,
      password: string,
    ): Promise<{ user: AuthUser } | { error: 'invalid_credentials' | 'inactive' }>
    authenticate(req: FastifyRequest, reply: FastifyReply): Promise<unknown>
  }
  interface FastifyRequest {
    user: AuthUser
  }
}
```

`server/src/routes/login.ts`:

```ts
import type { FastifyInstance } from 'fastify'
import { Type } from '@sinclair/typebox'

export async function loginRoutes(app: FastifyInstance) {
  app.post(
    '/api/login',
    {
      schema: {
        body: Type.Object({
          login: Type.String({ minLength: 1 }),
          password: Type.String({ minLength: 1 }),
        }),
      },
    },
    async (req, reply) => {
      const { login, password } = req.body as { login: string; password: string }
      const result = await app.verifyCredentials(login, password)
      if ('error' in result) return reply.code(401).send({ error: result.error })
      const { id, name, role } = result.user
      return { id, name, login: result.user.login, role }
    },
  )
}
```

В `server/src/app.ts` после регистрации cors:

```ts
import { authPlugin } from './plugins/auth.js'
import { loginRoutes } from './routes/login.js'
// внутри buildApp:
app.register(authPlugin)
app.register(loginRoutes)
```

- [ ] **Step 5: Тесты зелёные**

Run: `npx vitest run -r server`
Expected: PASS (все группы auth + прежние)

- [ ] **Step 6: Commit**

```powershell
git add server/src server/test/auth.spec.ts server/package.json package-lock.json
git commit -m "feat(server): basic-auth plugin and POST /api/login"
```

---

### Task 3: API-клиент и стор auth (web)

**Files:**
- Create: `web/src/api/client.ts`
- Create: `web/src/stores/auth.ts`

- [ ] **Step 1: Клиент**

`web/src/api/client.ts`:

```ts
const BASE = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code)
  }
}

export interface Creds {
  login: string
  password: string
}

let creds: Creds | null = null
export function setCreds(c: Creds | null) {
  creds = c
}

export async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  if (creds) headers.Authorization = 'Basic ' + btoa(`${creds.login}:${creds.password}`)
  const res = await fetch(BASE + path, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
  if (!res.ok) {
    let code = 'error'
    try {
      code = (await res.json()).error ?? 'error'
    } catch {
      /* тело не JSON */
    }
    throw new ApiError(res.status, code)
  }
  return res.json() as Promise<T>
}
```

- [ ] **Step 2: Стор**

`web/src/stores/auth.ts`:

```ts
import { defineStore } from 'pinia'
import { api, setCreds, type Creds } from '../api/client.js'

export const AUTH_KEY = 'aiTrackerAuth'

export interface Profile {
  id: string
  name: string
  login: string
  role: 'dev' | 'lead' | 'admin' | 'observer'
}

export const useAuth = defineStore('auth', {
  state: () => ({ user: null as Profile | null }),
  actions: {
    async login(login: string, password: string) {
      const creds: Creds = { login, password }
      setCreds(creds)
      try {
        this.user = await api<Profile>('/api/login', {
          method: 'POST',
          body: creds,
        })
      } catch (e) {
        setCreds(null)
        throw e
      }
      localStorage.setItem(AUTH_KEY, JSON.stringify(creds))
    },
    // Автовход (ТЗ §3.1): сохранённая связка → сразу в приложение.
    // Деактивированный участник автовход не проходит — связка стирается.
    async tryAutoLogin() {
      const raw = localStorage.getItem(AUTH_KEY)
      if (!raw) return
      try {
        const c = JSON.parse(raw) as Creds
        await this.login(c.login, c.password)
      } catch {
        localStorage.removeItem(AUTH_KEY)
        setCreds(null)
      }
    },
    logout() {
      localStorage.removeItem(AUTH_KEY)
      setCreds(null)
      this.user = null
    },
  },
})
```

- [ ] **Step 3: Commit**

```powershell
git add web/src/api/client.ts web/src/stores/auth.ts
git commit -m "feat(web): api client with basic auth + auth store"
```

---

### Task 4: Навигация по ролям (TDD) и роутер

**Files:**
- Create: `web/src/lib/nav.ts`
- Test: `web/test/nav.spec.ts`
- Create: `web/src/router.ts`
- Create: `web/src/views/QuickEntryView.vue`, `web/src/views/MyEntriesView.vue`, `web/src/views/DashboardView.vue`, `web/src/views/AdminView.vue`, `web/src/views/LoginView.vue` (заглушки; наполняются в планах 05–08 и Task 5)

- [ ] **Step 1: Падающий тест**

`web/test/nav.spec.ts`:

```ts
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
```

- [ ] **Step 2: Убедиться, что падает**

Run: `npx vitest run -r web`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализация**

`web/src/lib/nav.ts`:

```ts
import { canAccessAdmin, canCreateEntry } from './permissions.js'
import type { Role } from './permissions.js'

export interface Tab {
  path: string
  title: string
}

export function tabsFor(role: Role): Tab[] {
  const tabs: Tab[] = []
  if (canCreateEntry(role)) {
    tabs.push({ path: '/', title: 'Быстрый ввод' })
    tabs.push({ path: '/mine', title: 'Мои записи' })
  }
  tabs.push({ path: '/dashboard', title: 'Дашборд' })
  if (canAccessAdmin(role)) tabs.push({ path: '/admin', title: 'Администрирование' })
  return tabs
}

export const defaultRoute = (role: Role) => (role === 'observer' ? '/dashboard' : '/')
```

`web/src/lib/permissions.ts` — копия серверного модуля (единственное дублирование, меняются синхронно):

```ts
export type Role = 'dev' | 'lead' | 'admin' | 'observer'

export const canCreateEntry = (r: Role) => r !== 'observer'
export const canViewDashboard = (_r: Role) => true
export const canExportCsv = (r: Role) => r === 'lead' || r === 'admin' || r === 'observer'
export const canAccessAdmin = (r: Role) => r === 'lead' || r === 'admin'
```

- [ ] **Step 4: Тесты зелёные**

Run: `npx vitest run -r web`
Expected: PASS

- [ ] **Step 5: Роутер и заглушки**

Каждая заглушка (`QuickEntryView.vue`, `MyEntriesView.vue`, `DashboardView.vue`, `AdminView.vue`) до своего плана выглядит так (подставить свой заголовок):

```vue
<template>
  <div class="p-(--space-8)"><h1>Быстрый ввод</h1></div>
</template>
```

`web/src/router.ts`:

```ts
import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from './stores/auth.js'
import { defaultRoute } from './lib/nav.js'
import LoginView from './views/LoginView.vue'
import QuickEntryView from './views/QuickEntryView.vue'
import MyEntriesView from './views/MyEntriesView.vue'
import DashboardView from './views/DashboardView.vue'
import AdminView from './views/AdminView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginView, meta: { public: true } },
    { path: '/', component: QuickEntryView },
    { path: '/mine', component: MyEntriesView },
    { path: '/dashboard', component: DashboardView },
    // /admin доступен по URL любой роли: сама вью показывает плашку
    // «экран недоступен для вашей роли» (ТЗ §3.5)
    { path: '/admin', component: AdminView },
  ],
})

router.beforeEach((to) => {
  const auth = useAuth()
  if (!auth.user && !to.meta.public) return '/login'
  if (auth.user && to.path === '/login') return defaultRoute(auth.user.role)
  // observer не имеет быстрого ввода и «моих записей»
  if (auth.user?.role === 'observer' && (to.path === '/' || to.path === '/mine'))
    return '/dashboard'
})
```

`web/src/main.ts` — подключить роутер и автовход до монтирования (заменить блок создания приложения):

```ts
import { router } from './router.js'
import { useAuth } from './stores/auth.js'

const app = createApp(App)
app.use(createPinia())
app.use(PrimeVue, {
  theme: { preset: CleverVibePreset, options: { darkModeSelector: '[data-dark]' } },
})
app.use(ToastService)
app.use(router)

// Автовход до монтирования — без мигания формы входа (ТЗ §3.1)
await useAuth().tryAutoLogin()
app.mount('#app')
```

(`await` на верхнем уровне работает: Vite собирает ESM.)

- [ ] **Step 6: Commit**

```powershell
git add web/src web/test/nav.spec.ts
git commit -m "feat(web): router with role-aware guards and nav tabs (TDD)"
```

---

### Task 5: Экран входа и шапка

**Files:**
- Create: `web/src/views/LoginView.vue` (заменить заглушку)
- Create: `web/src/components/AppHeader.vue`
- Modify: `web/src/App.vue`

- [ ] **Step 1: LoginView**

Дизайн — `docs/design/README.md`, раздел «1. Вход»: карточка 360px по центру, точка-акцент, подпись, ошибки цветом `--bad`. Демо-доступы из прототипа не переносим (они прототипные).

`web/src/views/LoginView.vue`:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../stores/auth.js'
import { defaultRoute } from '../lib/nav.js'
import { ApiError } from '../api/client.js'
import ThemeSelect from '../components/ThemeSelect.vue'

const auth = useAuth()
const router = useRouter()
const login = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  if (!login.value || !password.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    await auth.login(login.value, password.value)
    router.push(defaultRoute(auth.user!.role))
  } catch (e) {
    error.value =
      e instanceof ApiError && e.code === 'inactive'
        ? 'Участник деактивирован'
        : 'Неверный логин или пароль'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="min-h-full flex flex-col items-center justify-center gap-(--space-6)">
    <div class="card flex flex-col gap-(--space-4)" style="width: 360px">
      <div class="flex items-center gap-(--space-3)">
        <span
          style="
            width: 9px; height: 9px; border-radius: 50%;
            background: var(--color-accent);
            box-shadow: 0 0 8px var(--color-accent);
          "
        />
        <span style="font-weight: 500">Clever Vibe</span>
      </div>
      <h1>Вход</h1>
      <p class="meta">Логин и пароль выдаёт тимлид при создании участника</p>
      <form class="flex flex-col gap-(--space-4)" @submit.prevent="submit">
        <label class="flex flex-col gap-(--space-2)">
          <span class="section-label">Логин</span>
          <input v-model.trim="login" class="input" autocomplete="username" />
        </label>
        <label class="flex flex-col gap-(--space-2)">
          <span class="section-label">Пароль</span>
          <input
            v-model="password"
            type="password"
            class="input"
            autocomplete="current-password"
          />
        </label>
        <p
          v-if="error"
          class="flex items-center gap-(--space-2)"
          style="color: var(--bad); font-size: 12.5px"
        >
          <i class="pi pi-exclamation-triangle" /> {{ error }}
        </p>
        <button
          type="submit"
          class="btn w-full justify-center"
          :class="login && password ? 'btn-accent' : ''"
          :disabled="!login || !password || busy"
        >
          Войти
        </button>
      </form>
    </div>
    <ThemeSelect />
  </div>
</template>
```

- [ ] **Step 2: AppHeader**

Дизайн — `docs/design/README.md`, раздел «2. Шапка»: sticky 58px, полупрозрачный фон с blur, табы, справа тема/пользователь/выход.

`web/src/components/AppHeader.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../stores/auth.js'
import { tabsFor } from '../lib/nav.js'
import ThemeSelect from './ThemeSelect.vue'

const auth = useAuth()
const router = useRouter()
const tabs = computed(() => (auth.user ? tabsFor(auth.user.role) : []))

const ROLE_TITLES = { dev: 'разработчик', lead: 'тимлид', admin: 'админ', observer: 'наблюдатель' }

function logout() {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <header
    class="sticky top-0 z-10 flex items-center gap-(--space-6) px-(--space-8)"
    style="
      height: 58px;
      background: color-mix(in srgb, var(--color-bg) 92%, transparent);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--color-neutral-800);
    "
  >
    <div class="flex items-center gap-(--space-3)">
      <span
        style="
          width: 9px; height: 9px; border-radius: 50%;
          background: var(--color-accent);
          box-shadow: 0 0 8px var(--color-accent);
        "
      />
      <span style="font-weight: 500">Clever Vibe</span>
      <span
        class="meta"
        style="
          border: 1px solid var(--color-neutral-800);
          border-radius: var(--radius-sm);
          padding: 1px var(--space-2);
          font-size: 10.5px;
        "
        >FE / Angular</span
      >
    </div>
    <nav class="flex items-center gap-(--space-1)">
      <RouterLink
        v-for="t in tabs"
        :key="t.path"
        :to="t.path"
        class="px-(--space-4) py-(--space-2)"
        style="border-radius: var(--radius-md); color: var(--color-neutral-400); font-size: 13px"
        :style="
          $route.path === t.path
            ? { background: 'var(--color-neutral-900)', color: 'var(--color-text)' }
            : {}
        "
        >{{ t.title }}</RouterLink
      >
    </nav>
    <div class="ml-auto flex items-center gap-(--space-4)">
      <ThemeSelect />
      <span class="meta" v-if="auth.user">
        {{ auth.user.name }} · {{ ROLE_TITLES[auth.user.role] }}
      </span>
      <button class="btn btn-secondary" title="Выйти" @click="logout">
        <i class="pi pi-sign-out" />
      </button>
    </div>
  </header>
</template>
```

- [ ] **Step 3: App.vue**

`web/src/App.vue` (заменить целиком — проба токенов из плана 02 больше не нужна):

```vue
<script setup lang="ts">
import { useAuth } from './stores/auth.js'
import AppHeader from './components/AppHeader.vue'

const auth = useAuth()
</script>

<template>
  <div class="min-h-full flex flex-col">
    <AppHeader v-if="auth.user" />
    <main class="flex-1">
      <RouterView />
    </main>
  </div>
</template>
```

Обновить `web/test/smoke.spec.ts` — App теперь требует Pinia и роутер; проще проверять LoginView:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import LoginView from '../src/views/LoginView.vue'

describe('LoginView', () => {
  it('кнопка неактивна при пустых полях', () => {
    const w = mount(LoginView, {
      global: {
        plugins: [createPinia()],
        stubs: { RouterLink: true },
        mocks: { $router: { push: () => {} } },
      },
    })
    expect(w.find('button[type="submit"]').attributes('disabled')).toBeDefined()
  })
})
```

- [ ] **Step 4: Проверка в браузере (полный цикл ТЗ §3.1)**

Запустить `npm run dev:server` и `npm run dev:web`:
1. Открыть http://localhost:5173 → редирект на `/login`.
2. Войти админом из сида (`ADMIN_LOGIN`/`ADMIN_PASSWORD` из `server/.env`) → шапка, табы «Быстрый ввод / Мои записи / Дашборд / Администрирование».
3. Перезагрузить страницу → автовход без формы.
4. Неверный пароль → «Неверный логин или пароль» цветом `--bad`.
5. В `prisma studio` поставить админу `active = false` → перезагрузка → форма входа; попытка входа → «Участник деактивирован». Вернуть `active = true`.
6. «Выйти» → форма входа, `localStorage['aiTrackerAuth']` пуст.

- [ ] **Step 5: Прогнать тесты**

Run: `npx vitest run -r web`
Expected: PASS

- [ ] **Step 6: Commit**

```powershell
git add web/src web/test
git commit -m "feat(web): login screen, auto-login, app header with role tabs"
```

---

## Критерий готовности модуля

- Вход/автовход/выход работают, деактивированный не проходит нигде.
- Права заданы одной матрицей на сервере (`permissions.ts`) и продублированы для UI.
- Табы и стартовый маршрут зависят от роли; `/admin` по прямому URL отдаёт вью (плашка — в плане 07).
