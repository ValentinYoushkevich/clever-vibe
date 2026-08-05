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
