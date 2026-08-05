<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useAuth } from '../stores/auth.js'
import { canAccessAdmin } from '../lib/permissions.js'
import { downloadFile } from '../lib/download.js'
import UsersCard from '../components/admin/UsersCard.vue'
import ApproachesCard from '../components/admin/ApproachesCard.vue'
import CustomApproachesCard from '../components/admin/CustomApproachesCard.vue'

const auth = useAuth()
const toast = useToast()
const allowed = computed(() => !!auth.user && canAccessAdmin(auth.user.role))
const approachesKey = ref(0) // перерисовать справочник после промоута

async function exportCsv() {
  await downloadFile('/api/export.csv', 'clever-vibe-entries.csv')
  toast.add({ severity: 'success', summary: 'CSV выгружен', life: 2200 })
}
</script>

<template>
  <div v-if="!allowed" class="p-(--space-8)">
    <div class="card" style="max-width: 420px">
      <p class="meta">Экран недоступен для вашей роли</p>
    </div>
  </div>
  <div v-else class="p-(--space-8) flex flex-col gap-(--space-6)">
    <div class="flex items-center">
      <h1>Администрирование</h1>
      <button class="btn btn-secondary ml-auto" @click="exportCsv">
        <i class="pi pi-download" /> Экспорт CSV
      </button>
    </div>
    <div class="grid gap-(--space-6)" style="grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)">
      <CustomApproachesCard @promoted="approachesKey++" />
      <ApproachesCard :key="approachesKey" />
    </div>
    <UsersCard />
  </div>
</template>
