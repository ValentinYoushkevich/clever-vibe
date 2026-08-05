<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DashboardData } from '../../api/dashboardTypes.js'
import { fmtMonth } from '../../lib/format.js'

const props = defineProps<{
  monthly: DashboardData['monthly']
  stages: DashboardData['stages']
}>()
const stageFilter = ref('') // '' = суммарно

const points = computed(() =>
  props.monthly.map((m) => {
    const src = stageFilter.value ? (m.byStage[stageFilter.value] ?? { n: 0, avg: 0 }) : m.total
    return { month: m.month, ...src }
  }),
)

const W = 480
const H = 200
const PAD = 24
const x = (i: number) =>
  PAD +
  (points.value.length > 1 ? (i / (points.value.length - 1)) * (W - 2 * PAD) : (W - 2 * PAD) / 2)
const y = (avg: number) => H - PAD - ((avg - 1) / 4) * (H - 2 * PAD)
// Ломаная строится только по месяцам с данными, но X берётся по исходному индексу месяца
const polyline = computed(() =>
  points.value
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.n > 0)
    .map(({ p, i }) => `${x(i)},${y(p.avg)}`)
    .join(' '),
)
</script>

<template>
  <div class="card flex flex-col gap-(--space-3)">
    <div class="flex items-center gap-(--space-3)">
      <h2>Динамика средней пользы</h2>
      <select v-model="stageFilter" class="input ml-auto" style="width: 170px">
        <option value="">Суммарно</option>
        <option v-for="s in props.stages" :key="s.code" :value="s.code">{{ s.title }}</option>
      </select>
    </div>
    <svg :viewBox="`0 0 ${W} ${H + 30}`" style="width: 100%">
      <polyline :points="polyline" fill="none" stroke="var(--color-accent)" stroke-width="2" />
      <template v-for="(p, i) in points" :key="p.month">
        <circle v-if="p.n > 0" :cx="x(i)" :cy="y(p.avg)" r="4" fill="var(--color-accent)" />
        <text
          :x="x(i)"
          :y="H + 8"
          text-anchor="middle"
          style="font-size: 10.5px; fill: var(--color-neutral-500)"
        >
          {{ fmtMonth(p.month) }}
        </text>
        <text
          :x="x(i)"
          :y="H + 22"
          text-anchor="middle"
          class="tnum"
          :style="{
            fontSize: '10.5px',
            fill: p.n < 5 ? 'var(--color-neutral-600)' : 'var(--color-text)',
          }"
          >{{ p.n > 0 ? `${p.avg} · N=${p.n}` : '—' }}</text
        >
      </template>
    </svg>
  </div>
</template>
