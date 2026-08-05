<script setup lang="ts">
import { computed } from 'vue'
import type { ApproachStat } from '../../api/dashboardTypes.js'
import { pointColor, pointRadius, median, QUADRANT_MIN_TOTAL } from '../../lib/quadrant.js'
import { f1 } from '../../lib/format.js'

const props = defineProps<{ approaches: ApproachStat[]; totalEntries: number }>()
const emit = defineEmits<{ (e: 'select', a: ApproachStat): void }>()

// Координаты в процентах области (прототип): X — частота, Y — средняя польза
const maxN = computed(() => Math.max(1, ...props.approaches.map((a) => a.n)))
const xPct = (n: number) => 8 + (n / maxN.value) * 84
const yPct = (u: number) => 92 - ((u - 1) / 4) * 84

// Границы — медианы по подходам с ≥ 1 записью; до 50 записей всего скрыты (ТЗ §3.4)
const showBounds = computed(() => props.totalEntries >= QUADRANT_MIN_TOTAL)
const medN = computed(() => median(props.approaches.map((a) => a.n)))
const medU = computed(() => median(props.approaches.map((a) => a.avgUsefulness)))
const medianLabel = computed(() =>
  showBounds.value
    ? `границы — медианы N ${medN.value} / польза ${f1(medU.value)}`
    : `границы появятся после ${QUADRANT_MIN_TOTAL} записей`,
)

const points = computed(() =>
  props.approaches.map((a) => ({
    a,
    x: xPct(a.n),
    y: yPct(a.avgUsefulness),
    size: pointRadius(a.n) * 2,
    stroke: pointColor(a.avgTrust),
    fill: `color-mix(in srgb, ${pointColor(a.avgTrust)} 40%, transparent)`,
    tip: `${a.title} · N ${a.n} · польза ${f1(a.avgUsefulness)} · доверие ${f1(a.avgTrust)}`,
  })),
)

// Примеры размеров той же формулой, что и точки на графике
const SIZE_LEGEND = [1, 10, 20].map((n) => ({
  label: n === 20 ? '20+' : String(n),
  size: pointRadius(n) * 2,
}))

const QUADRANTS: {
  text: string
  left: string
  top: string
  right: string
  bottom: string
  align: 'left' | 'right'
}[] = [
  { text: 'редко + полезно → продвигать', left: '0', top: '0', right: 'auto', bottom: 'auto', align: 'left' },
  { text: 'часто + полезно → закрепить', left: 'auto', top: '0', right: '0', bottom: 'auto', align: 'right' },
  { text: 'редко + бесполезно → отбросить', left: '0', top: 'auto', right: 'auto', bottom: '0', align: 'left' },
  { text: 'часто + бесполезно → разбираться', left: 'auto', top: 'auto', right: '0', bottom: '0', align: 'right' },
]
</script>

<template>
  <div class="card">
    <div class="flex items-baseline justify-between" style="margin-bottom: 16px">
      <h2 style="margin: 0; font-size: 16.5px; font-weight: 600">Квадранты: частота × польза</h2>
      <span class="tnum" style="font-size: 13px; color: var(--color-neutral-600)">
        {{ medianLabel }}
      </span>
    </div>

    <div
      class="grid gap-(--space-2)"
      style="grid-template-columns: 22px minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) 22px"
    >
      <div
        style="
          writing-mode: vertical-rl;
          transform: rotate(180deg);
          text-align: center;
          font-size: 12.5px;
          color: var(--color-neutral-600);
        "
      >
        средняя польза →
      </div>
      <div
        style="
          position: relative;
          height: 340px;
          background: var(--color-bg);
          border: 1px solid var(--color-neutral-800);
          border-radius: var(--radius-md);
          overflow: hidden;
        "
      >
        <template v-if="showBounds">
          <div
            style="position: absolute; left: 0; right: 0; height: 1px; background: var(--color-neutral-700)"
            :style="{ top: yPct(medU) + '%' }"
          />
          <div
            style="position: absolute; top: 0; bottom: 0; width: 1px; background: var(--color-neutral-700)"
            :style="{ left: xPct(medN) + '%' }"
          />
        </template>
        <div
          v-for="q in QUADRANTS"
          :key="q.text"
          style="
            position: absolute;
            padding: var(--space-3);
            font-size: 12.5px;
            /* Шаг 500 — «подписи, мета»: одинаково читаем во всех темах,
               в светлой шкала светлоты инвертируется (docs/design/README.md) */
            color: var(--color-neutral-500);
            pointer-events: none;
          "
          :style="{ left: q.left, top: q.top, right: q.right, bottom: q.bottom, textAlign: q.align }"
        >
          {{ q.text }}
        </div>
        <button
          v-for="p in points"
          :key="p.a.approachId"
          type="button"
          :title="p.tip"
          style="position: absolute; transform: translate(-50%, -50%); border-radius: 50%; cursor: pointer"
          :style="{
            left: p.x + '%',
            top: p.y + '%',
            width: p.size + 'px',
            height: p.size + 'px',
            background: p.fill,
            border: `1.5px solid ${p.stroke}`,
          }"
          @click="emit('select', p.a)"
        />
      </div>
      <div />
      <div style="text-align: center; font-size: 12.5px; color: var(--color-neutral-600)">
        число применений командой →
      </div>
    </div>

    <div
      class="flex flex-col gap-(--space-3)"
      style="margin-top: 12px; font-size: 13px; color: var(--color-neutral-500)"
    >
      <div class="flex items-center gap-(--space-6)">
        <span>цвет — среднее доверие:</span>
        <span class="flex items-center gap-(--space-2)">
          <span style="width: 9px; height: 9px; border-radius: 50%; background: var(--bad)" />низкое
        </span>
        <span class="flex items-center gap-(--space-2)">
          <span style="width: 9px; height: 9px; border-radius: 50%; background: var(--warn)" />среднее
        </span>
        <span class="flex items-center gap-(--space-2)">
          <span
            style="width: 9px; height: 9px; border-radius: 50%; background: var(--color-accent)"
          />высокое
        </span>
      </div>
      <div class="flex items-center gap-(--space-6)">
        <span>размер — число записей:</span>
        <span
          v-for="s in SIZE_LEGEND"
          :key="s.label"
          class="flex items-center gap-(--space-2)"
        >
          <span
            style="
              border-radius: 50%;
              background: color-mix(in srgb, var(--color-neutral-500) 40%, transparent);
              border: 1.5px solid var(--color-neutral-500);
            "
            :style="{ width: s.size + 'px', height: s.size + 'px' }"
          />{{ s.label }}
        </span>
        <span style="margin-left: auto">клик по точке → записи</span>
      </div>
    </div>
  </div>
</template>
