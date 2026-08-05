export const normalizeCustomText = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

export interface CustomEntry {
  customApproachText: string
  createdAt: Date
  stageId: string
  stageTitle: string
  authorName: string
}

export interface CustomGroup {
  text: string
  norm: string
  n: number
  authors: string[]
  firstAt: Date
  lastAt: Date
  stageId: string // самая частая стадия группы — предустановка для промоута
  stageTitle: string
  promoted: boolean
}

export function groupCustom(entries: CustomEntry[], promotedNorms: Set<string>): CustomGroup[] {
  const map = new Map<string, CustomEntry[]>()
  for (const e of entries) {
    const norm = normalizeCustomText(e.customApproachText)
    if (!map.has(norm)) map.set(norm, [])
    map.get(norm)!.push(e)
  }
  return [...map.entries()]
    .map(([norm, list]) => {
      const stageCount = new Map<string, number>()
      for (const e of list) stageCount.set(e.stageId, (stageCount.get(e.stageId) ?? 0) + 1)
      const topStage = [...stageCount.entries()].sort((a, b) => b[1] - a[1])[0][0]
      const dates = list.map((e) => e.createdAt.getTime())
      return {
        text: list[0].customApproachText.trim(),
        norm,
        n: list.length,
        authors: [...new Set(list.map((e) => e.authorName))],
        firstAt: new Date(Math.min(...dates)),
        lastAt: new Date(Math.max(...dates)),
        stageId: topStage,
        stageTitle: list.find((e) => e.stageId === topStage)!.stageTitle,
        promoted: promotedNorms.has(norm),
      }
    })
    .sort((a, b) => b.n - a.n)
}
