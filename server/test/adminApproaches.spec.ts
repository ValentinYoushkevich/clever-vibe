import { describe, it, expect, beforeEach } from 'vitest'
import { buildApp } from '../src/app.js'

type Row = Record<string, unknown> & { id: string }

const users = [
  { id: 'u1', name: 'Дев', login: 'dev', password: 'p', role: 'dev', active: true, createdById: null },
  { id: 'u2', name: 'Лид', login: 'lead', password: 'p', role: 'lead', active: true, createdById: null },
]
const stage = { id: 's1', code: 'code', title: 'Написание кода', order: 3, active: true }

let entries: Row[] = []
let approaches: Row[] = []

// Фильтры маршрутов узкие и известные, поэтому фейк разбирает ровно их формы
const matches = (row: Row, where: Record<string, unknown>) =>
  Object.entries(where).every(([k, v]) => {
    if (v && typeof v === 'object' && 'not' in (v as object)) return row[k] !== (v as { not: unknown }).not
    if (v && typeof v === 'object' && 'in' in (v as object))
      return ((v as { in: unknown[] }).in).includes(row[k])
    return row[k] === v
  })

const fakePrisma = {
  user: {
    findUnique: async ({ where }: never) =>
      users.find((u) => u.login === (where as { login: string }).login) ?? null,
  },
  approach: { findMany: async ({ where }: never) => approaches.filter((a) => matches(a, where as Row)) },
  entry: {
    findMany: async ({ where }: never) =>
      entries.filter((e) => matches(e, where as Row)).map((e) => ({
        ...e,
        stage,
        user: users.find((u) => u.id === e.userId),
      })),
    updateMany: async ({ where, data }: never) => {
      const rows = entries.filter((e) => matches(e, where as Row))
      for (const r of rows) Object.assign(r, data as Row)
      return { count: rows.length }
    },
  },
} as never

const auth = (login: string) => ({
  authorization: 'Basic ' + Buffer.from(`${login}:p`).toString('base64'),
})

const entry = (id: string, text: string, over: Partial<Row> = {}): Row => ({
  id,
  userId: 'u1',
  createdAt: new Date('2026-08-01'),
  stageId: 's1',
  approachId: null,
  customApproachText: text,
  deletedAt: null,
  ...over,
})

beforeEach(() => {
  entries = [entry('e1', 'Свой способ'), entry('e2', 'свой  способ'), entry('e3', 'Другое')]
  approaches = []
})

describe('GET /api/custom-approaches', () => {
  it('промоученные не показывает — они уже в справочнике', async () => {
    approaches = [{ id: 'a1', promotedFromText: 'другое' }]
    const app = buildApp({ prisma: fakePrisma })
    const res = await app.inject({ url: '/api/custom-approaches', headers: auth('lead') })
    expect(res.statusCode).toBe(200)
    expect(res.json().map((g: { text: string }) => g.text)).toEqual(['Свой способ'])
  })

  it('dev до списка не допускается', async () => {
    const app = buildApp({ prisma: fakePrisma })
    const res = await app.inject({ url: '/api/custom-approaches', headers: auth('dev') })
    expect(res.statusCode).toBe(403)
  })
})

describe('DELETE /api/custom-approaches', () => {
  it('удаляет группу вместе с её записями, не трогая остальные', async () => {
    const app = buildApp({ prisma: fakePrisma })
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/custom-approaches',
      headers: auth('lead'),
      payload: { text: 'СВОЙ способ' }, // сопоставление по нормализованному тексту
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().deleted).toBe(2)
    expect(entries.filter((e) => e.deletedAt).map((e) => e.id)).toEqual(['e1', 'e2'])
  })

  it('не трогает записи промоученного подхода — у них уже есть approachId', async () => {
    entries = [entry('e1', 'Свой способ', { approachId: 'a1' })]
    const app = buildApp({ prisma: fakePrisma })
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/custom-approaches',
      headers: auth('lead'),
      payload: { text: 'Свой способ' },
    })
    expect(res.statusCode).toBe(404)
    expect(entries[0].deletedAt).toBeNull()
  })

  it('dev удалять не может', async () => {
    const app = buildApp({ prisma: fakePrisma })
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/custom-approaches',
      headers: auth('dev'),
      payload: { text: 'Свой способ' },
    })
    expect(res.statusCode).toBe(403)
    expect(entries.every((e) => !e.deletedAt)).toBe(true)
  })
})
