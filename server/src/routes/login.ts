import type { FastifyInstance } from 'fastify'
import { Type } from '@sinclair/typebox'

export async function loginRoutes(app: FastifyInstance) {
  app.post(
    '/api/login',
    {
      schema: {
        body: Type.Object({
          login: Type.String({ minLength: 1 }),
          password: Type.String({ minLength: 1 }),
        }),
      },
    },
    async (req, reply) => {
      const { login, password } = req.body as { login: string; password: string }
      const result = await app.verifyCredentials(login, password)
      if ('error' in result) return reply.code(401).send({ error: result.error })
      const { id, name, role } = result.user
      return { id, name, login: result.user.login, role }
    },
  )
}
