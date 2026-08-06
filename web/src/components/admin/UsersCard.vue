<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { api } from '../../api/client.js'
import { useAuth } from '../../stores/auth.js'
import { plural } from '../../lib/format.js'
import { canDeleteUser } from '../../lib/permissions.js'

interface AdminUser {
  id: string
  name: string
  login: string
  role: 'dev' | 'lead' | 'admin' | 'observer'
  active: boolean
  createdById: string | null
  entriesCount: number
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
const confirm = useConfirm()
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
  dev: 'dev — разработчик',
  lead: 'lead — тимлид',
  admin: 'admin — администратор',
  observer: 'observer — наблюдатель',
}

// Матрица деактивации: лид — только dev, админ — всех (сервер проверяет то же)
const canToggle = (u: AdminUser) => u.role === 'dev' || auth.user?.role === 'admin'
// Удаление — только админ и только не себя (сервер проверяет то же)
const canRemove = (u: AdminUser) =>
  !!auth.user && canDeleteUser(auth.user.role) && u.id !== auth.user.id

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

function remove(u: AdminUser) {
  const n = u.entriesCount
  const tail = n ? ` Вместе с ним удалятся ${plural(n, 'его запись', 'его записи', 'его записей')}.` : ''
  confirm.require({
    header: 'Удалить участника?',
    message: `«${u.name}» исчезнет навсегда.${tail} Отменить будет нельзя.`,
    icon: 'pi pi-exclamation-triangle',
    acceptProps: { label: 'Удалить', severity: 'danger' },
    rejectProps: { label: 'Отмена', severity: 'secondary', outlined: true },
    accept: async () => {
      await api(`/api/users/${u.id}`, { method: 'DELETE' })
      toast.add({ severity: 'success', summary: 'Участник удалён', life: 2200 })
      await load()
    },
  })
}

async function regenerate(u: AdminUser) {
  await api<{ password: string }>(`/api/users/${u.id}/password`, { method: 'POST' })
  toast.add({ severity: 'success', summary: 'Пароль перегенерирован', life: 2200 })
  await load()
}

onMounted(load)
</script>

<template>
  <div class="card">
    <div class="flex items-center justify-between" style="margin-bottom: 14px">
      <h2 style="margin: 0; font-size: 16.5px; font-weight: 600">Пользователи</h2>
      <button
        type="button"
        class="inline-flex items-center gap-(--space-2)"
        style="
          padding: var(--space-2) var(--space-4);
          border-radius: var(--radius-md);
          border: 1px solid var(--color-accent-700);
          background: var(--color-accent-900);
          color: var(--color-accent);
          font-size: 14px;
          cursor: pointer;
        "
        @click="showForm = !showForm"
      >
        <i :class="showForm ? 'pi pi-times' : 'pi pi-plus'" style="font-size: 13px" />{{
          showForm ? 'Отмена' : 'Пользователь'
        }}
      </button>
    </div>

    <!-- Выданные доступы — акцентная плашка (дизайн-док §6) -->
    <div
      v-if="created"
      style="
        padding: var(--space-4);
        margin-bottom: var(--space-4);
        background: var(--color-accent-900);
        border: 1px solid var(--color-accent-700);
        border-radius: var(--radius-md);
      "
    >
      <div
        class="flex items-center justify-between gap-(--space-3)"
        style="margin-bottom: var(--space-3)"
      >
        <span style="font-size: 14px; color: var(--color-accent)">
          Выданы доступы — {{ created.name }}
        </span>
        <button
          type="button"
          aria-label="Скрыть"
          style="background: none; border: 0; color: var(--color-accent); cursor: pointer; display: flex"
          @click="created = null"
        >
          <i class="pi pi-times" style="font-size: 14px" />
        </button>
      </div>
      <div class="tnum flex flex-wrap gap-(--space-6)" style="font-size: 15px; margin-bottom: var(--space-3)">
        <span>Логин: <b style="font-weight: 500">{{ created.login }}</b></span>
        <span>Пароль: <b style="font-weight: 500">{{ created.password }}</b></span>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-(--space-2)"
        style="
          padding: var(--space-2) var(--space-4);
          border: 1px solid var(--color-accent);
          border-radius: var(--radius-md);
          background: transparent;
          color: var(--color-accent-300);
          font-size: 14px;
          cursor: pointer;
        "
        @click="copy(`${created.login} / ${created.password}`)"
      >
        <i class="pi pi-copy" style="font-size: 13px" />Скопировать
      </button>
    </div>

    <div
      v-if="showForm"
      class="flex flex-col gap-(--space-3)"
      style="
        padding: var(--space-4);
        margin-bottom: var(--space-4);
        background: var(--color-bg);
        border: 1px solid var(--color-accent-700);
        border-radius: var(--radius-md);
      "
    >
      <input
        v-model="newName"
        class="input"
        style="background: var(--color-surface)"
        placeholder="Имя участника"
      />
      <div class="flex flex-wrap gap-(--space-2)">
        <button
          v-for="r in roleOptions"
          :key="r"
          type="button"
          class="chip"
          :class="{ 'is-active': newRole === r }"
          style="flex: 1; justify-content: center; font-size: 14.5px"
          @click="newRole = r"
        >
          {{ ROLE_TITLES[r] }}
        </button>
      </div>
      <div class="flex items-center gap-(--space-4)">
        <button
          type="button"
          class="btn"
          :class="{ 'btn-accent': newName.trim() }"
          style="font-size: 14.5px"
          :disabled="!newName.trim()"
          @click="create"
        >
          Создать
        </button>
        <span style="font-size: 13.5px; color: var(--color-neutral-500)">
          {{ newName.trim() ? 'Логин и пароль система выдаст сама' : 'Нужно имя' }}
        </span>
      </div>
    </div>

    <div class="flex flex-col gap-(--space-3)">
      <div
        v-for="u in users"
        :key="u.id"
        style="
          padding: var(--space-4);
          background: var(--color-bg);
          border: 1px solid var(--color-neutral-800);
          border-radius: var(--radius-md);
        "
      >
        <div style="min-width: 0">
          <div
            style="font-size: 15px"
            :style="{ color: u.active ? 'var(--color-neutral-200)' : 'var(--color-neutral-600)' }"
          >
            {{ u.name }}
          </div>
          <div class="tnum" style="font-size: 12.5px; color: var(--color-neutral-500)">
            {{ u.role }} · {{ u.login }} · {{ plural(u.entriesCount, 'запись', 'записи', 'записей') }}
          </div>
          <div
            v-if="u.password"
            class="tnum flex items-center gap-(--space-2)"
            style="font-size: 12.5px; color: var(--color-neutral-500); margin-top: 2px"
          >
            <span>{{ u.password }}</span>
            <button
              type="button"
              aria-label="Скопировать пароль"
              style="background: none; border: 0; color: var(--color-neutral-400); cursor: pointer; display: flex"
              @click="copy(u.password!)"
            >
              <i class="pi pi-copy" style="font-size: 13px" />
            </button>
            <button
              type="button"
              style="background: none; border: 0; color: var(--color-neutral-400); font-size: 12.5px; cursor: pointer"
              @click="regenerate(u)"
            >
              новый
            </button>
          </div>
        </div>
        <!-- Кнопки под текстом, справа: иначе они сжимают строку с логином и числом записей -->
        <div
          v-if="canToggle(u) || canRemove(u)"
          class="flex justify-end gap-(--space-2)"
          style="margin-top: var(--space-3)"
        >
          <button
            v-if="canToggle(u)"
            type="button"
            style="
              padding: var(--space-2) var(--space-3);
              border-radius: var(--radius-md);
              background: var(--color-bg);
              font-size: 13.5px;
              cursor: pointer;
              border: 1px solid;
              white-space: nowrap;
            "
            :style="{
              color: u.active ? 'var(--color-neutral-400)' : 'var(--color-accent)',
              borderColor: u.active ? 'var(--color-neutral-700)' : 'var(--color-accent-700)',
            }"
            @click="toggleActive(u)"
          >
            {{ u.active ? 'Деактивировать' : 'Активировать' }}
          </button>
          <!-- Удаление необратимо, поэтому цветом ошибки и всегда правее деактивации -->
          <button
            v-if="canRemove(u)"
            type="button"
            style="
              padding: var(--space-2) var(--space-3);
              border-radius: var(--radius-md);
              background: var(--color-bg);
              border: 1px solid var(--bad);
              color: var(--bad);
              font-size: 13.5px;
              cursor: pointer;
              white-space: nowrap;
            "
            @click="remove(u)"
          >
            Удалить
          </button>
        </div>
      </div>
    </div>

    <div
      style="
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid var(--color-neutral-800);
        font-size: 13.5px;
        color: var(--color-neutral-500);
        line-height: 1.5;
      "
    >
      Записи не удаляются физически — только
      <span class="tnum" style="color: var(--color-neutral-400)">deletedAt</span>. Экспорт CSV
      содержит все поля записей.
    </div>
  </div>
</template>
