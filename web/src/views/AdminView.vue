<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useAuth } from '../stores/auth.js'
import { canAccessAdmin } from '../lib/permissions.js'
import { downloadFile } from '../lib/download.js'
import UsersCard from '../components/admin/UsersCard.vue'
import ApproachesCard from '../components/admin/ApproachesCard.vue'
import CustomApproachesCard from '../components/admin/CustomApproachesCard.vue'
import ToolsCard from '../components/admin/ToolsCard.vue'

const auth = useAuth()
const toast = useToast()
const allowed = computed(() => !!auth.user && canAccessAdmin(auth.user.role))
const approachesKey = ref(0) // перерисовать справочник после промоута
const exported = ref(false)

async function exportCsv() {
  await downloadFile('/api/export.csv', 'clever-vibe-entries.csv')
  exported.value = true
  setTimeout(() => (exported.value = false), 2200)
  toast.add({ severity: 'success', summary: 'CSV выгружен', life: 2200 })
}
</script>

<template>
  <div class="page">
    <div class="flex items-end justify-between" style="margin-bottom: 20px">
      <div>
        <h1 style="margin: 0 0 5px; font-size: 23px; font-weight: 600; letter-spacing: -0.01em">
          Администрирование
        </h1>
        <p style="margin: 0; font-size: 15px; color: var(--color-neutral-400)">
          Доступно только роли lead.
        </p>
      </div>
      <button
        v-if="allowed"
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
        <i class="pi pi-download" />{{
          exported ? 'CSV сформирован' : 'Экспорт всех записей в CSV'
        }}
      </button>
    </div>

    <div
      v-if="!allowed"
      style="
        padding: var(--space-6);
        background: var(--color-neutral-900);
        border: 1px solid var(--warn-dim);
        border-radius: var(--radius-lg);
        font-size: 15px;
        color: var(--warn);
      "
    >
      Вы вошли как {{ auth.user?.role }} — экран доступен только лиду. Войдите под учётной записью
      тимлида.
    </div>

    <div
      v-else
      class="grid items-start gap-(--space-6)"
      style="grid-template-columns: minmax(0, 1fr) 330px"
    >
      <div class="flex flex-col gap-(--space-6)">
        <CustomApproachesCard @promoted="approachesKey++" />
        <ApproachesCard :key="approachesKey" />
      </div>
      <div class="flex flex-col gap-(--space-6)">
        <UsersCard />
        <ToolsCard />
      </div>
    </div>
  </div>
</template>

<style scoped>
.export-btn:hover {
  border-color: var(--color-accent) !important;
  color: var(--color-accent) !important;
}
</style>
