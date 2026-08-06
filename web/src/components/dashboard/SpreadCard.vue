<script setup lang="ts">
import { computed } from 'vue'
import type { DashboardData } from '../../api/dashboardTypes.js'
import { f1, plural } from '../../lib/format.js'

const props = defineProps<{ spread: DashboardData['spread'] }>()

const MIN_N = 5 // при N ≤ 5 отрезок не строится (ТЗ §3.4, виджет 4)

// Виджет показывает не разброс оценок, а расстояние между людьми, и по одной
// полоске это не прочитать — тултип проговаривает, что именно за числа
function tipOf(r: DashboardData['spread'][number], d: number): string {
  const rows = [
    r.title,
    `строже всех: ${f1(r.min)} · щедрее всех: ${f1(r.max)}`,
    // Дробное всегда «балла»: 2.4 балла, 1.0 балла — plural тут не нужен
    `расхождение ${f1(d)} балла между участниками`,
    `${plural(r.n, 'запись', 'записи', 'записей')} · ${plural(r.coverage, 'участник', 'участника', 'участников')}`,
  ]
  // Разброс считается по крайним, поэтому один участник — это не согласие
  if (r.coverage < 2) rows.push('оценивал только один человек — сравнивать не с кем')
  else if (d >= 2) rows.push('разошлись сильно — стоит спросить, кто как применяет')
  return rows.join('\n')
}

const rows = computed(() =>
  props.spread.map((r) => {
    const d = r.max - r.min
    return {
      ...r,
      enough: r.n > MIN_N,
      left: ((r.min - 1) / 4) * 100,
      width: Math.max(2, (d / 4) * 100),
      color: d >= 2 ? 'var(--warn)' : 'var(--color-neutral-600)',
      deltaLabel: '±' + f1(d / 2),
      tip: tipOf(r, d),
      lowTip:
        `${r.title}\n${plural(r.n, 'запись', 'записи', 'записей')} — ` +
        `отрезок строится начиная с ${MIN_N + 1}`,
    }
  }),
)

const HEADER_TIP = [
  'У каждого участника считается его личное среднее по подходу.',
  'Отрезок тянется от самой строгой оценки к самой щедрой,',
  'вся ширина дорожки — шкала пользы от 1 до 5.',
  'Число справа — половина расхождения между крайними участниками.',
].join('\n')
</script>

<template>
  <div class="card flex flex-col" style="min-height: 0">
    <h2
      class="flex items-center gap-(--space-2)"
      style="margin: 0 0 4px; font-size: 16.5px; font-weight: 600"
    >
      Разброс между участниками
      <i
        v-tooltip.top="{ value: HEADER_TIP, class: 'chart-tip' }"
        class="pi pi-info-circle"
        style="font-size: 13px; color: var(--color-neutral-500); cursor: help"
      />
    </h2>
    <p style="margin: 0 0 14px; font-size: 14px; color: var(--color-neutral-500)">
      Большой разброс — дело в способе применения, а не в подходе.
    </p>
    <!-- Прокручивается список, а не карточка: заголовок с пояснением должен
         оставаться на виду, пока листаешь подходы -->
    <div class="flex flex-col gap-(--space-3)" style="flex: 1; min-height: 0; overflow: auto">
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
          <!-- Тултип на всей дорожке, а не на отрезке: отрезок бывает шириной
               в пару пикселей, и навести на него мышью не получится -->
          <div
            v-tooltip.top="{ value: r.tip, class: 'chart-tip' }"
            style="position: relative; height: 16px; cursor: help"
          >
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
          <span
            v-tooltip.top="{ value: r.tip, class: 'chart-tip' }"
            class="tnum"
            style="font-size: 13px; cursor: help"
            :style="{ color: r.color }"
          >
            {{ r.deltaLabel }}
          </span>
        </template>
        <span
          v-else
          v-tooltip.top="{ value: r.lowTip, class: 'chart-tip' }"
          style="grid-column: span 2; font-size: 13px; color: var(--color-neutral-600); cursor: help"
        >
          мало данных
        </span>
      </div>
    </div>
  </div>
</template>
