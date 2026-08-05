<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DashboardData, TrendBucket } from '../../api/dashboardTypes.js'
import { f1 } from '../../lib/format.js'

const props = defineProps<{
  trend: DashboardData['trend']
  stages: DashboardData['stages']
}>()
const stageFilter = ref('') // '' = суммарно
const period = ref<TrendBucket>('month')

const LOW = 5
const MAX_POINTS = 12 // при мелкой разбивке подписи иначе наезжают друг на друга

const PERIODS: { value: TrendBucket; title: string }[] = [
  { value: 'day', title: 'По дням' },
  { value: 'week', title: 'По неделям' },
  { value: 'month', title: 'По месяцам' },
  { value: 'all', title: 'Весь пилот' },
]

// Координаты в процентах области графика (прототип: x 6…94, y 95 → 5)
const dots = computed(() => {
  const src = (props.trend[period.value] ?? []).slice(-MAX_POINTS).map((p) => {
    const v = stageFilter.value ? (p.byStage[stageFilter.value] ?? { n: 0, avg: 0 }) : p.total
    return { key: p.key, label: p.label, n: v.n, avg: v.avg }
  })
  const step = src.length > 1 ? 88 / (src.length - 1) : 0
  return src.map((d, i) => ({
    ...d,
    x: src.length > 1 ? 6 + i * step : 50,
    y: d.n ? 95 - ((d.avg - 1) / 4) * 90 : 50,
    value: d.n ? f1(d.avg) : '—',
    color: d.n < LOW ? 'var(--color-neutral-600)' : 'var(--color-accent)',
  }))
})

// Ломаная — только по точкам с данными
const polyline = computed(() =>
  dots.value
    .filter((d) => d.n > 0)
    .map((d) => `${((d.x / 100) * 300).toFixed(1)},${((d.y / 100) * 150).toFixed(1)}`)
    .join(' '),
)
</script>

<template>
  <div class="card">
    <div class="flex items-baseline justify-between gap-(--space-3)" style="margin-bottom: 14px">
      <h2 style="margin: 0; font-size: 16.5px; font-weight: 600">Динамика средней пользы</h2>
      <div class="flex items-center gap-(--space-2)">
        <select
          v-model="period"
          aria-label="Период"
          class="input"
          style="width: auto; padding: var(--space-2) var(--space-3); font-size: 14px"
        >
          <option v-for="p in PERIODS" :key="p.value" :value="p.value">{{ p.title }}</option>
        </select>
        <select
          v-model="stageFilter"
          aria-label="Стадия"
          class="input"
          style="width: auto; padding: var(--space-2) var(--space-3); font-size: 14px"
        >
          <option value="">Суммарно</option>
          <option v-for="s in props.stages" :key="s.code" :value="s.code">{{ s.title }}</option>
        </select>
      </div>
    </div>

    <div
      style="
        position: relative;
        height: 150px;
        border-left: 1px solid var(--color-neutral-800);
        border-bottom: 1px solid var(--color-neutral-800);
        margin-bottom: 8px;
      "
    >
      <svg
        viewBox="0 0 300 150"
        preserveAspectRatio="none"
        style="position: absolute; inset: 0; width: 100%; height: 100%"
      >
        <polyline
          :points="polyline"
          fill="none"
          stroke="var(--color-accent)"
          stroke-width="2"
          vector-effect="non-scaling-stroke"
        />
      </svg>
      <div
        v-for="d in dots.filter((p) => p.n > 0)"
        :key="d.key"
        style="
          position: absolute;
          transform: translate(-50%, -50%);
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--color-accent);
        "
        :style="{ left: d.x + '%', top: d.y + '%' }"
      />
    </div>

    <div class="flex justify-between">
      <div
        v-for="d in dots"
        :key="d.key"
        class="tnum"
        style="text-align: center; font-size: 13px; color: var(--color-neutral-500)"
      >
        {{ d.label }}<br />
        <span :style="{ color: d.color }">{{ d.value }}</span>
        <span style="color: var(--color-neutral-600)"> N {{ d.n }}</span>
      </div>
    </div>
  </div>
</template>
