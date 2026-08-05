import type { FastifyInstance } from 'fastify'
import {
  approachStats, stageCoverage, trendSeries, spreadByApproach, type AggEntry,
} from '../lib/aggregate.js'

export async function dashboardRoutes(app: FastifyInstance) {
  const { prisma } = app.deps
  const guard = { preHandler: app.authenticate } // дашборд доступен всем ролям

  app.get('/api/dashboard', guard, async () => {
    const [entries, stages, teamSize] = await Promise.all([
      prisma.entry.findMany({
        where: { deletedAt: null }, // удалённые не входят в агрегаты (ТЗ §4)
        include: { stage: true, approach: true },
      }),
      prisma.stage.findMany({ where: { active: true } }),
      prisma.user.count({ where: { active: true, role: { in: ['dev', 'lead', 'admin'] } } }),
    ])
    const agg: AggEntry[] = entries.map((e) => ({
      userId: e.userId,
      createdAt: e.createdAt,
      stage: { code: e.stage.code, title: e.stage.title, order: e.stage.order },
      approach: e.approach ? { id: e.approach.id, title: e.approach.title } : null,
      usefulness: e.usefulness,
      trust: e.trust,
    }))
    return {
      totalEntries: agg.length,
      teamSize, // знаменатель охвата n/4 (допущение №5)
      approaches: approachStats(agg),
      stages: stageCoverage(stages, agg),
      // Динамика с выбором периода: дни / недели / месяцы / одна точка за весь пилот
      trend: {
        day: trendSeries(agg, 'day'),
        week: trendSeries(agg, 'week'),
        month: trendSeries(agg, 'month'),
        all: trendSeries(agg, 'all'),
      },
      spread: spreadByApproach(agg),
    }
  })

  app.get('/api/dashboard/approaches/:id/entries', guard, async (req) => {
    const id = (req.params as { id: string }).id
    const entries = await app.deps.prisma.entry.findMany({
      where: { deletedAt: null, approachId: id },
      include: { tool: true },
      orderBy: { createdAt: 'desc' },
    })
    // Автор записи не отображается (ТЗ §3.4)
    return entries.map((e) => ({
      id: e.id,
      createdAt: e.createdAt,
      taskRef: e.taskRef,
      toolTitle: e.tool.title,
      usefulness: e.usefulness,
      trust: e.trust,
      note: e.note,
    }))
  })
}
