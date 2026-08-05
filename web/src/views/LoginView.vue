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
  <div
    class="min-h-full flex items-center justify-center"
    style="padding: var(--space-8)"
  >
    <div style="width: 360px">
      <div
        class="flex items-center gap-(--space-3)"
        style="margin-bottom: var(--space-8)"
      >
        <span
          style="
            width: 9px; height: 9px; border-radius: 50%;
            background: var(--color-accent);
          "
        />
        <span style="font-size: 15.5px; font-weight: 600">Clever Vibe</span>
      </div>
      <h1 style="margin: 0 0 var(--space-2); font-size: 22px; font-weight: 600">Вход</h1>
      <p
        style="margin: 0 0 var(--space-8); font-size: 15px; color: var(--color-neutral-400)"
      >
        Логин и пароль выдаёт тимлид при создании участника.
      </p>

      <form class="card flex flex-col gap-(--space-4)" @submit.prevent="submit">
        <label>
          <div class="section-label" style="margin-bottom: var(--space-2)">Логин</div>
          <input v-model.trim="login" class="input" autocomplete="username" />
        </label>
        <label>
          <div class="section-label" style="margin-bottom: var(--space-2)">Пароль</div>
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
          style="margin: 0; color: var(--bad); font-size: 14px"
        >
          <i class="pi pi-exclamation-triangle" style="font-size: 14px" /> {{ error }}
        </p>
        <button
          type="submit"
          class="btn w-full justify-center"
          :class="login && password ? 'btn-accent' : ''"
          style="padding: var(--space-4) 0; font-size: 15.5px; font-weight: 500"
          :disabled="!login || !password || busy"
        >
          Войти
        </button>
      </form>

      <div
        class="flex items-center justify-between gap-(--space-4)"
        style="margin-top: var(--space-6)"
      >
        <span style="font-size: 13.5px; color: var(--color-neutral-500)">
          Внутренний контур · доступ выдаёт тимлид
        </span>
        <ThemeSelect />
      </div>
    </div>
  </div>
</template>
