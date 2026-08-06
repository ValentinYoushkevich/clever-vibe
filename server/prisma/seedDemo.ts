// Демо-данные для проверки дашборда на объёме: 400 записей от трёх участников.
// Отдельно от боевого сида (prisma/seed.ts) — тот наполняет справочники и админа,
// этот генерирует записи и запускается вручную: npm run seed:demo -w server
import { PrismaClient, type Role } from '@prisma/client'

const prisma = new PrismaClient()

const TOTAL = 400
const DAYS = 90 // хватает, чтобы тренд по дням, неделям и месяцам был непустым
const PASSWORD = 'demo1234'

// Детерминированный ГПСЧ (mulberry32): один и тот же прогон даёт одну и ту же
// картинку. С Math.random баг, замеченный на демо-данных, не воспроизвести.
function makeRng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = makeRng(20260806)

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)
const pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)]

// Сумма трёх равномерных ≈ нормальное: оценки кучкуются вокруг среднего,
// а не размазываются ровно по шкале 1–5
const jitter = () => (rnd() + rnd() + rnd()) / 1.5 - 1
const score = (mean: number, bias: number) => clamp(Math.round(mean + bias + jitter()), 1, 5)

const USERS: { login: string; name: string; role: Role; share: number; bias: number }[] = [
  // bias — систематическая строгость участника: без неё виджет разброса
  // между участниками покажет нули и его нечем будет проверить
  { login: 'demo-dev1', name: 'Никита Сорокин', role: 'dev', share: 0.42, bias: 0.45 },
  { login: 'demo-dev2', name: 'Полина Гаврилова', role: 'dev', share: 0.33, bias: -0.5 },
  { login: 'demo-lead', name: 'Артём Белов', role: 'lead', share: 0.25, bias: 0 },
]

// Явно заданные подходы — чтобы на графике были заполнены все четыре квадранта
// и картинка читалась как история, а не как облако шума
const PINNED: Record<string, { weight: number; usefulness: number; trust: number }> = {
  'cd-autocomplete': { weight: 14, usefulness: 3.6, trust: 4.4 }, // часто + полезно
  'cd-agent-mode': { weight: 11, usefulness: 4.3, trust: 2.7 }, // часто, польза есть, доверия нет
  'an-plan': { weight: 2, usefulness: 4.6, trust: 4.1 }, // редко + полезно → продвигать
  'ts-e2e': { weight: 9, usefulness: 2.1, trust: 2.2 }, // часто + бесполезно → разбираться
  'dc-changelog': { weight: 1, usefulness: 1.8, trust: 2.4 }, // редко + бесполезно → отбросить
}

// Остальным профиль выводится из кода подхода: значения произвольные,
// но стабильные между прогонами
const profileOf = (code: string) => {
  if (PINNED[code]) return PINNED[code]
  // Сдвиги беззнаковые: hash даёт uint32, а `>>` у больших значений вернёт
  // отрицательное число, и остаток от него в JS тоже отрицательный —
  // среднее уезжало ниже единицы и все оценки прибивало клампом к 1
  const h = hash(code)
  return {
    weight: 1 + (h % 6),
    usefulness: 2.3 + ((h >>> 3) % 22) / 10,
    trust: 2.1 + ((h >>> 7) % 25) / 10,
  }
}

// Повторяющиеся тексты дают группы в «Кастомных подходах на разбор»,
// одиночные — то, что промоутить не нужно
const CUSTOM = [
  { stage: 'code', text: 'Генерация миграций БД по изменению схемы', times: 4 },
  { stage: 'analysis', text: 'Перевод спеки в чек-лист приёмки', times: 3 },
  { stage: 'review', text: 'Проверка PR на утечки секретов', times: 2 },
  { stage: 'misc', text: 'Разбор чужого конфига вебпака', times: 1 },
]

const NOTES = [
  'Сэкономил примерно полдня.',
  'Пришлось переписывать почти всё, но направление подсказал верное.',
  'Уверенно выдумал несуществующий метод — проверять обязательно.',
  'На простых случаях отлично, на нашей специфике плывёт.',
  '',
  '',
  '',
]

function weightedPicker<T>(items: T[], weight: (x: T) => number) {
  const cum: number[] = []
  let sum = 0
  for (const it of items) cum.push((sum += weight(it)))
  return () => {
    const t = rnd() * sum
    return items[cum.findIndex((c) => c > t)]
  }
}

// Дата со сдвигом к свежим: степень > 1 уплотняет последние недели,
// иначе тренд выглядит неестественно ровным
function createdAt(): Date {
  const daysAgo = Math.floor(DAYS * rnd() ** 1.7)
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(9 + Math.floor(rnd() * 10), Math.floor(rnd() * 60), 0, 0)
  return d
}

async function main() {
  // Предохранитель: скрипт удаляет и создаёт записи пачками, на боевой базе
  // это недопустимо. Прод живёт в Neon, дев — в локальном контейнере.
  const url = process.env.DATABASE_URL ?? ''
  const isLocal = /@(localhost|127\.0\.0\.1|db)[:/]/.test(url)
  if (!isLocal && process.env.DEMO_ALLOW_REMOTE !== '1') {
    throw new Error(
      'DATABASE_URL указывает не на локальную базу. Демо-сид туда не пойдёт.\n' +
        'Если это осознанно — DEMO_ALLOW_REMOTE=1 npm run seed:demo -w server',
    )
  }

  const [stages, approaches, tools] = await Promise.all([
    prisma.stage.findMany(),
    prisma.approach.findMany({ where: { active: true } }),
    prisma.tool.findMany({ where: { active: true } }),
  ])
  if (!approaches.length || !tools.length) {
    throw new Error('Справочники пусты — сначала npx prisma db seed')
  }
  const stageById = new Map(stages.map((s) => [s.id, s]))
  const stageByCode = new Map(stages.map((s) => [s.code, s]))

  // Перезапуск не должен множить записи: чистим только за демо-участниками,
  // данные реальных пользователей не трогаем
  const logins = USERS.map((u) => u.login)
  const old = await prisma.user.findMany({ where: { login: { in: logins } } })
  if (old.length) {
    const { count } = await prisma.entry.deleteMany({
      where: { userId: { in: old.map((u) => u.id) } },
    })
    console.log(`Удалено записей прошлого прогона: ${count}`)
  }

  const users = []
  for (const u of USERS) {
    users.push(
      await prisma.user.upsert({
        where: { login: u.login },
        update: { name: u.name, role: u.role, password: PASSWORD, active: true },
        create: { name: u.name, login: u.login, password: PASSWORD, role: u.role },
      }),
    )
  }
  const biasByUserId = new Map(users.map((u, i) => [u.id, USERS[i].bias]))

  const pickApproach = weightedPicker(approaches, (a) => profileOf(a.code).weight)
  const pickUser = weightedPicker(users, (u) => USERS[users.indexOf(u)].share)

  const data: {
    userId: string
    createdAt: Date
    stageId: string
    approachId: string | null
    customApproachText: string | null
    taskRef: string | null
    toolId: string
    usefulness: number
    trust: number
    note: string | null
    deletedAt: Date | null
  }[] = []

  const customTotal = CUSTOM.reduce((s, c) => s + c.times, 0)
  for (let i = 0; i < TOTAL - customTotal; i++) {
    const a = pickApproach()
    const u = pickUser()
    const p = profileOf(a.code)
    const bias = biasByUserId.get(u.id)!
    data.push({
      userId: u.id,
      createdAt: createdAt(),
      stageId: a.stageId,
      approachId: a.id,
      customApproachText: null,
      taskRef: rnd() < 0.7 ? `TASK-${1000 + Math.floor(rnd() * 900)}` : null,
      toolId: pick(tools).id,
      usefulness: score(p.usefulness, bias),
      trust: score(p.trust, bias),
      note: pick(NOTES) || null,
      // Несколько удалённых — проверка, что агрегации их не считают
      deletedAt: rnd() < 0.015 ? new Date() : null,
    })
  }

  for (const c of CUSTOM) {
    const stage = stageByCode.get(c.stage)
    if (!stage) continue
    for (let i = 0; i < c.times; i++) {
      const u = pickUser()
      data.push({
        userId: u.id,
        createdAt: createdAt(),
        stageId: stage.id,
        approachId: null,
        customApproachText: c.text,
        taskRef: null,
        toolId: pick(tools).id,
        usefulness: score(3.4, biasByUserId.get(u.id)!),
        trust: score(3.2, biasByUserId.get(u.id)!),
        note: null,
        deletedAt: null,
      })
    }
  }

  await prisma.entry.createMany({ data })

  const live = data.filter((e) => !e.deletedAt)
  const stagesHit = new Set(live.map((e) => stageById.get(e.stageId)!.title))
  console.log(
    [
      `Создано записей: ${data.length} (живых ${live.length}, удалённых ${data.length - live.length})`,
      `Участники: ${USERS.map((u) => `${u.login} / ${PASSWORD}`).join(', ')}`,
      `Стадий затронуто: ${stagesHit.size} из ${stages.length}`,
      `Кастомных предложений: ${customTotal} в ${CUSTOM.length} группах`,
    ].join('\n'),
  )
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
