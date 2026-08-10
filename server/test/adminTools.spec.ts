import { describe, it, expect, beforeEach } from 'vitest'
import { buildApp } from '../src/app.js'

type Row = Record<string, unknown> & { id: string; code: string }

const users = [
  { id: 'u1', name: 'Дев', login: 'dev', password: 'p', role: 'dev', active: true, createdById: null },
  { id: 'u2', name: 'Лид', login: 'lead', password: 'p', role: 'lead', active: true, createdById: null },
  { id: 'u3', name: 'Админ', login: 'admin', password: 'p', role: 'admin', active: true, createdById: null },
  { id: 'u4', name: 'Наб', login: 'obs', password: 'p', role: 'observer', active: true, createdById: null },
]

let tools: Row[] = []

const fakePrisma = {
  user: {
    findUnique: async ({ where }: never) =>
      users.find((u) => u.login === (where as { login: string }).login) ?? null,
  },
  tool: {
    findMany: async () => tools.map((t) => ({ ...t, _count: { entries: 0 } })),
    findUnique: async ({ where }: never) =>
      tools.find((t) => t.id === (where as { id: string }).id) ?? null,
    create: async ({ data }: never) => {
      const row = { id: `t${tools.length + 1}`, active: true, ...(data as Row) }
      tools.push(row)
      return row
    },
    update: async ({ where, data }: never) => {
      const row = tools.find((t) => t.id === (where as { id: string }).id)!
      Object.assign(row, data as Row)
      return row
    },
  },
} as never

const auth = (login: string) => ({
  authorization: 'Basic ' + Buffer.from(`${login}:p`).toString('base64'),
})

const post = (login: string, body: unknown) =>
  buildApp({ prisma: fakePrisma }).inject({
    method: 'POST', url: '/api/tools', headers: auth(login), payload: body,
  })

beforeEach(() => {
  tools = [
    { id: 't1', code: 'cursor', title: 'Cursor', active: true },
    { id: 't2', code: 'copilot', title: 'GitHub Copilot', active: false },
  ]
})

describe('POST /api/tools', () => {
  it('лид и админ добавляют инструмент с заданным тегом', async () => {
    for (const [i, who] of ['lead', 'admin'].entries()) {
      const res = await post(who, { title: `Инструмент ${i}`, code: `tag-${i}` })
      expect(res.statusCode).toBe(201)
      expect(res.json().code).toBe(`tag-${i}`)
    }
  })

  it('пустой тег делается из названия — в том числе из кириллицы', async () => {
    const res = await post('lead', { title: 'Копайлот' })
    expect(res.statusCode).toBe(201)
    expect(res.json().code).toBe('kopaylot')
  })

  it('тег приводится к нижнему регистру', async () => {
    const res = await post('lead', { title: 'Windsurf', code: '  WindSurf  ' })
    expect(res.statusCode).toBe(201)
    expect(res.json().code).toBe('windsurf')
  })

  it('занятый тег отклоняется, даже если инструмент выключен', async () => {
    const res = await post('lead', { title: 'Второй копайлот', code: 'copilot' })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('code_taken')
    expect(tools).toHaveLength(2)
  })

  it('тег с пробелами, кириллицей или подчёркиванием отклоняется', async () => {
    for (const code of ['two words', 'копайлот', 'under_score', '-leading']) {
      const res = await post('lead', { title: 'Х', code })
      expect(res.json().error).toBe('bad_code')
    }
  })

  it('dev и observer добавлять не могут', async () => {
    for (const who of ['dev', 'obs']) {
      expect((await post(who, { title: 'Х', code: 'x' })).statusCode).toBe(403)
    }
    expect(tools).toHaveLength(2)
  })
})

describe('PATCH /api/tools/:id', () => {
  it('выключение и обратное включение', async () => {
    const app = buildApp({ prisma: fakePrisma })
    await app.inject({
      method: 'PATCH', url: '/api/tools/t1', headers: auth('lead'), payload: { active: false },
    })
    expect(tools.find((t) => t.id === 't1')!.active).toBe(false)
    await app.inject({
      method: 'PATCH', url: '/api/tools/t2', headers: auth('admin'), payload: { active: true },
    })
    expect(tools.find((t) => t.id === 't2')!.active).toBe(true)
  })

  it('dev не может, несуществующий — 404', async () => {
    const app = buildApp({ prisma: fakePrisma })
    const no = await app.inject({
      method: 'PATCH', url: '/api/tools/t1', headers: auth('dev'), payload: { active: false },
    })
    expect(no.statusCode).toBe(403)
    const missing = await app.inject({
      method: 'PATCH', url: '/api/tools/nope', headers: auth('lead'), payload: { active: false },
    })
    expect(missing.statusCode).toBe(404)
  })
})

describe('GET /api/admin/tools', () => {
  it('отдаёт и выключенные — иначе занятый тег выглядит свободным', async () => {
    const app = buildApp({ prisma: fakePrisma })
    const res = await app.inject({ url: '/api/admin/tools', headers: auth('lead') })
    expect(res.statusCode).toBe(200)
    expect(res.json().map((t: Row) => t.code)).toEqual(['cursor', 'copilot'])
  })

  it('dev в справочник не ходит', async () => {
    const app = buildApp({ prisma: fakePrisma })
    expect((await app.inject({ url: '/api/admin/tools', headers: auth('dev') })).statusCode).toBe(403)
  })
})
