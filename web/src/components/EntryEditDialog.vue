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
    !!form.stageId &&
    !!form.toolId &&
    !!form.usefulness &&
    !!form.trust &&
    !!(form.approachId || form.customText.trim()),
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
        <select v-model="form.stageId" class="input" @change="form.approachId = null">
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
      <input v-if="isCustom" v-model="form.customText" class="input" placeholder="Текст подхода" />
      <RatingRow
        v-model="form.usefulness"
        label="Польза"
        :labels="USEFULNESS_LABELS"
        kind="usefulness"
      />
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
