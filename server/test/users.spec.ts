import { describe, it, expect, beforeEach } from 'vitest'
import { buildApp } from '../src/app.js'

type U = Record<string, unknown> & { id: string; login: string }
let users: U[] = []
let entries: { id: string; userId: string }[] = []

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
    updateMany: async ({ where, data }: never) => {
      const w = where as { createdById: string }
      const hit = users.filter((u) => u.createdById === w.createdById)
      hit.forEach((u) => Object.assign(u, data as U))
      return { count: hit.length }
    },
    delete: async ({ where }: never) => {
      const i = users.findIndex((u) => u.id === (where as U).id)
      return users.splice(i, 1)[0]
    },
  },
  entry: {
    deleteMany: async ({ where }: never) => {
      const w = where as { userId: string }
      const before = entries.length
      entries = entries.filter((e) => e.userId !== w.userId)
      return { count: before - entries.length }
    },
  },
  $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(fakePrisma),
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
  entries = [
    { id: 'e1', userId: 'D1' },
    { id: 'e2', userId: 'D1' },
    { id: 'e3', userId: 'D2' },
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

describe('DELETE /api/users/:id (перманентное удаление — только админ)', () => {
  it('админ удаляет участника вместе с его записями', async () => {
    const app = buildApp({ prisma: fakePrisma })
    const res = await app.inject({ method: 'DELETE', url: '/api/users/D1', headers: auth('admin') })
    expect(res.statusCode).toBe(204)
    expect(users.find((u) => u.id === 'D1')).toBeUndefined()
    expect(entries.map((e) => e.id)).toEqual(['e3'])
  })

  it('созданные удалённым участники остаются, ссылка на автора обнуляется', async () => {
    const app = buildApp({ prisma: fakePrisma })
    await app.inject({ method: 'DELETE', url: '/api/users/L1', headers: auth('admin') })
    expect(users.find((u) => u.id === 'D1')!.createdById).toBeNull()
  })

  it('лид и dev удалять не могут', async () => {
    const app = buildApp({ prisma: fakePrisma })
    for (const who of ['lead', 'dev']) {
      const res = await app.inject({ method: 'DELETE', url: '/api/users/D2', headers: auth(who) })
      expect(res.statusCode).toBe(403)
    }
    expect(users.find((u) => u.id === 'D2')).toBeDefined()
  })

  it('себя удалить нельзя', async () => {
    const app = buildApp({ prisma: fakePrisma })
    const res = await app.inject({ method: 'DELETE', url: '/api/users/A1', headers: auth('admin') })
    expect(res.statusCode).toBe(400)
    expect(users.find((u) => u.id === 'A1')).toBeDefined()
  })

  it('несуществующий участник — 404', async () => {
    const app = buildApp({ prisma: fakePrisma })
    const res = await app.inject({ method: 'DELETE', url: '/api/users/nope', headers: auth('admin') })
    expect(res.statusCode).toBe(404)
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
