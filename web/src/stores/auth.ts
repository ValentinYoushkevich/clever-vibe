import { defineStore } from 'pinia'
import { api, setCreds, ApiError, type Creds } from '../api/client.js'

export const AUTH_KEY = 'aiTrackerAuth'

export interface Profile {
  id: string
  name: string
  login: string
  role: 'dev' | 'lead' | 'admin' | 'observer'
}

interface Stored extends Creds {
  user?: Profile // может отсутствовать: записи, сохранённые прежней версией
}

function read(): Stored | null {
  const raw = localStorage.getItem(AUTH_KEY)
  if (!raw) return null
  try {
    const s = JSON.parse(raw) as Stored
    return s?.login && s?.password ? s : null
  } catch {
    return null
  }
}

export const useAuth = defineStore('auth', {
  state: () => ({ user: null as Profile | null }),
  actions: {
    async login(login: string, password: string) {
      const creds: Creds = { login, password }
      setCreds(creds)
      let user: Profile
      try {
        user = await api<Profile>('/api/login', { method: 'POST', body: creds })
      } catch (e) {
        setCreds(null)
        throw e
      }
      this.user = user
      localStorage.setItem(AUTH_KEY, JSON.stringify({ ...creds, user }))
    },

    // Вход восстанавливается локально и мгновенно — без обращения к серверу (ТЗ §3.1).
    // Профиля может не быть только у записей прежнего формата — его подтянет refresh().
    restore(): boolean {
      const s = read()
      if (!s) return false
      setCreds({ login: s.login, password: s.password })
      if (!s.user) return false
      this.user = s.user
      return true
    },

    // Фоновая сверка профиля. Из приложения выкидывает только отказ сервера
    // (401 — пароль перевыпустили или участника деактивировали).
    // Сеть недоступна или сервер отвечает 5xx — человек остаётся залогиненным.
    async refresh() {
      const s = read()
      if (!s) return
      try {
        const user = await api<Profile>('/api/login', {
          method: 'POST',
          body: { login: s.login, password: s.password },
        })
        this.user = user
        localStorage.setItem(AUTH_KEY, JSON.stringify({ ...s, user }))
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) this.logout()
      }
    },

    logout() {
      localStorage.removeItem(AUTH_KEY)
      setCreds(null)
      this.user = null
    },
  },
})
