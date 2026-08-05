import type { FastifyInstance } from 'fastify'
import { Type } from '@sinclair/typebox'
import {
  canAccessAdmin, canCreateUser, canDeactivateUser, canDeleteUser, canSeePassword, type Role,
} from '../lib/permissions.js'
import { makeLogin, makePassword } from '../lib/credentials.js'

export async function userRoutes(app: FastifyInstance) {
  const { prisma } = app.deps
  const guard = { preHandler: app.authenticate }

  app.get('/api/users', guard, async (req, reply) => {
    if (!canAccessAdmin(req.user.role)) return reply.code(403).send({ error: 'forbidden' })
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { entries: true } } },
    })
    // Пароль постоянно виден в списке — в границах видимости (ТЗ §3.5)
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      login: u.login,
      role: u.role,
      active: u.active,
      createdById: u.createdById,
      entriesCount: u._count?.entries ?? 0,
      ...(canSeePassword(req.user, u) ? { password: u.password } : {}),
    }))
  })

  app.post(
    '/api/users',
    {
      ...guard,
      schema: {
        body: Type.Object({
          name: Type.String({ minLength: 1, maxLength: 100 }),
          role: Type.Union(
            (['dev', 'lead', 'admin', 'observer'] as const).map((r) => Type.Literal(r)),
          ),
        }),
      },
    },
    async (req, reply) => {
      const body = req.body as { name: string; role: Role }
      if (!canCreateUser(req.user.role, body.role))
        return reply.code(403).send({ error: 'forbidden' })
      const taken = new Set((await prisma.user.findMany()).map((u) => u.login))
      const user = await prisma.user.create({
        data: {
          name: body.name.trim(),
          login: makeLogin(body.name, taken),
          password: makePassword(),
          role: body.role,
          createdById: req.user.id,
        },
      })
      const { id, name, login, password, role } = user
      return reply.code(201).send({ id, name, login, password, role })
    },
  )

  app.patch(
    '/api/users/:id',
    { ...guard, schema: { body: Type.Object({ active: Type.Boolean() }) } },
    async (req, reply) => {
      const target = await prisma.user.findUnique({
        where: { id: (req.params as { id: string }).id },
      })
      if (!target) return reply.code(404).send({ error: 'not_found' })
      if (!canDeactivateUser(req.user.role, target.role))
        return reply.code(403).send({ error: 'forbidden' })
      await prisma.user.update({
        where: { id: target.id },
        data: { active: (req.body as { active: boolean }).active },
      })
      return { ok: true }
    },
  )

  // Перманентное удаление: участник исчезает вместе со своими записями.
  // Это единственное место в системе с физическим удалением — записи сами
  // по себе только помечаются deletedAt (ТЗ §4).
  app.delete('/api/users/:id', guard, async (req, reply) => {
    if (!canDeleteUser(req.user.role)) return reply.code(403).send({ error: 'forbidden' })
    const id = (req.params as { id: string }).id
    if (id === req.user.id) return reply.code(400).send({ error: 'self_delete' })
    const target = await prisma.user.findUnique({ where: { id } })
    if (!target) return reply.code(404).send({ error: 'not_found' })
    await prisma.$transaction(async (tx) => {
      await tx.entry.deleteMany({ where: { userId: id } })
      // Созданные им участники остаются — теряется только ссылка на автора
      await tx.user.updateMany({ where: { createdById: id }, data: { createdById: null } })
      await tx.user.delete({ where: { id } })
    })
    return reply.code(204).send()
  })

  app.post('/api/users/:id/password', guard, async (req, reply) => {
    const target = await prisma.user.findUnique({
      where: { id: (req.params as { id: string }).id },
    })
    if (!target) return reply.code(404).send({ error: 'not_found' })
    if (!canAccessAdmin(req.user.role) || !canSeePassword(req.user, target))
      return reply.code(403).send({ error: 'forbidden' })
    const password = makePassword()
    await prisma.user.update({ where: { id: target.id }, data: { password } })
    return { password }
  })
}
