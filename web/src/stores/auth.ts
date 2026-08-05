import { defineStore } from 'pinia'
import { api, setCreds, type Creds } from '../api/client.js'

export const AUTH_KEY = 'aiTrackerAuth'

export interface Profile {
  id: string
  name: string
  login: string
  role: 'dev' | 'lead' | 'admin' | 'observer'
}

export const useAuth = defineStore('auth', {
  state: () => ({ user: null as Profile | null }),
  actions: {
    async login(login: string, password: string) {
      const creds: Creds = { login, password }
      setCreds(creds)
      try {
        this.user = await api<Profile>('/api/login', {
          method: 'POST',
          body: creds,
        })
      } catch (e) {
        setCreds(null)
        throw e
      }
      localStorage.setItem(AUTH_KEY, JSON.stringify(creds))
    },
    // Автовход (ТЗ §3.1): сохранённая связка → сразу в приложение.
    // Деактивированный участник автовход не проходит — связка стирается.
    async tryAutoLogin() {
      const raw = localStorage.getItem(AUTH_KEY)
      if (!raw) return
      try {
        const c = JSON.parse(raw) as Creds
        await this.login(c.login, c.password)
      } catch {
        localStorage.removeItem(AUTH_KEY)
        setCreds(null)
      }
    },
    logout() {
      localStorage.removeItem(AUTH_KEY)
      setCreds(null)
      this.user = null
    },
  },
})
