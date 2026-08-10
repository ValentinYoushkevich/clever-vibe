// Поднимает контейнер с dev-базой перед стартом дев-сервера.
// Без него Prisma не может подключиться и любой запрос к БД падает с 500.
// Идемпотентен: если контейнер уже принимает соединения — выходит молча.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const CONTAINER = 'clever-vibe-pg'
const IMAGE = 'postgres:17-alpine'
const WAIT_MS = 30_000

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SERVER_DIR = path.join(ROOT, 'server')

function docker(...args) {
  const r = spawnSync('docker', args, { encoding: 'utf8' })
  const err = [r.error?.message, r.stderr].filter(Boolean).join('\n').trim()
  return { ok: r.status === 0, out: (r.stdout ?? '').trim(), err }
}

// npm/npx на Windows — .cmd-обёртки, без расширения spawnSync их не находит.
function run(cmd, args, cwd) {
  const bin = process.platform === 'win32' ? `${cmd}.cmd` : cmd
  return spawnSync(bin, args, { cwd, stdio: 'inherit' }).status === 0
}

function fail(message) {
  console.error(`\n[db] ${message}\n`)
  process.exit(1)
}

// Параметры контейнера берём из DATABASE_URL, чтобы дев-база совпала с тем,
// куда потом пойдёт Prisma, а пароль не дублировался в двух местах.
function devDbUrl() {
  let raw
  try {
    raw = readFileSync(path.join(SERVER_DIR, '.env'), 'utf8')
  } catch {
    return null
  }
  const line = raw.split(/\r?\n/).find((l) => /^\s*DATABASE_URL\s*=/.test(l))
  if (!line) return null
  const value = line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
  try {
    return new URL(value)
  } catch {
    return null
  }
}

function createContainer() {
  const url = devDbUrl()
  if (!url) {
    fail(
      `Контейнера ${CONTAINER} нет, и DATABASE_URL в server/.env не найден.\n` +
        `Заполни server/.env по образцу server/.env.example и повтори.`,
    )
  }

  const user = decodeURIComponent(url.username) || 'clever'
  const password = decodeURIComponent(url.password)
  const database = url.pathname.replace(/^\//, '') || 'clevervibe'
  const port = url.port || '5432'

  console.log(`[db] контейнера ${CONTAINER} нет — создаю (${IMAGE}, порт ${port})`)
  const created = docker(
    'run', '-d',
    '--name', CONTAINER,
    '-p', `${port}:5432`,
    '-e', `POSTGRES_USER=${user}`,
    '-e', `POSTGRES_PASSWORD=${password}`,
    '-e', `POSTGRES_DB=${database}`,
    IMAGE,
  )
  if (!created.ok) fail(`Не удалось создать ${CONTAINER}:\n${created.err}`)
}

async function waitReady() {
  // Контейнер "running" ещё до готовности постгреса — ждём именно приём соединений.
  const deadline = Date.now() + WAIT_MS
  while (Date.now() < deadline) {
    if (docker('exec', CONTAINER, 'pg_isready', '-q').ok) return
    await sleep(500)
  }
  fail(`${CONTAINER} не принимает соединения за ${WAIT_MS / 1000}с. Логи: docker logs ${CONTAINER}`)
}

const state = docker('inspect', '-f', '{{.State.Running}}', CONTAINER)
let fresh = false

if (!state.ok) {
  // Отличаем "docker не запущен" от "контейнера нет": сообщения разные, действия тоже.
  if (/daemon|pipe|connection refused|not recognized|ENOENT/i.test(state.err)) {
    fail(`Docker не отвечает. Запусти Docker Desktop и повтори.\n${state.err}`)
  }
  createContainer()
  fresh = true
} else if (state.out !== 'true') {
  console.log(`[db] ${CONTAINER} лежит — поднимаю`)
  const started = docker('start', CONTAINER)
  if (!started.ok) fail(`Не удалось запустить ${CONTAINER}:\n${started.err}`)
}

await waitReady()

// Свежесозданная база пустая — без схемы и админа дев-сервер бесполезен.
if (fresh) {
  console.log('[db] применяю миграции')
  if (!run('npx', ['prisma', 'migrate', 'deploy'], SERVER_DIR)) fail('prisma migrate deploy упал')
  console.log('[db] сид')
  if (!run('npx', ['prisma', 'db', 'seed'], SERVER_DIR)) fail('prisma db seed упал')
}

console.log('[db] готова')
