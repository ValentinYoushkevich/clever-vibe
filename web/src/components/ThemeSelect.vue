<script setup lang="ts">
import { ref } from 'vue'
import { THEMES, applyTheme, getSavedTheme, type ThemeCode } from '../lib/theme.js'

const current = ref<ThemeCode>(getSavedTheme())

function onChange(e: Event) {
  const code = (e.target as HTMLSelectElement).value as ThemeCode
  current.value = code
  applyTheme(code)
}
</script>

<template>
  <label class="inline-flex items-center gap-(--space-2)">
    <i class="pi pi-palette" style="color: var(--color-neutral-500); font-size: 16px" />
    <select
      class="input"
      style="
        width: auto;
        padding: var(--space-2);
        background: var(--color-surface);
        border-color: var(--color-neutral-800);
        font-size: 14px;
      "
      :value="current"
      aria-label="Тема"
      @change="onChange"
    >
      <option v-for="t in THEMES" :key="t.code" :value="t.code">{{ t.title }}</option>
    </select>
  </label>
</template>
