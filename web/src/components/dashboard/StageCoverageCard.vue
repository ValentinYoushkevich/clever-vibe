<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ stages: { code: string; title: string; n: number }[] }>()
const maxN = computed(() => Math.max(1, ...props.stages.map((s) => s.n)))
const LOW = 5
</script>

<template>
  <div class="card flex flex-col gap-(--space-3)">
    <h2>Покрытие стадий</h2>
    <div
      v-for="s in props.stages"
      :key="s.code"
      class="grid items-center gap-(--space-3)"
      style="grid-template-columns: 130px minmax(0, 1fr) 84px"
    >
      <span class="meta">{{ s.title }}</span>
      <div style="height: 9px; background: var(--color-neutral-900); border-radius: 4px">
        <div
          :style="{
            width: (s.n / maxN) * 100 + '%',
            height: '9px',
            borderRadius: '4px',
            background: s.n < LOW ? 'var(--warn)' : 'var(--color-accent)',
          }"
        />
      </div>
      <span class="meta tnum">
        {{ s.n }} n
        <i
          v-if="s.n < LOW"
          class="pi pi-exclamation-triangle"
          style="color: var(--warn); font-size: 11px"
        />
      </span>
    </div>
  </div>
</template>
