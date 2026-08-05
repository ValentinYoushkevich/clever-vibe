import type { FastifyInstance } from 'fastify'
import { Type } from '@sinclair/typebox'
import { canCreateEntry } from '../lib/permissions.js'
import { approachRuleError } from '../lib/entryRules.js'
import { canModify } from '../lib/editWindow.js'

const EntryBody = Type.Object({
  stageId: Type.String(),
  approachId: Type.Optional(Type.String()),
  customApproachText: Type.Optional(Type.String({ maxLength: 500 })),
  taskRef: Type.Optional(Type.String({ maxLength: 50 })),
  toolId: Type.String(),
  usefulness: Type.Integer({ minimum: 1, maximum: 5 }),
  trust: Type.Integer({ minimum: 1, maximum: 5 }),
  note: Type.Optional(Type.String({ maxLength: 2000 })),
})

interface EntryPayload {
  stageId: string
  approachId?: string
  customApproachText?: string
  taskRef?: string
  toolId: string
  usefulness: number
  trust: number
  note?: string
}

// Диапазон месяца по строке YYYY-MM (границы в UTC — команда в одном поясе)
export function monthRange(month: string): { gte: Date; lt: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  return { gte: new Date(Date.UTC(y, mo, 1)), lt: new Date(Date.UTC(y, mo + 1, 1)) }
}

export async function entryRoutes(app: FastifyInstance) {
  const { prisma } = app.deps

  // Общая валидация тела против БД; null — ок, иначе {code}
  async function validate(body: EntryPayload): Promise<string | null> {
    const ruleError = approachRuleError(body)
    if (ruleError) return ruleError
    const stage = await prisma.stage.findUnique({ where: { id: body.stageId } })
    if (!stage?.active) return 'bad_stage'
    if (body.approachId) {
      const approach = await prisma.approach.findUnique({ where: { id: body.approachId } })
      if (!approach?.active || approach.stageId !== body.stageId) return 'bad_approach'
    }
    const tool = await prisma.tool.findUnique({ where: { id: body.toolId } })
    if (!tool?.active) return 'bad_tool'
    return null
  }

  const toData = (body: EntryPayload) => ({
    stageId: body.stageId,
    approachId: body.approachId ?? null,
    customApproachText: body.customApproachText?.trim() || null,
    taskRef: body.taskRef?.trim() || null,
    toolId: body.toolId,
    usefulness: body.usefulness,
    trust: body.trust,
    note: body.note?.trim() || null,
  })

  app.post(
    '/api/entries',
    { preHandler: app.authenticate, schema: { body: EntryBody } },
    async (req, reply) => {
      if (!canCreateEntry(req.user.role)) return reply.code(403).send({ error: 'forbidden' })
      const body = req.body as EntryPayload
      const error = await validate(body)
      if (error) return reply.code(400).send({ error })
      const entry = await prisma.entry.create({
        data: { userId: req.user.id, ...toData(body) },
      })
      return reply.code(201).send(entry)
    },
  )

  app.get(
    '/api/entries',
    {
      preHandler: app.authenticate,
      schema: {
        querystring: Type.Object({
          month: Type.Optional(Type.String()),
          stageId: Type.Optional(Type.String()),
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000 })),
        }),
      },
    },
    async (req, reply) => {
      if (!canCreateEntry(req.user.role)) return reply.code(403).send({ error: 'forbidden' })
      const q = req.query as { month?: string; stageId?: string; limit?: number }
      const where: Record<string, unknown> = { userId: req.user.id, deletedAt: null }
      if (q.stageId) where.stageId = q.stageId
      if (q.month) {
        const range = monthRange(q.month)
        if (!range) return reply.code(400).send({ error: 'bad_month' })
        where.createdAt = range
      }
      const list = await prisma.entry.findMany({
        where,
        include: { stage: true, approach: true, tool: true },
        orderBy: { createdAt: 'desc' },
        take: q.limit,
      })
      return list
    },
  )

  // Загрузка своей записи внутри окна правки; ошибки едины для PATCH и DELETE
  async function ownEditable(req: { user: { id: string } }, id: string) {
    const entry = await prisma.entry.findUnique({ where: { id } })
    if (!entry || entry.deletedAt || entry.userId !== req.user.id)
      return { status: 404, error: 'not_found' } as const
    if (!canModify(entry.createdAt)) return { status: 403, error: 'edit_window_expired' } as const
    return { entry }
  }

  app.patch(
    '/api/entries/:id',
    { preHandler: app.authenticate, schema: { body: EntryBody } },
    async (req, reply) => {
      const found = await ownEditable(req, (req.params as { id: string }).id)
      // `&& found.error` — не логика, а подсказка TS 6: без неё сужение по `in`
      // оставляет ветку `{ entry }`, и `found.status` становится number | undefined
      if ('error' in found && found.error)
        return reply.code(found.status).send({ error: found.error })
      const body = req.body as EntryPayload
      const error = await validate(body)
      if (error) return reply.code(400).send({ error })
      return prisma.entry.update({ where: { id: found.entry.id }, data: toData(body) })
    },
  )

  app.delete(
    '/api/entries/:id',
    { preHandler: app.authenticate },
    async (req, reply) => {
      const found = await ownEditable(req, (req.params as { id: string }).id)
      // `&& found.error` — не логика, а подсказка TS 6: без неё сужение по `in`
      // оставляет ветку `{ entry }`, и `found.status` становится number | undefined
      if ('error' in found && found.error)
        return reply.code(found.status).send({ error: found.error })
      await prisma.entry.update({
        where: { id: found.entry.id },
        data: { deletedAt: new Date() },
      })
      return { ok: true }
    },
  )
}
