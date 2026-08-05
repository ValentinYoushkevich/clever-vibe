export const round1 = (x: number) => Math.round(x * 10) / 10
export const LOW_DATA_N = 5 // «при N < 5 — мало данных»
export const QUADRANT_MIN_TOTAL = 50 // границы квадрантов скрыты до 50 записей (ТЗ §3.4)

export interface AggEntry {
  userId: string
  createdAt: Date
  stage: { code: string; title: string; order: number }
  approach: { id: string; title: string } | null
  usefulness: number
  trust: number
}

const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function groupBy<T>(list: T[], key: (t: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of list) {
    const k = key(item)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(item)
  }
  return map
}

export interface ApproachStat {
  approachId: string
  title: string
  stageCode: string
  stageTitle: string
  n: number
  coverage: number
  avgUsefulness: number
  avgTrust: number
  lowData: boolean
}

export function approachStats(entries: AggEntry[]): ApproachStat[] {
  const withApproach = entries.filter((e) => e.approach)
  return [...groupBy(withApproach, (e) => e.approach!.id).values()].map((list) => ({
    approachId: list[0].approach!.id,
    title: list[0].approach!.title,
    stageCode: list[0].stage.code,
    stageTitle: list[0].stage.title,
    n: list.length,
    coverage: new Set(list.map((e) => e.userId)).size,
    avgUsefulness: round1(avg(list.map((e) => e.usefulness))),
    avgTrust: round1(avg(list.map((e) => e.trust))),
    lowData: list.length < LOW_DATA_N,
  }))
}

export function stageCoverage(
  stages: { code: string; title: string; order: number }[],
  entries: AggEntry[],
): { code: string; title: string; n: number }[] {
  return [...stages]
    .sort((a, b) => a.order - b.order)
    .map((s) => ({
      code: s.code,
      title: s.title,
      n: entries.filter((e) => e.stage.code === s.code).length,
    }))
}

export interface MonthPoint {
  month: string
  total: { n: number; avg: number }
  byStage: Record<string, { n: number; avg: number }>
}

export function monthlySeries(entries: AggEntry[]): MonthPoint[] {
  return [...groupBy(entries, (e) => e.createdAt.toISOString().slice(0, 7)).entries()]
    .map(([month, list]) => ({
      month,
      total: { n: list.length, avg: round1(avg(list.map((e) => e.usefulness))) },
      byStage: Object.fromEntries(
        [...groupBy(list, (e) => e.stage.code).entries()].map(([code, ls]) => [
          code,
          { n: ls.length, avg: round1(avg(ls.map((e) => e.usefulness))) },
        ]),
      ),
    }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

export interface SpreadRow {
  approachId: string
  title: string
  n: number
  min: number
  max: number
  delta: number
}

// Разброс средних usefulness участников (допущение №4 в README планов)
export function spreadByApproach(entries: AggEntry[]): SpreadRow[] {
  const withApproach = entries.filter((e) => e.approach)
  return [...groupBy(withApproach, (e) => e.approach!.id).values()].map((list) => {
    const perUser = [...groupBy(list, (e) => e.userId).values()].map((ls) =>
      round1(avg(ls.map((e) => e.usefulness))),
    )
    const min = Math.min(...perUser)
    const max = Math.max(...perUser)
    return {
      approachId: list[0].approach!.id,
      title: list[0].approach!.title,
      n: list.length,
      min,
      max,
      delta: round1(max - min),
    }
  })
}
