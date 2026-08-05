<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { api } from '../api/client.js'
import { useAuth } from '../stores/auth.js'
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
const data = ref<DashboardData | null>(null)
const selected = ref<ApproachStat | null>(null)

// Экспорт на дашборде — для observer, которому админка недоступна (ТЗ §3.5)
const showExport = computed(
  () => !!auth.user && canExportCsv(auth.user.role) && !canAccessAdmin(auth.user.role),
)

async function exportCsv() {
  await downloadFile('/api/export.csv', 'clever-vibe-entries.csv')
  toast.add({ severity: 'success', summary: 'CSV выгружен', life: 2200 })
}

onMounted(async () => {
  data.value = await api<DashboardData>('/api/dashboard')
})
</script>

<template>
  <div v-if="data" class="p-(--space-8) flex flex-col gap-(--space-6)">
    <div class="flex items-center">
      <h1>Дашборд</h1>
      <span class="meta tnum" style="margin-left: var(--space-4)"
        >всего записей: {{ data.totalEntries }}</span
      >
      <button v-if="showExport" class="btn btn-secondary ml-auto" @click="exportCsv">
        <i class="pi pi-download" /> Экспорт CSV
      </button>
    </div>

    <div
      class="grid gap-(--space-6)"
      style="grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr)"
    >
      <QuadrantChart
        :approaches="data.approaches"
        :total-entries="data.totalEntries"
        @select="selected = $event"
      />
      <StageCoverageCard :stages="data.stages" />
    </div>

    <div
      class="grid gap-(--space-6)"
      style="grid-template-columns: minmax(0, 1fr) minmax(0, 1.45fr)"
    >
      <TrendCard :monthly="data.monthly" :stages="data.stages" />
      <SpreadCard :spread="data.spread" />
    </div>

    <ApproachesTable
      :approaches="data.approaches"
      :team-size="data.teamSize"
      @select="selected = $event"
    />

    <EntriesDrawer :approach="selected" @close="selected = null" />
  </div>
</template>
