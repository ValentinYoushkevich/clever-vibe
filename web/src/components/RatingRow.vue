<script setup lang="ts">
const props = defineProps<{
  modelValue: number | null
  label: string
  labels: Record<number, string>
  kind: 'usefulness' | 'trust'
}>()
const emit = defineEmits<{ (e: 'update:modelValue', v: number): void }>()

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
</script>

<template>
  <div class="flex flex-col gap-(--space-2)">
    <span class="section-label">{{ label }}</span>
    <div class="flex items-center gap-(--space-2)">
      <button
        v-for="n in 5"
        :key="n"
        type="button"
        class="chip tnum"
        style="width: 34px; text-align: center"
        :style="props.modelValue === n ? ACTIVE[props.kind] : {}"
        @click="emit('update:modelValue', n)"
      >
        {{ n }}
      </button>
      <span class="meta" style="margin-left: var(--space-2)">
        {{ props.modelValue ? props.labels[props.modelValue] : '—' }}
      </span>
    </div>
  </div>
</template>
