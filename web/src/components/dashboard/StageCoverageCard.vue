<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ stages: { code: string; title: string; n: number }[] }>()
const maxN = computed(() => Math.max(1, ...props.stages.map((s) => s.n)))
const LOW = 5
const pct = (n: number) => Math.max(2, (n / maxN.value) * 100)
</script>

<template>
  <div class="card">
    <h2 style="margin: 0 0 14px; font-size: 16.5px; font-weight: 600">Покрытие стадий</h2>
    <div class="flex flex-col gap-(--space-3)">
      <div
        v-for="s in props.stages"
        :key="s.code"
        class="grid items-center gap-(--space-3)"
        style="grid-template-columns: 130px minmax(0, 1fr) 84px"
      >
        <span
          style="font-size: 14.5px"
          :style="{ color: s.n < LOW ? 'var(--warn)' : 'var(--color-neutral-300)' }"
          >{{ s.title }}</span
        >
        <div
          style="
            height: 9px;
            background: var(--color-bg);
            border-radius: var(--radius-md);
            overflow: hidden;
          "
        >
          <div
            style="height: 100%; border-radius: var(--radius-md)"
            :style="{
              width: pct(s.n) + '%',
              background: s.n < LOW ? 'var(--warn)' : 'var(--color-accent)',
            }"
          />
        </div>
        <span
          class="tnum inline-flex items-center gap-(--space-1)"
          style="font-size: 13px"
          :style="{ color: s.n < LOW ? 'var(--warn)' : 'var(--color-neutral-500)' }"
        >
          N {{ s.n }}
          <i v-if="s.n < LOW" class="pi pi-exclamation-triangle" style="font-size: 13px" />
        </span>
      </div>
    </div>
  </div>
</template>
