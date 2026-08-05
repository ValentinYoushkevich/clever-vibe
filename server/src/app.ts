import Fastify from 'fastify'
import cors from '@fastify/cors'

// TODO(план 01): заменить на import type { PrismaClient } from '@prisma/client'
type PrismaClient = unknown

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
