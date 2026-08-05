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
            <button
              class="btn btn-secondary"
              style="padding: 2px var(--space-3)"
              @click="editing = e"
            >
              Изменить
            </button>
            <button
              class="btn btn-secondary"
              style="padding: 2px var(--space-3)"
              @click="remove(e)"
            >
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
