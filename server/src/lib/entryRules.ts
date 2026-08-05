export interface ApproachFields {
  approachId?: string | null
  customApproachText?: string | null
}

// null — правило соблюдено, иначе код ошибки для ответа 400
export function approachRuleError(f: ApproachFields): string | null {
  const hasApproach = !!f.approachId
  const hasText = !!f.customApproachText?.trim()
  if (hasApproach && hasText) return 'approach_conflict'
  if (!hasApproach && !hasText) return 'approach_required'
  return null
}
