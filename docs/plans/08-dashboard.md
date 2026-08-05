# 08 · Дашборд (5 виджетов) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Командный дашборд: квадранты «частота × польза» (границы-медианы появляются от 50 записей), покрытие стадий, динамика средней пользы по месяцам, разброс между участниками, сортируемая таблица подходов; панель записей подхода без раскрытия авторства; кнопка экспорта CSV для observer.

**Architecture:** Все агрегаты считаются на сервере (`lib/aggregate.ts`, чистые функции под TDD) — так авторство не покидает бэкенд: виджет разброса получает только min/max/дельту, панель записей — записи без `userId`. Виджеты — свои SVG-компоненты на токенах (`--color-accent` для графики, `--warn`/`--bad` для порогов доверия), без чартовых библиотек.

**Tech Stack:** Fastify, Prisma, Vue 3, PrimeVue (Drawer), SVG.

---

### Task 1: Агрегаты (TDD)

**Files:**
- Create: `server/src/lib/aggregate.ts`
- Test: `server/test/aggregate.spec.ts`

- [x] **Step 1: Падающий тест**

`server/test/aggregate.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  round1, median, approachStats, stageCoverage, monthlySeries, spreadByApproach,
} from '../src/lib/aggregate.js'
import type { AggEntry } from '../src/lib/aggregate.js'

const stage = { code: 'code', title: 'Написание кода', order: 3 }
const e = (over: Partial<AggEntry>): AggEntry => ({
  userId: 'u1',
  createdAt: new Date('2026-08-10T10:00:00Z'),
  stage,
  approach: { id: 'a1', title: 'Автокомплит в IDE' },
  usefulness: 4,
  trust: 3,
  ...over,
})

describe('median (границы квадрантов — медианы, ТЗ §3.4)', () => {
  it('нечётное и чётное число элементов', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })
})

describe('approachStats (ТЗ §4)', () => {
  it('n, средние с округлением, охват — distinct userId', () => {
    const stats = approachStats([
      e({ usefulness: 5, trust: 4 }),
      e({ usefulness: 4, trust: 3, userId: 'u2' }),
      e({ usefulness: 3, trust: 5, userId: 'u2' }),
    ])
    expect(stats).toEqual([
      {
        approachId: 'a1', title: 'Автокомплит в IDE', stageCode: 'code',
        stageTitle: 'Написание кода', n: 3, coverage: 2,
        avgUsefulness: 4, avgTrust: 4, lowData: true,
      },
    ])
  })
  it('записи без approachId не попадают в статистику подходов', () => {
    expect(approachStats([e({ approach: null })])).toEqual([])
  })
})

describe('stageCoverage (виджет 2)', () => {
  it('включает стадии с нулём записей', () => {
    const rows = stageCoverage(
      [stage, { code: 'test', title: 'Тесты', order: 6 }],
      [e({}), e({})],
    )
    expect(rows).toEqual([
      { code: 'code', title: 'Написание кода', n: 2 },
      { code: 'test', title: 'Тесты', n: 0 },
    ])
  })
})

describe('monthlySeries (виджет 3)', () => {
  it('среднее по месяцам, суммарно и по стадиям', () => {
    const rows = monthlySeries([
      e({ usefulness: 4 }),
      e({ usefulness: 2, createdAt: new Date('2026-09-01T10:00:00Z') }),
      e({ usefulness: 4, createdAt: new Date('2026-09-02T10:00:00Z') }),
    ])
    expect(rows).toEqual([
      { month: '2026-08', total: { n: 1, avg: 4 }, byStage: { code: { n: 1, avg: 4 } } },
      { month: '2026-09', total: { n: 2, avg: 3 }, byStage: { code: { n: 2, avg: 3 } } },
    ])
  })
})

describe('spreadByApproach (виджет 4: min–max средних участников)', () => {
  it('считает разброс средних usefulness по участникам', () => {
    const rows = spreadByApproach([
      e({ userId: 'u1', usefulness: 5 }),
      e({ userId: 'u1', usefulness: 4 }), // средняя u1 = 4.5
      e({ userId: 'u2', usefulness: 2 }), // средняя u2 = 2
    ])
    expect(rows).toEqual([
      { approachId: 'a1', title: 'Автокомплит в IDE', n: 3, min: 2, max: 4.5, delta: 2.5 },
    ])
  })
})

describe('round1', () => {
  it('один знак после запятой (ТЗ §4)', () => {
    expect(round1(3.14159)).toBe(3.1)
  })
})
```

- [x] **Step 2: Убедиться, что падает**

Run: `npx vitest run -r server` → FAIL

- [x] **Step 3: Реализация**

`server/src/lib/aggregate.ts`:

```ts
export const round1 = (x: number) => Math.round(x * 10) / 10
export const LOW_DATA_N = 5 // «при N < 5 — мало данных»
export const QUADRANT_MIN_TOTAL = 50 // границы квадрантов скрыты до 50 записей (ТЗ §3.4)

export interface AggEntry {
  userId: string
  createdAt: Date
  stage: { code: string; title: string; order: number }
  approach: { id: string; title: string } | null
  usefulness: number
  trust: number
}

const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function groupBy<T>(list: T[], key: (t: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of list) {
    const k = key(item)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(item)
  }
  return map
}

export interface ApproachStat {
  approachId: string
  title: string
  stageCode: string
  stageTitle: string
  n: number
  coverage: number
  avgUsefulness: number
  avgTrust: number
  lowData: boolean
}

export function approachStats(entries: AggEntry[]): ApproachStat[] {
  const withApproach = entries.filter((e) => e.approach)
  return [...groupBy(withApproach, (e) => e.approach!.id).values()].map((list) => ({
    approachId: list[0].approach!.id,
    title: list[0].approach!.title,
    stageCode: list[0].stage.code,
    stageTitle: list[0].stage.title,
    n: list.length,
    coverage: new Set(list.map((e) => e.userId)).size,
    avgUsefulness: round1(avg(list.map((e) => e.usefulness))),
    avgTrust: round1(avg(list.map((e) => e.trust))),
    lowData: list.length < LOW_DATA_N,
  }))
}

export function stageCoverage(
  stages: { code: string; title: string; order: number }[],
  entries: AggEntry[],
): { code: string; title: string; n: number }[] {
  return [...stages]
    .sort((a, b) => a.order - b.order)
    .map((s) => ({
      code: s.code,
      title: s.title,
      n: entries.filter((e) => e.stage.code === s.code).length,
    }))
}

export interface MonthPoint {
  month: string
  total: { n: number; avg: number }
  byStage: Record<string, { n: number; avg: number }>
}

export function monthlySeries(entries: AggEntry[]): MonthPoint[] {
  return [...groupBy(entries, (e) => e.createdAt.toISOString().slice(0, 7)).entries()]
    .map(([month, list]) => ({
      month,
      total: { n: list.length, avg: round1(avg(list.map((e) => e.usefulness))) },
      byStage: Object.fromEntries(
        [...groupBy(list, (e) => e.stage.code).entries()].map(([code, ls]) => [
          code,
          { n: ls.length, avg: round1(avg(ls.map((e) => e.usefulness))) },
        ]),
      ),
    }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

export interface SpreadRow {
  approachId: string
  title: string
  n: number
  min: number
  max: number
  delta: number
}

// Разброс средних usefulness участников (допущение №4 в README планов)
export function spreadByApproach(entries: AggEntry[]): SpreadRow[] {
  const withApproach = entries.filter((e) => e.approach)
  return [...groupBy(withApproach, (e) => e.approach!.id).values()].map((list) => {
    const perUser = [...groupBy(list, (e) => e.userId).values()].map((ls) =>
      round1(avg(ls.map((e) => e.usefulness))),
    )
    const min = Math.min(...perUser)
    const max = Math.max(...perUser)
    return {
      approachId: list[0].approach!.id,
      title: list[0].approach!.title,
      n: list.length,
      min,
      max,
      delta: round1(max - min),
    }
  })
}
```

- [x] **Step 4: Тесты зелёные + Commit**

Run: `npx vitest run -r server` → PASS

```powershell
git add server/src/lib/aggregate.ts server/test/aggregate.spec.ts
git commit -m "feat(server): dashboard aggregates (TDD)"
```

---

### Task 2: Роуты дашборда (анонимность)

**Files:**
- Create: `server/src/routes/dashboard.ts`
- Modify: `server/src/app.ts`
- Test: `server/test/dashboard.spec.ts`

- [x] **Step 1: Падающий тест**

`server/test/dashboard.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildApp } from '../src/app.js'

const users = [
  { id: 'u1', name: 'Дев', login: 'dev', password: 'p', role: 'dev', active: true, createdById: null },
  { id: 'u9', name: 'Наб', login: 'obs', password: 'p', role: 'observer', active: true, createdById: null },
]
const stage = { id: 's1', code: 'code', title: 'Написание кода', order: 3, active: true }
const approach = { id: 'a1', code: 'x', stageId: 's1', title: 'Автокомплит', description: null, order: 1, active: true, isCustom: false }
const tool = { id: 't1', code: 'copilot', title: 'Copilot', active: true }
const entries = [
  {
    id: 'e1', userId: 'u1', createdAt: new Date('2026-08-10T10:00:00Z'), stageId: 's1',
    approachId: 'a1', customApproachText: null, taskRef: null, toolId: 't1',
    usefulness: 4, trust: 3, note: 'секретная заметка', deletedAt: null,
    stage, approach, tool, user: users[0],
  },
]

const fakePrisma = {
  user: {
    findUnique: async ({ where }: never) => users.find((u) => u.login === (where as { login: string }).login) ?? null,
    findMany: async () => users,
    count: async () => 2,
  },
  stage: { findMany: async () => [stage] },
  entry: { findMany: async () => entries },
} as never

const auth = (login: string) => ({
  authorization: 'Basic ' + Buffer.from(`${login}:p`).toString('base64'),
})

describe('GET /api/dashboard', () => {
  it('доступен всем ролям, включая observer', async () => {
    const app = buildApp({ prisma: fakePrisma })
    const res = await app.inject({ url: '/api/dashboard', headers: auth('obs') })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.totalEntries).toBe(1)
    expect(body.approaches[0].n).toBe(1)
    expect(body.stages.length).toBe(1)
    // авторство не покидает бэкенд
    expect(JSON.stringify(body)).not.toContain('u1')
  })
})

describe('GET /api/dashboard/approaches/:id/entries', () => {
  it('записи подхода без автора (ТЗ §3.4)', async () => {
    const app = buildApp({ prisma: fakePrisma })
    const res = await app.inject({ url: '/api/dashboard/approaches/a1/entries', headers: auth('dev') })
    expect(res.statusCode).toBe(200)
    const list = res.json()
    expect(list[0].note).toBe('секретная заметка')
    expect(list[0].userId).toBeUndefined()
    expect(JSON.stringify(list)).not.toContain('"user"')
  })
})
```

- [x] **Step 2: Убедиться, что падает**

Run: `npx vitest run -r server` → FAIL (404)

- [x] **Step 3: Реализация**

`server/src/routes/dashboard.ts`:

```ts
import type { FastifyInstance } from 'fastify'
import {
  approachStats, stageCoverage, monthlySeries, spreadByApproach, type AggEntry,
} from '../lib/aggregate.js'

export async function dashboardRoutes(app: FastifyInstance) {
  const { prisma } = app.deps
  const guard = { preHandler: app.authenticate } // дашборд доступен всем ролям

  app.get('/api/dashboard', guard, async () => {
    const [entries, stages, teamSize] = await Promise.all([
      prisma.entry.findMany({
        where: { deletedAt: null }, // удалённые не входят в агрегаты (ТЗ §4)
        include: { stage: true, approach: true },
      }),
      prisma.stage.findMany({ where: { active: true } }),
      prisma.user.count({ where: { active: true, role: { in: ['dev', 'lead', 'admin'] } } }),
    ])
    const agg: AggEntry[] = entries.map((e) => ({
      userId: e.userId,
      createdAt: e.createdAt,
      stage: { code: e.stage.code, title: e.stage.title, order: e.stage.order },
      approach: e.approach ? { id: e.approach.id, title: e.approach.title } : null,
      usefulness: e.usefulness,
      trust: e.trust,
    }))
    return {
      totalEntries: agg.length,
      teamSize, // знаменатель охвата n/4 (допущение №5)
      approaches: approachStats(agg),
      stages: stageCoverage(stages, agg),
      monthly: monthlySeries(agg),
      spread: spreadByApproach(agg),
    }
  })

  app.get('/api/dashboard/approaches/:id/entries', guard, async (req) => {
    const id = (req.params as { id: string }).id
    const entries = await app.deps.prisma.entry.findMany({
      where: { deletedAt: null, approachId: id },
      include: { tool: true },
      orderBy: { createdAt: 'desc' },
    })
    // Автор записи не отображается (ТЗ §3.4)
    return entries.map((e) => ({
      id: e.id,
      createdAt: e.createdAt,
      taskRef: e.taskRef,
      toolTitle: e.tool.title,
      usefulness: e.usefulness,
      trust: e.trust,
      note: e.note,
    }))
  })
}
```

В `server/src/app.ts`: `app.register(dashboardRoutes)`.

- [x] **Step 4: Тесты зелёные + Commit**

Run: `npx vitest run -r server` → PASS

```powershell
git add server/src server/test/dashboard.spec.ts
git commit -m "feat(server): dashboard routes with author anonymity"
```

---

### Task 3: Хелперы квадрантов на клиенте (TDD)

**Files:**
- Create: `web/src/lib/quadrant.ts`
- Test: `web/test/quadrant.spec.ts`

- [x] **Step 1: Падающий тест**

`web/test/quadrant.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { pointColor, pointRadius, median, QUADRANT_MIN_TOTAL } from '../src/lib/quadrant.js'

describe('quadrant helpers (ТЗ §3.4, виджет 1)', () => {
  it('цвет по доверию: < 2.6 bad, < 3.6 warn, иначе accent', () => {
    expect(pointColor(2.5)).toBe('var(--bad)')
    expect(pointColor(3.5)).toBe('var(--warn)')
    expect(pointColor(3.6)).toBe('var(--color-accent)')
  })
  it('размер точки: 10 + min(20, N×1.1) px (диаметр)', () => {
    expect(pointRadius(0)).toBe(5)
    expect(pointRadius(10)).toBe((10 + 11) / 2)
    expect(pointRadius(100)).toBe(15) // капается на 20
  })
  it('медиана и порог 50 записей', () => {
    expect(median([1, 5, 3])).toBe(3)
    expect(QUADRANT_MIN_TOTAL).toBe(50)
  })
})
```

- [x] **Step 2: Убедиться, что падает**

Run: `npx vitest run -r web` → FAIL

- [x] **Step 3: Реализация**

`web/src/lib/quadrant.ts`:

```ts
export const QUADRANT_MIN_TOTAL = 50

export function pointColor(avgTrust: number): string {
  if (avgTrust < 2.6) return 'var(--bad)'
  if (avgTrust < 3.6) return 'var(--warn)'
  return 'var(--color-accent)'
}

// Диаметр 10 + min(20, N × 1.1) px → радиус
export const pointRadius = (n: number) => (10 + Math.min(20, n * 1.1)) / 2

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
```

- [x] **Step 4: Тесты зелёные + Commit**

Run: `npx vitest run -r web` → PASS

```powershell
git add web/src/lib/quadrant.ts web/test/quadrant.spec.ts
git commit -m "feat(web): quadrant helpers (TDD)"
```

---

### Task 4: Типы дашборда и панель записей

**Files:**
- Create: `web/src/api/dashboardTypes.ts`
- Create: `web/src/components/dashboard/EntriesDrawer.vue`

- [x] **Step 1: Типы ответа**

`web/src/api/dashboardTypes.ts`:

```ts
export interface ApproachStat {
  approachId: string
  title: string
  stageCode: string
  stageTitle: string
  n: number
  coverage: number
  avgUsefulness: number
  avgTrust: number
  lowData: boolean
}

export interface DashboardData {
  totalEntries: number
  teamSize: number
  approaches: ApproachStat[]
  stages: { code: string; title: string; n: number }[]
  monthly: {
    month: string
    total: { n: number; avg: number }
    byStage: Record<string, { n: number; avg: number }>
  }[]
  spread: { approachId: string; title: string; n: number; min: number; max: number; delta: number }[]
}

export interface AnonEntry {
  id: string
  createdAt: string
  taskRef: string | null
  toolTitle: string
  usefulness: number
  trust: number
  note: string | null
}
```

- [x] **Step 2: Панель записей (drawer 520px, без автора)**

`web/src/components/dashboard/EntriesDrawer.vue`:

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'
import Drawer from 'primevue/drawer'
import { api } from '../../api/client.js'
import type { AnonEntry, ApproachStat } from '../../api/dashboardTypes.js'
import { fmtDate } from '../../lib/format.js'

const props = defineProps<{ approach: ApproachStat | null }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const entries = ref<AnonEntry[]>([])

watch(
  () => props.approach,
  async (a) => {
    entries.value = a
      ? await api<AnonEntry[]>(`/api/dashboard/approaches/${a.approachId}/entries`)
      : []
  },
)
</script>

<template>
  <Drawer
    :visible="!!props.approach"
    position="right"
    :header="props.approach?.title"
    style="width: 520px"
    @update:visible="emit('close')"
  >
    <div class="flex flex-col gap-(--space-3)">
      <span v-if="props.approach" class="meta tnum">
        N={{ props.approach.n }} · польза {{ props.approach.avgUsefulness }} · доверие
        {{ props.approach.avgTrust }}
      </span>
      <div
        v-for="e in entries"
        :key="e.id"
        class="flex flex-col gap-(--space-1)"
        style="border-top: 1px solid var(--color-neutral-900); padding-top: var(--space-3)"
      >
        <span class="meta tnum">
          {{ fmtDate(e.createdAt) }} · {{ e.toolTitle
          }}<template v-if="e.taskRef"> · {{ e.taskRef }}</template>
          · польза {{ e.usefulness }} · доверие {{ e.trust }}
        </span>
        <span v-if="e.note" style="font-size: 12.5px">{{ e.note }}</span>
      </div>
    </div>
  </Drawer>
</template>
```

- [x] **Step 3: Commit**

```powershell
git add web/src/api/dashboardTypes.ts web/src/components/dashboard/EntriesDrawer.vue
git commit -m "feat(web): dashboard types and anonymous entries drawer"
```

---

### Task 5: Виджеты 1–4

**Files:**
- Create: `web/src/components/dashboard/QuadrantChart.vue`
- Create: `web/src/components/dashboard/StageCoverageCard.vue`
- Create: `web/src/components/dashboard/TrendCard.vue`
- Create: `web/src/components/dashboard/SpreadCard.vue`

- [x] **Step 1: Виджет 1 — квадранты**

`web/src/components/dashboard/QuadrantChart.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { ApproachStat } from '../../api/dashboardTypes.js'
import { pointColor, pointRadius, median, QUADRANT_MIN_TOTAL } from '../../lib/quadrant.js'

const props = defineProps<{ approaches: ApproachStat[]; totalEntries: number }>()
const emit = defineEmits<{ (e: 'select', a: ApproachStat): void }>()

const W = 640
const H = 340
const PAD = 28

const maxN = computed(() => Math.max(5, ...props.approaches.map((a) => a.n)))
const x = (n: number) => PAD + (n / maxN.value) * (W - 2 * PAD)
const y = (u: number) => H - PAD - ((u - 1) / 4) * (H - 2 * PAD)

// Границы — медианы по подходам с ≥ 1 записью; до 50 записей всего скрыты (ТЗ §3.4)
const showBounds = computed(() => props.totalEntries >= QUADRANT_MIN_TOTAL)
const mx = computed(() => median(props.approaches.map((a) => a.n)))
const my = computed(() => median(props.approaches.map((a) => a.avgUsefulness)))

// X — частота, Y — польза: ↑← продвигать, ↑→ закрепить, ↓← отбросить, ↓→ разбираться
const corners = [
  { label: 'продвигать', cx: PAD + 4, cy: PAD + 12, anchor: 'start' },
  { label: 'закрепить', cx: W - PAD - 4, cy: PAD + 12, anchor: 'end' },
  { label: 'отбросить', cx: PAD + 4, cy: H - PAD - 6, anchor: 'start' },
  { label: 'разбираться', cx: W - PAD - 4, cy: H - PAD - 6, anchor: 'end' },
]
</script>

<template>
  <div class="card flex flex-col gap-(--space-3)">
    <div class="flex items-center gap-(--space-3)">
      <h2>Квадранты: частота × польза</h2>
      <span v-if="showBounds" class="meta ml-auto">границы предварительные</span>
      <span v-else class="meta ml-auto">границы появятся после 50 записей</span>
    </div>
    <svg :viewBox="`0 0 ${W} ${H}`" style="width: 100%; height: 340px">
      <rect :x="PAD" :y="PAD" :width="W - 2 * PAD" :height="H - 2 * PAD"
        fill="none" stroke="var(--color-neutral-800)" />
      <template v-if="showBounds">
        <line :x1="x(mx)" :y1="PAD" :x2="x(mx)" :y2="H - PAD"
          stroke="var(--color-neutral-700)" stroke-dasharray="4 4" />
        <line :x1="PAD" :y1="y(my)" :x2="W - PAD" :y2="y(my)"
          stroke="var(--color-neutral-700)" stroke-dasharray="4 4" />
        <text v-for="c in corners" :key="c.label" :x="c.cx" :y="c.cy" :text-anchor="c.anchor"
          style="font-size: 10.5px; fill: var(--color-neutral-500)">{{ c.label }}</text>
      </template>
      <circle
        v-for="a in props.approaches"
        :key="a.approachId"
        :cx="x(a.n)"
        :cy="y(a.avgUsefulness)"
        :r="pointRadius(a.n)"
        :stroke="pointColor(a.avgTrust)"
        :fill="pointColor(a.avgTrust)"
        fill-opacity="0.4"
        style="cursor: pointer"
        @click="emit('select', a)"
      >
        <title>{{ a.title }} — N={{ a.n }}, польза {{ a.avgUsefulness }}, доверие {{ a.avgTrust }}</title>
      </circle>
    </svg>
    <span class="meta">X — число применений, Y — средняя польза, размер — N, цвет — доверие</span>
  </div>
</template>
```

- [x] **Step 2: Виджет 2 — покрытие стадий**

`web/src/components/dashboard/StageCoverageCard.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ stages: { code: string; title: string; n: number }[] }>()
const maxN = computed(() => Math.max(1, ...props.stages.map((s) => s.n)))
const LOW = 5
</script>

<template>
  <div class="card flex flex-col gap-(--space-3)">
    <h2>Покрытие стадий</h2>
    <div
      v-for="s in props.stages"
      :key="s.code"
      class="grid items-center gap-(--space-3)"
      style="grid-template-columns: 130px minmax(0, 1fr) 84px"
    >
      <span class="meta">{{ s.title }}</span>
      <div style="height: 9px; background: var(--color-neutral-900); border-radius: 4px">
        <div
          :style="{
            width: (s.n / maxN) * 100 + '%',
            height: '9px',
            borderRadius: '4px',
            background: s.n < LOW ? 'var(--warn)' : 'var(--color-accent)',
          }"
        />
      </div>
      <span class="meta tnum">
        {{ s.n }} n
        <i v-if="s.n < LOW" class="pi pi-exclamation-triangle" style="color: var(--warn); font-size: 11px" />
      </span>
    </div>
  </div>
</template>
```

- [x] **Step 3: Виджет 3 — динамика средней пользы**

`web/src/components/dashboard/TrendCard.vue`:

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DashboardData } from '../../api/dashboardTypes.js'
import { fmtMonth } from '../../lib/format.js'

const props = defineProps<{
  monthly: DashboardData['monthly']
  stages: DashboardData['stages']
}>()
const stageFilter = ref('') // '' = суммарно

const points = computed(() =>
  props.monthly.map((m) => {
    const src = stageFilter.value ? m.byStage[stageFilter.value] ?? { n: 0, avg: 0 } : m.total
    return { month: m.month, ...src }
  }),
)

const W = 480
const H = 200
const PAD = 24
const x = (i: number) =>
  PAD + (points.value.length > 1 ? (i / (points.value.length - 1)) * (W - 2 * PAD) : (W - 2 * PAD) / 2)
const y = (avg: number) => H - PAD - ((avg - 1) / 4) * (H - 2 * PAD)
const polyline = computed(() =>
  points.value.filter((p) => p.n > 0).map((p, _, arr) =>
    `${x(points.value.indexOf(p))},${y(p.avg)}`).join(' '),
)
</script>

<template>
  <div class="card flex flex-col gap-(--space-3)">
    <div class="flex items-center gap-(--space-3)">
      <h2>Динамика средней пользы</h2>
      <select v-model="stageFilter" class="input ml-auto" style="width: 170px">
        <option value="">Суммарно</option>
        <option v-for="s in props.stages" :key="s.code" :value="s.code">{{ s.title }}</option>
      </select>
    </div>
    <svg :viewBox="`0 0 ${W} ${H + 30}`" style="width: 100%">
      <polyline :points="polyline" fill="none" stroke="var(--color-accent)" stroke-width="2" />
      <template v-for="(p, i) in points" :key="p.month">
        <circle v-if="p.n > 0" :cx="x(i)" :cy="y(p.avg)" r="4" fill="var(--color-accent)" />
        <text :x="x(i)" :y="H + 8" text-anchor="middle"
          style="font-size: 10.5px; fill: var(--color-neutral-500)">{{ fmtMonth(p.month) }}</text>
        <text :x="x(i)" :y="H + 22" text-anchor="middle" class="tnum"
          :style="{ fontSize: '10.5px', fill: p.n < 5 ? 'var(--color-neutral-600)' : 'var(--color-text)' }"
          >{{ p.n > 0 ? `${p.avg} · N=${p.n}` : '—' }}</text>
      </template>
    </svg>
  </div>
</template>
```

- [x] **Step 4: Виджет 4 — разброс между участниками**

`web/src/components/dashboard/SpreadCard.vue`:

```vue
<script setup lang="ts">
import type { DashboardData } from '../../api/dashboardTypes.js'

const props = defineProps<{ spread: DashboardData['spread'] }>()
const pct = (v: number) => ((v - 1) / 4) * 100
</script>

<template>
  <div class="card flex flex-col gap-(--space-3)">
    <h2>Разброс между участниками</h2>
    <div
      v-for="row in props.spread"
      :key="row.approachId"
      class="grid items-center gap-(--space-3)"
      style="grid-template-columns: minmax(0, 1fr) 180px 64px"
    >
      <span class="meta">{{ row.title }}</span>
      <!-- При N ≤ 5 отрезок не строится (ТЗ §3.4, виджет 4) -->
      <template v-if="row.n > 5">
        <div style="position: relative; height: 9px; background: var(--color-neutral-900); border-radius: 4px">
          <div
            :style="{
              position: 'absolute',
              left: pct(row.min) + '%',
              width: Math.max(2, pct(row.max) - pct(row.min)) + '%',
              height: '9px',
              borderRadius: '4px',
              background: row.delta >= 2 ? 'var(--warn)' : 'var(--color-accent)',
            }"
          />
        </div>
        <span class="meta tnum">±{{ row.delta }}</span>
      </template>
      <span v-else class="meta" style="grid-column: span 2">
        недостаточно данных для формирования результата
      </span>
    </div>
    <span class="meta">Большой разброс — дело в способе применения: повод обменяться практиками</span>
  </div>
</template>
```

- [x] **Step 5: Commit**

```powershell
git add web/src/components/dashboard
git commit -m "feat(web): dashboard widgets 1-4"
```

---

### Task 6: Виджет 5 (таблица) и сборка экрана

**Files:**
- Create: `web/src/components/dashboard/ApproachesTable.vue`
- Modify: `web/src/views/DashboardView.vue` (заменить заглушку целиком)

- [x] **Step 1: Таблица подходов**

`web/src/components/dashboard/ApproachesTable.vue`:

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ApproachStat } from '../../api/dashboardTypes.js'

const props = defineProps<{ approaches: ApproachStat[]; teamSize: number }>()
const emit = defineEmits<{ (e: 'select', a: ApproachStat): void }>()

type Key = 'title' | 'stageTitle' | 'n' | 'avgUsefulness' | 'avgTrust' | 'coverage'
const sortKey = ref<Key>('n')
const sortDir = ref<1 | -1>(-1)

const COLUMNS: { key: Key; title: string }[] = [
  { key: 'title', title: 'Подход' },
  { key: 'stageTitle', title: 'Стадия' },
  { key: 'n', title: 'N' },
  { key: 'avgUsefulness', title: 'Польза' },
  { key: 'avgTrust', title: 'Доверие' },
  { key: 'coverage', title: 'Охват' },
]

function sortBy(key: Key) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 1 ? -1 : 1
  else {
    sortKey.value = key
    sortDir.value = key === 'title' || key === 'stageTitle' ? 1 : -1
  }
}

const sorted = computed(() =>
  [...props.approaches].sort((a, b) => {
    const [x, y] = [a[sortKey.value], b[sortKey.value]]
    return (typeof x === 'string' ? String(x).localeCompare(String(y)) : Number(x) - Number(y)) * sortDir.value
  }),
)
</script>

<template>
  <div class="card flex flex-col gap-(--space-3)">
    <h2>Таблица подходов</h2>
    <div style="max-height: 360px; overflow-y: auto">
      <table style="width: 100%; border-collapse: collapse; font-size: 12.5px">
        <thead style="position: sticky; top: 0; background: var(--color-surface)">
          <tr>
            <th
              v-for="c in COLUMNS"
              :key="c.key"
              class="section-label"
              style="text-align: left; padding: var(--space-2) var(--space-3); cursor: pointer"
              @click="sortBy(c.key)"
            >
              {{ c.title }}
              <i
                v-if="sortKey === c.key"
                :class="sortDir === 1 ? 'pi pi-arrow-up' : 'pi pi-arrow-down'"
                style="font-size: 9px"
              />
            </th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="a in sorted"
            :key="a.approachId"
            style="border-top: 1px solid var(--color-neutral-900); cursor: pointer"
            @click="emit('select', a)"
          >
            <td style="padding: var(--space-2) var(--space-3)">{{ a.title }}</td>
            <td class="meta">{{ a.stageTitle }}</td>
            <td class="tnum">{{ a.n }}</td>
            <td class="tnum" :style="a.lowData ? { color: 'var(--color-neutral-600)' } : {}">
              {{ a.avgUsefulness }}
            </td>
            <td class="tnum" :style="a.lowData ? { color: 'var(--color-neutral-600)' } : {}">
              {{ a.avgTrust }}
            </td>
            <td class="tnum">{{ a.coverage }}/{{ props.teamSize }}</td>
            <td>
              <span v-if="a.lowData" class="meta" style="color: var(--warn-dim)">мало данных</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
```

- [x] **Step 2: Сборка экрана**

`web/src/views/DashboardView.vue`:

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { api } from '../api/client.js'
import { useAuth } from '../stores/auth.js'
import { canAccessAdmin, canExportCsv } from '../lib/permissions.js'
import { downloadFile } from '../lib/download.js'
import type { ApproachStat, DashboardData } from '../api/dashboardTypes.js'
import QuadrantChart from '../components/dashboard/QuadrantChart.vue'
import StageCoverageCard from '../components/dashboard/StageCoverageCard.vue'
import TrendCard from '../components/dashboard/TrendCard.vue'
import SpreadCard from '../components/dashboard/SpreadCard.vue'
import ApproachesTable from '../components/dashboard/ApproachesTable.vue'
import EntriesDrawer from '../components/dashboard/EntriesDrawer.vue'

const auth = useAuth()
const toast = useToast()
const data = ref<DashboardData | null>(null)
const selected = ref<ApproachStat | null>(null)

// Экспорт на дашборде — для observer, которому админка недоступна (ТЗ §3.5)
const showExport = computed(
  () => !!auth.user && canExportCsv(auth.user.role) && !canAccessAdmin(auth.user.role),
)

async function exportCsv() {
  await downloadFile('/api/export.csv', 'clever-vibe-entries.csv')
  toast.add({ severity: 'success', summary: 'CSV выгружен', life: 2200 })
}

onMounted(async () => {
  data.value = await api<DashboardData>('/api/dashboard')
})
</script>

<template>
  <div v-if="data" class="p-(--space-8) flex flex-col gap-(--space-6)">
    <div class="flex items-center">
      <h1>Дашборд</h1>
      <span class="meta tnum" style="margin-left: var(--space-4)">всего записей: {{ data.totalEntries }}</span>
      <button v-if="showExport" class="btn btn-secondary ml-auto" @click="exportCsv">
        <i class="pi pi-download" /> Экспорт CSV
      </button>
    </div>

    <div class="grid gap-(--space-6)" style="grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr)">
      <QuadrantChart
        :approaches="data.approaches"
        :total-entries="data.totalEntries"
        @select="selected = $event"
      />
      <StageCoverageCard :stages="data.stages" />
    </div>

    <div class="grid gap-(--space-6)" style="grid-template-columns: minmax(0, 1fr) minmax(0, 1.45fr)">
      <TrendCard :monthly="data.monthly" :stages="data.stages" />
      <SpreadCard :spread="data.spread" />
    </div>

    <ApproachesTable
      :approaches="data.approaches"
      :team-size="data.teamSize"
      @select="selected = $event"
    />

    <EntriesDrawer :approach="selected" @close="selected = null" />
  </div>
</template>
```

- [ ] **Step 3: Проверка в браузере (сценарии ТЗ §3.4)**

Нужны данные: внести 10–15 записей разными пользователями по разным стадиям/подходам.
1. Пока записей < 50: квадранты — только облако точек, без границ и подписей; подпись «границы появятся после 50 записей».
2. Временно поменять `QUADRANT_MIN_TOTAL` на 5 (в `web/src/lib/quadrant.ts`) → границы-медианы, подписи углов и «границы предварительные». Вернуть 50.
3. Клик по точке и по строке таблицы → правая панель 520px со всеми записями подхода и заметками, **без автора**.
4. Покрытие стадий: пустые/малые стадии — жёлтая полоса и предупреждение.
5. Динамика: переключение «Суммарно»/стадия; значения с N < 5 приглушены; N подписан.
6. Разброс: у подхода с N ≤ 5 — текст «недостаточно данных…»; при разбросе ≥ 2 отрезок жёлтый (устроить руками: два пользователя с оценками 1 и 5).
7. Таблица: сортировка по каждой колонке с индикатором, sticky-заголовок при скролле, охват «n/4», флаг «мало данных».
8. Войти observer'ом: дашборд доступен, кнопка «Экспорт CSV» на месте, других табов нет.

- [x] **Step 4: Прогнать все тесты**

Run: `npx vitest run -r server; npx vitest run -r web` → PASS

- [x] **Step 5: Commit**

```powershell
git add web/src
git commit -m "feat(web): dashboard screen with five widgets and entries drawer"
```

---

## Критерий готовности модуля

- Пять виджетов по ТЗ §3.4, включая правило 50 записей, «мало данных» при N < 5 и «недостаточно данных…» при N ≤ 5 в разбросе.
- Авторство нигде не отображается и не покидает бэкенд (проверено тестом).
- Observer видит дашборд и экспорт, но не быстрый ввод.
