export const EDIT_WINDOW_DAYS = 7

export function canModify(createdAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - createdAt.getTime() < EDIT_WINDOW_DAYS * 24 * 60 * 60 * 1000
}
