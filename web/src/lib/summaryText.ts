import type { SummaryStage } from './summary.js'
import { fmtMonth } from './format.js'

export function summaryText(month: string, stages: SummaryStage[]): string {
  const lines: string[] = [`Моя сводка за ${fmtMonth(month)}`]
  for (const s of stages) {
    lines.push('', `${s.stageTitle} — ${s.n} записей`)
    for (const a of s.approaches) {
      const suffix = a.lowData ? ' (мало данных)' : ''
      lines.push(
        `  ${a.title} — N=${a.n}, польза ${a.avgUsefulness}, доверие ${a.avgTrust}${suffix}`,
      )
      if (a.notes.length) {
        lines.push('  Заметки:')
        for (const n of a.notes) lines.push(`  - ${n}`)
      }
    }
  }
  return lines.join('\n')
}
