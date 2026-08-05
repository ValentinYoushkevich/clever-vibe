<script setup lang="ts">
import { computed } from 'vue'
import type { DashboardData } from '../../api/dashboardTypes.js'
import { f1 } from '../../lib/format.js'

const props = defineProps<{ spread: DashboardData['spread'] }>()

const rows = computed(() =>
  props.spread.map((r) => {
    const d = r.max - r.min
    return {
      ...r,
      // При N ≤ 5 отрезок не строится (ТЗ §3.4, виджет 4)
      enough: r.n > 5,
      left: ((r.min - 1) / 4) * 100,
      width: Math.max(2, (d / 4) * 100),
      color: d >= 2 ? 'var(--warn)' : 'var(--color-neutral-600)',
      deltaLabel: '±' + f1(d / 2),
    }
  }),
)
</script>

<template>
  <div class="card">
    <h2 style="margin: 0 0 4px; font-size: 16.5px; font-weight: 600">Разброс между участниками</h2>
    <p style="margin: 0 0 14px; font-size: 14px; color: var(--color-neutral-500)">
      Большой разброс — дело в способе применения, а не в подходе.
    </p>
    <div class="flex flex-col gap-(--space-3)">
      <div
        v-for="r in rows"
        :key="r.approachId"
        class="grid items-center gap-(--space-3)"
        style="grid-template-columns: minmax(0, 1fr) 150px 46px"
      >
        <span
          style="
            font-size: 14.5px;
            color: var(--color-neutral-300);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          "
          >{{ r.title }}</span
        >
        <template v-if="r.enough">
          <div style="position: relative; height: 16px">
            <div
              style="
                position: absolute;
                left: 0;
                right: 0;
                top: 7px;
                height: 1px;
                background: var(--color-neutral-800);
              "
            />
            <div
              style="position: absolute; top: 6px; height: 4px; border-radius: var(--radius-sm)"
              :style="{ left: r.left + '%', width: r.width + '%', background: r.color }"
            />
          </div>
          <span class="tnum" style="font-size: 13px" :style="{ color: r.color }">
            {{ r.deltaLabel }}
          </span>
        </template>
        <span
          v-else
          style="grid-column: span 2; font-size: 13px; color: var(--color-neutral-600)"
        >
          мало данных
        </span>
      </div>
    </div>
  </div>
</template>
