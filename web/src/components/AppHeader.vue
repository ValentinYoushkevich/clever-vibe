<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../stores/auth.js'
import { tabsFor } from '../lib/nav.js'
import ThemeSelect from './ThemeSelect.vue'

const auth = useAuth()
const router = useRouter()
const tabs = computed(() => (auth.user ? tabsFor(auth.user.role) : []))

function logout() {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <header
    class="sticky top-0 z-10 flex items-center gap-(--space-8) px-(--space-8)"
    style="
      height: 58px;
      background: color-mix(in srgb, var(--color-bg) 92%, transparent);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--color-neutral-800);
    "
  >
    <div class="flex items-center gap-(--space-3)" style="margin-right: 8px">
      <span
        style="
          width: 9px; height: 9px; border-radius: 50%;
          background: var(--color-accent);
          box-shadow: 0 0 12px color-mix(in srgb, var(--color-accent) 55%, transparent);
        "
      />
      <span style="font-size: 15.5px; font-weight: 600; letter-spacing: 0.01em">Clever Vibe</span>
      <span
        class="tnum"
        style="
          border: 1px solid var(--color-neutral-800);
          border-radius: var(--radius-md);
          padding: var(--space-1) var(--space-2);
          font-size: 13px;
          color: var(--color-neutral-500);
        "
        >FE / Angular</span
      >
    </div>
    <nav class="flex items-center gap-(--space-1)">
      <RouterLink
        v-for="t in tabs"
        :key="t.path"
        :to="t.path"
        class="tab px-(--space-4) py-(--space-3)"
        style="
          border-radius: var(--radius-md);
          color: var(--color-neutral-400);
          font-size: 15px;
          font-weight: 500;
        "
        :style="
          $route.path === t.path
            ? { background: 'var(--color-neutral-900)', color: 'var(--color-text)' }
            : {}
        "
        >{{ t.title }}</RouterLink
      >
    </nav>
    <div class="ml-auto flex items-center gap-(--space-8)">
      <ThemeSelect />
      <div class="flex items-center gap-(--space-3)">
        <div
          v-if="auth.user"
          class="flex flex-col items-end"
          style="line-height: 1.25"
        >
          <span style="font-size: 14.5px; font-weight: 500">{{ auth.user.name }}</span>
          <span style="font-size: 12.5px; color: var(--color-neutral-500)">{{ auth.user.role }}</span>
        </div>
        <button
          type="button"
          class="logout inline-flex items-center gap-(--space-2)"
          style="
            padding: var(--space-2) var(--space-3);
            border: 1px solid var(--color-neutral-800);
            border-radius: var(--radius-md);
            background: transparent;
            color: var(--color-neutral-400);
            font-size: 14px;
            cursor: pointer;
          "
          @click="logout"
        >
          <i class="pi pi-sign-out" style="font-size: 14px" />Выйти
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.tab:hover {
  background: var(--color-neutral-900);
  color: var(--color-text) !important;
}
.logout:hover {
  border-color: var(--color-accent-700) !important;
  color: var(--color-accent) !important;
}
</style>
