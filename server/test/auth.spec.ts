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
