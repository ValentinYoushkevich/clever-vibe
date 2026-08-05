import { describe, it, expect } from 'vitest'
import { buildApp } from '../src/app.js'

describe('app', () => {
  it('отвечает на /api/health', async () => {
    const app = buildApp({ prisma: null as never })
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
  })
})
