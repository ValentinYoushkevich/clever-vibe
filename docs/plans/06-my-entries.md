# 06 · «Мои записи» и сводка за месяц — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Экран «Мои записи»: список с фильтрами (стадия, месяц/весь пилот) и счётчиком, правка/удаление в окне 7 дней, блок «Моя сводка за месяц» (стадия → подход → N, средние, заметки, приглушение при N < 5) и «Копировать текстом».

**Architecture:** Все свои записи грузятся одним `GET /api/entries` (≤ ~150 строк за пилот), фильтры и сводка считаются на клиенте чистыми функциями (`summary.ts`, `summaryText.ts`) под тестами. Правка — диалог с теми же правилами, что быстрый ввод; сервер всё равно перепроверяет окно 7 дней (план 04).

**Tech Stack:** Vue 3, PrimeVue (Dialog, Toast), модули планов 04–05.

---

### Task 1: Сводка за месяц (TDD)

**Files:**
- Create: `web/src/lib/summary.ts`
- Test: `web/test/summary.spec.ts`
- Modify: `web/src/lib/format.ts` (round1, fmtMonth)

- [ ] **Step 1: Падающий тест**

`web/test/summary.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildSummary } from '../src/lib/summary.js'
import { round1, fmtMonth } from '../src/lib/format.js'
import type { Entry } from '../src/api/types.js'

const stageCode = { id: 's1', code: 'code', title: 'Написание кода', order: 3 }
const stageTest = { id: 's2', code: 'test', title: 'Тесты', order: 6 }
const appr = (id: string, title: string, stageId: string) =>
  ({ id, code: id, title, stageId, description: null, order: 1, isCustom: false })

const entry = (over: Partial<Entry>): Entry => ({
  id: Math.random().toString(36).slice(2),
  createdAt: '2026-08-10T10:00:00Z',
  stage: stageCode,
  approach: appr('a1', 'Автокомплит в IDE', 's1'),
  customApproachText: null,
  taskRef: null,
  tool: { id: 't1', code: 'copilot', title: 'GitHub Copilot' },
  usefulness: 4,
  trust: 3,
  note: null,
  ...over,
})

describe('round1 / fmtMonth', () => {
  it('округление до одного знака (ТЗ §4)', () => {
    expect(round1(3.66666)).toBe(3.7)
    expect(round1(4)).toBe(4)
  })
  it('месяц по-русски', () => {
    expect(fmtMonth('2026-08')).toBe('август 2026')
  })
})

describe('buildSummary (ТЗ §3.3: стадия → подход → N, средние, заметки)', () => {
  it('группирует и считает средние с округлением', () => {
    const s = buildSummary([
      entry({ usefulness: 5, trust: 4, note: 'быстро' }),
      entry({ usefulness: 4, trust: 3 }),
      entry({ usefulness: 3, trust: 3, stage: stageTest, approach: appr('a2', 'Генерация unit-тестов по готовому коду', 's2') }),
    ])
    expect(s.length).toBe(2)
    const code = s.find((x) => x.stageTitle === 'Написание кода')!
    expect(code.n).toBe(2)
    expect(code.approaches[0]).toMatchObject({
      title: 'Автокомплит в IDE',
      n: 2,
      avgUsefulness: 4.5,
      avgTrust: 3.5,
      lowData: true, // N < 5 (ТЗ: приглушение + «мало данных»)
      notes: ['быстро'],
    })
  })
  it('N ≥ 5 — не lowData', () => {
    const s = buildSummary(Array.from({ length: 5 }, () => entry({})))
    expect(s[0].approaches[0].lowData).toBe(false)
  })
  it('«другой подход» группируется по тексту', () => {
    const s = buildSummary([
      entry({ approach: null, customApproachText: 'свой способ' }),
      entry({ approach: null, customApproachText: 'свой способ' }),
    ])
    expect(s[0].approaches[0].title).toBe('свой способ')
    expect(s[0].approaches[0].n).toBe(2)
  })
})
```

- [ ] **Step 2: Убедиться, что падает**

Run: `npx vitest run -r web` → FAIL

- [ ] **Step 3: Реализация**

Дополнить `web/src/lib/format.ts`:

```ts
export const round1 = (x: number) => Math.round(x * 10) / 10

const MONTHS_RU = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
]

// '2026-08' → 'август 2026'
export function fmtMonth(month: string): string {
  const [y, m] = month.split('-')
  return `${MONTHS_RU[Number(m) - 1]} ${y}`
}
```

`web/src/lib/summary.ts`:

```ts
import type { Entry } from '../api/types.js'
import { round1 } from './format.js'

export const LOW_DATA_N = 5 // «при N < 5 — мало данных» (ТЗ §3.3/§3.4)

export interface SummaryApproach {
  title: string
  n: number
  avgUsefulness: number
  avgTrust: number
  lowData: boolean
  notes: string[]
}

export interface SummaryStage {
  stageTitle: string
  stageOrder: number
  n: number
  approaches: SummaryApproach[]
}

export function buildSummary(entries: Entry[]): SummaryStage[] {
  const byStage = new Map<string, Entry[]>()
  for (const e of entries) {
    const key = e.stage.id
    if (!byStage.has(key)) byStage.set(key, [])
    byStage.get(key)!.push(e)
  }

  const result: SummaryStage[] = []
  for (const list of byStage.values()) {
    const byApproach = new Map<string, Entry[]>()
    for (const e of list) {
      const key = e.approach?.title ?? e.customApproachText ?? '—'
      if (!byApproach.has(key)) byApproach.set(key, [])
      byApproach.get(key)!.push(e)
    }
    const approaches: SummaryApproach[] = [...byApproach.entries()]
      .map(([title, es]) => ({
        title,
        n: es.length,
        avgUsefulness: round1(es.reduce((s, e) => s + e.usefulness, 0) / es.length),
        avgTrust: round1(es.reduce((s, e) => s + e.trust, 0) / es.length),
        lowData: es.length < LOW_DATA_N,
        notes: es.map((e) => e.note).filter((n): n is string => !!n),
      }))
      .sort((a, b) => b.n - a.n)
    result.push({
      stageTitle: list[0].stage.title,
      stageOrder: list[0].stage.order,
      n: list.length,
      approaches,
    })
  }
  return result.sort((a, b) => a.stageOrder - b.stageOrder)
}
```

- [ ] **Step 4: Тесты зелёные + Commit**

Run: `npx vitest run -r web` → PASS

```powershell
git add web/src/lib web/test/summary.spec.ts
git commit -m "feat(web): monthly summary aggregation (TDD)"
```

---

### Task 2: Плоский текст сводки (TDD)

**Files:**
- Create: `web/src/lib/summaryText.ts`
- Test: `web/test/summaryText.spec.ts`

- [ ] **Step 1: Падающий тест**

`web/test/summaryText.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { summaryText } from '../src/lib/summaryText.js'

describe('summaryText (ТЗ §3.3: «Копировать текстом» — плоский текст)', () => {
  it('строит текст: заголовок, стадия+N, строки подходов, заметки', () => {
    const text = summaryText('2026-08', [
      {
        stageTitle: 'Написание кода',
        stageOrder: 3,
        n: 6,
        approaches: [
          {
            title: 'Автокомплит в IDE', n: 6, avgUsefulness: 4.2, avgTrust: 3.8,
            lowData: false, notes: ['быстро', 'иногда мимо'],
          },
        ],
      },
    ])
    expect(text).toBe(
      [
        'Моя сводка за август 2026',
        '',
        'Написание кода — 6 записей',
        '  Автокомплит в IDE — N=6, польза 4.2, доверие 3.8',
        '  Заметки:',
        '  - быстро',
        '  - иногда мимо',
      ].join('\n'),
    )
  })
  it('помечает строки с малым N', () => {
    const text = summaryText('2026-08', [
      {
        stageTitle: 'Тесты', stageOrder: 6, n: 2,
        approaches: [
          { title: 'Генерация unit-тестов', n: 2, avgUsefulness: 3, avgTrust: 3, lowData: true, notes: [] },
        ],
      },
    ])
    expect(text).toContain('N=2, польза 3, доверие 3 (мало данных)')
  })
})
```

- [ ] **Step 2: Убедиться, что падает**

Run: `npx vitest run -r web` → FAIL

- [ ] **Step 3: Реализация**

`web/src/lib/summaryText.ts`:

```ts
import type { SummaryStage } from './summary.js'
import { fmtMonth } from './format.js'

export function summaryText(month: string, stages: SummaryStage[]): string {
  const lines: string[] = [`Моя сводка за ${fmtMonth(month)}`]
  for (const s of stages) {
    lines.push('', `${s.stageTitle} — ${s.n} записей`)
    for (const a of s.approaches) {
      const suffix = a.lowData ? ' (мало данных)' : ''
      lines.push(`  ${a.title} — N=${a.n}, польза ${a.avgUsefulness}, доверие ${a.avgTrust}${suffix}`)
      if (a.notes.length) {
        lines.push('  Заметки:')
        for (const n of a.notes) lines.push(`  - ${n}`)
      }
    }
  }
  return lines.join('\n')
}
```

- [ ] **Step 4: Тесты зелёные + Commit**

Run: `npx vitest run -r web` → PASS

```powershell
git add web/src/lib/summaryText.ts web/test/summaryText.spec.ts
git commit -m "feat(web): summary flat-text export (TDD)"
```

---

### Task 3: Окно правки на клиенте

**Files:**
- Create: `web/src/lib/editWindow.ts`

- [ ] **Step 1: Модуль (копия серверного правила из плана 04 — менять синхронно)**

`web/src/lib/editWindow.ts`:

```ts
export const EDIT_WINDOW_DAYS = 7

export function canModify(createdAtIso: string, now: Date = new Date()): boolean {
  return now.getTime() - new Date(createdAtIso).getTime() < EDIT_WINDOW_DAYS * 24 * 60 * 60 * 1000
}
```

- [ ] **Step 2: Commit**

```powershell
git add web/src/lib/editWindow.ts
git commit -m "feat(web): client-side edit window mirror"
```

---

### Task 4: Экран «Мои записи»

**Files:**
- Modify: `web/src/views/MyEntriesView.vue` (заменить заглушку целиком)
- Create: `web/src/components/EntryEditDialog.vue`

- [ ] **Step 1: Диалог правки**

`web/src/components/EntryEditDialog.vue`:

```vue
<script setup lang="ts">
import { reactive, computed, watch } from 'vue'
import Dialog from 'primevue/dialog'
import { useDictionaries } from '../stores/dictionaries.js'
import type { Entry } from '../api/types.js'
import { api } from '../api/client.js'
import { USEFULNESS_LABELS, TRUST_LABELS } from '../lib/scales.js'
import RatingRow from './RatingRow.vue'

const props = defineProps<{ entry: Entry | null }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'saved'): void }>()
const dict = useDictionaries()

const form = reactive({
  stageId: '',
  approachId: null as string | null,
  customText: '',
  toolId: '',
  usefulness: null as number | null,
  trust: null as number | null,
  taskRef: '',
  note: '',
})

watch(
  () => props.entry,
  (e) => {
    if (!e) return
    Object.assign(form, {
      stageId: e.stage.id,
      approachId: e.approach?.id ?? null,
      customText: e.customApproachText ?? '',
      toolId: e.tool.id,
      usefulness: e.usefulness,
      trust: e.trust,
      taskRef: e.taskRef ?? '',
      note: e.note ?? '',
    })
  },
  { immediate: true },
)

const approaches = computed(() => dict.approachesByStage(form.stageId))
const isCustom = computed(() => !form.approachId)
const valid = computed(
  () =>
    !!form.stageId && !!form.toolId && form.usefulness && form.trust &&
    (form.approachId || form.customText.trim()),
)

async function save() {
  if (!valid.value || !props.entry) return
  await api(`/api/entries/${props.entry.id}`, {
    method: 'PATCH',
    body: {
      stageId: form.stageId,
      approachId: form.approachId ?? undefined,
      customApproachText: form.approachId ? undefined : form.customText.trim(),
      taskRef: form.taskRef.trim() || undefined,
      toolId: form.toolId,
      usefulness: form.usefulness,
      trust: form.trust,
      note: form.note.trim() || undefined,
    },
  })
  emit('saved')
}
</script>

<template>
  <Dialog
    :visible="!!props.entry"
    modal
    header="Изменить запись"
    style="width: 560px"
    @update:visible="emit('close')"
  >
    <div class="flex flex-col gap-(--space-4)">
      <label class="flex flex-col gap-(--space-2)">
        <span class="section-label">Стадия</span>
        <select
          v-model="form.stageId"
          class="input"
          @change="form.approachId = null"
        >
          <option v-for="s in dict.stages" :key="s.id" :value="s.id">{{ s.title }}</option>
        </select>
      </label>
      <label class="flex flex-col gap-(--space-2)">
        <span class="section-label">Подход</span>
        <select v-model="form.approachId" class="input">
          <option :value="null">Другой подход (текст ниже)</option>
          <option v-for="a in approaches" :key="a.id" :value="a.id">{{ a.title }}</option>
        </select>
      </label>
      <input
        v-if="isCustom"
        v-model="form.customText"
        class="input"
        placeholder="Текст подхода"
      />
      <RatingRow v-model="form.usefulness" label="Польза" :labels="USEFULNESS_LABELS" kind="usefulness" />
      <RatingRow v-model="form.trust" label="Доверие" :labels="TRUST_LABELS" kind="trust" />
      <div class="flex gap-(--space-4)">
        <label class="flex flex-col gap-(--space-2)" style="flex: 1">
          <span class="section-label">Инструмент</span>
          <select v-model="form.toolId" class="input">
            <option v-for="t in dict.tools" :key="t.id" :value="t.id">{{ t.title }}</option>
          </select>
        </label>
        <label class="flex flex-col gap-(--space-2)" style="width: 140px">
          <span class="section-label">Задача</span>
          <input v-model="form.taskRef" class="input tnum" />
        </label>
      </div>
      <label class="flex flex-col gap-(--space-2)">
        <span class="section-label">Заметка</span>
        <textarea v-model="form.note" class="input" rows="3" />
      </label>
      <div class="flex gap-(--space-3) justify-end">
        <button class="btn btn-secondary" @click="emit('close')">Отмена</button>
        <button class="btn btn-accent" :disabled="!valid" @click="save">Сохранить</button>
      </div>
    </div>
  </Dialog>
</template>
```

- [ ] **Step 2: Вью**

`web/src/views/MyEntriesView.vue`:

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { api } from '../api/client.js'
import type { Entry } from '../api/types.js'
import { useDictionaries } from '../stores/dictionaries.js'
import { canModify } from '../lib/editWindow.js'
import { buildSummary } from '../lib/summary.js'
import { summaryText } from '../lib/summaryText.js'
import { fmtDate, fmtMonth } from '../lib/format.js'
import EntryEditDialog from '../components/EntryEditDialog.vue'

const dict = useDictionaries()
const toast = useToast()
const all = ref<Entry[]>([])
const stageFilter = ref<string>('') // '' = все стадии
const monthFilter = ref<string>('all') // 'all' = весь пилот
const editing = ref<Entry | null>(null)

const months = computed(() => {
  const set = new Set(all.value.map((e) => e.createdAt.slice(0, 7)))
  return [...set].sort().reverse()
})

const shown = computed(() =>
  all.value.filter(
    (e) =>
      (!stageFilter.value || e.stage.id === stageFilter.value) &&
      (monthFilter.value === 'all' || e.createdAt.startsWith(monthFilter.value)),
  ),
)

// Сводка всегда за месяц: выбранный, иначе текущий (ТЗ §3.3 — «сводка за месяц»)
const summaryMonth = computed(() =>
  monthFilter.value === 'all' ? new Date().toISOString().slice(0, 7) : monthFilter.value,
)
const summary = computed(() =>
  buildSummary(all.value.filter((e) => e.createdAt.startsWith(summaryMonth.value))),
)

async function load() {
  all.value = await api<Entry[]>('/api/entries')
}

async function remove(e: Entry) {
  if (!confirm('Удалить запись?')) return
  await api(`/api/entries/${e.id}`, { method: 'DELETE' })
  toast.add({ severity: 'success', summary: 'Запись удалена', life: 2200 })
  await load()
}

async function onSaved() {
  editing.value = null
  toast.add({ severity: 'success', summary: 'Запись обновлена', life: 2200 })
  await load()
}

async function copySummary() {
  await navigator.clipboard.writeText(summaryText(summaryMonth.value, summary.value))
  toast.add({ severity: 'success', summary: 'Сводка скопирована', life: 2200 })
}

onMounted(async () => {
  await dict.load()
  await load()
})
</script>

<template>
  <div
    class="p-(--space-8) grid gap-(--space-6)"
    style="grid-template-columns: minmax(0, 1fr) 400px"
  >
    <!-- Список -->
    <div class="card flex flex-col gap-(--space-4)">
      <div class="flex items-center gap-(--space-4)">
        <h1>Мои записи</h1>
        <select v-model="stageFilter" class="input" style="width: 180px">
          <option value="">Все стадии</option>
          <option v-for="s in dict.stages" :key="s.id" :value="s.id">{{ s.title }}</option>
        </select>
        <select v-model="monthFilter" class="input" style="width: 160px">
          <option value="all">Весь пилот</option>
          <option v-for="m in months" :key="m" :value="m">{{ fmtMonth(m) }}</option>
        </select>
        <span class="meta ml-auto tnum">Показано: {{ shown.length }}</span>
      </div>

      <p v-if="!shown.length" class="meta">Записей нет</p>
      <div
        v-for="e in shown"
        :key="e.id"
        class="grid gap-(--space-3) items-start"
        style="
          grid-template-columns: 78px minmax(0, 1fr) 120px 92px;
          border-top: 1px solid var(--color-neutral-900);
          padding-top: var(--space-3);
        "
      >
        <span class="meta tnum">{{ fmtDate(e.createdAt) }}</span>
        <div class="flex flex-col gap-(--space-1)">
          <span>{{ e.approach?.title ?? e.customApproachText }}</span>
          <span class="meta">
            {{ e.stage.title }} · {{ e.tool.title
            }}<template v-if="e.taskRef"> · {{ e.taskRef }}</template>
          </span>
          <span
            v-if="e.note"
            class="meta"
            style="border-left: 2px solid var(--color-neutral-700); padding-left: var(--space-3)"
            >{{ e.note }}</span
          >
        </div>
        <span class="meta tnum">польза {{ e.usefulness }} · дов. {{ e.trust }}</span>
        <div class="flex flex-col gap-(--space-1)">
          <template v-if="canModify(e.createdAt)">
            <button class="btn btn-secondary" style="padding: 2px var(--space-3)" @click="editing = e">
              Изменить
            </button>
            <button class="btn btn-secondary" style="padding: 2px var(--space-3)" @click="remove(e)">
              Удалить
            </button>
          </template>
          <span v-else class="meta">7 дней прошло</span>
        </div>
      </div>
    </div>

    <!-- Сводка -->
    <div class="card flex flex-col gap-(--space-4) self-start">
      <div class="flex items-center gap-(--space-3)">
        <span class="section-label">Моя сводка за {{ fmtMonth(summaryMonth) }}</span>
        <button class="btn btn-secondary ml-auto" @click="copySummary">
          <i class="pi pi-copy" /> Копировать текстом
        </button>
      </div>
      <p v-if="!summary.length" class="meta">За этот месяц записей нет</p>
      <div v-for="s in summary" :key="s.stageTitle" class="flex flex-col gap-(--space-2)">
        <span style="font-weight: 500">{{ s.stageTitle }} · {{ s.n }}</span>
        <div
          v-for="a in s.approaches"
          :key="a.title"
          class="flex flex-col gap-(--space-1)"
          :style="a.lowData ? { color: 'var(--color-neutral-600)' } : {}"
        >
          <span class="tnum" style="font-size: 12.5px">
            {{ a.title }} — N={{ a.n }}, польза {{ a.avgUsefulness }}, доверие {{ a.avgTrust }}
            <span v-if="a.lowData" style="color: var(--warn-dim)">· мало данных</span>
          </span>
          <span v-for="n in a.notes" :key="n" class="meta" style="padding-left: var(--space-4)"
            >— {{ n }}</span
          >
        </div>
      </div>
    </div>

    <EntryEditDialog :entry="editing" @close="editing = null" @saved="onSaved" />
  </div>
</template>
```

- [ ] **Step 3: Проверка в браузере (сценарии ТЗ §3.3)**

1. Внести несколько записей через быстрый ввод → все видны, новые сверху, счётчик совпадает.
2. Фильтр по стадии и по месяцу сужает список и счётчик.
3. «Изменить» открывает диалог с текущими значениями; сохранение обновляет строку.
4. «Удалить» с подтверждением убирает запись из списка (в БД остаётся с `deletedAt` — проверить в prisma studio).
5. В prisma studio поставить записи `createdAt` на 8 дней назад → вместо кнопок «7 дней прошло»; PATCH через API тоже отвечает 403.
6. Сводка группирует по стадиям/подходам, при N < 5 строка приглушена с пометкой.
7. «Копировать текстом» кладёт в буфер плоский текст (вставить в блокнот и сверить).

- [ ] **Step 4: Прогнать тесты**

Run: `npx vitest run -r web` → PASS

- [ ] **Step 5: Commit**

```powershell
git add web/src
git commit -m "feat(web): my entries screen with filters, edit window, monthly summary"
```

---

## Критерий готовности модуля

- Список, фильтры, счётчик, правка/удаление с окном 7 дней — по ТЗ §3.3.
- Сводка за месяц с «мало данных» и копированием плоским текстом.
- Удаление мягкое, агрегаты его не видят (проверяется в плане 08).
