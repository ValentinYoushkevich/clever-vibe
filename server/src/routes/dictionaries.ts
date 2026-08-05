import type { FastifyInstance } from 'fastify'

export async function dictionaryRoutes(app: FastifyInstance) {
  const opts = { preHandler: app.authenticate }

  app.get('/api/stages', opts, async () =>
    app.deps.prisma.stage.findMany({ where: { active: true }, orderBy: { order: 'asc' } }),
  )

  app.get('/api/approaches', opts, async () =>
    app.deps.prisma.approach.findMany({ where: { active: true }, orderBy: { order: 'asc' } }),
  )

  app.get('/api/tools', opts, async () =>
    app.deps.prisma.tool.findMany({ where: { active: true }, orderBy: { title: 'asc' } }),
  )
}
