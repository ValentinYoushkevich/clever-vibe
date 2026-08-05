<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { api } from '../../api/client.js'
import { useDictionaries } from '../../stores/dictionaries.js'

interface AdminApproach {
  id: string
  title: string
  stageId: string
  stageTitle: string
  active: boolean
  isCustom: boolean
  n: number
}

const dict = useDictionaries()
const list = ref<AdminApproach[]>([])
const stageFilter = ref('')
const showForm = ref(false)
const newTitle = ref('')
const newStageId = ref('')

const shown = computed(() =>
  stageFilter.value ? list.value.filter((a) => a.stageId === stageFilter.value) : list.value,
)

async function load() {
  list.value = await api<AdminApproach[]>('/api/admin/approaches')
}

// Справочник изменился — чипсы быстрого ввода должны перечитать его
async function reloadDictionaries() {
  dict.loaded = false
  await dict.load()
}

async function create() {
  if (!newTitle.value.trim() || !newStageId.value) return
  await api('/api/approaches', {
    method: 'POST',
    body: { stageId: newStageId.value, title: newTitle.value.trim() },
  })
  newTitle.value = ''
  showForm.value = false
  await Promise.all([load(), reloadDictionaries()])
}

async function toggle(a: AdminApproach) {
  await api(`/api/approaches/${a.id}`, { method: 'PATCH', body: { active: !a.active } })
  await Promise.all([load(), reloadDictionaries()])
}

onMounted(async () => {
  await dict.load()
  await load()
})
</script>

<template>
  <div class="card flex flex-col gap-(--space-4)">
    <div class="flex items-center gap-(--space-3)">
      <h2>Справочник подходов</h2>
      <select v-model="stageFilter" class="input" style="width: 170px">
        <option value="">Все стадии</option>
        <option v-for="s in dict.stages" :key="s.id" :value="s.id">{{ s.title }}</option>
      </select>
      <button class="btn btn-secondary ml-auto" @click="showForm = !showForm">
        <i class="pi pi-plus" /> Подход
      </button>
    </div>

    <div v-if="showForm" class="flex items-end gap-(--space-3)">
      <label class="flex flex-col gap-(--space-2)" style="width: 170px">
        <span class="section-label">Стадия</span>
        <select v-model="newStageId" class="input">
          <option v-for="s in dict.stages" :key="s.id" :value="s.id">{{ s.title }}</option>
        </select>
      </label>
      <label class="flex flex-col gap-(--space-2)" style="flex: 1">
        <span class="section-label">Название</span>
        <input v-model="newTitle" class="input" />
      </label>
      <button class="btn btn-accent" :disabled="!newTitle.trim() || !newStageId" @click="create">
        Добавить
      </button>
    </div>

    <div
      v-for="a in shown"
      :key="a.id"
      class="grid items-center gap-(--space-3)"
      style="
        grid-template-columns: minmax(0, 1fr) 110px 54px 96px;
        border-top: 1px solid var(--color-neutral-900);
        padding-top: var(--space-3);
      "
    >
      <span :style="a.active ? {} : { color: 'var(--color-neutral-600)' }">
        {{ a.title }}
        <span
          v-if="a.isCustom"
          class="meta"
          style="
            border: 1px solid var(--color-accent-700);
            color: var(--color-accent);
            border-radius: var(--radius-sm);
            padding: 0 var(--space-2);
            font-size: 10.5px;
          "
          >custom</span
        >
      </span>
      <span class="meta">{{ a.stageTitle }}</span>
      <span class="meta tnum">{{ a.n }}</span>
      <button class="btn btn-secondary" style="padding: 2px var(--space-3)" @click="toggle(a)">
        {{ a.active ? 'Деактивировать' : 'Включить' }}
      </button>
    </div>
  </div>
</template>
