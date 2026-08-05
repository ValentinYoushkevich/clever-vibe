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
    <i class="pi pi-palette" style="color: var(--color-neutral-500); font-size: 13px" />
    <select
      class="input"
      style="width: auto; padding: var(--space-2) var(--space-3)"
      :value="current"
      aria-label="Тема"
      @change="onChange"
    >
      <option v-for="t in THEMES" :key="t.code" :value="t.code">{{ t.title }}</option>
    </select>
  </label>
</template>
