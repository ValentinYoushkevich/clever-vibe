// Поднимает контейнер с dev-базой перед стартом дев-сервера.
// Без него Prisma не может подключиться и любой запрос к БД падает с 500.
import { spawnSync } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const CONTAINER = 'clever-vibe-pg'
const WAIT_MS = 30_000

function docker(...args) {
  const r = spawnSync('docker', args, { encoding: 'utf8' })
  return { ok: r.status === 0, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() }
}

function fail(message) {
  console.error(`\n[db] ${message}\n`)
  process.exit(1)
}

const state = docker('inspect', '-f', '{{.State.Running}}', CONTAINER)

if (!state.ok) {
  // Отличаем "docker не запущен" от "контейнера нет": сообщения разные, действия тоже.
  if (/daemon|pipe|connection refused|not recognized|ENOENT/i.test(state.err)) {
    fail(`Docker не отвечает. Запусти Docker Desktop и повтори.\n${state.err}`)
  }
  fail(
    `Контейнер ${CONTAINER} не найден. Создай dev-базу:\n` +
      `  docker run -d --name ${CONTAINER} -p 5432:5432 ` +
      `-e POSTGRES_PASSWORD=<пароль из server/.env> -e POSTGRES_DB=clevervibe postgres:17-alpine\n` +
      `  cd server && npx prisma migrate deploy && npx prisma db seed`,
  )
}

if (state.out !== 'true') {
  console.log(`[db] ${CONTAINER} лежит — поднимаю`)
  const started = docker('start', CONTAINER)
  if (!started.ok) fail(`Не удалось запустить ${CONTAINER}:\n${started.err}`)
}

// Контейнер "running" ещё до готовности постгреса — ждём именно приём соединений.
const deadline = Date.now() + WAIT_MS
while (Date.now() < deadline) {
  if (docker('exec', CONTAINER, 'pg_isready', '-q').ok) {
    console.log('[db] готова')
    process.exit(0)
  }
  await sleep(500)
}

fail(`${CONTAINER} не принимает соединения за ${WAIT_MS / 1000}с. Логи: docker logs ${CONTAINER}`)
