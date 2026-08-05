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
