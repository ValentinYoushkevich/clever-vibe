<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useToast } from 'primevue/usetoast'
import { api } from '../../api/client.js'
import { useAuth } from '../../stores/auth.js'

interface AdminUser {
  id: string
  name: string
  login: string
  role: 'dev' | 'lead' | 'admin' | 'observer'
  active: boolean
  createdById: string | null
  password?: string
}

interface CreatedUser {
  id: string
  name: string
  login: string
  password: string
  role: string
}

const auth = useAuth()
const toast = useToast()
const users = ref<AdminUser[]>([])
const showForm = ref(false)
const newName = ref('')
const newRole = ref<AdminUser['role']>('dev')
const created = ref<CreatedUser | null>(null)

// Лид создаёт только dev; админ — все четыре роли (ТЗ §3.5)
const roleOptions = computed(() =>
  auth.user?.role === 'admin' ? (['dev', 'lead', 'admin', 'observer'] as const) : (['dev'] as const),
)
const ROLE_TITLES: Record<AdminUser['role'], string> = {
  dev: 'разработчик',
  lead: 'тимлид',
  admin: 'админ',
  observer: 'наблюдатель',
}

// Матрица деактивации: лид — только dev, админ — всех (сервер проверяет то же)
const canToggle = (u: AdminUser) => u.role === 'dev' || auth.user?.role === 'admin'

async function load() {
  users.value = await api<AdminUser[]>('/api/users')
}

async function create() {
  if (!newName.value.trim()) return
  created.value = await api<CreatedUser>('/api/users', {
    method: 'POST',
    body: { name: newName.value.trim(), role: newRole.value },
  })
  showForm.value = false
  newName.value = ''
  toast.add({ severity: 'success', summary: 'Участник создан', life: 2200 })
  await load()
}

async function copy(text: string) {
  await navigator.clipboard.writeText(text)
  toast.add({ severity: 'success', summary: 'Скопировано', life: 2200 })
}

async function toggleActive(u: AdminUser) {
  await api(`/api/users/${u.id}`, { method: 'PATCH', body: { active: !u.active } })
  await load()
}

async function regenerate(u: AdminUser) {
  await api<{ password: string }>(`/api/users/${u.id}/password`, { method: 'POST' })
  toast.add({ severity: 'success', summary: 'Пароль перегенерирован', life: 2200 })
  await load()
}

onMounted(load)
</script>

<template>
  <div class="card flex flex-col gap-(--space-4)">
    <div class="flex items-center gap-(--space-3)">
      <h2>Пользователи</h2>
      <button class="btn btn-secondary ml-auto" @click="showForm = !showForm">
        <i class="pi pi-plus" /> Пользователь
      </button>
    </div>

    <div v-if="showForm" class="flex items-end gap-(--space-3)">
      <label class="flex flex-col gap-(--space-2)" style="flex: 1">
        <span class="section-label">Имя</span>
        <input v-model="newName" class="input" placeholder="Имя Фамилия" />
      </label>
      <label class="flex flex-col gap-(--space-2)" style="width: 160px">
        <span class="section-label">Роль</span>
        <select v-model="newRole" class="input">
          <option v-for="r in roleOptions" :key="r" :value="r">{{ ROLE_TITLES[r] }}</option>
        </select>
      </label>
      <button class="btn btn-accent" :disabled="!newName.trim()" @click="create">Создать</button>
    </div>

    <!-- Выданные доступы — акцентная плашка (дизайн-док §6) -->
    <div
      v-if="created"
      class="flex items-center gap-(--space-3)"
      style="
        background: var(--color-accent-900);
        border: 1px solid var(--color-accent-700);
        border-radius: var(--radius-md);
        padding: var(--space-3) var(--space-4);
        color: var(--color-accent);
      "
    >
      <span
        >{{ created.name }}:
        <b class="tnum">{{ created.login }} / {{ created.password }}</b></span
      >
      <button class="btn btn-secondary" @click="copy(`${created.login} / ${created.password}`)">
        <i class="pi pi-copy" /> Скопировать
      </button>
      <button class="btn btn-secondary" @click="created = null"><i class="pi pi-times" /></button>
    </div>

    <div
      v-for="u in users"
      :key="u.id"
      class="grid items-center gap-(--space-3)"
      style="
        grid-template-columns: minmax(0, 1fr) 110px 150px 170px;
        border-top: 1px solid var(--color-neutral-900);
        padding-top: var(--space-3);
      "
    >
      <div class="flex flex-col">
        <span :style="u.active ? {} : { color: 'var(--color-neutral-600)' }">{{ u.name }}</span>
        <span class="meta tnum">{{ u.login }}</span>
      </div>
      <span class="meta">{{ ROLE_TITLES[u.role] }}</span>
      <div class="flex items-center gap-(--space-2)">
        <template v-if="u.password">
          <span class="meta tnum">{{ u.password }}</span>
          <button
            class="btn btn-secondary"
            style="padding: 2px var(--space-2)"
            @click="copy(u.password!)"
          >
            <i class="pi pi-copy" style="font-size: 11px" />
          </button>
        </template>
        <span v-else class="meta">—</span>
      </div>
      <div class="flex gap-(--space-2) justify-end">
        <button
          v-if="u.password"
          class="btn btn-secondary"
          style="padding: 2px var(--space-3)"
          @click="regenerate(u)"
        >
          Новый пароль
        </button>
        <button
          v-if="canToggle(u)"
          class="btn btn-secondary"
          style="padding: 2px var(--space-3)"
          @click="toggleActive(u)"
        >
          {{ u.active ? 'Деактивировать' : 'Включить' }}
        </button>
      </div>
    </div>
  </div>
</template>
