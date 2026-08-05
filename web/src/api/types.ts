export interface Stage {
  id: string
  code: string
  title: string
  order: number
}

export interface Approach {
  id: string
  code: string
  stageId: string
  title: string
  description: string | null
  order: number
  isCustom: boolean
}

export interface Tool {
  id: string
  code: string
  title: string
}

export interface Entry {
  id: string
  createdAt: string
  stage: Stage
  approach: Approach | null
  customApproachText: string | null
  taskRef: string | null
  tool: Tool
  usefulness: number
  trust: number
  note: string | null
}
