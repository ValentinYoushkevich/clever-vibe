export function fmtDate(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}`
}

export const round1 = (x: number) => Math.round(x * 10) / 10

const MONTHS_RU = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
]

// '2026-08' → 'август 2026'
export function fmtMonth(month: string): string {
  const [y, m] = month.split('-')
  return `${MONTHS_RU[Number(m) - 1]} ${y}`
}
