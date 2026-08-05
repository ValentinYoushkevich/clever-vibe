import type { Entry } from '../api/types.js'
import { round1 } from './format.js'

export const LOW_DATA_N = 5 // «при N < 5 — мало данных» (ТЗ §3.3/§3.4)

export interface SummaryApproach {
  title: string
  n: number
  avgUsefulness: number
  avgTrust: number
  lowData: boolean
  notes: string[]
}

export interface SummaryStage {
  stageTitle: string
  stageOrder: number
  n: number
  approaches: SummaryApproach[]
}

export function buildSummary(entries: Entry[]): SummaryStage[] {
  const byStage = new Map<string, Entry[]>()
  for (const e of entries) {
    const key = e.stage.id
    if (!byStage.has(key)) byStage.set(key, [])
    byStage.get(key)!.push(e)
  }

  const result: SummaryStage[] = []
  for (const list of byStage.values()) {
    const byApproach = new Map<string, Entry[]>()
    for (const e of list) {
      const key = e.approach?.title ?? e.customApproachText ?? '—'
      if (!byApproach.has(key)) byApproach.set(key, [])
      byApproach.get(key)!.push(e)
    }
    const approaches: SummaryApproach[] = [...byApproach.entries()]
      .map(([title, es]) => ({
        title,
        n: es.length,
        avgUsefulness: round1(es.reduce((s, e) => s + e.usefulness, 0) / es.length),
        avgTrust: round1(es.reduce((s, e) => s + e.trust, 0) / es.length),
        lowData: es.length < LOW_DATA_N,
        notes: es.map((e) => e.note).filter((n): n is string => !!n),
      }))
      .sort((a, b) => b.n - a.n)
    result.push({
      stageTitle: list[0].stage.title,
      stageOrder: list[0].stage.order,
      n: list.length,
      approaches,
    })
  }
  return result.sort((a, b) => a.stageOrder - b.stageOrder)
}
