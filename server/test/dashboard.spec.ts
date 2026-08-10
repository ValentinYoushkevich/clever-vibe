import { describe, it, expect } from 'vitest'
import { buildApp } from '../src/app.js'

const users = [
  { id: 'u1', name: 'Дев', login: 'dev', password: 'p', role: 'dev', active: true, createdById: null },
  { id: 'u9', name: 'Наб', login: 'obs', password: 'p', role: 'observer', active: true, createdById: null },
]
const stage = { id: 's1', code: 'code', title: 'Написание кода', order: 3, active: true }
const approach = { id: 'a1', code: 'x', stageId: 's1', title: 'Автокомплит', description: null, order: 1, active: true, isCustom: false }
const tool = { id: 't1', code: 'copilot', title: 'Copilot', active: true }
const entries = [
  {
    id: 'e1', userId: 'u1', createdAt: new Date('2026-08-10T10:00:00Z'), stageId: 's1',
    approachId: 'a1', customApproachText: null, taskRef: null, toolId: 't1',
    usefulness: 4, trust: 3, note: 'секретная заметка', deletedAt: null,
    stage, approach, tool, user: users[0],
  },
]

const fakePrisma = {
  user: {
    findUnique: async ({ where }: never) => users.find((u) => u.login === (where as { login: string }).login) ?? null,
    findMany: async () => users,
    count: async () => 2,
  },
  stage: { findMany: async () => [stage] },
  entry: { findMany: async () => entries },
} as never

const auth = (login: string) => ({
  authorization: 'Basic ' + Buffer.from(`${login}:p`).toString('base64'),
})

describe('GET /api/dashboard', () => {
  it('доступен всем ролям, включая observer', async () => {
    const app = buildApp({ prisma: fakePrisma })
    const res = await app.inject({ url: '/api/dashboard', headers: auth('obs') })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.totalEntries).toBe(1)
    expect(body.approaches[0].n).toBe(1)
    expect(body.stages.length).toBe(1)
    // авторство не покидает бэкенд
    expect(JSON.stringify(body)).not.toContain('u1')
  })
})

describe('GET /api/dashboard/approaches/:id/entries', () => {
  it('записи подхода без автора (ТЗ §3.4)', async () => {
    const app = buildApp({ prisma: fakePrisma })
    const res = await app.inject({ url: '/api/dashboard/approaches/a1/entries', headers: auth('dev') })
    expect(res.statusCode).toBe(200)
    const list = res.json()
    expect(list[0].note).toBe('секретная заметка')
    expect(list[0].userId).toBeUndefined()
    expect(JSON.stringify(list)).not.toContain('"user"')
  })
})

// Прокидывание фильтра проверяем по where: агрегаты считаются из того,
// что вернул findMany, поэтому подмена условия наружу иначе не видна.
describe('фильтр по инструменту', () => {
  function spyPrisma() {
    const wheres: unknown[] = []
    const prisma = {
      ...(fakePrisma as object),
      entry: {
        findMany: async (args: { where: unknown }) => {
          wheres.push(args.where)
          return entries
        },
      },
    } as never
    return { prisma, wheres }
  }

  it('без параметра берёт все инструменты', async () => {
    const { prisma, wheres } = spyPrisma()
    const app = buildApp({ prisma })
    await app.inject({ url: '/api/dashboard', headers: auth('dev') })
    expect(wheres[0]).toEqual({ deletedAt: null })
  })

  it('?tool сужает выборку дашборда', async () => {
    const { prisma, wheres } = spyPrisma()
    const app = buildApp({ prisma })
    const res = await app.inject({ url: '/api/dashboard?tool=codex', headers: auth('dev') })
    expect(res.statusCode).toBe(200)
    expect(wheres[0]).toEqual({ deletedAt: null, tool: { code: 'codex' } })
  })

  it('?tool сужает и записи в шторке подхода', async () => {
    const { prisma, wheres } = spyPrisma()
    const app = buildApp({ prisma })
    await app.inject({ url: '/api/dashboard/approaches/a1/entries?tool=cursor', headers: auth('dev') })
    expect(wheres[0]).toEqual({ deletedAt: null, approachId: 'a1', tool: { code: 'cursor' } })
  })
})
