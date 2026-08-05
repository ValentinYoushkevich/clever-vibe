import Fastify from 'fastify'
import cors from '@fastify/cors'
import type { PrismaClient } from '@prisma/client'
import { decorateAuth } from './plugins/auth.js'
import { loginRoutes } from './routes/login.js'
import { dictionaryRoutes } from './routes/dictionaries.js'
import { entryRoutes } from './routes/entries.js'

export interface Deps {
  prisma: PrismaClient
}

export function buildApp(deps: Deps) {
  const app = Fastify({ logger: true })
  app.register(cors, { origin: process.env.CORS_ORIGIN ?? true })
  app.decorate('deps', deps)
  decorateAuth(app)
  app.register(loginRoutes)
  app.register(dictionaryRoutes)
  app.register(entryRoutes)
  app.get('/api/health', async () => ({ ok: true }))
  return app
}

declare module 'fastify' {
  interface FastifyInstance {
    deps: Deps
  }
}
