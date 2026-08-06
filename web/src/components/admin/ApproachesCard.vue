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
  <div class="card" style="padding: var(--space-8) 0 var(--space-2)">
    <div class="flex items-center justify-between" style="margin: 0 20px 14px">
      <h2 style="margin: 0; font-size: 16.5px; font-weight: 600">Справочник подходов</h2>
      <div class="flex items-center gap-(--space-3)">
        <select
          v-model="stageFilter"
          class="input"
          style="width: auto; padding: var(--space-3); font-size: 14px"
        >
          <option value="">Все стадии</option>
          <option v-for="s in dict.stages" :key="s.id" :value="s.id">{{ s.title }}</option>
        </select>
        <button
          type="button"
          class="inline-flex items-center gap-(--space-2)"
          style="
            padding: var(--space-3) var(--space-4);
            border-radius: var(--radius-md);
            border: 1px solid var(--color-accent-700);
            background: var(--color-accent-900);
            color: var(--color-accent);
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
          "
          @click="showForm = !showForm"
        >
          <i :class="showForm ? 'pi pi-times' : 'pi pi-plus'" style="font-size: 13px" />{{
            showForm ? 'Отмена' : 'Подход'
          }}
        </button>
      </div>
    </div>

    <div
      v-if="showForm"
      class="flex items-end gap-(--space-3)"
      style="
        margin: 0 20px 14px;
        padding: var(--space-4);
        background: var(--color-bg);
        border: 1px solid var(--color-accent-700);
        border-radius: var(--radius-md);
      "
    >
      <label style="width: 170px">
        <div class="section-label" style="margin-bottom: var(--space-2)">Стадия</div>
        <select v-model="newStageId" class="input">
          <option v-for="s in dict.stages" :key="s.id" :value="s.id">{{ s.title }}</option>
        </select>
      </label>
      <label style="flex: 1">
        <div class="section-label" style="margin-bottom: var(--space-2)">Название</div>
        <input v-model="newTitle" class="input" />
      </label>
      <button
        type="button"
        class="btn btn-accent"
        :disabled="!newTitle.trim() || !newStageId"
        @click="create"
      >
        Добавить
      </button>
    </div>

    <div style="max-height: 420px; overflow: auto">
      <div
        v-for="a in shown"
        :key="a.id"
        class="grid items-center gap-(--space-3)"
        style="
          grid-template-columns: minmax(0, 1fr) 110px 54px 96px;
          padding: var(--space-3) var(--space-8);
          border-bottom: 1px solid var(--color-neutral-900);
        "
      >
        <div style="min-width: 0">
          <span
            style="font-size: 14.5px"
            :style="{ color: a.active ? 'var(--color-neutral-200)' : 'var(--color-neutral-600)' }"
            >{{ a.title }}</span
          >
          <!-- Промоученный подход: в списке «на разбор» его уже нет, поэтому
               происхождение видно только отсюда -->
          <i
            v-if="a.isCustom"
            v-tooltip.top="'Кастомный подход — предложен участником в записи и добавлен в справочник'"
            class="pi pi-user-edit"
            style="
              font-size: 12.5px;
              color: var(--warn-dim);
              margin-left: 7px;
              vertical-align: middle;
              cursor: help;
            "
          />
        </div>
        <span style="font-size: 13.5px; color: var(--color-neutral-500)">{{ a.stageTitle }}</span>
        <span class="tnum" style="font-size: 13px; color: var(--color-neutral-500); text-align: right">
          {{ a.n }}
        </span>
        <button
          type="button"
          style="
            justify-self: end;
            padding: var(--space-2) var(--space-3);
            border-radius: var(--radius-md);
            background: var(--color-bg);
            font-size: 13.5px;
            cursor: pointer;
            border: 1px solid;
          "
          :style="{
            color: a.active ? 'var(--color-neutral-400)' : 'var(--color-accent)',
            borderColor: a.active ? 'var(--color-neutral-700)' : 'var(--color-accent-700)',
          }"
          @click="toggle(a)"
        >
          {{ a.active ? 'Деактивировать' : 'Включить' }}
        </button>
      </div>
    </div>
  </div>
</template>
