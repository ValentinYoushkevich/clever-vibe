import type { FastifyInstance, FastifyReply } from 'fastify'
import { Type } from '@sinclair/typebox'
import { canManageTools } from '../lib/permissions.js'
import { slugify, unique } from '../lib/credentials.js'

// Тег уходит в CSV и остаётся в записях навсегда, поэтому набор символов узкий:
// латиница, цифры и дефис — выгрузку можно фильтровать без экранирования.
const CODE_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

export async function adminToolRoutes(app: FastifyInstance) {
  const { prisma } = app.deps
  const guard = { preHandler: app.authenticate }
  const forbidden = (reply: FastifyReply) => reply.code(403).send({ error: 'forbidden' })

  // Весь справочник, включая выключенные: иначе занятый тег выглядит свободным,
  // а добавить второй инструмент с тем же тегом нельзя
  app.get('/api/admin/tools', guard, async (req, reply) => {
    if (!canManageTools(req.user.role)) return forbidden(reply)
    const list = await prisma.tool.findMany({
      orderBy: { title: 'asc' },
      include: { _count: { select: { entries: { where: { deletedAt: null } } } } },
    })
    return list.map((t) => ({
      id: t.id,
      code: t.code,
      title: t.title,
      active: t.active,
      n: t._count.entries,
    }))
  })

  app.post(
    '/api/tools',
    {
      ...guard,
      schema: {
        body: Type.Object({
          title: Type.String({ minLength: 1, maxLength: 100 }),
          // Пустой тег — нормальный случай: сделаем из названия транслитерацией
          code: Type.Optional(Type.String({ maxLength: 40 })),
        }),
      },
    },
    async (req, reply) => {
      if (!canManageTools(req.user.role)) return forbidden(reply)
      const body = req.body as { title: string; code?: string }
      const title = body.title.trim()
      const asked = body.code?.trim().toLowerCase()
      const taken = new Set((await prisma.tool.findMany()).map((t) => t.code))

      let code: string
      if (asked) {
        if (!CODE_RE.test(asked)) return reply.code(400).send({ error: 'bad_code' })
        // Занять тег выключенного инструмента нельзя: его записи уже помечены
        // этим тегом, и два разных инструмента слились бы в выгрузке в один
        if (taken.has(asked)) return reply.code(400).send({ error: 'code_taken' })
        code = asked
      } else {
        code = unique(slugify(title), taken)
        if (!CODE_RE.test(code)) return reply.code(400).send({ error: 'bad_code' })
      }

      const tool = await prisma.tool.create({ data: { code, title } })
      return reply.code(201).send(tool)
    },
  )

  // Удаления нет: инструмент упомянут в записях, поэтому только выключение —
  // из формы записи и фильтров он исчезает, история остаётся целой
  app.patch(
    '/api/tools/:id',
    { ...guard, schema: { body: Type.Object({ active: Type.Boolean() }) } },
    async (req, reply) => {
      if (!canManageTools(req.user.role)) return forbidden(reply)
      const id = (req.params as { id: string }).id
      const found = await prisma.tool.findUnique({ where: { id } })
      if (!found) return reply.code(404).send({ error: 'not_found' })
      await prisma.tool.update({
        where: { id },
        data: { active: (req.body as { active: boolean }).active },
      })
      return { ok: true }
    },
  )
}
