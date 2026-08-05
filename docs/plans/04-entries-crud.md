# 04 · CRUD записей и API справочников — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Бэкенд-API: справочники (стадии, подходы, инструменты), создание/чтение/изменение/мягкое удаление записей с правилом «7 дней на правку» и валидацией «подход из справочника либо свободный текст».

**Architecture:** Роуты тонкие; правила — чистые функции (`editWindow.ts`, `entryRules.ts`) под юнит-тестами; роуты тестируются `app.inject()` с in-memory фейком Prisma. Все роуты — за `app.authenticate` (план 03), права — `permissions.ts`.

**Tech Stack:** Fastify + TypeBox, Prisma.

---

### Task 1: Окно редактирования 7 дней (TDD)

**Files:**
- Create: `server/src/lib/editWindow.ts`
- Test: `server/test/editWindow.spec.ts`

- [x] **Step 1: Падающий тест**

`server/test/editWindow.spec.ts`:

```ts
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
```

- [x] **Step 2: Убедиться, что падает**

Run: `npx vitest run -r server`
Expected: FAIL — модуль не найден.

- [x] **Step 3: Реализация**

`server/src/lib/editWindow.ts`:

```ts
export const EDIT_WINDOW_DAYS = 7

export function canModify(createdAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - createdAt.getTime() < EDIT_WINDOW_DAYS * 24 * 60 * 60 * 1000
}
```

- [x] **Step 4: Тесты зелёные + Commit**

Run: `npx vitest run -r server` → PASS

```powershell
git add server/src/lib/editWindow.ts server/test/editWindow.spec.ts
git commit -m "feat(server): 7-day edit window rule (TDD)"
```

---

### Task 2: Правило «подход или свободный текст» (TDD)

**Files:**
- Create: `server/src/lib/entryRules.ts`
- Test: `server/test/entryRules.spec.ts`

- [x] **Step 1: Падающий тест**

`server/test/entryRules.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { approachRuleError } from '../src/lib/entryRules.js'

describe('approachRuleError (ТЗ §2.4: approachId либо customApproachText)', () => {
  it('подход из справочника без текста — ок', () => {
    expect(approachRuleError({ approachId: 'a1' })).toBeNull()
  })
  it('«другой подход» с непустым текстом — ок', () => {
    expect(approachRuleError({ customApproachText: 'свой способ' })).toBeNull()
  })
  it('ни того ни другого — ошибка', () => {
    expect(approachRuleError({})).toBe('approach_required')
  })
  it('пустой/пробельный текст — ошибка', () => {
    expect(approachRuleError({ customApproachText: '   ' })).toBe('approach_required')
  })
  it('и то и другое сразу — ошибка', () => {
    expect(approachRuleError({ approachId: 'a1', customApproachText: 'x' })).toBe(
      'approach_conflict',
    )
  })
})
```

- [x] **Step 2: Убедиться, что падает**

Run: `npx vitest run -r server` → FAIL

- [x] **Step 3: Реализация**

`server/src/lib/entryRules.ts`:

```ts
export interface ApproachFields {
  approachId?: string | null
  customApproachText?: string | null
}

// null — правило соблюдено, иначе код ошибки для ответа 400
export function approachRuleError(f: ApproachFields): string | null {
  const hasApproach = !!f.approachId
  const hasText = !!f.customApproachText?.trim()
  if (hasApproach && hasText) return 'approach_conflict'
  if (!hasApproach && !hasText) return 'approach_required'
  return null
}
```

- [x] **Step 4: Тесты зелёные + Commit**

Run: `npx vitest run -r server` → PASS

```powershell
git add server/src/lib/entryRules.ts server/test/entryRules.spec.ts
git commit -m "feat(server): entry approach-or-text rule (TDD)"
```

---

### Task 3: Роуты справочников

**Files:**
- Create: `server/src/routes/dictionaries.ts`
- Modify: `server/src/app.ts`
- Test: `server/test/dictionaries.spec.ts`

- [x] **Step 1: Падающий тест**

`server/test/dictionaries.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildApp } from '../src/app.js'

const user = { id: 'u1', name: 'А', login: 'a', password: 'p', role: 'dev', active: true, createdById: null }

const fakePrisma = {
  user: { findUnique: async () => user },
  stage: {
    findMany: async (q: { where?: { active?: boolean } }) =>
      q?.where?.active ? [{ id: 's1', code: 'code', title: 'Написание кода', order: 3, active: true }] : [],
  },
  approach: {
    findMany: async () => [
      { id: 'a1', code: 'cd-autocomplete', stageId: 's1', title: 'Автокомплит в IDE', description: null, order: 1, active: true, isCustom: false },
    ],
  },
  tool: {
    findMany: async () => [{ id: 't1', code: 'copilot', title: 'GitHub Copilot', active: true }],
  },
} as never

const auth = { authorization: 'Basic ' + Buffer.from('a:p').toString('base64') }

describe('dictionaries', () => {
  it('отдаёт активные стадии/подходы/инструменты только авторизованным', async () => {
    const app = buildApp({ prisma: fakePrisma })
    for (const url of ['/api/stages', '/api/approaches', '/api/tools']) {
      expect((await app.inject({ url })).statusCode).toBe(401)
      const res = await app.inject({ url, headers: auth })
      expect(res.statusCode).toBe(200)
      expect(res.json().length).toBe(1)
    }
  })
})
```

- [x] **Step 2: Убедиться, что падает**

Run: `npx vitest run -r server` → FAIL (404 вместо 401/200)

- [x] **Step 3: Реализация**

`server/src/routes/dictionaries.ts`:

```ts
import type { FastifyInstance } from 'fastify'

export async function dictionaryRoutes(app: FastifyInstance) {
  const opts = { preHandler: app.authenticate }

  app.get('/api/stages', opts, async () =>
    app.deps.prisma.stage.findMany({ where: { active: true }, orderBy: { order: 'asc' } }),
  )

  app.get('/api/approaches', opts, async () =>
    app.deps.prisma.approach.findMany({ where: { active: true }, orderBy: { order: 'asc' } }),
  )

  app.get('/api/tools', opts, async () =>
    app.deps.prisma.tool.findMany({ where: { active: true }, orderBy: { title: 'asc' } }),
  )
}
```

В `server/src/app.ts`:

```ts
import { dictionaryRoutes } from './routes/dictionaries.js'
// внутри buildApp, после loginRoutes:
app.register(dictionaryRoutes)
```

- [x] **Step 4: Тесты зелёные + Commit**

Run: `npx vitest run -r server` → PASS

```powershell
git add server/src server/test/dictionaries.spec.ts
git commit -m "feat(server): dictionary routes (stages, approaches, tools)"
```

---

### Task 4: Роуты записей

**Files:**
- Create: `server/src/routes/entries.ts`
- Modify: `server/src/app.ts`
- Test: `server/test/entries.spec.ts`

- [x] **Step 1: Падающий тест (in-memory фейк Prisma)**

`server/test/entries.spec.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { buildApp } from '../src/app.js'

const DAY = 24 * 60 * 60 * 1000
type Row = Record<string, unknown> & { id: string }

let entries: Row[] = []
const users = [
  { id: 'u1', name: 'Дев', login: 'dev', password: 'p', role: 'dev', active: true, createdById: null },
  { id: 'u9', name: 'Наблюдатель', login: 'obs', password: 'p', role: 'observer', active: true, createdById: null },
]
const stage = { id: 's1', code: 'code', title: 'Написание кода', order: 3, active: true }
const approach = { id: 'a1', code: 'cd-autocomplete', stageId: 's1', title: 'Автокомплит', description: null, order: 1, active: true, isCustom: false }
const tool = { id: 't1', code: 'copilot', title: 'GitHub Copilot', active: true }

const matches = (row: Row, where: Record<string, unknown>) =>
  Object.entries(where).every(([k, v]) => {
    if (k === 'createdAt' && v && typeof v === 'object') {
      const range = v as { gte?: Date; lt?: Date }
      const t = (row.createdAt as Date).getTime()
      return (!range.gte || t >= range.gte.getTime()) && (!range.lt || t < range.lt.getTime())
    }
    return row[k] === v
  })

const fakePrisma = {
  user: { findUnique: async ({ where }: never) => users.find((u) => u.login === (where as { login: string }).login) ?? null },
  stage: { findUnique: async ({ where }: never) => ((where as Row).id === 's1' ? stage : null) },
  approach: { findUnique: async ({ where }: never) => ((where as Row).id === 'a1' ? approach : null) },
  tool: { findUnique: async ({ where }: never) => ((where as Row).id === 't1' ? tool : null) },
  entry: {
    create: async ({ data }: never) => {
      const row = { id: `e${entries.length + 1}`, createdAt: new Date(), deletedAt: null, ...(data as Row) }
      entries.push(row)
      return row
    },
    findMany: async ({ where }: never) =>
      entries
        .filter((e) => matches(e, where as Row))
        .map((e) => ({ ...e, stage, approach: e.approachId ? approach : null, tool })),
    findUnique: async ({ where }: never) => entries.find((e) => e.id === (where as Row).id) ?? null,
    update: async ({ where, data }: never) => {
      const row = entries.find((e) => e.id === (where as Row).id)!
      Object.assign(row, data as Row)
      return row
    },
  },
} as never

const auth = (login: string) => ({
  authorization: 'Basic ' + Buffer.from(`${login}:p`).toString('base64'),
})
const valid = { stageId: 's1', approachId: 'a1', toolId: 't1', usefulness: 4, trust: 3 }

beforeEach(() => {
  entries = []
})

describe('POST /api/entries', () => {
  it('создаёт запись от текущего пользователя', async () => {
    const app = buildApp({ prisma: fakePrisma })
    const res = await app.inject({ method: 'POST', url: '/api/entries', headers: auth('dev'), payload: valid })
    expect(res.statusCode).toBe(201)
    expect(entries[0].userId).toBe('u1')
  })
  it('observer не может вносить записи (матрица §2.1.1)', async () => {
    const app = buildApp({ prisma: fakePrisma })
    const res = await app.inject({ method: 'POST', url: '/api/entries', headers: auth('obs'), payload: valid })
    expect(res.statusCode).toBe(403)
  })
  it('без подхода и текста → 400 approach_required', async () => {
    const app = buildApp({ prisma: fakePrisma })
    const res = await app.inject({
      method: 'POST', url: '/api/entries', headers: auth('dev'),
      payload: { ...valid, approachId: undefined },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('approach_required')
  })
  it('подход чужой стадии → 400 bad_approach', async () => {
    const app = buildApp({ prisma: fakePrisma })
    const res = await app.inject({
      method: 'POST', url: '/api/entries', headers: auth('dev'),
      payload: { ...valid, stageId: 's1', approachId: 'missing' },
    })
    expect(res.statusCode).toBe(400)
  })
  it('оценка вне 1–5 → 400 (схема)', async () => {
    const app = buildApp({ prisma: fakePrisma })
    const res = await app.inject({
      method: 'POST', url: '/api/entries', headers: auth('dev'),
      payload: { ...valid, usefulness: 6 },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /api/entries', () => {
  it('отдаёт только свои неудалённые, новые сверху, с limit', async () => {
    const app = buildApp({ prisma: fakePrisma })
    for (let i = 0; i < 4; i++)
      await app.inject({ method: 'POST', url: '/api/entries', headers: auth('dev'), payload: valid })
    entries[0].deletedAt = new Date()
    entries[1].userId = 'other'
    const res = await app.inject({ url: '/api/entries?limit=3', headers: auth('dev') })
    expect(res.json().length).toBe(2)
  })
})

describe('PATCH и DELETE /api/entries/:id', () => {
  it('правка своей записи внутри окна работает', async () => {
    const app = buildApp({ prisma: fakePrisma })
    await app.inject({ method: 'POST', url: '/api/entries', headers: auth('dev'), payload: valid })
    const res = await app.inject({
      method: 'PATCH', url: `/api/entries/${entries[0].id}`, headers: auth('dev'),
      payload: { ...valid, usefulness: 5 },
    })
    expect(res.statusCode).toBe(200)
    expect(entries[0].usefulness).toBe(5)
  })
  it('после 7 дней → 403 edit_window_expired', async () => {
    const app = buildApp({ prisma: fakePrisma })
    await app.inject({ method: 'POST', url: '/api/entries', headers: auth('dev'), payload: valid })
    entries[0].createdAt = new Date(Date.now() - 8 * DAY)
    const patch = await app.inject({
      method: 'PATCH', url: `/api/entries/${entries[0].id}`, headers: auth('dev'), payload: valid,
    })
    expect(patch.statusCode).toBe(403)
    const del = await app.inject({
      method: 'DELETE', url: `/api/entries/${entries[0].id}`, headers: auth('dev'),
    })
    expect(del.statusCode).toBe(403)
  })
  it('чужая запись → 404', async () => {
    const app = buildApp({ prisma: fakePrisma })
    await app.inject({ method: 'POST', url: '/api/entries', headers: auth('dev'), payload: valid })
    entries[0].userId = 'other'
    const res = await app.inject({
      method: 'DELETE', url: `/api/entries/${entries[0].id}`, headers: auth('dev'),
    })
    expect(res.statusCode).toBe(404)
  })
  it('удаление ставит deletedAt, физического удаления нет', async () => {
    const app = buildApp({ prisma: fakePrisma })
    await app.inject({ method: 'POST', url: '/api/entries', headers: auth('dev'), payload: valid })
    const res = await app.inject({
      method: 'DELETE', url: `/api/entries/${entries[0].id}`, headers: auth('dev'),
    })
    expect(res.statusCode).toBe(200)
    expect(entries.length).toBe(1)
    expect(entries[0].deletedAt).toBeInstanceOf(Date)
  })
})
```

- [x] **Step 2: Убедиться, что падает**

Run: `npx vitest run -r server` → FAIL (404 на все роуты)

- [x] **Step 3: Реализация**

`server/src/routes/entries.ts`:

```ts
import type { FastifyInstance } from 'fastify'
import { Type } from '@sinclair/typebox'
import { canCreateEntry } from '../lib/permissions.js'
import { approachRuleError } from '../lib/entryRules.js'
import { canModify } from '../lib/editWindow.js'

const EntryBody = Type.Object({
  stageId: Type.String(),
  approachId: Type.Optional(Type.String()),
  customApproachText: Type.Optional(Type.String({ maxLength: 500 })),
  taskRef: Type.Optional(Type.String({ maxLength: 50 })),
  toolId: Type.String(),
  usefulness: Type.Integer({ minimum: 1, maximum: 5 }),
  trust: Type.Integer({ minimum: 1, maximum: 5 }),
  note: Type.Optional(Type.String({ maxLength: 2000 })),
})

interface EntryPayload {
  stageId: string
  approachId?: string
  customApproachText?: string
  taskRef?: string
  toolId: string
  usefulness: number
  trust: number
  note?: string
}

// Диапазон месяца по строке YYYY-MM (границы в UTC — команда в одном поясе)
export function monthRange(month: string): { gte: Date; lt: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  return { gte: new Date(Date.UTC(y, mo, 1)), lt: new Date(Date.UTC(y, mo + 1, 1)) }
}

export async function entryRoutes(app: FastifyInstance) {
  const { prisma } = app.deps

  // Общая валидация тела против БД; null — ок, иначе {code}
  async function validate(body: EntryPayload): Promise<string | null> {
    const ruleError = approachRuleError(body)
    if (ruleError) return ruleError
    const stage = await prisma.stage.findUnique({ where: { id: body.stageId } })
    if (!stage?.active) return 'bad_stage'
    if (body.approachId) {
      const approach = await prisma.approach.findUnique({ where: { id: body.approachId } })
      if (!approach?.active || approach.stageId !== body.stageId) return 'bad_approach'
    }
    const tool = await prisma.tool.findUnique({ where: { id: body.toolId } })
    if (!tool?.active) return 'bad_tool'
    return null
  }

  const toData = (body: EntryPayload) => ({
    stageId: body.stageId,
    approachId: body.approachId ?? null,
    customApproachText: body.customApproachText?.trim() || null,
    taskRef: body.taskRef?.trim() || null,
    toolId: body.toolId,
    usefulness: body.usefulness,
    trust: body.trust,
    note: body.note?.trim() || null,
  })

  app.post(
    '/api/entries',
    { preHandler: app.authenticate, schema: { body: EntryBody } },
    async (req, reply) => {
      if (!canCreateEntry(req.user.role)) return reply.code(403).send({ error: 'forbidden' })
      const body = req.body as EntryPayload
      const error = await validate(body)
      if (error) return reply.code(400).send({ error })
      const entry = await prisma.entry.create({
        data: { userId: req.user.id, ...toData(body) },
      })
      return reply.code(201).send(entry)
    },
  )

  app.get(
    '/api/entries',
    {
      preHandler: app.authenticate,
      schema: {
        querystring: Type.Object({
          month: Type.Optional(Type.String()),
          stageId: Type.Optional(Type.String()),
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000 })),
        }),
      },
    },
    async (req, reply) => {
      if (!canCreateEntry(req.user.role)) return reply.code(403).send({ error: 'forbidden' })
      const q = req.query as { month?: string; stageId?: string; limit?: number }
      const where: Record<string, unknown> = { userId: req.user.id, deletedAt: null }
      if (q.stageId) where.stageId = q.stageId
      if (q.month) {
        const range = monthRange(q.month)
        if (!range) return reply.code(400).send({ error: 'bad_month' })
        where.createdAt = range
      }
      const list = await prisma.entry.findMany({
        where,
        include: { stage: true, approach: true, tool: true },
        orderBy: { createdAt: 'desc' },
        take: q.limit,
      })
      return list
    },
  )

  // Загрузка своей записи внутри окна правки; ошибки едины для PATCH и DELETE
  async function ownEditable(req: { user: { id: string } }, id: string) {
    const entry = await prisma.entry.findUnique({ where: { id } })
    if (!entry || entry.deletedAt || entry.userId !== req.user.id)
      return { status: 404, error: 'not_found' } as const
    if (!canModify(entry.createdAt)) return { status: 403, error: 'edit_window_expired' } as const
    return { entry }
  }

  app.patch(
    '/api/entries/:id',
    { preHandler: app.authenticate, schema: { body: EntryBody } },
    async (req, reply) => {
      const found = await ownEditable(req, (req.params as { id: string }).id)
      if ('error' in found) return reply.code(found.status).send({ error: found.error })
      const body = req.body as EntryPayload
      const error = await validate(body)
      if (error) return reply.code(400).send({ error })
      return prisma.entry.update({ where: { id: found.entry.id }, data: toData(body) })
    },
  )

  app.delete(
    '/api/entries/:id',
    { preHandler: app.authenticate },
    async (req, reply) => {
      const found = await ownEditable(req, (req.params as { id: string }).id)
      if ('error' in found) return reply.code(found.status).send({ error: found.error })
      await prisma.entry.update({
        where: { id: found.entry.id },
        data: { deletedAt: new Date() },
      })
      return { ok: true }
    },
  )
}
```

В `server/src/app.ts`:

```ts
import { entryRoutes } from './routes/entries.js'
// внутри buildApp:
app.register(entryRoutes)
```

Примечание: `buildApp` теперь обращается к `app.deps.prisma` при регистрации `entryRoutes` — фейк в тестах должен передаваться до `inject` (уже так).

- [x] **Step 4: Тесты зелёные**

Run: `npx vitest run -r server`
Expected: PASS (все группы)

- [x] **Step 5: Ручная проверка на реальной БД**

Запустить `npm run dev:server` и (PowerShell; `<login>:<password>` — админ из сида):

```powershell
$auth = 'Basic ' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('admin:change-me'))
$stages = Invoke-RestMethod http://localhost:3000/api/stages -Headers @{Authorization=$auth}
$approaches = Invoke-RestMethod http://localhost:3000/api/approaches -Headers @{Authorization=$auth}
$tools = Invoke-RestMethod http://localhost:3000/api/tools -Headers @{Authorization=$auth}
$body = @{ stageId=$stages[2].id; approachId=($approaches | Where-Object stageId -eq $stages[2].id)[0].id; toolId=$tools[0].id; usefulness=4; trust=3 } | ConvertTo-Json
Invoke-RestMethod http://localhost:3000/api/entries -Method Post -Headers @{Authorization=$auth} -ContentType 'application/json' -Body $body
Invoke-RestMethod 'http://localhost:3000/api/entries?limit=3' -Headers @{Authorization=$auth}
```

Expected: 201 с записью; список из одной записи со stage/approach/tool.

- [x] **Step 6: Commit**

```powershell
git add server/src server/test/entries.spec.ts
git commit -m "feat(server): entries CRUD with 7-day window and soft delete"
```

---

## Критерий готовности модуля

- Все правила ТЗ §2.4/§3.3 покрыты тестами: подход-или-текст, 1–5, 7 дней, `deletedAt`.
- Observer получает 403 на запись; чужие записи невидимы и неизменяемы.
- Справочники отдают только активные позиции в порядке `order`.
