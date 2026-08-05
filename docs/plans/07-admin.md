# 07 · Администрирование и экспорт CSV — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Экран администрирования (`lead`/`admin`): разбор кастомных подходов с промоутом, ведение справочника подходов, создание участников с генерацией логина/пароля, постоянно видимые пароли (в границах ролей), перегенерация, активация/деактивация, экспорт CSV.

**Architecture:** Генерация логина (транслит + суффикс), пароля (8 знаков без похожих символов), группировка кастомных текстов и CSV — чистые модули под TDD. Промоут создаёт подход с `isCustom = true` и `promotedFromText`, затем проставляет `approachId` записям той же стадии с совпадающим нормализованным текстом (`customApproachText` сохраняется — допущение №2 в README планов). В CSV стадия/инструмент — кодами, подход — кодом; удалённые записи не выгружаются (допущение №3).

**Tech Stack:** Fastify, Prisma, node:crypto (randomInt), PrimeVue Dialog.

**Примечание к вехам:** если участников нужно завести до готовности этого модуля — выполнить Task 1–2 отдельно (бэкенд достаточен: создать участников через API), либо вручную в `prisma studio`.

---

### Task 1: Генерация логина и пароля (TDD)

**Files:**
- Create: `server/src/lib/credentials.ts`
- Test: `server/test/credentials.spec.ts`

- [ ] **Step 1: Падающий тест**

`server/test/credentials.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  translit, makeLogin, makePassword, PASSWORD_ALPHABET, slugify, unique,
} from '../src/lib/credentials.js'

describe('translit / makeLogin (ТЗ §2.1: транслит имени, суффикс при коллизии)', () => {
  it('транслитерирует русское имя', () => {
    expect(translit('артём')).toBe('artem')
    expect(translit('юля')).toBe('yulya')
  })
  it('логин — первое слово имени', () => {
    expect(makeLogin('Артём Иванов', new Set())).toBe('artem')
    expect(makeLogin('John Doe', new Set())).toBe('john')
  })
  it('коллизии получают суффиксы 2, 3, …', () => {
    expect(makeLogin('Артём', new Set(['artem']))).toBe('artem2')
    expect(makeLogin('Артём', new Set(['artem', 'artem2']))).toBe('artem3')
  })
  it('пустой транслит → user', () => {
    expect(makeLogin('!!!', new Set())).toBe('user')
  })
})

describe('makePassword (ТЗ §2.1: 8 знаков, без 0/O, 1/l/I)', () => {
  it('алфавит не содержит похожих символов', () => {
    expect(/[0O1lI]/.test(PASSWORD_ALPHABET)).toBe(false)
  })
  it('8 символов из алфавита', () => {
    const pw = makePassword()
    expect(pw).toHaveLength(8)
    for (const ch of pw) expect(PASSWORD_ALPHABET).toContain(ch)
  })
  it('детерминирован при подмене rand', () => {
    expect(makePassword(() => 0)).toBe(PASSWORD_ALPHABET[0].repeat(8))
  })
})

describe('slugify / unique (коды подходов)', () => {
  it('строит код из названия', () => {
    expect(slugify('Генерация тестов')).toBe('generatsiya-testov')
  })
  it('unique добавляет суффикс', () => {
    expect(unique('x', new Set(['x']))).toBe('x2')
  })
})
```

- [ ] **Step 2: Убедиться, что падает**

Run: `npx vitest run -r server` → FAIL

- [ ] **Step 3: Реализация**

`server/src/lib/credentials.ts`:

```ts
import { randomInt } from 'node:crypto'

const RU: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

export function translit(s: string): string {
  return s
    .toLowerCase()
    .split('')
    .map((ch) => RU[ch] ?? (/[a-z0-9]/.test(ch) ? ch : ''))
    .join('')
}

export function unique(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base
  for (let i = 2; ; i++) if (!taken.has(`${base}${i}`)) return `${base}${i}`
}

// Логин: транслит первого слова имени; при коллизии суффикс 2, 3, … (ТЗ §2.1)
export function makeLogin(name: string, taken: Set<string>): string {
  return unique(translit(name.trim().split(/\s+/)[0]) || 'user', taken)
}

// Без 0/O, 1/l/I (ТЗ §2.1)
export const PASSWORD_ALPHABET =
  'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function makePassword(rand: (max: number) => number = randomInt): string {
  return Array.from({ length: 8 }, () => PASSWORD_ALPHABET[rand(PASSWORD_ALPHABET.length)]).join('')
}

export function slugify(title: string): string {
  return (
    title.trim().toLowerCase().split(/\s+/).map(translit).filter(Boolean).join('-').slice(0, 40) ||
    'approach'
  )
}
```

Внимание: в `PASSWORD_ALPHABET` строчные идут без `l` и `o`, заглавные — без `I` и `O` (проверяется тестом).

- [ ] **Step 4: Тесты зелёные + Commit**

Run: `npx vitest run -r server` → PASS

```powershell
git add server/src/lib/credentials.ts server/test/credentials.spec.ts
git commit -m "feat(server): login/password generation (TDD)"
```

---

### Task 2: Роуты пользователей

**Files:**
- Create: `server/src/routes/users.ts`
- Modify: `server/src/app.ts`
- Test: `server/test/users.spec.ts`

- [ ] **Step 1: Падающий тест**

`server/test/users.spec.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { buildApp } from '../src/app.js'

type U = Record<string, unknown> & { id: string; login: string }
let users: U[] = []

const fakePrisma = {
  user: {
    findUnique: async ({ where }: never) =>
      users.find((u) => u.login === (where as U).login || u.id === (where as U).id) ?? null,
    findMany: async () => users,
    create: async ({ data }: never) => {
      const row = { id: `u${users.length + 1}`, active: true, createdAt: new Date(), ...(data as U) }
      users.push(row)
      return row
    },
    update: async ({ where, data }: never) => {
      const row = users.find((u) => u.id === (where as U).id)!
      Object.assign(row, data as U)
      return row
    },
  },
} as never

const auth = (login: string) => ({
  authorization: 'Basic ' + Buffer.from(`${login}:p`).toString('base64'),
})

beforeEach(() => {
  users = [
    { id: 'L1', name: 'Лид', login: 'lead', password: 'p', role: 'lead', active: true, createdById: null },
    { id: 'A1', name: 'Админ', login: 'admin', password: 'p', role: 'admin', active: true, createdById: null },
    { id: 'D1', name: 'Дев', login: 'dev', password: 'p', role: 'dev', active: true, createdById: 'L1' },
    { id: 'D2', name: 'Дев2', login: 'dev2', password: 'p', role: 'dev', active: true, createdById: 'A1' },
  ]
})

describe('POST /api/users', () => {
  it('лид создаёт dev; логин и пароль генерируются', async () => {
    const app = buildApp({ prisma: fakePrisma })
    const res = await app.inject({
      method: 'POST', url: '/api/users', headers: auth('lead'),
      payload: { name: 'Полина', role: 'dev' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.login).toBe('polina')
    expect(body.password).toHaveLength(8)
    expect(users.at(-1)!.createdById).toBe('L1')
  })
  it('лид не может создать lead/admin/observer', async () => {
    const app = buildApp({ prisma: fakePrisma })
    for (const role of ['lead', 'admin', 'observer']) {
      const res = await app.inject({
        method: 'POST', url: '/api/users', headers: auth('lead'),
        payload: { name: 'Х', role },
      })
      expect(res.statusCode).toBe(403)
    }
  })
  it('админ создаёт любую роль; dev — никого', async () => {
    const app = buildApp({ prisma: fakePrisma })
    const ok = await app.inject({
      method: 'POST', url: '/api/users', headers: auth('admin'),
      payload: { name: 'Оля', role: 'observer' },
    })
    expect(ok.statusCode).toBe(201)
    const no = await app.inject({
      method: 'POST', url: '/api/users', headers: auth('dev'),
      payload: { name: 'Х', role: 'dev' },
    })
    expect(no.statusCode).toBe(403)
  })
})

describe('GET /api/users (видимость паролей §2.1.1)', () => {
  it('лид видит пароли только созданных им', async () => {
    const app = buildApp({ prisma: fakePrisma })
    const list = (await app.inject({ url: '/api/users', headers: auth('lead') })).json()
    const byId = Object.fromEntries(list.map((u: U) => [u.id, u]))
    expect(byId.D1.password).toBe('p')
    expect(byId.D2.password).toBeUndefined()
    expect(byId.A1.password).toBeUndefined()
  })
  it('админ видит все пароли', async () => {
    const app = buildApp({ prisma: fakePrisma })
    const list = (await app.inject({ url: '/api/users', headers: auth('admin') })).json()
    expect(list.every((u: U) => typeof u.password === 'string')).toBe(true)
  })
})

describe('PATCH /api/users/:id (деактивация §2.1.1)', () => {
  it('лид деактивирует dev, но не lead', async () => {
    const app = buildApp({ prisma: fakePrisma })
    const ok = await app.inject({
      method: 'PATCH', url: '/api/users/D1', headers: auth('lead'), payload: { active: false },
    })
    expect(ok.statusCode).toBe(200)
    expect(users.find((u) => u.id === 'D1')!.active).toBe(false)
    const no = await app.inject({
      method: 'PATCH', url: '/api/users/L1', headers: auth('lead'), payload: { active: false },
    })
    expect(no.statusCode).toBe(403)
  })
})

describe('POST /api/users/:id/password (перегенерация в границах видимости)', () => {
  it('лид перегенерирует пароль созданного им; чужого — нет', async () => {
    const app = buildApp({ prisma: fakePrisma })
    const ok = await app.inject({ method: 'POST', url: '/api/users/D1/password', headers: auth('lead') })
    expect(ok.statusCode).toBe(200)
    expect(ok.json().password).toHaveLength(8)
    const no = await app.inject({ method: 'POST', url: '/api/users/D2/password', headers: auth('lead') })
    expect(no.statusCode).toBe(403)
  })
})
```

- [ ] **Step 2: Убедиться, что падает**

Run: `npx vitest run -r server` → FAIL (404)

- [ ] **Step 3: Реализация**

`server/src/routes/users.ts`:

```ts
import type { FastifyInstance } from 'fastify'
import { Type } from '@sinclair/typebox'
import {
  canAccessAdmin, canCreateUser, canDeactivateUser, canSeePassword, type Role,
} from '../lib/permissions.js'
import { makeLogin, makePassword } from '../lib/credentials.js'

export async function userRoutes(app: FastifyInstance) {
  const { prisma } = app.deps
  const guard = { preHandler: app.authenticate }

  app.get('/api/users', guard, async (req, reply) => {
    if (!canAccessAdmin(req.user.role)) return reply.code(403).send({ error: 'forbidden' })
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } })
    // Пароль постоянно виден в списке — в границах видимости (ТЗ §3.5)
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      login: u.login,
      role: u.role,
      active: u.active,
      createdById: u.createdById,
      ...(canSeePassword(req.user, u) ? { password: u.password } : {}),
    }))
  })

  app.post(
    '/api/users',
    {
      ...guard,
      schema: {
        body: Type.Object({
          name: Type.String({ minLength: 1, maxLength: 100 }),
          role: Type.Union(
            (['dev', 'lead', 'admin', 'observer'] as const).map((r) => Type.Literal(r)),
          ),
        }),
      },
    },
    async (req, reply) => {
      const body = req.body as { name: string; role: Role }
      if (!canCreateUser(req.user.role, body.role))
        return reply.code(403).send({ error: 'forbidden' })
      const taken = new Set((await prisma.user.findMany()).map((u) => u.login))
      const user = await prisma.user.create({
        data: {
          name: body.name.trim(),
          login: makeLogin(body.name, taken),
          password: makePassword(),
          role: body.role,
          createdById: req.user.id,
        },
      })
      const { id, name, login, password, role } = user
      return reply.code(201).send({ id, name, login, password, role })
    },
  )

  app.patch(
    '/api/users/:id',
    { ...guard, schema: { body: Type.Object({ active: Type.Boolean() }) } },
    async (req, reply) => {
      const target = await prisma.user.findUnique({
        where: { id: (req.params as { id: string }).id },
      })
      if (!target) return reply.code(404).send({ error: 'not_found' })
      if (!canDeactivateUser(req.user.role, target.role))
        return reply.code(403).send({ error: 'forbidden' })
      await prisma.user.update({
        where: { id: target.id },
        data: { active: (req.body as { active: boolean }).active },
      })
      return { ok: true }
    },
  )

  app.post('/api/users/:id/password', guard, async (req, reply) => {
    const target = await prisma.user.findUnique({
      where: { id: (req.params as { id: string }).id },
    })
    if (!target) return reply.code(404).send({ error: 'not_found' })
    if (!canAccessAdmin(req.user.role) || !canSeePassword(req.user, target))
      return reply.code(403).send({ error: 'forbidden' })
    const password = makePassword()
    await prisma.user.update({ where: { id: target.id }, data: { password } })
    return { password }
  })
}
```

В `server/src/app.ts`: `app.register(userRoutes)`.

- [ ] **Step 4: Тесты зелёные + Commit**

Run: `npx vitest run -r server` → PASS

```powershell
git add server/src server/test/users.spec.ts
git commit -m "feat(server): user management routes with visibility bounds"
```

---

### Task 3: Кастомные подходы: группировка (TDD) и роуты справочника

**Files:**
- Create: `server/src/lib/customApproaches.ts`
- Test: `server/test/customApproaches.spec.ts`
- Create: `server/src/routes/adminApproaches.ts`
- Modify: `server/src/app.ts`

- [ ] **Step 1: Падающий тест группировки**

`server/test/customApproaches.spec.ts`:

```ts
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
```

- [ ] **Step 2: Убедиться, что падает**

Run: `npx vitest run -r server` → FAIL

- [ ] **Step 3: Реализация группировки**

`server/src/lib/customApproaches.ts`:

```ts
export const normalizeCustomText = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

export interface CustomEntry {
  customApproachText: string
  createdAt: Date
  stageId: string
  stageTitle: string
  authorName: string
}

export interface CustomGroup {
  text: string
  norm: string
  n: number
  authors: string[]
  firstAt: Date
  lastAt: Date
  stageId: string // самая частая стадия группы — предустановка для промоута
  stageTitle: string
  promoted: boolean
}

export function groupCustom(entries: CustomEntry[], promotedNorms: Set<string>): CustomGroup[] {
  const map = new Map<string, CustomEntry[]>()
  for (const e of entries) {
    const norm = normalizeCustomText(e.customApproachText)
    if (!map.has(norm)) map.set(norm, [])
    map.get(norm)!.push(e)
  }
  return [...map.entries()]
    .map(([norm, list]) => {
      const stageCount = new Map<string, number>()
      for (const e of list) stageCount.set(e.stageId, (stageCount.get(e.stageId) ?? 0) + 1)
      const topStage = [...stageCount.entries()].sort((a, b) => b[1] - a[1])[0][0]
      const dates = list.map((e) => e.createdAt.getTime())
      return {
        text: list[0].customApproachText.trim(),
        norm,
        n: list.length,
        authors: [...new Set(list.map((e) => e.authorName))],
        firstAt: new Date(Math.min(...dates)),
        lastAt: new Date(Math.max(...dates)),
        stageId: topStage,
        stageTitle: list.find((e) => e.stageId === topStage)!.stageTitle,
        promoted: promotedNorms.has(norm),
      }
    })
    .sort((a, b) => b.n - a.n)
}
```

- [ ] **Step 4: Тесты зелёные, затем роуты**

Run: `npx vitest run -r server` → PASS

`server/src/routes/adminApproaches.ts`:

```ts
import type { FastifyInstance } from 'fastify'
import { Type } from '@sinclair/typebox'
import { canManageApproaches } from '../lib/permissions.js'
import { slugify, unique } from '../lib/credentials.js'
import { groupCustom, normalizeCustomText } from '../lib/customApproaches.js'

export async function adminApproachRoutes(app: FastifyInstance) {
  const { prisma } = app.deps
  const guard = { preHandler: app.authenticate }

  const forbidden = (reply: { code: (n: number) => { send: (b: unknown) => unknown } }) =>
    reply.code(403).send({ error: 'forbidden' })

  // Справочник целиком (включая неактивные) с N по каждому подходу
  app.get('/api/admin/approaches', guard, async (req, reply) => {
    if (!canManageApproaches(req.user.role)) return forbidden(reply)
    const list = await prisma.approach.findMany({
      orderBy: { order: 'asc' },
      include: {
        stage: true,
        _count: { select: { entries: { where: { deletedAt: null } } } },
      },
    })
    return list.map((a) => ({
      id: a.id, code: a.code, title: a.title, stageId: a.stageId,
      stageTitle: a.stage.title, active: a.active, isCustom: a.isCustom,
      n: a._count.entries,
    }))
  })

  app.post(
    '/api/approaches',
    {
      ...guard,
      schema: {
        body: Type.Object({
          stageId: Type.String(),
          title: Type.String({ minLength: 1, maxLength: 200 }),
        }),
      },
    },
    async (req, reply) => {
      if (!canManageApproaches(req.user.role)) return forbidden(reply)
      const body = req.body as { stageId: string; title: string }
      const stage = await prisma.stage.findUnique({ where: { id: body.stageId } })
      if (!stage) return reply.code(400).send({ error: 'bad_stage' })
      const codes = new Set((await prisma.approach.findMany()).map((a) => a.code))
      const maxOrder = Math.max(0, ...(await prisma.approach.findMany()).map((a) => a.order))
      const approach = await prisma.approach.create({
        data: {
          code: unique(slugify(body.title), codes),
          stageId: body.stageId,
          title: body.title.trim(),
          order: maxOrder + 1,
        },
      })
      return reply.code(201).send(approach)
    },
  )

  app.patch(
    '/api/approaches/:id',
    { ...guard, schema: { body: Type.Object({ active: Type.Boolean() }) } },
    async (req, reply) => {
      if (!canManageApproaches(req.user.role)) return forbidden(reply)
      const id = (req.params as { id: string }).id
      const found = await prisma.approach.findUnique({ where: { id } })
      if (!found) return reply.code(404).send({ error: 'not_found' })
      await prisma.approach.update({
        where: { id },
        data: { active: (req.body as { active: boolean }).active },
      })
      return { ok: true }
    },
  )

  // Кастомные подходы на разбор: авторство показывается — это рабочий
  // инструмент ведения справочника, а не оценка людей (ТЗ §3.5)
  app.get('/api/custom-approaches', guard, async (req, reply) => {
    if (!canManageApproaches(req.user.role)) return forbidden(reply)
    const entries = await prisma.entry.findMany({
      where: { customApproachText: { not: null }, deletedAt: null },
      include: { user: true, stage: true },
    })
    const promoted = await prisma.approach.findMany({ where: { promotedFromText: { not: null } } })
    return groupCustom(
      entries.map((e) => ({
        customApproachText: e.customApproachText!,
        createdAt: e.createdAt,
        stageId: e.stageId,
        stageTitle: e.stage.title,
        authorName: e.user.name,
      })),
      new Set(promoted.map((a) => a.promotedFromText!)),
    )
  })

  app.post(
    '/api/approaches/promote',
    {
      ...guard,
      schema: {
        body: Type.Object({
          text: Type.String({ minLength: 1 }),
          stageId: Type.String(),
          title: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
        }),
      },
    },
    async (req, reply) => {
      if (!canManageApproaches(req.user.role)) return forbidden(reply)
      const body = req.body as { text: string; stageId: string; title?: string }
      const norm = normalizeCustomText(body.text)
      const title = (body.title ?? body.text).trim()
      const codes = new Set((await prisma.approach.findMany()).map((a) => a.code))
      const maxOrder = Math.max(0, ...(await prisma.approach.findMany()).map((a) => a.order))
      const approach = await prisma.approach.create({
        data: {
          code: unique(slugify(title), codes),
          stageId: body.stageId,
          title,
          order: maxOrder + 1,
          isCustom: true,
          promotedFromText: norm,
        },
      })
      // Бэкфил: записи той же стадии с совпадающим нормализованным текстом
      // получают approachId; customApproachText остаётся для истории и CSV
      const candidates = await prisma.entry.findMany({
        where: { stageId: body.stageId, customApproachText: { not: null }, approachId: null },
      })
      const ids = candidates
        .filter((e) => normalizeCustomText(e.customApproachText!) === norm)
        .map((e) => e.id)
      if (ids.length)
        await prisma.entry.updateMany({
          where: { id: { in: ids } },
          data: { approachId: approach.id },
        })
      return reply.code(201).send({ approach, backfilled: ids.length })
    },
  )
}
```

В `server/src/app.ts`: `app.register(adminApproachRoutes)`.

Run: `npx vitest run -r server` → PASS (существующие тесты не задеты)

- [ ] **Step 5: Commit**

```powershell
git add server/src server/test/customApproaches.spec.ts
git commit -m "feat(server): approach directory admin + custom approach promote"
```

---

### Task 4: CSV (TDD) и роут экспорта

**Files:**
- Create: `server/src/lib/csv.ts`
- Test: `server/test/csv.spec.ts`
- Create: `server/src/routes/exportCsv.ts`
- Modify: `server/src/app.ts`

- [ ] **Step 1: Падающий тест**

`server/test/csv.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { csvEscape, entriesToCsv, CSV_HEADER } from '../src/lib/csv.js'

describe('csv (ТЗ §3.5: id,userId,createdAt,stage,approach,customApproachText,taskRef,tool,usefulness,trust,note)', () => {
  it('заголовок точно по ТЗ', () => {
    expect(CSV_HEADER.join(',')).toBe(
      'id,userId,createdAt,stage,approach,customApproachText,taskRef,tool,usefulness,trust,note',
    )
  })
  it('экранирует кавычки, запятые и переводы строк', () => {
    expect(csvEscape('a,b')).toBe('"a,b"')
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""')
    expect(csvEscape('x\ny')).toBe('"x\ny"')
    expect(csvEscape(null)).toBe('')
    expect(csvEscape(4)).toBe('4')
  })
  it('строит строки записей', () => {
    const csv = entriesToCsv([
      {
        id: 'e1', userId: 'u1', createdAt: new Date('2026-08-10T10:00:00Z'),
        stageCode: 'code', approachCode: 'cd-autocomplete', customApproachText: null,
        taskRef: 'FE-1042', toolCode: 'copilot', usefulness: 4, trust: 3, note: 'ок, но с правками',
      },
    ])
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe(CSV_HEADER.join(','))
    expect(lines[1]).toBe(
      'e1,u1,2026-08-10T10:00:00.000Z,code,cd-autocomplete,,FE-1042,copilot,4,3,"ок, но с правками"',
    )
  })
})
```

- [ ] **Step 2: Убедиться, что падает**

Run: `npx vitest run -r server` → FAIL

- [ ] **Step 3: Реализация**

`server/src/lib/csv.ts`:

```ts
export const CSV_HEADER = [
  'id', 'userId', 'createdAt', 'stage', 'approach', 'customApproachText',
  'taskRef', 'tool', 'usefulness', 'trust', 'note',
]

export function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export interface CsvEntry {
  id: string
  userId: string
  createdAt: Date
  stageCode: string
  approachCode: string | null
  customApproachText: string | null
  taskRef: string | null
  toolCode: string
  usefulness: number
  trust: number
  note: string | null
}

export function entriesToCsv(rows: CsvEntry[]): string {
  const lines = [CSV_HEADER.join(',')]
  for (const r of rows)
    lines.push(
      [
        r.id, r.userId, r.createdAt.toISOString(), r.stageCode, r.approachCode,
        r.customApproachText, r.taskRef, r.toolCode, r.usefulness, r.trust, r.note,
      ]
        .map(csvEscape)
        .join(','),
    )
  return lines.join('\r\n')
}
```

`server/src/routes/exportCsv.ts`:

```ts
import type { FastifyInstance } from 'fastify'
import { canExportCsv } from '../lib/permissions.js'
import { entriesToCsv } from '../lib/csv.js'

export async function exportRoutes(app: FastifyInstance) {
  app.get('/api/export.csv', { preHandler: app.authenticate }, async (req, reply) => {
    if (!canExportCsv(req.user.role)) return reply.code(403).send({ error: 'forbidden' })
    const entries = await app.deps.prisma.entry.findMany({
      where: { deletedAt: null }, // допущение №3: удалённые не выгружаются
      include: { stage: true, approach: true, tool: true },
      orderBy: { createdAt: 'asc' },
    })
    const csv = entriesToCsv(
      entries.map((e) => ({
        id: e.id, userId: e.userId, createdAt: e.createdAt, stageCode: e.stage.code,
        approachCode: e.approach?.code ?? null, customApproachText: e.customApproachText,
        taskRef: e.taskRef, toolCode: e.tool.code, usefulness: e.usefulness,
        trust: e.trust, note: e.note,
      })),
    )
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', 'attachment; filename="clever-vibe-entries.csv"')
      .send('﻿' + csv) // BOM — для корректной кириллицы в Excel
  })
}
```

В `server/src/app.ts`: `app.register(exportRoutes)`.

- [ ] **Step 4: Тесты зелёные + Commit**

Run: `npx vitest run -r server` → PASS

```powershell
git add server/src server/test/csv.spec.ts
git commit -m "feat(server): csv export with escaping (TDD)"
```

---

### Task 5: Экран администрирования

**Files:**
- Modify: `web/src/views/AdminView.vue` (заменить заглушку целиком)
- Create: `web/src/components/admin/UsersCard.vue`
- Create: `web/src/components/admin/ApproachesCard.vue`
- Create: `web/src/components/admin/CustomApproachesCard.vue`
- Modify: `web/src/api/client.ts` (экспорт заголовка авторизации)
- Create: `web/src/lib/download.ts`

- [ ] **Step 1: Заголовок авторизации и скачивание**

В `web/src/api/client.ts` добавить экспорт (после `setCreds`):

```ts
export function authHeader(): Record<string, string> {
  return creds ? { Authorization: 'Basic ' + btoa(`${creds.login}:${creds.password}`) } : {}
}
```

`web/src/lib/download.ts`:

```ts
import { authHeader } from '../api/client.js'

const BASE = import.meta.env.VITE_API_URL ?? ''

export async function downloadFile(path: string, filename: string): Promise<void> {
  const res = await fetch(BASE + path, { headers: authHeader() })
  if (!res.ok) throw new Error(`download failed: ${res.status}`)
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 2: Карточка пользователей**

`web/src/components/admin/UsersCard.vue`:

```vue
<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useToast } from 'primevue/usetoast'
import { api } from '../../api/client.js'
import { useAuth } from '../../stores/auth.js'

interface AdminUser {
  id: string
  name: string
  login: string
  role: 'dev' | 'lead' | 'admin' | 'observer'
  active: boolean
  createdById: string | null
  password?: string
}

const auth = useAuth()
const toast = useToast()
const users = ref<AdminUser[]>([])
const showForm = ref(false)
const newName = ref('')
const newRole = ref<AdminUser['role']>('dev')
const created = ref<{ name: string; login: string; password: string; role: string } | null>(null)

// Лид создаёт только dev; админ — все четыре роли (ТЗ §3.5)
const roleOptions = computed(() =>
  auth.user?.role === 'admin' ? (['dev', 'lead', 'admin', 'observer'] as const) : (['dev'] as const),
)
const ROLE_TITLES = { dev: 'разработчик', lead: 'тимлид', admin: 'админ', observer: 'наблюдатель' }

async function load() {
  users.value = await api<AdminUser[]>('/api/users')
}

async function create() {
  if (!newName.value.trim()) return
  created.value = await api('/api/users', {
    method: 'POST',
    body: { name: newName.value.trim(), role: newRole.value },
  })
  showForm.value = false
  newName.value = ''
  toast.add({ severity: 'success', summary: 'Участник создан', life: 2200 })
  await load()
}

async function copy(text: string) {
  await navigator.clipboard.writeText(text)
  toast.add({ severity: 'success', summary: 'Скопировано', life: 2200 })
}

async function toggleActive(u: AdminUser) {
  await api(`/api/users/${u.id}`, { method: 'PATCH', body: { active: !u.active } })
  await load()
}

async function regenerate(u: AdminUser) {
  await api<{ password: string }>(`/api/users/${u.id}/password`, { method: 'POST' })
  toast.add({ severity: 'success', summary: 'Пароль перегенерирован', life: 2200 })
  await load()
}

onMounted(load)
</script>

<template>
  <div class="card flex flex-col gap-(--space-4)">
    <div class="flex items-center gap-(--space-3)">
      <h2>Пользователи</h2>
      <button class="btn btn-secondary ml-auto" @click="showForm = !showForm">
        <i class="pi pi-plus" /> Пользователь
      </button>
    </div>

    <div v-if="showForm" class="flex items-end gap-(--space-3)">
      <label class="flex flex-col gap-(--space-2)" style="flex: 1">
        <span class="section-label">Имя</span>
        <input v-model="newName" class="input" placeholder="Имя Фамилия" />
      </label>
      <label class="flex flex-col gap-(--space-2)" style="width: 160px">
        <span class="section-label">Роль</span>
        <select v-model="newRole" class="input">
          <option v-for="r in roleOptions" :key="r" :value="r">{{ ROLE_TITLES[r] }}</option>
        </select>
      </label>
      <button class="btn btn-accent" :disabled="!newName.trim()" @click="create">Создать</button>
    </div>

    <!-- Выданные доступы — акцентная плашка (дизайн-док §6) -->
    <div
      v-if="created"
      class="flex items-center gap-(--space-3)"
      style="
        background: var(--color-accent-900);
        border: 1px solid var(--color-accent-700);
        border-radius: var(--radius-md);
        padding: var(--space-3) var(--space-4);
        color: var(--color-accent);
      "
    >
      <span>{{ created.name }}: <b class="tnum">{{ created.login }} / {{ created.password }}</b></span>
      <button class="btn btn-secondary" @click="copy(`${created.login} / ${created.password}`)">
        <i class="pi pi-copy" /> Скопировать
      </button>
      <button class="btn btn-secondary" @click="created = null"><i class="pi pi-times" /></button>
    </div>

    <div
      v-for="u in users"
      :key="u.id"
      class="grid items-center gap-(--space-3)"
      style="
        grid-template-columns: minmax(0, 1fr) 110px 150px 170px;
        border-top: 1px solid var(--color-neutral-900);
        padding-top: var(--space-3);
      "
    >
      <div class="flex flex-col">
        <span :style="u.active ? {} : { color: 'var(--color-neutral-600)' }">{{ u.name }}</span>
        <span class="meta tnum">{{ u.login }}</span>
      </div>
      <span class="meta">{{ ROLE_TITLES[u.role] }}</span>
      <div class="flex items-center gap-(--space-2)">
        <template v-if="u.password">
          <span class="meta tnum">{{ u.password }}</span>
          <button class="btn btn-secondary" style="padding: 2px var(--space-2)" @click="copy(u.password!)">
            <i class="pi pi-copy" style="font-size: 11px" />
          </button>
        </template>
        <span v-else class="meta">—</span>
      </div>
      <div class="flex gap-(--space-2) justify-end">
        <button
          v-if="u.password"
          class="btn btn-secondary"
          style="padding: 2px var(--space-3)"
          @click="regenerate(u)"
        >
          Новый пароль
        </button>
        <button class="btn btn-secondary" style="padding: 2px var(--space-3)" @click="toggleActive(u)">
          {{ u.active ? 'Деактивировать' : 'Включить' }}
        </button>
      </div>
    </div>
  </div>
</template>
```

Примечание: кнопки активации/деактивации сервер дополнительно фильтрует по матрице — лид получит 403 на не-dev; в UI можно скрывать кнопку тем же правилом (`u.role === 'dev' || auth.user?.role === 'admin'`).

- [ ] **Step 3: Карточка справочника подходов**

`web/src/components/admin/ApproachesCard.vue`:

```vue
<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { api } from '../../api/client.js'
import { useDictionaries } from '../../stores/dictionaries.js'

interface AdminApproach {
  id: string
  title: string
  stageId: string
  stageTitle: string
  active: boolean
  isCustom: boolean
  n: number
}

const dict = useDictionaries()
const list = ref<AdminApproach[]>([])
const stageFilter = ref('')
const showForm = ref(false)
const newTitle = ref('')
const newStageId = ref('')

const shown = computed(() =>
  stageFilter.value ? list.value.filter((a) => a.stageId === stageFilter.value) : list.value,
)

async function load() {
  list.value = await api<AdminApproach[]>('/api/admin/approaches')
}

async function create() {
  if (!newTitle.value.trim() || !newStageId.value) return
  await api('/api/approaches', {
    method: 'POST',
    body: { stageId: newStageId.value, title: newTitle.value.trim() },
  })
  newTitle.value = ''
  showForm.value = false
  dict.loaded = false // чипсы быстрого ввода перечитают справочник
  await Promise.all([load(), dict.load()])
}

async function toggle(a: AdminApproach) {
  await api(`/api/approaches/${a.id}`, { method: 'PATCH', body: { active: !a.active } })
  dict.loaded = false
  await Promise.all([load(), dict.load()])
}

onMounted(async () => {
  await dict.load()
  await load()
})
</script>

<template>
  <div class="card flex flex-col gap-(--space-4)">
    <div class="flex items-center gap-(--space-3)">
      <h2>Справочник подходов</h2>
      <select v-model="stageFilter" class="input" style="width: 170px">
        <option value="">Все стадии</option>
        <option v-for="s in dict.stages" :key="s.id" :value="s.id">{{ s.title }}</option>
      </select>
      <button class="btn btn-secondary ml-auto" @click="showForm = !showForm">
        <i class="pi pi-plus" /> Подход
      </button>
    </div>

    <div v-if="showForm" class="flex items-end gap-(--space-3)">
      <label class="flex flex-col gap-(--space-2)" style="width: 170px">
        <span class="section-label">Стадия</span>
        <select v-model="newStageId" class="input">
          <option v-for="s in dict.stages" :key="s.id" :value="s.id">{{ s.title }}</option>
        </select>
      </label>
      <label class="flex flex-col gap-(--space-2)" style="flex: 1">
        <span class="section-label">Название</span>
        <input v-model="newTitle" class="input" />
      </label>
      <button class="btn btn-accent" :disabled="!newTitle.trim() || !newStageId" @click="create">
        Добавить
      </button>
    </div>

    <div
      v-for="a in shown"
      :key="a.id"
      class="grid items-center gap-(--space-3)"
      style="
        grid-template-columns: minmax(0, 1fr) 110px 54px 96px;
        border-top: 1px solid var(--color-neutral-900);
        padding-top: var(--space-3);
      "
    >
      <span :style="a.active ? {} : { color: 'var(--color-neutral-600)' }">
        {{ a.title }}
        <span
          v-if="a.isCustom"
          class="meta"
          style="
            border: 1px solid var(--color-accent-700);
            color: var(--color-accent);
            border-radius: var(--radius-sm);
            padding: 0 var(--space-2);
            font-size: 10.5px;
          "
          >custom</span
        >
      </span>
      <span class="meta">{{ a.stageTitle }}</span>
      <span class="meta tnum">{{ a.n }}</span>
      <button class="btn btn-secondary" style="padding: 2px var(--space-3)" @click="toggle(a)">
        {{ a.active ? 'Деактивировать' : 'Включить' }}
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Карточка кастомных подходов**

`web/src/components/admin/CustomApproachesCard.vue`:

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { api } from '../../api/client.js'
import { useDictionaries } from '../../stores/dictionaries.js'
import { fmtDate } from '../../lib/format.js'

interface CustomGroup {
  text: string
  n: number
  authors: string[]
  firstAt: string
  lastAt: string
  stageId: string
  stageTitle: string
  promoted: boolean
}

const dict = useDictionaries()
const toast = useToast()
const groups = ref<CustomGroup[]>([])
const emit = defineEmits<{ (e: 'promoted'): void }>()

async function load() {
  groups.value = await api<CustomGroup[]>('/api/custom-approaches')
}

async function promote(g: CustomGroup) {
  await api('/api/approaches/promote', {
    method: 'POST',
    body: { text: g.text, stageId: g.stageId },
  })
  toast.add({ severity: 'success', summary: 'Подход добавлен в справочник', life: 2200 })
  dict.loaded = false
  await Promise.all([load(), dict.load()])
  emit('promoted')
}

onMounted(load)
</script>

<template>
  <div class="card flex flex-col gap-(--space-4)">
    <h2>Кастомные подходы на разбор</h2>
    <p v-if="!groups.length" class="meta">Предложений нет</p>
    <div
      v-for="g in groups"
      :key="g.text"
      class="grid items-center gap-(--space-3)"
      style="
        grid-template-columns: minmax(0, 1fr) 160px 120px;
        border-top: 1px solid var(--color-neutral-900);
        padding-top: var(--space-3);
      "
    >
      <div class="flex flex-col gap-(--space-1)">
        <span>{{ g.text }}</span>
        <span class="meta">
          {{ g.stageTitle }} · {{ g.authors.join(', ') }} · {{ g.n }} ×
        </span>
      </div>
      <span class="meta tnum">{{ fmtDate(g.firstAt) }} — {{ fmtDate(g.lastAt) }}</span>
      <span v-if="g.promoted" class="meta">В справочнике</span>
      <button v-else class="btn btn-secondary" style="padding: 2px var(--space-3)" @click="promote(g)">
        Промоутить
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 5: Сборка экрана**

`web/src/views/AdminView.vue`:

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useAuth } from '../stores/auth.js'
import { canAccessAdmin } from '../lib/permissions.js'
import { downloadFile } from '../lib/download.js'
import UsersCard from '../components/admin/UsersCard.vue'
import ApproachesCard from '../components/admin/ApproachesCard.vue'
import CustomApproachesCard from '../components/admin/CustomApproachesCard.vue'

const auth = useAuth()
const toast = useToast()
const allowed = computed(() => !!auth.user && canAccessAdmin(auth.user.role))
const approachesKey = ref(0) // перерисовать справочник после промоута

async function exportCsv() {
  await downloadFile('/api/export.csv', 'clever-vibe-entries.csv')
  toast.add({ severity: 'success', summary: 'CSV выгружен', life: 2200 })
}
</script>

<template>
  <div v-if="!allowed" class="p-(--space-8)">
    <div class="card" style="max-width: 420px">
      <p class="meta">Экран недоступен для вашей роли</p>
    </div>
  </div>
  <div v-else class="p-(--space-8) flex flex-col gap-(--space-6)">
    <div class="flex items-center">
      <h1>Администрирование</h1>
      <button class="btn btn-secondary ml-auto" @click="exportCsv">
        <i class="pi pi-download" /> Экспорт CSV
      </button>
    </div>
    <div class="grid gap-(--space-6)" style="grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)">
      <CustomApproachesCard @promoted="approachesKey++" />
      <ApproachesCard :key="approachesKey" />
    </div>
    <UsersCard />
  </div>
</template>
```

- [ ] **Step 6: Проверка в браузере (сценарии ТЗ §3.5)**

1. Войти лидом (создать через API или админом) → на экране три блока и кнопка экспорта.
2. Войти девом → плашка «Экран недоступен для вашей роли» по прямому URL `/admin`; пункта меню нет.
3. «+ Пользователь»: лид видит в селекте только «разработчик»; после «Создать» — акцентная плашка с логином/паролем и копированием; участник в списке, пароль виден постоянно.
4. Войти админом → пароли видны у всех; лидом — только у созданных им.
5. «Новый пароль» меняет пароль; старый перестаёт подходить при входе.
6. Деактивация участника: он не может войти (в т.ч. автовходом); «Включить» возвращает доступ. Лид не может деактивировать лида/админа/наблюдателя (кнопка отвечает 403).
7. Внести запись с «другим подходом» двумя пользователями с одинаковым текстом → в «на разбор» одна группа: текст, авторы, частота, период.
8. «Промоутить» → тост, группа помечена «В справочнике», подход появился в справочнике с бейджем `custom` и в чипсах быстрого ввода; старые записи учитывают его (проверить N в справочнике).
9. «Деактивировать» подход из справочника → пропадает из чипсов быстрого ввода, N в агрегатах сохраняется.
10. «Экспорт CSV» скачивает файл: заголовок по ТЗ, кириллица читается в Excel, удалённых записей нет.

- [ ] **Step 7: Прогнать все тесты**

Run: `npx vitest run -r server; npx vitest run -r web` → PASS

- [ ] **Step 8: Commit**

```powershell
git add web/src
git commit -m "feat(web): admin screen (users, approaches, custom review, csv export)"
```

---

## Критерий готовности модуля

- Полный цикл лида: создать участника → выдать доступы → разобрать кастомные подходы → промоутить → вести справочник → выгрузить CSV.
- Границы видимости паролей и деактивации соблюдены и на бэке (тесты), и в UI.
- CSV со всеми полями по ТЗ, с экранированием и BOM.
