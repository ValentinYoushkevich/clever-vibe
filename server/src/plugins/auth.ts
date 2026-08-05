import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

export interface AuthUser {
  id: string
  name: string
  login: string
  role: 'dev' | 'lead' | 'admin' | 'observer'
  createdById: string | null
}

export function parseBasic(
  header: string | undefined,
): { login: string; password: string } | null {
  if (!header?.startsWith('Basic ')) return null
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8')
  const i = decoded.indexOf(':')
  if (i <= 0) return null
  return { login: decoded.slice(0, i), password: decoded.slice(i + 1) }
}

/**
 * Навешивает декораторы аутентификации синхронно.
 * app.register() отложил бы выполнение плагина до app.ready(), а роуты,
 * объявленные сразу после buildApp(), должны видеть app.authenticate уже сейчас.
 */
export function decorateAuth(app: FastifyInstance) {
  // Проверка пары логин/пароль в открытом виде — осознанное решение ТЗ §2.1
  app.decorate('verifyCredentials', async (login: string, password: string) => {
    const user = await app.deps.prisma.user.findUnique({ where: { login } })
    if (!user || user.password !== password) return { error: 'invalid_credentials' as const }
    if (!user.active) return { error: 'inactive' as const }
    const { password: _pw, ...safe } = user
    return { user: safe as AuthUser }
  })

  app.decorate(
    'authenticate',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const creds = parseBasic(req.headers.authorization)
      if (!creds) return reply.code(401).send({ error: 'invalid_credentials' })
      const result = await app.verifyCredentials(creds.login, creds.password)
      if ('error' in result) return reply.code(401).send({ error: result.error })
      req.user = result.user
    },
  )
}

/** Тот же набор декораторов для регистрации через app.register() (fp снимает инкапсуляцию). */
export const authPlugin = fp(async (app) => {
  decorateAuth(app)
})

declare module 'fastify' {
  interface FastifyInstance {
    verifyCredentials(
      login: string,
      password: string,
    ): Promise<{ user: AuthUser } | { error: 'invalid_credentials' | 'inactive' }>
    authenticate(req: FastifyRequest, reply: FastifyReply): Promise<unknown>
  }
  interface FastifyRequest {
    user: AuthUser
  }
}
