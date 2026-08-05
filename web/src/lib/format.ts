export function fmtDate(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}`
}

export const round1 = (x: number) => Math.round(x * 10) / 10

// Средние выводятся с одним знаком всегда: 4 → «4.0» (прототип: f1)
export const f1 = (x: number) => x.toFixed(1)

// «1 запись / 2 записи / 5 записей»
export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return `${n} ${one}`
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} ${few}`
  return `${n} ${many}`
}

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

// То же с заглавной — для заголовков в интерфейсе (прототип: «Август 2026»)
export function fmtMonthTitle(month: string): string {
  const s = fmtMonth(month)
  return s.charAt(0).toUpperCase() + s.slice(1)
}
