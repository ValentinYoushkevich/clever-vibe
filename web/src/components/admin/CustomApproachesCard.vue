<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { api } from '../../api/client.js'
import { useDictionaries } from '../../stores/dictionaries.js'
import { plural } from '../../lib/format.js'

const MONTHS_RU = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
]
const monthOf = (iso: string) => MONTHS_RU[new Date(iso).getMonth()]

interface CustomGroup {
  text: string
  n: number
  authors: string[]
  firstAt: string
  lastAt: string
  stageId: string
  stageTitle: string
  promoted: boolean
}

const dict = useDictionaries()
const toast = useToast()
const groups = ref<CustomGroup[]>([])
const emit = defineEmits<{ (e: 'promoted'): void }>()

async function load() {
  groups.value = await api<CustomGroup[]>('/api/custom-approaches')
}

// Авторство здесь раскрывается намеренно: лид разбирает предложения (ТЗ §3.5)
function groupMeta(g: CustomGroup): string {
  const from = monthOf(g.firstAt)
  const to = monthOf(g.lastAt)
  const period = from === to ? from : `${from}–${to}`
  return `${g.stageTitle} · ${g.authors.join(', ')} · ${plural(g.n, 'запись', 'записи', 'записей')} · ${period}`
}

async function promote(g: CustomGroup) {
  await api('/api/approaches/promote', {
    method: 'POST',
    body: { text: g.text, stageId: g.stageId },
  })
  toast.add({ severity: 'success', summary: 'Подход добавлен в справочник', life: 2200 })
  // Справочник пополнился — чипсы быстрого ввода перечитают его
  dict.loaded = false
  await Promise.all([load(), dict.load()])
  emit('promoted')
}

onMounted(load)
</script>

<template>
  <div class="card">
    <h2 style="margin: 0 0 4px; font-size: 16.5px; font-weight: 600">
      Кастомные подходы на разбор
    </h2>
    <p style="margin: 0 0 14px; font-size: 14px; color: var(--color-neutral-500)">
      Повторяющиеся — промоутить в справочник, иначе агрегации не будет.
    </p>

    <p v-if="!groups.length" class="meta">Предложений нет</p>
    <div class="flex flex-col gap-(--space-3)">
      <div
        v-for="g in groups"
        :key="g.text"
        class="flex items-center gap-(--space-4)"
        style="
          padding: var(--space-4);
          background: var(--color-bg);
          border: 1px solid var(--color-neutral-800);
          border-radius: var(--radius-md);
        "
      >
        <div style="flex: 1; min-width: 0">
          <div style="font-size: 15px; margin-bottom: 3px">{{ g.text }}</div>
          <div class="tnum" style="font-size: 13px; color: var(--color-neutral-500)">
            {{ groupMeta(g) }}
          </div>
        </div>
        <span v-if="g.promoted" style="font-size: 14px; color: var(--color-neutral-500)">
          В справочнике
        </span>
        <button
          v-else
          type="button"
          style="
            padding: var(--space-2) var(--space-4);
            border-radius: var(--radius-md);
            border: 1px solid var(--color-accent-700);
            background: var(--color-accent-900);
            color: var(--color-accent);
            font-size: 14px;
            cursor: pointer;
            white-space: nowrap;
          "
          @click="promote(g)"
        >
          Промоутить
        </button>
      </div>
    </div>
  </div>
</template>
