<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { api } from '../../api/client.js'
import { useDictionaries } from '../../stores/dictionaries.js'
import { fmtDate } from '../../lib/format.js'

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
  <div class="card flex flex-col gap-(--space-4)">
    <h2>Кастомные подходы на разбор</h2>
    <p v-if="!groups.length" class="meta">Предложений нет</p>
    <div
      v-for="g in groups"
      :key="g.text"
      class="grid items-center gap-(--space-3)"
      style="
        grid-template-columns: minmax(0, 1fr) 160px 120px;
        border-top: 1px solid var(--color-neutral-900);
        padding-top: var(--space-3);
      "
    >
      <div class="flex flex-col gap-(--space-1)">
        <span>{{ g.text }}</span>
        <span class="meta"> {{ g.stageTitle }} · {{ g.authors.join(', ') }} · {{ g.n }} × </span>
      </div>
      <span class="meta tnum">{{ fmtDate(g.firstAt) }} — {{ fmtDate(g.lastAt) }}</span>
      <span v-if="g.promoted" class="meta">В справочнике</span>
      <button
        v-else
        class="btn btn-secondary"
        style="padding: 2px var(--space-3)"
        @click="promote(g)"
      >
        Промоутить
      </button>
    </div>
  </div>
</template>
