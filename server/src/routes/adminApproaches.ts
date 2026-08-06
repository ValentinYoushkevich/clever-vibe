import type { FastifyInstance, FastifyReply } from 'fastify'
import { Type } from '@sinclair/typebox'
import { canManageApproaches } from '../lib/permissions.js'
import { slugify, unique } from '../lib/credentials.js'
import { groupCustom, normalizeCustomText } from '../lib/customApproaches.js'

export async function adminApproachRoutes(app: FastifyInstance) {
  const { prisma } = app.deps
  const guard = { preHandler: app.authenticate }

  const forbidden = (reply: FastifyReply) => reply.code(403).send({ error: 'forbidden' })

  // Справочник целиком (включая неактивные) с N по каждому подходу
  app.get('/api/admin/approaches', guard, async (req, reply) => {
    if (!canManageApproaches(req.user.role)) return forbidden(reply)
    const list = await prisma.approach.findMany({
      orderBy: { order: 'asc' },
      include: {
        stage: true,
        _count: { select: { entries: { where: { deletedAt: null } } } },
      },
    })
    return list.map((a) => ({
      id: a.id, code: a.code, title: a.title, stageId: a.stageId,
      stageTitle: a.stage.title, active: a.active, isCustom: a.isCustom,
      n: a._count.entries,
    }))
  })

  app.post(
    '/api/approaches',
    {
      ...guard,
      schema: {
        body: Type.Object({
          stageId: Type.String(),
          title: Type.String({ minLength: 1, maxLength: 200 }),
        }),
      },
    },
    async (req, reply) => {
      if (!canManageApproaches(req.user.role)) return forbidden(reply)
      const body = req.body as { stageId: string; title: string }
      const stage = await prisma.stage.findUnique({ where: { id: body.stageId } })
      if (!stage) return reply.code(400).send({ error: 'bad_stage' })
      const existing = await prisma.approach.findMany()
      const codes = new Set(existing.map((a) => a.code))
      const maxOrder = Math.max(0, ...existing.map((a) => a.order))
      const approach = await prisma.approach.create({
        data: {
          code: unique(slugify(body.title), codes),
          stageId: body.stageId,
          title: body.title.trim(),
          order: maxOrder + 1,
        },
      })
      return reply.code(201).send(approach)
    },
  )

  app.patch(
    '/api/approaches/:id',
    { ...guard, schema: { body: Type.Object({ active: Type.Boolean() }) } },
    async (req, reply) => {
      if (!canManageApproaches(req.user.role)) return forbidden(reply)
      const id = (req.params as { id: string }).id
      const found = await prisma.approach.findUnique({ where: { id } })
      if (!found) return reply.code(404).send({ error: 'not_found' })
      await prisma.approach.update({
        where: { id },
        data: { active: (req.body as { active: boolean }).active },
      })
      return { ok: true }
    },
  )

  // Кастомные подходы на разбор: авторство показывается — это рабочий
  // инструмент ведения справочника, а не оценка людей (ТЗ §3.5)
  app.get('/api/custom-approaches', guard, async (req, reply) => {
    if (!canManageApproaches(req.user.role)) return forbidden(reply)
    const entries = await prisma.entry.findMany({
      where: { customApproachText: { not: null }, deletedAt: null },
      include: { user: true, stage: true },
    })
    const promoted = await prisma.approach.findMany({ where: { promotedFromText: { not: null } } })
    return groupCustom(
      entries.map((e) => ({
        customApproachText: e.customApproachText!,
        createdAt: e.createdAt,
        stageId: e.stageId,
        stageTitle: e.stage.title,
        authorName: e.user.name,
      })),
      new Set(promoted.map((a) => a.promotedFromText!)),
      // Это список «на разбор»: промоученные уже разобраны и живут в справочнике
      // с пометкой isCustom — держать их здесь значит показывать сделанную работу
    ).filter((g) => !g.promoted)
  })

  // Отклонение предложения: сам подход в справочник не попадает, а записи,
  // где он был указан, уходят в удалённые — иначе текст остался бы висеть
  // в списке. Физического удаления записей нет (ТЗ §2.4), только deletedAt.
  app.delete(
    '/api/custom-approaches',
    { ...guard, schema: { body: Type.Object({ text: Type.String({ minLength: 1 }) }) } },
    async (req, reply) => {
      if (!canManageApproaches(req.user.role)) return forbidden(reply)
      const norm = normalizeCustomText((req.body as { text: string }).text)
      // approachId: null — только неразобранные предложения. У промоученных
      // записей customApproachText остаётся для истории и CSV, и они уже
      // относятся к подходу из справочника — их этот маршрут трогать не должен.
      const candidates = await prisma.entry.findMany({
        where: { customApproachText: { not: null }, approachId: null, deletedAt: null },
      })
      const ids = candidates
        .filter((e) => normalizeCustomText(e.customApproachText!) === norm)
        .map((e) => e.id)
      if (!ids.length) return reply.code(404).send({ error: 'not_found' })
      await prisma.entry.updateMany({
        where: { id: { in: ids } },
        data: { deletedAt: new Date() },
      })
      return { ok: true, deleted: ids.length }
    },
  )

  app.post(
    '/api/approaches/promote',
    {
      ...guard,
      schema: {
        body: Type.Object({
          text: Type.String({ minLength: 1 }),
          stageId: Type.String(),
          title: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
        }),
      },
    },
    async (req, reply) => {
      if (!canManageApproaches(req.user.role)) return forbidden(reply)
      const body = req.body as { text: string; stageId: string; title?: string }
      const norm = normalizeCustomText(body.text)
      const title = (body.title ?? body.text).trim()
      const existing = await prisma.approach.findMany()
      const codes = new Set(existing.map((a) => a.code))
      const maxOrder = Math.max(0, ...existing.map((a) => a.order))
      const approach = await prisma.approach.create({
        data: {
          code: unique(slugify(title), codes),
          stageId: body.stageId,
          title,
          order: maxOrder + 1,
          isCustom: true,
          promotedFromText: norm,
        },
      })
      // Бэкфил: записи той же стадии с совпадающим нормализованным текстом
      // получают approachId; customApproachText остаётся для истории и CSV
      const candidates = await prisma.entry.findMany({
        where: { stageId: body.stageId, customApproachText: { not: null }, approachId: null },
      })
      const ids = candidates
        .filter((e) => normalizeCustomText(e.customApproachText!) === norm)
        .map((e) => e.id)
      if (ids.length)
        await prisma.entry.updateMany({
          where: { id: { in: ids } },
          data: { approachId: approach.id },
        })
      return reply.code(201).send({ approach, backfilled: ids.length })
    },
  )
}
