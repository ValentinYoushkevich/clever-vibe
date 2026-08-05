<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ApproachStat } from '../../api/dashboardTypes.js'

const props = defineProps<{ approaches: ApproachStat[]; teamSize: number }>()
const emit = defineEmits<{ (e: 'select', a: ApproachStat): void }>()

type Key = 'title' | 'stageTitle' | 'n' | 'avgUsefulness' | 'avgTrust' | 'coverage'
const sortKey = ref<Key>('n')
const sortDir = ref<1 | -1>(-1)

const COLUMNS: { key: Key; title: string }[] = [
  { key: 'title', title: 'Подход' },
  { key: 'stageTitle', title: 'Стадия' },
  { key: 'n', title: 'N' },
  { key: 'avgUsefulness', title: 'Польза' },
  { key: 'avgTrust', title: 'Доверие' },
  { key: 'coverage', title: 'Охват' },
]

function sortBy(key: Key) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 1 ? -1 : 1
  else {
    sortKey.value = key
    sortDir.value = key === 'title' || key === 'stageTitle' ? 1 : -1
  }
}

const sorted = computed(() =>
  [...props.approaches].sort((a, b) => {
    const [x, y] = [a[sortKey.value], b[sortKey.value]]
    return (
      (typeof x === 'string' ? String(x).localeCompare(String(y)) : Number(x) - Number(y)) *
      sortDir.value
    )
  }),
)
</script>

<template>
  <div class="card flex flex-col gap-(--space-3)">
    <h2>Таблица подходов</h2>
    <div style="max-height: 360px; overflow-y: auto">
      <table style="width: 100%; border-collapse: collapse; font-size: 12.5px">
        <thead style="position: sticky; top: 0; background: var(--color-surface)">
          <tr>
            <th
              v-for="c in COLUMNS"
              :key="c.key"
              class="section-label"
              style="text-align: left; padding: var(--space-2) var(--space-3); cursor: pointer"
              @click="sortBy(c.key)"
            >
              {{ c.title }}
              <i
                v-if="sortKey === c.key"
                :class="sortDir === 1 ? 'pi pi-arrow-up' : 'pi pi-arrow-down'"
                style="font-size: 9px"
              />
            </th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="a in sorted"
            :key="a.approachId"
            style="border-top: 1px solid var(--color-neutral-900); cursor: pointer"
            @click="emit('select', a)"
          >
            <td style="padding: var(--space-2) var(--space-3)">{{ a.title }}</td>
            <td class="meta">{{ a.stageTitle }}</td>
            <td class="tnum">{{ a.n }}</td>
            <td class="tnum" :style="a.lowData ? { color: 'var(--color-neutral-600)' } : {}">
              {{ a.avgUsefulness }}
            </td>
            <td class="tnum" :style="a.lowData ? { color: 'var(--color-neutral-600)' } : {}">
              {{ a.avgTrust }}
            </td>
            <td class="tnum">{{ a.coverage }}/{{ props.teamSize }}</td>
            <td>
              <span v-if="a.lowData" class="meta" style="color: var(--warn-dim)">мало данных</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
