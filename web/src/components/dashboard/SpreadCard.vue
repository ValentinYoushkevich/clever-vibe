<script setup lang="ts">
import type { DashboardData } from '../../api/dashboardTypes.js'

const props = defineProps<{ spread: DashboardData['spread'] }>()
const pct = (v: number) => ((v - 1) / 4) * 100
</script>

<template>
  <div class="card flex flex-col gap-(--space-3)">
    <h2>Разброс между участниками</h2>
    <div
      v-for="row in props.spread"
      :key="row.approachId"
      class="grid items-center gap-(--space-3)"
      style="grid-template-columns: minmax(0, 1fr) 180px 64px"
    >
      <span class="meta">{{ row.title }}</span>
      <!-- При N ≤ 5 отрезок не строится (ТЗ §3.4, виджет 4) -->
      <template v-if="row.n > 5">
        <div
          style="
            position: relative;
            height: 9px;
            background: var(--color-neutral-900);
            border-radius: 4px;
          "
        >
          <div
            :style="{
              position: 'absolute',
              left: pct(row.min) + '%',
              width: Math.max(2, pct(row.max) - pct(row.min)) + '%',
              height: '9px',
              borderRadius: '4px',
              background: row.delta >= 2 ? 'var(--warn)' : 'var(--color-accent)',
            }"
          />
        </div>
        <span class="meta tnum">±{{ row.delta }}</span>
      </template>
      <span v-else class="meta" style="grid-column: span 2">
        недостаточно данных для формирования результата
      </span>
    </div>
    <span class="meta">Большой разброс — дело в способе применения: повод обменяться практиками</span>
  </div>
</template>
