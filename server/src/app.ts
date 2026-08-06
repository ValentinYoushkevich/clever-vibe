import Fastify from 'fastify'
import cors from '@fastify/cors'
import type { PrismaClient } from '@prisma/client'
import { decorateAuth } from './plugins/auth.js'
import { loginRoutes } from './routes/login.js'
import { dictionaryRoutes } from './routes/dictionaries.js'
import { entryRoutes } from './routes/entries.js'
import { userRoutes } from './routes/users.js'
import { adminApproachRoutes } from './routes/adminApproaches.js'
import { exportRoutes } from './routes/exportCsv.js'
import { dashboardRoutes } from './routes/dashboard.js'

export interface Deps {
  prisma: PrismaClient
}

export function buildApp(deps: Deps) {
  const app = Fastify({ logger: true })
  // methods задаём явно: по умолчанию плагин разрешает только GET/HEAD/POST,
  // и preflight отклоняет PATCH и DELETE. В проде фронт отдаётся с того же
  // origin и preflight не возникает, поэтому промах виден только в деве.
  app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE'],
  })
  app.decorate('deps', deps)
  decorateAuth(app)
  app.register(loginRoutes)
  app.register(dictionaryRoutes)
  app.register(entryRoutes)
  app.register(userRoutes)
  app.register(adminApproachRoutes)
  app.register(exportRoutes)
  app.register(dashboardRoutes)
  app.get('/api/health', async () => ({ ok: true }))
  return app
}

declare module 'fastify' {
  interface FastifyInstance {
    deps: Deps
  }
}
