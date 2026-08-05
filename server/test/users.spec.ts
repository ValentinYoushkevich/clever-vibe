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
