<script setup lang="ts">
import { useAuth } from './stores/auth.js'
import AppHeader from './components/AppHeader.vue'

const auth = useAuth()
</script>

<template>
  <div class="min-h-full flex flex-col">
    <AppHeader v-if="auth.user" />
    <main class="flex-1">
      <RouterView />
    </main>
  </div>
</template>
