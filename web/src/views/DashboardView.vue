<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'
import { api } from '../api/client.js'
import { useAuth } from '../stores/auth.js'
import { useDictionaries } from '../stores/dictionaries.js'
import { canAccessAdmin, canExportCsv } from '../lib/permissions.js'
import { downloadFile } from '../lib/download.js'
import type { ApproachStat, DashboardData } from '../api/dashboardTypes.js'
import QuadrantChart from '../components/dashboard/QuadrantChart.vue'
import StageCoverageCard from '../components/dashboard/StageCoverageCard.vue'
import TrendCard from '../components/dashboard/TrendCard.vue'
import SpreadCard from '../components/dashboard/SpreadCard.vue'
import ApproachesTable from '../components/dashboard/ApproachesTable.vue'
import EntriesDrawer from '../components/dashboard/EntriesDrawer.vue'

const auth = useAuth()
const toast = useToast()
const dict = useDictionaries()
const data = ref<DashboardData | null>(null)
const selected = ref<ApproachStat | null>(null)
const toolCode = ref('') // '' = все инструменты

// Экспорт на дашборде — для observer, которому админка недоступна (ТЗ §3.5)
const showExport = computed(
  () => !!auth.user && canExportCsv(auth.user.role) && !canAccessAdmin(auth.user.role),
)

const subtitle = computed(() => {
  const d = data.value
  if (!d) return ''
  const withData = d.approaches.filter((a) => a.n > 0).length
  return `${d.totalEntries} записей · ${d.teamSize} участника · ${withData} подходов с данными`
})

async function exportCsv() {
  await downloadFile('/api/export.csv', 'clever-vibe-entries.csv')
  toast.add({ severity: 'success', summary: 'CSV выгружен', life: 2200 })
}

async function load() {
  const qs = toolCode.value ? `?tool=${encodeURIComponent(toolCode.value)}` : ''
  data.value = await api<DashboardData>(`/api/dashboard${qs}`)
}

// data не обнуляем: иначе на время запроса пропадает вся страница вместе
// с селектором, из которого только что выбирали
watch(toolCode, async () => {
  selected.value = null // цифры в открытой шторке относились к прежнему срезу
  await load()
})

onMounted(async () => {
  await Promise.all([load(), dict.load()])
})
</script>

<template>
  <div v-if="data" class="page" style="max-width: 1440px">
    <div class="flex items-end justify-between" style="margin-bottom: 20px">
      <div>
        <div class="flex items-center gap-(--space-4)" style="margin-bottom: 5px">
          <h1 style="margin: 0; font-size: 23px; font-weight: 600; letter-spacing: -0.01em">
            Дашборд
          </h1>
          <select
            v-model="toolCode"
            aria-label="Инструмент"
            class="input"
            style="width: auto; padding: var(--space-2) var(--space-3); font-size: 14px"
          >
            <option value="">Все инструменты</option>
            <option v-for="t in dict.tools" :key="t.code" :value="t.code">{{ t.title }}</option>
          </select>
        </div>
        <p style="margin: 0; font-size: 15px; color: var(--color-neutral-400)">{{ subtitle }}</p>
      </div>
      <div class="flex items-center gap-(--space-4)">
        <button
          v-if="showExport"
          type="button"
          class="export-btn inline-flex items-center gap-(--space-2)"
          style="
            padding: var(--space-3) var(--space-6);
            border-radius: var(--radius-md);
            border: 1px solid var(--color-neutral-700);
            background: var(--color-bg);
            color: var(--color-text);
            font-size: 15px;
            cursor: pointer;
          "
          @click="exportCsv"
        >
          <i class="pi pi-download" />Экспорт всех записей в CSV
        </button>
        <span style="font-size: 13.5px; color: var(--color-neutral-600)">
          Рядом со средней всегда N. При N &lt; 5 значение приглушено.
        </span>
      </div>
    </div>

    <div
      class="grid gap-(--space-6)"
      style="grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); margin-bottom: 16px"
    >
      <QuadrantChart
        :approaches="data.approaches"
        :total-entries="data.totalEntries"
        @select="selected = $event"
      />
      <div class="flex flex-col gap-(--space-6)">
        <StageCoverageCard :stages="data.stages" />
        <TrendCard :trend="data.trend" :stages="data.stages" />
      </div>
    </div>

    <!-- Обе карточки в одном ряду высотой по контенту, но не выше 560px: списки
         тут длинные и разной длины, и без общего потолка одна прокручивалась бы
         внутри себя, а вторая растягивала страницу на всю высоту -->
    <div
      class="grid gap-(--space-6)"
      style="
        grid-template-columns: minmax(0, 1fr) minmax(0, 1.45fr);
        grid-auto-rows: minmax(0, 560px);
      "
    >
      <SpreadCard :spread="data.spread" />
      <ApproachesTable
        :approaches="data.approaches"
        :team-size="data.teamSize"
        @select="selected = $event"
      />
    </div>

    <EntriesDrawer
      :approach="selected"
      :team-size="data.teamSize"
      :tool-code="toolCode"
      @close="selected = null"
    />
  </div>
</template>

<style scoped>
.export-btn:hover {
  border-color: var(--color-accent) !important;
  color: var(--color-accent) !important;
}
</style>
