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

const stageTitle = computed(() => dict.stages.find((s) => s.id === form.stageId)?.title ?? '')
const approachHint = computed(() =>
  form.stageId ? `отфильтровано по стадии «${stageTitle.value}»` : 'сначала выберите стадию',
)
const saveHint = computed(() =>
  savable.value ? 'Стадия и инструмент останутся выбранными' : 'Нужны подход, польза и доверие',
)
const draftLabel = computed(() =>
  form.approachId || form.custom || form.usefulness || form.trust || form.taskRef || form.note
    ? 'черновик сохранён локально'
    : 'черновик пуст',
)

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
  <div class="page">
    <!-- Заголовок экрана -->
    <div
      class="flex items-end justify-between gap-(--space-8)"
      style="margin-bottom: 20px"
    >
      <div>
        <h1 style="margin: 0 0 5px; font-size: 23px; font-weight: 600; letter-spacing: -0.01em">
          Быстрый ввод
        </h1>
        <p style="margin: 0; font-size: 15px; color: var(--color-neutral-400)">
          Одна запись = одно применение подхода. Цель — 20–30 секунд.
        </p>
      </div>
      <span class="tnum" style="font-size: 13px; color: var(--color-neutral-600)">
        {{ draftLabel }}
      </span>
    </div>

    <div
      class="grid items-start gap-(--space-6)"
      style="grid-template-columns: minmax(0, 1fr) 336px"
    >
      <!-- Форма -->
      <div class="card">
        <div class="section-label" style="margin-bottom: 10px">Стадия</div>
        <div class="flex flex-wrap gap-(--space-3)" style="margin-bottom: 22px">
          <button
            v-for="s in dict.stages"
            :key="s.id"
            type="button"
            class="chip chip-stage"
            :class="{ 'is-active': form.stageId === s.id }"
            @click="selectStage(s.id)"
          >
            {{ s.title }}
          </button>
        </div>

        <div class="flex items-baseline gap-(--space-3)" style="margin-bottom: 10px">
          <span class="section-label">Подход</span>
          <span style="font-size: 13.5px; color: var(--color-neutral-600)">{{ approachHint }}</span>
        </div>
        <div
          class="flex flex-wrap gap-(--space-3)"
          style="min-height: 64px; margin-bottom: 22px"
        >
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
            v-if="form.stageId"
            type="button"
            class="chip"
            :class="{ 'is-active': form.custom }"
            style="border-color: var(--color-neutral-700)"
            title="Свободный текст, лид разбирает раз в месяц"
            @click="selectCustom()"
          >
            <i class="pi pi-plus" style="font-size: 13px" />Другой подход
          </button>
        </div>

        <input
          v-if="form.custom"
          v-model="form.customText"
          class="input"
          style="margin-bottom: 22px"
          placeholder="Опишите подход своими словами — лид разберёт раз в месяц"
        />

        <div
          class="grid gap-(--space-8)"
          style="grid-template-columns: 1fr 1fr; margin-bottom: 22px"
        >
          <RatingRow
            v-model="form.usefulness"
            label="Польза"
            :labels="USEFULNESS_LABELS"
            kind="usefulness"
          />
          <RatingRow v-model="form.trust" label="Доверие" :labels="TRUST_LABELS" kind="trust" />
        </div>

        <div
          class="grid items-end gap-(--space-4)"
          style="grid-template-columns: 220px 1fr; margin-bottom: 16px"
        >
          <label>
            <div class="section-label" style="margin-bottom: 8px">Инструмент</div>
            <select v-model="form.toolId" class="input">
              <option v-for="t in dict.tools" :key="t.id" :value="t.id">{{ t.title }}</option>
            </select>
          </label>
          <label>
            <div class="section-label" style="margin-bottom: 8px">
              Задача
              <span
                style="
                  text-transform: none;
                  letter-spacing: 0;
                  font-weight: 400;
                  color: var(--color-neutral-600);
                "
                >— опционально</span
              >
            </div>
            <input v-model="form.taskRef" class="input tnum" placeholder="FE-1042" />
          </label>
        </div>

        <button
          type="button"
          class="btn-ghost inline-flex items-center gap-(--space-2)"
          style="margin-bottom: 10px; color: var(--color-neutral-400); cursor: pointer"
          @click="form.noteOpen = !form.noteOpen"
        >
          <i :class="form.noteOpen ? 'pi pi-minus' : 'pi pi-plus'" style="font-size: 13px" />
          {{ form.noteOpen ? 'Свернуть заметку' : 'Добавить заметку' }}
        </button>
        <textarea
          v-if="form.noteOpen"
          v-model="form.note"
          class="input"
          rows="3"
          style="resize: vertical"
          placeholder="Что именно сработало или не сработало"
        />

        <div
          class="flex items-center gap-(--space-4)"
          style="margin-top: 18px; padding-top: 18px; border-top: 1px solid var(--color-neutral-800)"
        >
          <button
            type="button"
            class="btn"
            :class="{ 'btn-accent': savable }"
            style="padding: var(--space-4) var(--space-8); font-size: 15.5px; font-weight: 500"
            :disabled="!savable || busy"
            @click="save"
          >
            Сохранить запись
          </button>
          <span style="font-size: 14px; color: var(--color-neutral-600)">{{ saveHint }}</span>
          <button type="button" class="btn-ghost ml-auto" style="cursor: pointer" @click="clearForm">
            Очистить
          </button>
        </div>
      </div>

      <!-- Правая колонка -->
      <div class="flex flex-col gap-(--space-4)">
        <div
          class="card"
          style="padding: var(--space-6) var(--space-6) var(--space-4)"
        >
          <div class="section-label" style="margin-bottom: 12px">Последние 3 записи</div>
          <p v-if="!recent.length" class="meta">Пока пусто</p>
          <div class="flex flex-col gap-(--space-3)">
            <div
              v-for="e in recent"
              :key="e.id"
              style="
                padding: var(--space-3) var(--space-4);
                background: var(--color-bg);
                border: 1px solid var(--color-neutral-800);
                border-radius: var(--radius-md);
              "
            >
              <div
                class="flex justify-between gap-(--space-3)"
                style="margin-bottom: 4px"
              >
                <span style="font-size: 14.5px; font-weight: 500; line-height: 1.35">
                  {{ e.approach?.title ?? e.customApproachText }}
                </span>
                <span
                  class="tnum"
                  style="font-size: 12.5px; color: var(--color-neutral-600); white-space: nowrap"
                >
                  {{ fmtDate(e.createdAt) }}
                </span>
              </div>
              <div
                class="tnum flex gap-(--space-3)"
                style="font-size: 12.5px; color: var(--color-neutral-500)"
              >
                <span>{{ e.stage.title }}</span>
                <span>·</span>
                <span style="color: var(--color-accent)">П {{ e.usefulness }}</span>
                <span style="color: var(--color-accent-2-400)">Д {{ e.trust }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="card" style="padding: var(--space-6)">
          <div class="section-label" style="margin-bottom: 11px">Шкалы</div>
          <div class="flex flex-col gap-(--space-2)" style="margin-bottom: 14px">
            <span style="font-size: 13.5px; font-weight: 600; color: var(--color-accent)">
              Польза
            </span>
            <div
              v-for="n in 5"
              :key="n"
              class="flex gap-(--space-3)"
              style="font-size: 13.5px; color: var(--color-neutral-400)"
            >
              <span class="tnum" style="color: var(--color-neutral-600)">{{ n }}</span>
              <span>{{ USEFULNESS_LABELS[n] }}</span>
            </div>
          </div>
          <div class="flex flex-col gap-(--space-2)">
            <span style="font-size: 13.5px; font-weight: 600; color: var(--color-accent-2-400)">
              Доверие
            </span>
            <div
              v-for="n in 5"
              :key="n"
              class="flex gap-(--space-3)"
              style="font-size: 13.5px; color: var(--color-neutral-400)"
            >
              <span class="tnum" style="color: var(--color-neutral-600)">{{ n }}</span>
              <span>{{ TRUST_LABELS[n] }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
