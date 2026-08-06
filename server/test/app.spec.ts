import { describe, it, expect } from 'vitest'
import { buildApp } from '../src/app.js'

describe('app', () => {
  it('отвечает на /api/health', async () => {
    const app = buildApp({ prisma: null as never })
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
  })

  // Дев-фронт живёт на другом порту, поэтому редактирование и удаление
  // проходят через preflight — с дефолтами плагина он их отклонял
  it('preflight пропускает PATCH и DELETE', async () => {
    const app = buildApp({ prisma: null as never })
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/api/custom-approaches',
      headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'DELETE' },
    })
    const allowed = String(res.headers['access-control-allow-methods']).split(/,\s*/)
    expect(allowed).toContain('DELETE')
    expect(allowed).toContain('PATCH')
  })
})
