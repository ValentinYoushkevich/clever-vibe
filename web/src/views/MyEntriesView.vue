<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { api } from '../api/client.js'
import type { Entry } from '../api/types.js'
import { useDictionaries } from '../stores/dictionaries.js'
import { useAuth } from '../stores/auth.js'
import { canModify } from '../lib/editWindow.js'
import { buildSummary } from '../lib/summary.js'
import { summaryText } from '../lib/summaryText.js'
import { fmtDate, fmtMonthTitle, f1 } from '../lib/format.js'
import EntryEditDialog from '../components/EntryEditDialog.vue'

const dict = useDictionaries()
const auth = useAuth()
const toast = useToast()
const all = ref<Entry[]>([])
const stageFilter = ref<string>('') // '' = все стадии
const monthFilter = ref<string>('all') // 'all' = весь пилот
const editing = ref<Entry | null>(null)
const copied = ref(false)

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

const subtitle = computed(
  () =>
    `${auth.user?.name ?? ''} · ${all.value.length} записей за пилот · редактирование в течение 7 дней`,
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
  copied.value = true
  setTimeout(() => (copied.value = false), 2200)
  toast.add({ severity: 'success', summary: 'Сводка скопирована', life: 2200 })
}

function entryMeta(e: Entry): string {
  const parts = [e.stage.title, e.tool.title]
  if (e.taskRef) parts.push(e.taskRef)
  return parts.join(' · ')
}

onMounted(async () => {
  await dict.load()
  await load()
})
</script>

<template>
  <div class="page">
    <h1 style="margin: 0 0 5px; font-size: 23px; font-weight: 600; letter-spacing: -0.01em">
      Мои записи
    </h1>
    <p style="margin: 0 0 20px; font-size: 15px; color: var(--color-neutral-400)">
      {{ subtitle }}
    </p>

    <div
      class="grid items-start gap-(--space-6)"
      style="grid-template-columns: minmax(0, 1fr) 400px"
    >
      <!-- Список -->
      <div
        style="
          background: var(--color-surface);
          border: 1px solid var(--color-neutral-800);
          border-radius: var(--radius-lg);
          overflow: hidden;
        "
      >
        <div
          class="flex flex-wrap items-center gap-(--space-3)"
          style="
            padding: var(--space-4) var(--space-6);
            border-bottom: 1px solid var(--color-neutral-800);
          "
        >
          <select
            v-model="stageFilter"
            class="input"
            style="width: auto; padding: var(--space-3); font-size: 14.5px"
          >
            <option value="">Все стадии</option>
            <option v-for="s in dict.stages" :key="s.id" :value="s.id">{{ s.title }}</option>
          </select>
          <select
            v-model="monthFilter"
            class="input"
            style="width: auto; padding: var(--space-3); font-size: 14.5px"
          >
            <option value="all">Весь пилот</option>
            <option v-for="m in months" :key="m" :value="m">{{ fmtMonthTitle(m) }}</option>
          </select>
          <span
            class="tnum ml-auto"
            style="font-size: 13.5px; color: var(--color-neutral-500)"
            >показано {{ shown.length }}</span
          >
        </div>

        <p v-if="!shown.length" class="meta" style="padding: var(--space-6)">Записей нет</p>
        <div
          v-for="e in shown"
          :key="e.id"
          class="grid items-center gap-(--space-4)"
          style="
            grid-template-columns: 78px minmax(0, 1fr) 120px 92px;
            padding: var(--space-4) var(--space-6);
            border-bottom: 1px solid var(--color-neutral-900);
          "
        >
          <span class="tnum" style="font-size: 13px; color: var(--color-neutral-500)">
            {{ fmtDate(e.createdAt) }}
          </span>
          <div style="min-width: 0">
            <div style="font-size: 15px; font-weight: 500; margin-bottom: 3px">
              {{ e.approach?.title ?? e.customApproachText }}
            </div>
            <div style="font-size: 13.5px; color: var(--color-neutral-500)">{{ entryMeta(e) }}</div>
            <div
              v-if="e.note"
              style="
                font-size: 13.5px;
                color: var(--color-neutral-400);
                margin-top: 4px;
                border-left: 2px solid var(--color-neutral-700);
                padding-left: 8px;
              "
            >
              {{ e.note }}
            </div>
          </div>
          <div class="tnum flex gap-(--space-2)" style="font-size: 13.5px">
            <span style="color: var(--color-accent)">П {{ e.usefulness }}</span>
            <span style="color: var(--color-accent-2-400)">Д {{ e.trust }}</span>
          </div>
          <div class="flex justify-end gap-(--space-3)">
            <template v-if="canModify(e.createdAt)">
              <button
                type="button"
                class="row-action"
                style="
                  background: none;
                  border: 0;
                  color: var(--color-neutral-400);
                  font-size: 13.5px;
                  cursor: pointer;
                "
                @click="editing = e"
              >
                Изменить
              </button>
              <button
                type="button"
                class="row-action row-action-danger"
                style="
                  background: none;
                  border: 0;
                  color: var(--color-neutral-400);
                  font-size: 13.5px;
                  cursor: pointer;
                "
                @click="remove(e)"
              >
                Удалить
              </button>
            </template>
            <span v-else style="font-size: 13px; color: var(--color-neutral-600)">
              7 дней прошло
            </span>
          </div>
        </div>
      </div>

      <!-- Сводка -->
      <div class="card self-start">
        <div class="flex items-center justify-between" style="margin-bottom: 4px">
          <h2 style="margin: 0; font-size: 17px; font-weight: 600">Моя сводка за месяц</h2>
          <button
            type="button"
            class="copy-btn"
            style="
              padding: var(--space-2) var(--space-4);
              border-radius: var(--radius-md);
              border: 1px solid var(--color-neutral-700);
              background: var(--color-bg);
              color: var(--color-text);
              font-size: 14px;
              cursor: pointer;
            "
            @click="copySummary"
          >
            {{ copied ? 'Скопировано' : 'Копировать текстом' }}
          </button>
        </div>
        <p style="margin: 0 0 16px; font-size: 14px; color: var(--color-neutral-500)">
          {{ fmtMonthTitle(summaryMonth) }} · готово к зачитыванию на встрече
        </p>

        <p v-if="!summary.length" class="meta">За этот месяц записей нет</p>
        <div class="flex flex-col gap-(--space-6)">
          <div v-for="s in summary" :key="s.stageTitle">
            <div
              class="flex items-baseline gap-(--space-3)"
              style="
                margin-bottom: 7px;
                padding-bottom: 5px;
                border-bottom: 1px solid var(--color-neutral-800);
              "
            >
              <span style="font-size: 14.5px; font-weight: 600">{{ s.stageTitle }}</span>
              <span class="tnum" style="font-size: 13px; color: var(--color-neutral-600)">
                N {{ s.n }}
              </span>
            </div>
            <div class="flex flex-col gap-(--space-3)">
              <div v-for="a in s.approaches" :key="a.title">
                <div class="flex items-baseline justify-between gap-(--space-3)">
                  <span style="font-size: 14.5px; color: var(--color-neutral-300); line-height: 1.35">
                    {{ a.title }}
                  </span>
                  <span
                    class="tnum"
                    style="font-size: 13.5px; white-space: nowrap"
                    :style="{
                      color: a.lowData ? 'var(--color-neutral-600)' : 'var(--color-neutral-400)',
                    }"
                  >
                    N {{ a.n }} · П {{ f1(a.avgUsefulness) }} · Д {{ f1(a.avgTrust)
                    }}<template v-if="a.lowData"> · мало данных</template>
                  </span>
                </div>
                <div
                  v-for="n in a.notes"
                  :key="n"
                  style="font-size: 13.5px; color: var(--color-neutral-500); margin-top: 3px"
                >
                  {{ n }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <EntryEditDialog :entry="editing" @close="editing = null" @saved="onSaved" />
  </div>
</template>

<style scoped>
.row-action:hover {
  color: var(--color-text) !important;
}
.row-action-danger:hover {
  color: var(--bad) !important;
}
.copy-btn:hover {
  border-color: var(--color-accent) !important;
  color: var(--color-accent) !important;
}
</style>
