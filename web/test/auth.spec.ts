import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuth, AUTH_KEY } from '../src/stores/auth.js'

const PROFILE = { id: 'u1', name: 'Артём', login: 'artem', role: 'lead' as const }

const okResponse = (body: unknown) => ({ ok: true, status: 200, json: async () => body })
const errResponse = (status: number, code: string) => ({
  ok: false,
  status,
  json: async () => ({ error: code }),
})

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('автологин (ТЗ §3.1: связка логин/пароль хранится локально)', () => {
  it('login кладёт логин, пароль и профиль в localStorage', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okResponse(PROFILE)))
    const auth = useAuth()
    await auth.login('artem', 'lead-4821')
    expect(JSON.parse(localStorage.getItem(AUTH_KEY)!)).toEqual({
      login: 'artem',
      password: 'lead-4821',
      user: PROFILE,
    })
  })

  it('restore поднимает пользователя из хранилища без запроса к серверу', () => {
    localStorage.setItem(
      AUTH_KEY,
      JSON.stringify({ login: 'artem', password: 'lead-4821', user: PROFILE }),
    )
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const auth = useAuth()
    expect(auth.restore()).toBe(true)
    expect(auth.user).toEqual(PROFILE)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('сервер недоступен — пользователь остаётся залогиненным', async () => {
    localStorage.setItem(
      AUTH_KEY,
      JSON.stringify({ login: 'artem', password: 'lead-4821', user: PROFILE }),
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    const auth = useAuth()
    auth.restore()
    await auth.refresh()
    expect(auth.user).toEqual(PROFILE)
    expect(localStorage.getItem(AUTH_KEY)).not.toBeNull()
  })

  it('пароль сменили или участника деактивировали (401) — связка стирается', async () => {
    localStorage.setItem(
      AUTH_KEY,
      JSON.stringify({ login: 'artem', password: 'старый', user: PROFILE }),
    )
    vi.stubGlobal('fetch', vi.fn(async () => errResponse(401, 'bad_credentials')))
    const auth = useAuth()
    auth.restore()
    await auth.refresh()
    expect(auth.user).toBeNull()
    expect(localStorage.getItem(AUTH_KEY)).toBeNull()
  })

  it('ошибка сервера (500) не выкидывает из приложения', async () => {
    localStorage.setItem(
      AUTH_KEY,
      JSON.stringify({ login: 'artem', password: 'lead-4821', user: PROFILE }),
    )
    vi.stubGlobal('fetch', vi.fn(async () => errResponse(500, 'error')))
    const auth = useAuth()
    auth.restore()
    await auth.refresh()
    expect(auth.user).toEqual(PROFILE)
    expect(localStorage.getItem(AUTH_KEY)).not.toBeNull()
  })

  it('logout — единственный ручной выход: чистит хранилище', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okResponse(PROFILE)))
    const auth = useAuth()
    await auth.login('artem', 'lead-4821')
    auth.logout()
    expect(auth.user).toBeNull()
    expect(localStorage.getItem(AUTH_KEY)).toBeNull()
  })

  it('битая запись в хранилище не роняет старт', () => {
    localStorage.setItem(AUTH_KEY, '{не json')
    const auth = useAuth()
    expect(auth.restore()).toBe(false)
    expect(auth.user).toBeNull()
  })
})
