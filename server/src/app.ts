import Fastify from 'fastify'
import cors from '@fastify/cors'
import type { PrismaClient } from '@prisma/client'

export interface Deps {
  prisma: PrismaClient
}

export function buildApp(deps: Deps) {
  const app = Fastify({ logger: true })
  app.register(cors, { origin: process.env.CORS_ORIGIN ?? true })
  app.decorate('deps', deps)
  app.get('/api/health', async () => ({ ok: true }))
  return app
}

declare module 'fastify' {
  interface FastifyInstance {
    deps: Deps
  }
}
