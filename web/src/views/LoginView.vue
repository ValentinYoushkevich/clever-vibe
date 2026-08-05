<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../stores/auth.js'
import { defaultRoute } from '../lib/nav.js'
import { ApiError } from '../api/client.js'
import ThemeSelect from '../components/ThemeSelect.vue'

const auth = useAuth()
const router = useRouter()
const login = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  if (!login.value || !password.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    await auth.login(login.value, password.value)
    router.push(defaultRoute(auth.user!.role))
  } catch (e) {
    error.value =
      e instanceof ApiError && e.code === 'inactive'
        ? 'Участник деактивирован'
        : 'Неверный логин или пароль'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="min-h-full flex flex-col items-center justify-center gap-(--space-6)">
    <div class="card flex flex-col gap-(--space-4)" style="width: 360px">
      <div class="flex items-center gap-(--space-3)">
        <span
          style="
            width: 9px; height: 9px; border-radius: 50%;
            background: var(--color-accent);
            box-shadow: 0 0 8px var(--color-accent);
          "
        />
        <span style="font-weight: 500">Clever Vibe</span>
      </div>
      <h1>Вход</h1>
      <p class="meta">Логин и пароль выдаёт тимлид при создании участника</p>
      <form class="flex flex-col gap-(--space-4)" @submit.prevent="submit">
        <label class="flex flex-col gap-(--space-2)">
          <span class="section-label">Логин</span>
          <input v-model.trim="login" class="input" autocomplete="username" />
        </label>
        <label class="flex flex-col gap-(--space-2)">
          <span class="section-label">Пароль</span>
          <input
            v-model="password"
            type="password"
            class="input"
            autocomplete="current-password"
          />
        </label>
        <p
          v-if="error"
          class="flex items-center gap-(--space-2)"
          style="color: var(--bad); font-size: 12.5px"
        >
          <i class="pi pi-exclamation-triangle" /> {{ error }}
        </p>
        <button
          type="submit"
          class="btn w-full justify-center"
          :class="login && password ? 'btn-accent' : ''"
          :disabled="!login || !password || busy"
        >
          Войти
        </button>
      </form>
    </div>
    <ThemeSelect />
  </div>
</template>
