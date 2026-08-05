<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { api } from '../../api/client.js'
import type { AnonEntry, ApproachStat } from '../../api/dashboardTypes.js'
import { fmtDate, f1 } from '../../lib/format.js'

const props = defineProps<{ approach: ApproachStat | null; teamSize: number }>()
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

// Авторство в общекомандных представлениях не раскрывается (ТЗ §3.4)
const meta = computed(() => {
  const a = props.approach
  if (!a) return ''
  return `${a.stageTitle} · N ${a.n} · польза ${f1(a.avgUsefulness)} · доверие ${f1(a.avgTrust)} · охват ${a.coverage}/${props.teamSize}`
})

function entryMeta(e: AnonEntry): string {
  const parts = [e.toolTitle]
  if (e.taskRef) parts.push(e.taskRef)
  return parts.join(' · ')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.approach"
      class="flex justify-end"
      style="
        position: fixed;
        inset: 0;
        z-index: 60;
        background: color-mix(in srgb, var(--color-bg) 78%, transparent);
      "
    >
      <div style="flex: 1" @click="emit('close')" />
      <div
        style="
          width: 520px;
          height: 100%;
          background: var(--color-surface);
          border-left: 1px solid var(--color-neutral-800);
          overflow: auto;
          padding: var(--space-8);
        "
      >
        <div
          class="flex items-start justify-between gap-(--space-4)"
          style="margin-bottom: 6px"
        >
          <h2 style="margin: 0; font-size: 18px; font-weight: 600; line-height: 1.3">
            {{ props.approach.title }}
          </h2>
          <button
            type="button"
            aria-label="Закрыть"
            style="
              background: none;
              border: 0;
              color: var(--color-neutral-500);
              font-size: 16px;
              cursor: pointer;
              line-height: 1;
              display: flex;
            "
            @click="emit('close')"
          >
            <i class="pi pi-times" />
          </button>
        </div>
        <div
          class="tnum"
          style="font-size: 13.5px; color: var(--color-neutral-500); margin-bottom: 18px"
        >
          {{ meta }}
        </div>

        <div class="flex flex-col gap-(--space-3)">
          <div
            v-for="e in entries"
            :key="e.id"
            style="
              padding: var(--space-4);
              background: var(--color-bg);
              border: 1px solid var(--color-neutral-800);
              border-radius: var(--radius-md);
            "
          >
            <div class="flex justify-between gap-(--space-3)" style="margin-bottom: 5px">
              <span class="tnum" style="font-size: 14.5px; font-weight: 500">
                {{ fmtDate(e.createdAt) }}
              </span>
              <span class="tnum" style="font-size: 13px; color: var(--color-neutral-600)">
                {{ entryMeta(e) }}
              </span>
            </div>
            <div class="tnum flex gap-(--space-3)" style="font-size: 13.5px; margin-bottom: 5px">
              <span style="color: var(--color-accent)">Польза {{ e.usefulness }}</span>
              <span style="color: var(--color-accent-2-400)">Доверие {{ e.trust }}</span>
            </div>
            <div
              v-if="e.note"
              style="font-size: 14.5px; color: var(--color-neutral-300); line-height: 1.45"
            >
              {{ e.note }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
