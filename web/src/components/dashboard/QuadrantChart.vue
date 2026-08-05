<script setup lang="ts">
import { computed } from 'vue'
import type { ApproachStat } from '../../api/dashboardTypes.js'
import { pointColor, pointRadius, median, QUADRANT_MIN_TOTAL } from '../../lib/quadrant.js'

const props = defineProps<{ approaches: ApproachStat[]; totalEntries: number }>()
const emit = defineEmits<{ (e: 'select', a: ApproachStat): void }>()

const W = 640
const H = 340
const PAD = 28

const maxN = computed(() => Math.max(5, ...props.approaches.map((a) => a.n)))
const x = (n: number) => PAD + (n / maxN.value) * (W - 2 * PAD)
const y = (u: number) => H - PAD - ((u - 1) / 4) * (H - 2 * PAD)

// Границы — медианы по подходам с ≥ 1 записью; до 50 записей всего скрыты (ТЗ §3.4)
const showBounds = computed(() => props.totalEntries >= QUADRANT_MIN_TOTAL)
const mx = computed(() => median(props.approaches.map((a) => a.n)))
const my = computed(() => median(props.approaches.map((a) => a.avgUsefulness)))

// X — частота, Y — польза: ↑← продвигать, ↑→ закрепить, ↓← отбросить, ↓→ разбираться
const corners = [
  { label: 'продвигать', cx: PAD + 4, cy: PAD + 12, anchor: 'start' },
  { label: 'закрепить', cx: W - PAD - 4, cy: PAD + 12, anchor: 'end' },
  { label: 'отбросить', cx: PAD + 4, cy: H - PAD - 6, anchor: 'start' },
  { label: 'разбираться', cx: W - PAD - 4, cy: H - PAD - 6, anchor: 'end' },
]
</script>

<template>
  <div class="card flex flex-col gap-(--space-3)">
    <div class="flex items-center gap-(--space-3)">
      <h2>Квадранты: частота × польза</h2>
      <span v-if="showBounds" class="meta ml-auto">границы предварительные</span>
      <span v-else class="meta ml-auto">границы появятся после 50 записей</span>
    </div>
    <svg :viewBox="`0 0 ${W} ${H}`" style="width: 100%; height: 340px">
      <rect
        :x="PAD"
        :y="PAD"
        :width="W - 2 * PAD"
        :height="H - 2 * PAD"
        fill="none"
        stroke="var(--color-neutral-800)"
      />
      <template v-if="showBounds">
        <line
          :x1="x(mx)"
          :y1="PAD"
          :x2="x(mx)"
          :y2="H - PAD"
          stroke="var(--color-neutral-700)"
          stroke-dasharray="4 4"
        />
        <line
          :x1="PAD"
          :y1="y(my)"
          :x2="W - PAD"
          :y2="y(my)"
          stroke="var(--color-neutral-700)"
          stroke-dasharray="4 4"
        />
        <text
          v-for="c in corners"
          :key="c.label"
          :x="c.cx"
          :y="c.cy"
          :text-anchor="c.anchor"
          style="font-size: 10.5px; fill: var(--color-neutral-500)"
        >
          {{ c.label }}
        </text>
      </template>
      <circle
        v-for="a in props.approaches"
        :key="a.approachId"
        :cx="x(a.n)"
        :cy="y(a.avgUsefulness)"
        :r="pointRadius(a.n)"
        :stroke="pointColor(a.avgTrust)"
        :fill="pointColor(a.avgTrust)"
        fill-opacity="0.4"
        style="cursor: pointer"
        @click="emit('select', a)"
      >
        <title>
          {{ a.title }} — N={{ a.n }}, польза {{ a.avgUsefulness }}, доверие {{ a.avgTrust }}
        </title>
      </circle>
    </svg>
    <span class="meta">X — число применений, Y — средняя польза, размер — N, цвет — доверие</span>
  </div>
</template>
