<script setup lang="ts">
import ThemeSelect from './components/ThemeSelect.vue'
</script>

<template>
  <div class="p-(--space-8) flex flex-col gap-(--space-6) items-start">
    <ThemeSelect />
    <div class="card flex flex-col gap-(--space-4)" style="width: 360px">
      <span class="section-label">Проба токенов</span>
      <h1>Clever Vibe</h1>
      <input class="input" placeholder="Инпут" />
      <div class="flex gap-(--space-3)">
        <button class="btn btn-accent">Акцент</button>
        <button class="btn btn-secondary">Вторичная</button>
        <button class="btn" disabled>Выключена</button>
      </div>
      <div class="flex gap-(--space-2)">
        <button class="chip is-active">Чип активный</button>
        <button class="chip">Чип</button>
      </div>
    </div>
  </div>
</template>
