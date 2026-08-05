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
