import { randomInt } from 'node:crypto'

const RU: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

export function translit(s: string): string {
  return s
    .toLowerCase()
    .split('')
    .map((ch) => RU[ch] ?? (/[a-z0-9]/.test(ch) ? ch : ''))
    .join('')
}

export function unique(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base
  for (let i = 2; ; i++) if (!taken.has(`${base}${i}`)) return `${base}${i}`
}

// Логин: транслит первого слова имени; при коллизии суффикс 2, 3, … (ТЗ §2.1)
export function makeLogin(name: string, taken: Set<string>): string {
  return unique(translit(name.trim().split(/\s+/)[0]) || 'user', taken)
}

// Без 0/O, 1/l/I (ТЗ §2.1)
export const PASSWORD_ALPHABET =
  'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function makePassword(rand: (max: number) => number = randomInt): string {
  return Array.from({ length: 8 }, () => PASSWORD_ALPHABET[rand(PASSWORD_ALPHABET.length)]).join('')
}

export function slugify(title: string): string {
  return (
    title.trim().toLowerCase().split(/\s+/).map(translit).filter(Boolean).join('-').slice(0, 40) ||
    'approach'
  )
}
