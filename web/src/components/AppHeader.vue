<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../stores/auth.js'
import { tabsFor } from '../lib/nav.js'
import ThemeSelect from './ThemeSelect.vue'

const auth = useAuth()
const router = useRouter()
const tabs = computed(() => (auth.user ? tabsFor(auth.user.role) : []))

const ROLE_TITLES = { dev: 'разработчик', lead: 'тимлид', admin: 'админ', observer: 'наблюдатель' }

function logout() {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <header
    class="sticky top-0 z-10 flex items-center gap-(--space-6) px-(--space-8)"
    style="
      height: 58px;
      background: color-mix(in srgb, var(--color-bg) 92%, transparent);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--color-neutral-800);
    "
  >
    <div class="flex items-center gap-(--space-3)">
      <span
        style="
          width: 9px; height: 9px; border-radius: 50%;
          background: var(--color-accent);
          box-shadow: 0 0 8px var(--color-accent);
        "
      />
      <span style="font-weight: 500">Clever Vibe</span>
      <span
        class="meta"
        style="
          border: 1px solid var(--color-neutral-800);
          border-radius: var(--radius-sm);
          padding: 1px var(--space-2);
          font-size: 10.5px;
        "
        >FE / Angular</span
      >
    </div>
    <nav class="flex items-center gap-(--space-1)">
      <RouterLink
        v-for="t in tabs"
        :key="t.path"
        :to="t.path"
        class="px-(--space-4) py-(--space-2)"
        style="border-radius: var(--radius-md); color: var(--color-neutral-400); font-size: 13px"
        :style="
          $route.path === t.path
            ? { background: 'var(--color-neutral-900)', color: 'var(--color-text)' }
            : {}
        "
        >{{ t.title }}</RouterLink
      >
    </nav>
    <div class="ml-auto flex items-center gap-(--space-4)">
      <ThemeSelect />
      <span class="meta" v-if="auth.user">
        {{ auth.user.name }} · {{ ROLE_TITLES[auth.user.role] }}
      </span>
      <button class="btn btn-secondary" title="Выйти" @click="logout">
        <i class="pi pi-sign-out" />
      </button>
    </div>
  </header>
</template>
