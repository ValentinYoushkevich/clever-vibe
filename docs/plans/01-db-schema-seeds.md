# 01 · Схема БД и сиды — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prisma-схема пяти сущностей (User, Stage, Approach, Tool, Entry) с миграцией в PostgreSQL (Neon) и сидами: 9 стадий, стартовые подходы из ТЗ §2.3, инструменты, первый админ из переменных окружения.

**Architecture:** Prisma + Neon: `DATABASE_URL` (pooled) для рантайма, `DIRECT_URL` для миграций (ТЗ §5). Данные сидов вынесены в `seedData.ts` — чистый модуль без Prisma, покрытый юнит-тестом на целостность. Сид идемпотентен (upsert по `code`), чтобы его можно было гонять повторно.

**Tech Stack:** Prisma 6, @prisma/client, PostgreSQL (Neon; локально — любой PostgreSQL или сразу Neon-ветка).

---

### Task 1: Prisma-схема

**Files:**
- Create: `server/prisma/schema.prisma`
- Modify: `server/src/app.ts` (вернуть настоящий тип PrismaClient)
- Create: `server/src/prisma.ts`
- Modify: `server/src/index.ts`
- Modify: `server/.env` (локально, не коммитится)

- [x] **Step 1: Установить Prisma**

```powershell
npm i -w server @prisma/client
npm i -w server -D prisma
```

- [x] **Step 2: Схема**

`server/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

enum Role {
  dev
  lead
  admin
  observer
}

model User {
  id          String   @id @default(uuid())
  name        String
  login       String   @unique
  // Открытый пароль — осознанное решение ТЗ §2.1: генерируется системой,
  // постоянно виден лиду в админке, что заменяет процедуру сброса.
  password    String
  role        Role
  createdById String?
  createdBy   User?    @relation("CreatedUsers", fields: [createdById], references: [id])
  created     User[]   @relation("CreatedUsers")
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
  entries     Entry[]
}

model Stage {
  id         String     @id @default(uuid())
  code       String     @unique
  title      String
  order      Int
  active     Boolean    @default(true)
  approaches Approach[]
  entries    Entry[]
}

model Approach {
  id               String  @id @default(uuid())
  code             String  @unique
  stageId          String
  stage            Stage   @relation(fields: [stageId], references: [id])
  title            String
  description      String?
  order            Int
  active           Boolean @default(true)
  isCustom         Boolean @default(false)
  // Нормализованный текст «другого подхода», из которого подход был промоучен (план 07)
  promotedFromText String?
  entries          Entry[]
}

model Tool {
  id      String  @id @default(uuid())
  code    String  @unique
  title   String
  active  Boolean @default(true)
  entries Entry[]
}

model Entry {
  id                 String    @id @default(uuid())
  userId             String
  user               User      @relation(fields: [userId], references: [id])
  createdAt          DateTime  @default(now())
  stageId            String
  stage              Stage     @relation(fields: [stageId], references: [id])
  approachId         String?
  approach           Approach? @relation(fields: [approachId], references: [id])
  customApproachText String?
  taskRef            String?
  toolId             String
  tool               Tool      @relation(fields: [toolId], references: [id])
  usefulness         Int // 1–5
  trust              Int // 1–5
  note               String?
  deletedAt          DateTime? // физического удаления нет (ТЗ §2.4)

  @@index([userId])
  @@index([stageId])
  @@index([approachId])
  @@index([deletedAt])
}
```

- [x] **Step 3: Локальное окружение**

Скопировать `server/.env.example` → `server/.env`, вписать реальные строки Neon (создать бесплатный проект на neon.tech, взять `DATABASE_URL` — pooled и `DIRECT_URL` — direct). Для чисто локальной разработки допустим локальный PostgreSQL — обе переменные указывают на него.

- [x] **Step 4: Миграция**

Run: `npx prisma migrate dev --name init` (из каталога `server/`)
Expected: `Your database is now in sync with your schema` + сгенерирован клиент.

- [x] **Step 5: Подключить клиент в приложение**

`server/src/prisma.ts`:

```ts
import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()
```

В `server/src/app.ts` удалить временный `type PrismaClient = unknown` и вернуть импорт:

```ts
import type { PrismaClient } from '@prisma/client'
```

`server/src/index.ts` (заменить создание приложения):

```ts
import { buildApp } from './app.js'
import { prisma } from './prisma.js'

const app = buildApp({ prisma })
```

- [x] **Step 6: Тесты и запуск**

Run: `npx vitest run -r server`
Expected: PASS (тест health из плана 00 не сломался)

- [x] **Step 7: Commit**

```powershell
git add server
git commit -m "feat(server): prisma schema for User/Stage/Approach/Tool/Entry + init migration"
```

---

### Task 2: Данные сидов (чистый модуль + тест)

**Files:**
- Create: `server/prisma/seedData.ts`
- Create: `server/test/seedData.spec.ts`

- [x] **Step 1: Написать падающий тест целостности**

`server/test/seedData.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { STAGES, APPROACHES, TOOLS } from '../prisma/seedData.js'

describe('seedData', () => {
  it('9 стадий с уникальными кодами по ТЗ §2.2', () => {
    expect(STAGES.map((s) => s.code)).toEqual([
      'analysis', 'design', 'code', 'refactor', 'debug',
      'test', 'review', 'docs', 'misc',
    ])
  })

  it('коды подходов уникальны', () => {
    const codes = APPROACHES.map((a) => a.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('каждый подход ссылается на существующую стадию', () => {
    const stageCodes = new Set(STAGES.map((s) => s.code))
    for (const a of APPROACHES) expect(stageCodes.has(a.stageCode)).toBe(true)
  })

  it('число подходов соответствует ТЗ §2.3 (3+3+7+4+5+6+4+5+4 = 41)', () => {
    expect(APPROACHES.length).toBe(41)
  })

  it('инструменты непусты и с уникальными кодами', () => {
    expect(TOOLS.length).toBeGreaterThan(0)
    expect(new Set(TOOLS.map((t) => t.code)).size).toBe(TOOLS.length)
  })
})
```

- [x] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run -r server`
Expected: FAIL — `Cannot find module '../prisma/seedData.js'`

- [x] **Step 3: Реализовать seedData**

`server/prisma/seedData.ts`:

```ts
// Справочники по ТЗ §2.2, §2.3, §2.5. Порядок = порядок в ТЗ.

export const STAGES = [
  { code: 'analysis', title: 'Анализ задачи' },
  { code: 'design',   title: 'Проектирование' },
  { code: 'code',     title: 'Написание кода' },
  { code: 'refactor', title: 'Рефакторинг' },
  { code: 'debug',    title: 'Дебаг' },
  { code: 'test',     title: 'Тесты' },
  { code: 'review',   title: 'Код-ревью' },
  { code: 'docs',     title: 'Документация' },
  { code: 'misc',     title: 'Прочее' },
].map((s, i) => ({ ...s, order: i + 1 }))

interface SeedApproach {
  code: string
  stageCode: string
  title: string
  description?: string
}

const A = (stageCode: string, list: [code: string, title: string, description?: string][]) =>
  list.map(([code, title, description]) => ({ code, stageCode, title, description }))

export const APPROACHES: SeedApproach[] = [
  ...A('analysis', [
    ['an-requirements', 'Разбор требований', 'Уточняющие вопросы, edge-кейсы, что не учтено'],
    ['an-decompose', 'Декомпозиция задачи на подзадачи'],
    ['an-plan', 'Генерация плана реализации до написания кода'],
  ]),
  ...A('design', [
    ['ds-arch-options', 'Обсуждение архитектурных вариантов'],
    ['ds-structure', 'Генерация структуры модуля / контракта API / типов'],
    ['ds-self-review', 'Ревью собственного архитектурного решения'],
  ]),
  ...A('code', [
    ['cd-autocomplete', 'Автокомплит в IDE'],
    ['cd-from-description', 'Генерация по описанию задачи'],
    ['cd-chat-iterations', 'Чат-итерации', 'Сгенерировал → поправь → уточнил'],
    ['cd-agent-mode', 'Агентный режим', 'Правки в нескольких файлах'],
    ['cd-by-example', 'Генерация по образцу существующего компонента'],
    ['cd-ng-migration', 'Миграция синтаксиса между версиями Angular'],
    ['cd-boilerplate', 'Бойлерплейт', 'Конфиги, скаффолдинг, типы, моки'],
  ]),
  ...A('refactor', [
    ['rf-split', 'Разбиение большого компонента / функции'],
    ['rf-dedup', 'Устранение дублирования'],
    ['rf-legacy', 'Модернизация легаси'],
    ['rf-optimize', 'Оптимизация', 'Перф, бандл'],
  ]),
  ...A('debug', [
    ['db-stacktrace', 'Стектрейс + контекст → гипотезы причины'],
    ['db-explain-code', 'Объяснение незнакомого / легаси-кода'],
    ['db-min-repro', 'Генерация минимального репро'],
    ['db-rubber-duck', 'Проговаривание проблемы в диалоге'],
    ['db-diff-analysis', 'Анализ диффа', '«После этих изменений сломалось — где?»'],
  ]),
  ...A('test', [
    ['ts-unit-by-code', 'Генерация unit-тестов по готовому коду'],
    ['ts-scenarios-then-code', 'Список сценариев / edge-кейсов, затем код тестов'],
    ['ts-coverage-fill', 'Дописывание покрытия по отчёту coverage'],
    ['ts-fixtures', 'Генерация тестовых данных, фикстур, моков'],
    ['ts-tests-first', 'Тесты по требованиям до написания кода'],
    ['ts-e2e', 'E2E-сценарии по описанию юзер-флоу'],
  ]),
  ...A('review', [
    ['rv-self-pr', 'Само-ревью своего PR до отправки'],
    ['rv-second-opinion', 'Второе мнение по чужому PR'],
    ['rv-conventions', 'Проверка на соответствие конвенциям проекта'],
    ['rv-explain-pr', 'Объяснение чужого PR перед ревью'],
  ]),
  ...A('docs', [
    ['dc-jsdoc', 'JSDoc / комментарии по коду'],
    ['dc-readme', 'README / гайд по модулю'],
    ['dc-pr-description', 'Описание PR'],
    ['dc-changelog', 'Changelog из коммитов'],
    ['dc-refresh', 'Актуализация устаревшей документации'],
  ]),
  ...A('misc', [
    ['ms-commit-msg', 'Коммит-месседжи'],
    ['ms-build-errors', 'Разбор ошибок сборки'],
    ['ms-regex-sql-config', 'Регэкспы, SQL, конфиги'],
    ['ms-semantic-search', 'Смысловой поиск по кодбазе'],
  ]),
]

// ПЛЕЙСХОЛДЕР: заменить утверждённым в компании списком инструментов
// до развёртывания (ТЗ §2.5). Коды стабильны, менять только title/состав.
export const TOOLS = [
  { code: 'copilot', title: 'GitHub Copilot' },
  { code: 'cursor', title: 'Cursor' },
  { code: 'claude-code', title: 'Claude Code' },
  { code: 'web-chat', title: 'Чат (веб-версия)' },
]
```

- [x] **Step 4: Убедиться, что тесты проходят**

Run: `npx vitest run -r server`
Expected: PASS (5 тестов seedData + health)

- [x] **Step 5: Commit**

```powershell
git add server/prisma/seedData.ts server/test/seedData.spec.ts
git commit -m "feat(server): seed data for stages, approaches, tools"
```

---

### Task 3: Скрипт сида

**Files:**
- Create: `server/prisma/seed.ts`
- Modify: `server/package.json`

- [x] **Step 1: Скрипт**

`server/prisma/seed.ts`:

```ts
import { PrismaClient } from '@prisma/client'
import { STAGES, APPROACHES, TOOLS } from './seedData.js'

const prisma = new PrismaClient()

async function main() {
  for (const s of STAGES) {
    await prisma.stage.upsert({
      where: { code: s.code },
      update: { title: s.title, order: s.order },
      create: s,
    })
  }

  const stages = await prisma.stage.findMany()
  const stageIdByCode = new Map(stages.map((s) => [s.code, s.id]))

  for (const [i, a] of APPROACHES.entries()) {
    const stageId = stageIdByCode.get(a.stageCode)!
    await prisma.approach.upsert({
      where: { code: a.code },
      update: { title: a.title, description: a.description ?? null, order: i + 1, stageId },
      create: {
        code: a.code,
        stageId,
        title: a.title,
        description: a.description ?? null,
        order: i + 1,
      },
    })
  }

  for (const t of TOOLS) {
    await prisma.tool.upsert({
      where: { code: t.code },
      update: { title: t.title },
      create: t,
    })
  }

  // Первый админ — из переменных окружения (ТЗ §3.5, открытый вопрос закрыт сидом)
  const { ADMIN_NAME, ADMIN_LOGIN, ADMIN_PASSWORD } = process.env
  if (!ADMIN_LOGIN || !ADMIN_PASSWORD) {
    throw new Error('ADMIN_LOGIN и ADMIN_PASSWORD обязательны для сида')
  }
  await prisma.user.upsert({
    where: { login: ADMIN_LOGIN },
    update: {},
    create: {
      name: ADMIN_NAME ?? 'Администратор',
      login: ADMIN_LOGIN,
      password: ADMIN_PASSWORD,
      role: 'admin',
    },
  })

  console.log('Seed done')
}

main().finally(() => prisma.$disconnect())
```

- [x] **Step 2: Зарегистрировать в package.json**

В `server/package.json` добавить на верхний уровень:

```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

- [x] **Step 3: Прогнать сид дважды (идемпотентность)**

Run (из `server/`): `npx prisma db seed`
Expected: `Seed done`

Run повторно: `npx prisma db seed`
Expected: снова `Seed done`, без ошибок уникальности.

- [x] **Step 4: Проверить данные**

Run (из `server/`): `npx prisma studio` → таблицы Stage (9 строк), Approach (41), Tool (4), User (1 админ).

- [x] **Step 5: Commit**

```powershell
git add server/prisma/seed.ts server/package.json
git commit -m "feat(server): idempotent seed script incl. admin from env"
```

---

## Критерий готовности модуля

- Миграция применяется на чистую БД; сид идемпотентен.
- В БД: 9 стадий, 41 подход, инструменты, 1 админ.
- Список инструментов помечен как плейсхолдер — уточнить у заказчика до деплоя.
