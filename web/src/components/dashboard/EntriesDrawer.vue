<script setup lang="ts">
import { ref, watch } from 'vue'
import Drawer from 'primevue/drawer'
import { api } from '../../api/client.js'
import type { AnonEntry, ApproachStat } from '../../api/dashboardTypes.js'
import { fmtDate } from '../../lib/format.js'

const props = defineProps<{ approach: ApproachStat | null }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const entries = ref<AnonEntry[]>([])

watch(
  () => props.approach,
  async (a) => {
    entries.value = a
      ? await api<AnonEntry[]>(`/api/dashboard/approaches/${a.approachId}/entries`)
      : []
  },
)
</script>

<template>
  <Drawer
    :visible="!!props.approach"
    position="right"
    :header="props.approach?.title"
    style="width: 520px"
    @update:visible="emit('close')"
  >
    <div class="flex flex-col gap-(--space-3)">
      <span v-if="props.approach" class="meta tnum">
        N={{ props.approach.n }} · польза {{ props.approach.avgUsefulness }} · доверие
        {{ props.approach.avgTrust }}
      </span>
      <div
        v-for="e in entries"
        :key="e.id"
        class="flex flex-col gap-(--space-1)"
        style="border-top: 1px solid var(--color-neutral-900); padding-top: var(--space-3)"
      >
        <span class="meta tnum">
          {{ fmtDate(e.createdAt) }} · {{ e.toolTitle
          }}<template v-if="e.taskRef"> · {{ e.taskRef }}</template>
          · польза {{ e.usefulness }} · доверие {{ e.trust }}
        </span>
        <span v-if="e.note" style="font-size: 12.5px">{{ e.note }}</span>
      </div>
    </div>
  </Drawer>
</template>
