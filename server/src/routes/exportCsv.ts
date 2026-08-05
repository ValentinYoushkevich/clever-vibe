import type { FastifyInstance } from 'fastify'
import { canExportCsv } from '../lib/permissions.js'
import { entriesToCsv } from '../lib/csv.js'

// BOM — без него Excel читает UTF-8 CSV как ANSI и ломает кириллицу
const BOM = '﻿'

export async function exportRoutes(app: FastifyInstance) {
  app.get('/api/export.csv', { preHandler: app.authenticate }, async (req, reply) => {
    if (!canExportCsv(req.user.role)) return reply.code(403).send({ error: 'forbidden' })
    const entries = await app.deps.prisma.entry.findMany({
      where: { deletedAt: null }, // допущение №3: удалённые не выгружаются
      include: { stage: true, approach: true, tool: true },
      orderBy: { createdAt: 'asc' },
    })
    const csv = entriesToCsv(
      entries.map((e) => ({
        id: e.id, userId: e.userId, createdAt: e.createdAt, stageCode: e.stage.code,
        approachCode: e.approach?.code ?? null, customApproachText: e.customApproachText,
        taskRef: e.taskRef, toolCode: e.tool.code, usefulness: e.usefulness,
        trust: e.trust, note: e.note,
      })),
    )
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', 'attachment; filename="clever-vibe-entries.csv"')
      .send(BOM + csv)
  })
}
