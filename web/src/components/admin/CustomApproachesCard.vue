<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { api } from '../../api/client.js'
import { useDictionaries } from '../../stores/dictionaries.js'
import { plural } from '../../lib/format.js'

const MONTHS_RU = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
]
const monthOf = (iso: string) => MONTHS_RU[new Date(iso).getMonth()]

// Промоученные сюда не приходят — сервер их отфильтровывает, они уже в справочнике
interface CustomGroup {
  text: string
  n: number
  authors: string[]
  firstAt: string
  lastAt: string
  stageId: string
  stageTitle: string
}

const dict = useDictionaries()
const toast = useToast()
const confirm = useConfirm()
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

// Отклонение: предложение исчезает вместе с записями, где оно указано, —
// без них текст всё равно продолжил бы висеть в списке
function discard(g: CustomGroup) {
  const n = plural(g.n, 'запись', 'записи', 'записей')
  confirm.require({
    header: 'Удалить предложение?',
    message: `«${g.text}» исчезнет из списка, вместе с ним удалятся ${n}, где оно указано.`,
    icon: 'pi pi-exclamation-triangle',
    acceptProps: { label: 'Удалить', severity: 'danger' },
    rejectProps: { label: 'Отмена', severity: 'secondary', outlined: true },
    accept: async () => {
      await api('/api/custom-approaches', { method: 'DELETE', body: { text: g.text } })
      toast.add({ severity: 'success', summary: 'Предложение удалено', life: 2200 })
      await load()
    },
  })
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
        <!-- items-stretch, а не одинаковые паддинги: у иконки и у текста разные
             метрики строки, растяжение выравнивает высоту без подгонки на глаз -->
        <div class="flex items-stretch gap-(--space-2)">
          <button
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
          <!-- Удаление необратимо, поэтому цветом ошибки и всегда правее промоута -->
          <button
            type="button"
            class="discard-btn flex items-center"
            aria-label="Удалить предложение"
            v-tooltip.top="'Удалить предложение вместе с записями'"
            style="
              padding: 0 var(--space-3);
              border-radius: var(--radius-md);
              border: 1px solid var(--bad);
              background: var(--color-bg);
              color: var(--bad);
              cursor: pointer;
            "
            @click="discard(g)"
          >
            <i class="pi pi-trash" style="font-size: 14px" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.discard-btn:hover {
  background: var(--bad) !important;
  color: var(--color-bg) !important;
}
</style>
