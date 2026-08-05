<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ApproachStat } from '../../api/dashboardTypes.js'
import { pointColor } from '../../lib/quadrant.js'
import { f1 } from '../../lib/format.js'

const props = defineProps<{ approaches: ApproachStat[]; teamSize: number }>()
const emit = defineEmits<{ (e: 'select', a: ApproachStat): void }>()

type Key = 'title' | 'stageTitle' | 'n' | 'avgUsefulness' | 'avgTrust' | 'coverage'
const sortKey = ref<Key>('n')
const sortDir = ref<1 | -1>(-1)

const COLUMNS: { key: Key | null; title: string; align: 'left' | 'right' }[] = [
  { key: 'title', title: 'Подход', align: 'left' },
  { key: 'stageTitle', title: 'Стадия', align: 'left' },
  { key: 'n', title: 'N', align: 'right' },
  { key: 'avgUsefulness', title: 'Польза', align: 'right' },
  { key: 'avgTrust', title: 'Доверие', align: 'right' },
  { key: 'coverage', title: 'Охват', align: 'right' },
  { key: null, title: '', align: 'left' },
]

function sortBy(key: Key | null) {
  if (!key) return
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
  <div class="card" style="padding: var(--space-8) 0 var(--space-3)">
    <h2 style="margin: 0 20px 14px; font-size: 16.5px; font-weight: 600">Таблица подходов</h2>
    <div style="max-height: 360px; overflow: auto">
      <table style="width: 100%; border-collapse: collapse">
        <thead>
          <tr>
            <th
              v-for="c in COLUMNS"
              :key="c.title"
              style="
                position: sticky;
                top: 0;
                background: var(--color-surface);
                padding: var(--space-3) var(--space-4);
                font-size: 12.5px;
                font-weight: 600;
                letter-spacing: 0.07em;
                text-transform: uppercase;
                border-bottom: 1px solid var(--color-neutral-800);
                white-space: nowrap;
                cursor: pointer;
              "
              :style="{
                textAlign: c.align,
                color: sortKey === c.key ? 'var(--color-text)' : 'var(--color-neutral-500)',
              }"
              @click="sortBy(c.key)"
            >
              <span class="inline-flex items-center gap-(--space-1)">
                {{ c.title }}
                <i
                  v-if="c.key && sortKey === c.key"
                  :class="sortDir === 1 ? 'pi pi-arrow-up' : 'pi pi-arrow-down'"
                  style="font-size: 11px"
                />
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in sorted" :key="a.approachId" class="row" @click="emit('select', a)">
            <td style="font-size: 14.5px">{{ a.title }}</td>
            <td style="font-size: 14px; color: var(--color-neutral-400); white-space: nowrap">
              {{ a.stageTitle }}
            </td>
            <td class="tnum" style="font-size: 14px; text-align: right; color: var(--color-neutral-400)">
              {{ a.n }}
            </td>
            <td
              class="tnum"
              style="font-size: 14px; text-align: right"
              :style="{ color: a.lowData ? 'var(--color-neutral-600)' : 'var(--color-neutral-200)' }"
            >
              {{ f1(a.avgUsefulness) }}
            </td>
            <td
              class="tnum"
              style="font-size: 14px; text-align: right"
              :style="{
                color: a.lowData ? 'var(--color-neutral-600)' : pointColor(a.avgTrust),
              }"
            >
              {{ f1(a.avgTrust) }}
            </td>
            <td class="tnum" style="font-size: 14px; text-align: right; color: var(--color-neutral-400)">
              {{ a.coverage }}/{{ props.teamSize }}
            </td>
            <td style="font-size: 12.5px; color: var(--warn-dim); white-space: nowrap">
              <template v-if="a.lowData">мало данных</template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.row {
  cursor: pointer;
}
.row:hover {
  background: var(--color-neutral-900);
}
.row td {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-neutral-900);
}
</style>
