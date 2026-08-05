# 05 · Экран «Быстрый ввод» (раскладка A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Главный экран: форма записи за 20–30 секунд на одном экране без скролла (грид `minmax(0,1fr) 336px`), чипсы стадий и подходов, «Другой подход» со свободным текстом, две шкалы оценок, черновик в `localStorage['aiTrackerDraft']`, последние 3 записи и легенда шкал справа. Раскладки B и C из прототипа не делаются (ТЗ §3.2).

**Architecture:** Вся логика формы — чистые модули (`quickForm.ts`, `draft.ts`, `scales.ts`) под юнит-тестами; вью только рендерит состояние и дёргает API. Справочники — Pinia-стор с разовой загрузкой. Тосты — PrimeVue Toast (2.2 с, снизу по центру — дизайн-док, Interactions).

**Tech Stack:** Vue 3 + Pinia, PrimeVue (Toast), токены из плана 02.

---

### Task 1: Типы API и стор справочников

**Files:**
- Create: `web/src/api/types.ts`
- Create: `web/src/stores/dictionaries.ts`

- [x] **Step 1: Типы**

`web/src/api/types.ts`:

```ts
export interface Stage {
  id: string
  code: string
  title: string
  order: number
}

export interface Approach {
  id: string
  code: string
  stageId: string
  title: string
  description: string | null
  order: number
  isCustom: boolean
}

export interface Tool {
  id: string
  code: string
  title: string
}

export interface Entry {
  id: string
  createdAt: string
  stage: Stage
  approach: Approach | null
  customApproachText: string | null
  taskRef: string | null
  tool: Tool
  usefulness: number
  trust: number
  note: string | null
}
```

- [x] **Step 2: Стор**

`web/src/stores/dictionaries.ts`:

```ts
import { defineStore } from 'pinia'
import { api } from '../api/client.js'
import type { Stage, Approach, Tool } from '../api/types.js'

export const useDictionaries = defineStore('dictionaries', {
  state: () => ({
    stages: [] as Stage[],
    approaches: [] as Approach[],
    tools: [] as Tool[],
    loaded: false,
  }),
  getters: {
    approachesByStage: (s) => (stageId: string) =>
      s.approaches.filter((a) => a.stageId === stageId),
  },
  actions: {
    async load() {
      if (this.loaded) return
      ;[this.stages, this.approaches, this.tools] = await Promise.all([
        api<Stage[]>('/api/stages'),
        api<Approach[]>('/api/approaches'),
        api<Tool[]>('/api/tools'),
      ])
      this.loaded = true
    },
  },
})
```

- [x] **Step 3: Commit**

```powershell
git add web/src/api/types.ts web/src/stores/dictionaries.ts
git commit -m "feat(web): api types and dictionaries store"
```

---

### Task 2: Логика формы (TDD)

**Files:**
- Create: `web/src/lib/quickForm.ts`
- Create: `web/src/lib/scales.ts`
- Test: `web/test/quickForm.spec.ts`

- [x] **Step 1: Падающий тест**

`web/test/quickForm.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { emptyForm, canSave, afterSave } from '../src/lib/quickForm.js'

const filled = () => ({
  ...emptyForm(),
  stageId: 's1',
  approachId: 'a1',
  toolId: 't1',
  usefulness: 4,
  trust: 3,
})

describe('canSave (ТЗ §3.2)', () => {
  it('активна при подходе, пользе, доверии', () => {
    expect(canSave(filled())).toBe(true)
  })
  it('неактивна без подхода / пользы / доверия', () => {
    expect(canSave({ ...filled(), approachId: null })).toBe(false)
    expect(canSave({ ...filled(), usefulness: null })).toBe(false)
    expect(canSave({ ...filled(), trust: null })).toBe(false)
  })
  it('для «другого подхода» нужен непустой текст', () => {
    const custom = { ...filled(), approachId: null, custom: true, customText: '  ' }
    expect(canSave(custom)).toBe(false)
    expect(canSave({ ...custom, customText: 'свой способ' })).toBe(true)
  })
})

describe('afterSave (ТЗ §3.2: стадия и инструмент сохраняются)', () => {
  it('сбрасывает всё, кроме стадии и инструмента', () => {
    const next = afterSave({ ...filled(), taskRef: 'FE-1', note: 'x', noteOpen: true })
    expect(next.stageId).toBe('s1')
    expect(next.toolId).toBe('t1')
    expect(next.approachId).toBeNull()
    expect(next.usefulness).toBeNull()
    expect(next.trust).toBeNull()
    expect(next.taskRef).toBe('')
    expect(next.note).toBe('')
    expect(next.noteOpen).toBe(false)
  })
})
```

- [x] **Step 2: Убедиться, что падает**

Run: `npx vitest run -r web` → FAIL

- [x] **Step 3: Реализация**

`web/src/lib/quickForm.ts`:

```ts
export interface QuickForm {
  stageId: string | null
  approachId: string | null
  custom: boolean // выбран чип «Другой подход»
  customText: string
  toolId: string | null
  usefulness: number | null
  trust: number | null
  taskRef: string
  note: string
  noteOpen: boolean
}

export const emptyForm = (): QuickForm => ({
  stageId: null,
  approachId: null,
  custom: false,
  customText: '',
  toolId: null,
  usefulness: null,
  trust: null,
  taskRef: '',
  note: '',
  noteOpen: false,
})

export function canSave(f: QuickForm): boolean {
  const approachOk = f.custom ? f.customText.trim().length > 0 : !!f.approachId
  return !!f.stageId && approachOk && !!f.toolId && f.usefulness !== null && f.trust !== null
}

export function afterSave(f: QuickForm): QuickForm {
  return { ...emptyForm(), stageId: f.stageId, toolId: f.toolId }
}
```

`web/src/lib/scales.ts` (шкалы ТЗ §2.4; используются и в легенде, и в сводке):

```ts
export const USEFULNESS_LABELS: Record<number, string> = {
  1: 'Помешало, потратил время впустую',
  2: 'Пользы почти не было',
  3: 'Немного помогло',
  4: 'Заметно ускорило',
  5: 'Сэкономило часы',
}

export const TRUST_LABELS: Record<number, string> = {
  1: 'Выкинул полностью',
  2: 'Переписал большую часть',
  3: 'Существенно дорабатывал',
  4: 'Мелкие правки',
  5: 'Взял как есть',
}
```

- [x] **Step 4: Тесты зелёные + Commit**

Run: `npx vitest run -r web` → PASS

```powershell
git add web/src/lib/quickForm.ts web/src/lib/scales.ts web/test/quickForm.spec.ts
git commit -m "feat(web): quick entry form logic and scales (TDD)"
```

---

### Task 3: Черновик и последний инструмент (TDD)

**Files:**
- Create: `web/src/lib/draft.ts`
- Test: `web/test/draft.spec.ts`

- [x] **Step 1: Падающий тест**

`web/test/draft.spec.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { saveDraft, loadDraft, clearDraft, saveLastTool, loadLastTool } from '../src/lib/draft.js'
import { emptyForm } from '../src/lib/quickForm.js'

beforeEach(() => localStorage.clear())

describe('draft (ТЗ §3.2: localStorage["aiTrackerDraft"])', () => {
  it('сохраняет и восстанавливает форму', () => {
    const f = { ...emptyForm(), stageId: 's1', note: 'заметка' }
    saveDraft(f)
    expect(localStorage.getItem('aiTrackerDraft')).toBeTruthy()
    expect(loadDraft()).toEqual(f)
  })
  it('clearDraft удаляет черновик', () => {
    saveDraft(emptyForm())
    clearDraft()
    expect(loadDraft()).toBeNull()
  })
  it('битый JSON не роняет загрузку', () => {
    localStorage.setItem('aiTrackerDraft', '{oops')
    expect(loadDraft()).toBeNull()
  })
})

describe('последний инструмент', () => {
  it('запоминается и читается', () => {
    saveLastTool('t2')
    expect(loadLastTool()).toBe('t2')
    expect(loadLastTool()).not.toBeNull()
  })
})
```

- [x] **Step 2: Убедиться, что падает**

Run: `npx vitest run -r web` → FAIL

- [x] **Step 3: Реализация**

`web/src/lib/draft.ts`:

```ts
import type { QuickForm } from './quickForm.js'

const DRAFT_KEY = 'aiTrackerDraft'
const LAST_TOOL_KEY = 'aiTrackerLastTool'

export function saveDraft(f: QuickForm): void {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(f))
}

export function loadDraft(): QuickForm | null {
  const raw = localStorage.getItem(DRAFT_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as QuickForm
    return typeof parsed === 'object' && parsed !== null ? parsed : null
  } catch {
    return null
  }
}

export function clearDraft(): void {
  localStorage.removeItem(DRAFT_KEY)
}

export const saveLastTool = (id: string) => localStorage.setItem(LAST_TOOL_KEY, id)
export const loadLastTool = () => localStorage.getItem(LAST_TOOL_KEY)
```

- [x] **Step 4: Тесты зелёные + Commit**

Run: `npx vitest run -r web` → PASS

```powershell
git add web/src/lib/draft.ts web/test/draft.spec.ts
git commit -m "feat(web): form draft persistence (TDD)"
```

---

### Task 4: Компонент шкалы оценок

**Files:**
- Create: `web/src/components/RatingRow.vue`

- [x] **Step 1: Компонент**

Роли токенов (дизайн-док): польза — `accent-900/700/accent`, доверие — `accent-2-900/-700/-400`.

`web/src/components/RatingRow.vue`:

```vue
<script setup lang="ts">
const props = defineProps<{
  modelValue: number | null
  label: string
  labels: Record<number, string>
  kind: 'usefulness' | 'trust'
}>()
const emit = defineEmits<{ (e: 'update:modelValue', v: number): void }>()

const ACTIVE = {
  usefulness: {
    background: 'var(--color-accent-900)',
    borderColor: 'var(--color-accent-700)',
    color: 'var(--color-accent)',
  },
  trust: {
    background: 'var(--color-accent-2-900)',
    borderColor: 'var(--color-accent-2-700)',
    color: 'var(--color-accent-2-400)',
  },
}
</script>

<template>
  <div class="flex flex-col gap-(--space-2)">
    <span class="section-label">{{ label }}</span>
    <div class="flex items-center gap-(--space-2)">
      <button
        v-for="n in 5"
        :key="n"
        type="button"
        class="chip tnum"
        style="width: 34px; text-align: center"
        :style="props.modelValue === n ? ACTIVE[props.kind] : {}"
        @click="emit('update:modelValue', n)"
      >
        {{ n }}
      </button>
      <span class="meta" style="margin-left: var(--space-2)">
        {{ props.modelValue ? props.labels[props.modelValue] : '—' }}
      </span>
    </div>
  </div>
</template>
```

- [x] **Step 2: Commit**

```powershell
git add web/src/components/RatingRow.vue
git commit -m "feat(web): rating row component"
```

---

### Task 5: Экран быстрого ввода

**Files:**
- Modify: `web/src/views/QuickEntryView.vue` (заменить заглушку целиком)
- Modify: `web/src/App.vue` (добавить Toast)

- [x] **Step 1: Toast в App.vue**

В `web/src/App.vue` в `<template>` (после `</main>`) добавить, а в script — импорт:

```ts
import Toast from 'primevue/toast'
```

```html
<Toast position="bottom-center" />
```

- [x] **Step 2: Вью**

`web/src/views/QuickEntryView.vue`:

```vue
<script setup lang="ts">
import { onMounted, reactive, ref, watch, computed } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useDictionaries } from '../stores/dictionaries.js'
import { api } from '../api/client.js'
import type { Entry } from '../api/types.js'
import { emptyForm, canSave, afterSave, type QuickForm } from '../lib/quickForm.js'
import { saveDraft, loadDraft, clearDraft, saveLastTool, loadLastTool } from '../lib/draft.js'
import { USEFULNESS_LABELS, TRUST_LABELS } from '../lib/scales.js'
import { fmtDate } from '../lib/format.js'
import RatingRow from '../components/RatingRow.vue'

const dict = useDictionaries()
const toast = useToast()
const form = reactive<QuickForm>(emptyForm())
const recent = ref<Entry[]>([])
const busy = ref(false)

const approaches = computed(() =>
  form.stageId ? dict.approachesByStage(form.stageId) : [],
)
const savable = computed(() => canSave(form))

function selectStage(id: string) {
  form.stageId = id
  form.approachId = null
  form.custom = false
  form.customText = ''
}

function selectApproach(id: string) {
  form.approachId = id
  form.custom = false
  form.customText = ''
}

function selectCustom() {
  form.approachId = null
  form.custom = true
}

async function loadRecent() {
  recent.value = await api<Entry[]>('/api/entries?limit=3')
}

async function save() {
  if (!savable.value || busy.value) return
  busy.value = true
  try {
    await api('/api/entries', {
      method: 'POST',
      body: {
        stageId: form.stageId,
        approachId: form.custom ? undefined : form.approachId ?? undefined,
        customApproachText: form.custom ? form.customText.trim() : undefined,
        taskRef: form.taskRef.trim() || undefined,
        toolId: form.toolId,
        usefulness: form.usefulness,
        trust: form.trust,
        note: form.note.trim() || undefined,
      },
    })
    saveLastTool(form.toolId!)
    clearDraft()
    Object.assign(form, afterSave(form))
    toast.add({ severity: 'success', summary: 'Запись сохранена', life: 2200 })
    await loadRecent()
  } finally {
    busy.value = false
  }
}

function clearForm() {
  Object.assign(form, emptyForm())
  form.toolId = loadLastTool()
  clearDraft()
}

onMounted(async () => {
  await dict.load()
  const draft = loadDraft()
  if (draft) Object.assign(form, draft)
  if (!form.toolId) form.toolId = loadLastTool() ?? dict.tools[0]?.id ?? null
  await loadRecent()
})

// Черновик — при каждом изменении (ТЗ §3.2)
watch(form, () => saveDraft(form), { deep: true })
</script>

<template>
  <div
    class="p-(--space-8) grid gap-(--space-6)"
    style="grid-template-columns: minmax(0, 1fr) 336px"
  >
    <!-- Форма -->
    <div class="card flex flex-col gap-(--space-6)">
      <h1>Быстрый ввод</h1>

      <div class="flex flex-col gap-(--space-2)">
        <span class="section-label">Стадия</span>
        <div class="flex flex-wrap gap-(--space-2)">
          <button
            v-for="s in dict.stages"
            :key="s.id"
            type="button"
            class="chip"
            :class="{ 'is-active': form.stageId === s.id }"
            @click="selectStage(s.id)"
          >
            {{ s.title }}
          </button>
        </div>
      </div>

      <div v-if="form.stageId" class="flex flex-col gap-(--space-2)">
        <span class="section-label">Подход</span>
        <div class="flex flex-wrap gap-(--space-2)">
          <button
            v-for="a in approaches"
            :key="a.id"
            type="button"
            class="chip"
            :class="{ 'is-active': form.approachId === a.id }"
            :title="a.description ?? undefined"
            @click="selectApproach(a.id)"
          >
            {{ a.title }}
          </button>
          <button
            type="button"
            class="chip"
            :class="{ 'is-active': form.custom }"
            @click="selectCustom()"
          >
            <i class="pi pi-plus" style="font-size: 11px" /> Другой подход
          </button>
        </div>
        <input
          v-if="form.custom"
          v-model="form.customText"
          class="input"
          placeholder="Опишите подход коротко — лид разберёт и добавит в справочник"
        />
      </div>

      <RatingRow
        v-model="form.usefulness"
        label="Польза"
        :labels="USEFULNESS_LABELS"
        kind="usefulness"
      />
      <RatingRow v-model="form.trust" label="Доверие" :labels="TRUST_LABELS" kind="trust" />

      <div class="flex gap-(--space-4)">
        <label class="flex flex-col gap-(--space-2)" style="width: 220px">
          <span class="section-label">Инструмент</span>
          <select v-model="form.toolId" class="input">
            <option v-for="t in dict.tools" :key="t.id" :value="t.id">{{ t.title }}</option>
          </select>
        </label>
        <label class="flex flex-col gap-(--space-2)" style="width: 160px">
          <span class="section-label">Задача</span>
          <input v-model="form.taskRef" class="input tnum" placeholder="FE-1042" />
        </label>
      </div>

      <div class="flex flex-col gap-(--space-2)">
        <button
          type="button"
          class="btn btn-secondary self-start"
          @click="form.noteOpen = !form.noteOpen"
        >
          <i :class="form.noteOpen ? 'pi pi-minus' : 'pi pi-plus'" style="font-size: 11px" />
          Заметка
        </button>
        <textarea
          v-if="form.noteOpen"
          v-model="form.note"
          class="input"
          rows="3"
          placeholder="Что сработало, что нет"
        />
      </div>

      <div class="flex items-center gap-(--space-4)">
        <button class="btn" :class="{ 'btn-accent': savable }" :disabled="!savable || busy" @click="save">
          Сохранить запись
        </button>
        <button class="btn btn-secondary" @click="clearForm">Очистить</button>
        <span class="meta">Подход, польза и доверие обязательны</span>
      </div>
    </div>

    <!-- Правая колонка -->
    <div class="flex flex-col gap-(--space-6)">
      <div class="card flex flex-col gap-(--space-3)">
        <span class="section-label">Последние 3 записи</span>
        <p v-if="!recent.length" class="meta">Пока пусто</p>
        <div
          v-for="e in recent"
          :key="e.id"
          class="flex flex-col gap-(--space-1)"
          style="border-top: 1px solid var(--color-neutral-900); padding-top: var(--space-3)"
        >
          <div class="flex items-center gap-(--space-2)">
            <span class="meta tnum">{{ fmtDate(e.createdAt) }}</span>
            <span style="font-size: 13px">{{ e.approach?.title ?? e.customApproachText }}</span>
          </div>
          <span class="meta">
            {{ e.stage.title }} · {{ e.tool.title }}<template v-if="e.taskRef"> · {{ e.taskRef }}</template>
            · польза {{ e.usefulness }} · доверие {{ e.trust }}
          </span>
        </div>
      </div>

      <div class="card flex flex-col gap-(--space-3)">
        <span class="section-label">Шкалы</span>
        <div class="flex flex-col gap-(--space-1)">
          <span class="meta" style="color: var(--color-accent)">Польза</span>
          <span v-for="n in 5" :key="n" class="meta tnum">{{ n }} — {{ USEFULNESS_LABELS[n] }}</span>
        </div>
        <div class="flex flex-col gap-(--space-1)">
          <span class="meta" style="color: var(--color-accent-2-400)">Доверие</span>
          <span v-for="n in 5" :key="n" class="meta tnum">{{ n }} — {{ TRUST_LABELS[n] }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
```

`web/src/lib/format.ts`:

```ts
export function fmtDate(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}`
}
```

- [x] **Step 3: Проверка в браузере (сценарии ТЗ §3.2)**

Оба dev-сервера запущены, вход админом:
1. Выбрать стадию → появились чипсы её подходов + «Другой подход».
2. Кнопка «Сохранить запись» неактивна, пока не выбраны подход, польза, доверие; для «другого подхода» — пока пуст текст.
3. Сохранить → тост «Запись сохранена» снизу по центру; форма очистилась, **стадия и инструмент остались**; запись появилась в «Последние 3».
4. Заполнить форму наполовину → перезагрузить страницу → значения восстановились из черновика.
5. После сохранения черновик удалён (`localStorage['aiTrackerDraft']` пуст).
6. Смена стадии сбрасывает выбранный подход.
7. Всё умещается на экране 1920×1080 без вертикального скролла.

- [x] **Step 4: Прогнать тесты**

Run: `npx vitest run -r web` → PASS

- [x] **Step 5: Commit**

```powershell
git add web/src
git commit -m "feat(web): quick entry screen (layout A) with draft and recent entries"
```

---

## Критерий готовности модуля

- Полный цикл: выбор → сохранение → тост → очистка с сохранением стадии/инструмента → запись в «последних».
- Черновик переживает перезагрузку и удаляется после сохранения.
- Свободный ввод названия подхода невозможен — только чип «Другой подход» с отдельным полем.
