export const CSV_HEADER = [
  'id', 'userId', 'createdAt', 'stage', 'approach', 'customApproachText',
  'taskRef', 'tool', 'usefulness', 'trust', 'note',
]

export function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export interface CsvEntry {
  id: string
  userId: string
  createdAt: Date
  stageCode: string
  approachCode: string | null
  customApproachText: string | null
  taskRef: string | null
  toolCode: string
  usefulness: number
  trust: number
  note: string | null
}

export function entriesToCsv(rows: CsvEntry[]): string {
  const lines = [CSV_HEADER.join(',')]
  for (const r of rows)
    lines.push(
      [
        r.id, r.userId, r.createdAt.toISOString(), r.stageCode, r.approachCode,
        r.customApproachText, r.taskRef, r.toolCode, r.usefulness, r.trust, r.note,
      ]
        .map(csvEscape)
        .join(','),
    )
  return lines.join('\r\n')
}
