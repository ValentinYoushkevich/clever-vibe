<script setup lang="ts">
const props = defineProps<{
  modelValue: number | null
  label: string
  labels: Record<number, string>
  kind: 'usefulness' | 'trust'
}>()
const emit = defineEmits<{ (e: 'update:modelValue', v: number): void }>()

// Прототип: неактивная кнопка — фон --color-bg, рамка --color-neutral-800, текст --color-neutral-500
const IDLE = {
  background: 'var(--color-bg)',
  borderColor: 'var(--color-neutral-800)',
  color: 'var(--color-neutral-500)',
}

const ACTIVE = {
  usefulness: {
    background: 'var(--color-accent-900)',
    borderColor: 'var(--color-accent-700)',
    color: 'var(--color-accent)',
  },
  trust: {
    background: 'var(--color-accent-2-900)',
    borderColor: 'var(--color-accent-2-700)',
    color: 'var(--color-accent-2-400)',
  },
}

const HINT_COLOR = {
  usefulness: 'var(--color-accent)',
  trust: 'var(--color-accent-2-400)',
}
</script>

<template>
  <div>
    <div class="flex items-baseline justify-between" style="margin-bottom: 9px">
      <span class="section-label">{{ label }}</span>
      <span style="font-size: 14px" :style="{ color: HINT_COLOR[props.kind] }">
        {{ props.modelValue ? props.labels[props.modelValue] : 'не выбрано' }}
      </span>
    </div>
    <div class="flex gap-(--space-2)">
      <button
        v-for="n in 5"
        :key="n"
        type="button"
        class="tnum"
        style="
          flex: 1;
          padding: var(--space-4) 0;
          border: 1px solid;
          border-radius: var(--radius-md);
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
        "
        :style="props.modelValue === n ? ACTIVE[props.kind] : IDLE"
        @click="emit('update:modelValue', n)"
      >
        {{ n }}
      </button>
    </div>
  </div>
</template>
