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

export interface DashboardData {
  totalEntries: number
  teamSize: number
  approaches: ApproachStat[]
  stages: { code: string; title: string; n: number }[]
  monthly: {
    month: string
    total: { n: number; avg: number }
    byStage: Record<string, { n: number; avg: number }>
  }[]
  spread: { approachId: string; title: string; n: number; min: number; max: number; delta: number }[]
}

export interface AnonEntry {
  id: string
  createdAt: string
  taskRef: string | null
  toolTitle: string
  usefulness: number
  trust: number
  note: string | null
}
