import type { QuickForm } from './quickForm.js'

const DRAFT_KEY = 'aiTrackerDraft'
const LAST_TOOL_KEY = 'aiTrackerLastTool'

export function saveDraft(f: QuickForm): void {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(f))
}

export function loadDraft(): QuickForm | null {
  const raw = localStorage.getItem(DRAFT_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as QuickForm
    return typeof parsed === 'object' && parsed !== null ? parsed : null
  } catch {
    return null
  }
}

export function clearDraft(): void {
  localStorage.removeItem(DRAFT_KEY)
}

export const saveLastTool = (id: string) => localStorage.setItem(LAST_TOOL_KEY, id)
export const loadLastTool = () => localStorage.getItem(LAST_TOOL_KEY)
