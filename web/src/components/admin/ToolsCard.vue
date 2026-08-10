<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { api, ApiError } from '../../api/client.js'
import { useDictionaries } from '../../stores/dictionaries.js'
import { plural } from '../../lib/format.js'

interface AdminTool {
  id: string
  code: string
  title: string
  active: boolean
  n: number
}

const dict = useDictionaries()
const toast = useToast()
const list = ref<AdminTool[]>([])
const showForm = ref(false)
const newTitle = ref('')
const newCode = ref('')
const error = ref('')

const ERRORS: Record<string, string> = {
  bad_code: 'Тег — латиница, цифры и дефис: например claude-code',
  code_taken: 'Такой тег уже занят. Найдите инструмент в списке ниже и включите его',
}

async function load() {
  list.value = await api<AdminTool[]>('/api/admin/tools')
}

// Справочник изменился — форма записи и фильтр дашборда читают его из стора
async function reloadDictionaries() {
  dict.loaded = false
  await dict.load()
}

async function create() {
  if (!newTitle.value.trim()) return
  error.value = ''
  try {
    await api('/api/tools', {
      method: 'POST',
      body: { title: newTitle.value.trim(), code: newCode.value.trim() || undefined },
    })
  } catch (e) {
    error.value = (e instanceof ApiError && ERRORS[e.code]) || 'Не удалось добавить инструмент'
    return
  }
  newTitle.value = ''
  newCode.value = ''
  showForm.value = false
  toast.add({ severity: 'success', summary: 'Инструмент добавлен', life: 2200 })
  await Promise.all([load(), reloadDictionaries()])
}

async function toggle(t: AdminTool) {
  await api(`/api/tools/${t.id}`, { method: 'PATCH', body: { active: !t.active } })
  await Promise.all([load(), reloadDictionaries()])
}

onMounted(load)
</script>

<template>
  <div class="card">
    <div class="flex items-center justify-between" style="margin-bottom: 14px">
      <h2 style="margin: 0; font-size: 16.5px; font-weight: 600">Инструменты</h2>
      <button
        type="button"
        class="inline-flex items-center gap-(--space-2)"
        style="
          padding: var(--space-2) var(--space-4);
          border-radius: var(--radius-md);
          border: 1px solid var(--color-accent-700);
          background: var(--color-accent-900);
          color: var(--color-accent);
          font-size: 14px;
          cursor: pointer;
        "
        @click="((showForm = !showForm), (error = ''))"
      >
        <i :class="showForm ? 'pi pi-times' : 'pi pi-plus'" style="font-size: 13px" />{{
          showForm ? 'Отмена' : 'Инструмент'
        }}
      </button>
    </div>

    <div
      v-if="showForm"
      class="flex flex-col gap-(--space-3)"
      style="
        padding: var(--space-4);
        margin-bottom: var(--space-4);
        background: var(--color-bg);
        border: 1px solid var(--color-accent-700);
        border-radius: var(--radius-md);
      "
    >
      <label>
        <div class="section-label" style="margin-bottom: var(--space-2)">Название</div>
        <input
          v-model="newTitle"
          class="input"
          style="background: var(--color-surface)"
          placeholder="GitHub Copilot"
        />
      </label>
      <label>
        <div class="section-label" style="margin-bottom: var(--space-2)">Тег</div>
        <input
          v-model="newCode"
          class="input tnum"
          style="background: var(--color-surface)"
          placeholder="github-copilot"
        />
      </label>
      <div v-if="error" style="font-size: 13.5px; color: var(--bad); line-height: 1.4">
        {{ error }}
      </div>
      <div class="flex items-center gap-(--space-4)">
        <button
          type="button"
          class="btn"
          :class="{ 'btn-accent': newTitle.trim() }"
          style="font-size: 14.5px"
          :disabled="!newTitle.trim()"
          @click="create"
        >
          Добавить
        </button>
        <span style="font-size: 13.5px; color: var(--color-neutral-500)">
          {{ newTitle.trim() ? 'Пустой тег сделаем из названия' : 'Нужно название' }}
        </span>
      </div>
    </div>

    <div class="flex flex-col gap-(--space-3)">
      <div
        v-for="t in list"
        :key="t.id"
        style="
          padding: var(--space-4);
          background: var(--color-bg);
          border: 1px solid var(--color-neutral-800);
          border-radius: var(--radius-md);
        "
      >
        <div style="min-width: 0">
          <div
            style="font-size: 15px"
            :style="{ color: t.active ? 'var(--color-neutral-200)' : 'var(--color-neutral-600)' }"
          >
            {{ t.title }}
          </div>
          <div class="tnum" style="font-size: 12.5px; color: var(--color-neutral-500)">
            {{ t.code }} · {{ plural(t.n, 'запись', 'записи', 'записей') }}
          </div>
        </div>
        <div class="flex justify-end" style="margin-top: var(--space-3)">
          <button
            type="button"
            style="
              padding: var(--space-2) var(--space-3);
              border-radius: var(--radius-md);
              background: var(--color-bg);
              font-size: 13.5px;
              cursor: pointer;
              border: 1px solid;
              white-space: nowrap;
            "
            :style="{
              color: t.active ? 'var(--color-neutral-400)' : 'var(--color-accent)',
              borderColor: t.active ? 'var(--color-neutral-700)' : 'var(--color-accent-700)',
            }"
            @click="toggle(t)"
          >
            {{ t.active ? 'Деактивировать' : 'Включить' }}
          </button>
        </div>
      </div>
    </div>

    <div
      style="
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid var(--color-neutral-800);
        font-size: 13.5px;
        color: var(--color-neutral-500);
        line-height: 1.5;
      "
    >
      Тег попадает в выгрузку CSV и остаётся в записях навсегда — поэтому инструменты не
      удаляются, а выключаются.
    </div>
  </div>
</template>
