export const EDIT_WINDOW_DAYS = 7

export function canModify(createdAtIso: string, now: Date = new Date()): boolean {
  return (
    now.getTime() - new Date(createdAtIso).getTime() < EDIT_WINDOW_DAYS * 24 * 60 * 60 * 1000
  )
}
