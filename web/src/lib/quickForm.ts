export interface QuickForm {
  stageId: string | null
  approachId: string | null
  custom: boolean // выбран чип «Другой подход»
  customText: string
  toolId: string | null
  usefulness: number | null
  trust: number | null
  taskRef: string
  note: string
  noteOpen: boolean
}

export const emptyForm = (): QuickForm => ({
  stageId: null,
  approachId: null,
  custom: false,
  customText: '',
  toolId: null,
  usefulness: null,
  trust: null,
  taskRef: '',
  note: '',
  noteOpen: false,
})

export function canSave(f: QuickForm): boolean {
  const approachOk = f.custom ? f.customText.trim().length > 0 : !!f.approachId
  return !!f.stageId && approachOk && !!f.toolId && f.usefulness !== null && f.trust !== null
}

export function afterSave(f: QuickForm): QuickForm {
  return { ...emptyForm(), stageId: f.stageId, toolId: f.toolId }
}
