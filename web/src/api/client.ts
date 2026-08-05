const BASE = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  // Поля объявлены явно: tsconfig включает erasableSyntaxOnly,
  // при котором параметры-свойства конструктора запрещены.
  status: number
  code: string

  constructor(status: number, code: string) {
    super(code)
    this.status = status
    this.code = code
  }
}

export interface Creds {
  login: string
  password: string
}

let creds: Creds | null = null
export function setCreds(c: Creds | null) {
  creds = c
}

// Сохранённая связка перестала подходить (пароль перевыпустили, участника
// деактивировали) — приложение должно вернуть человека на форму входа
let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn
}

// btoa понимает только latin1, поэтому пару сначала кодируем в UTF-8 —
// сервер декодирует заголовок как utf8 (server/src/plugins/auth.ts)
function basic(c: Creds): string {
  const bytes = new TextEncoder().encode(`${c.login}:${c.password}`)
  return 'Basic ' + btoa(String.fromCharCode(...bytes))
}

// Заголовок авторизации для запросов мимо api() — например, скачивание файлов
export function authHeader(): Record<string, string> {
  return creds ? { Authorization: basic(creds) } : {}
}

export async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  if (creds) headers.Authorization = basic(creds)
  const res = await fetch(BASE + path, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
  if (!res.ok) {
    let code = 'error'
    try {
      code = (await res.json()).error ?? 'error'
    } catch {
      /* тело не JSON */
    }
    // Ручной вход обрабатывает 401 сам — форма показывает «неверный логин или пароль»
    if (res.status === 401 && path !== '/api/login') onUnauthorized?.()
    throw new ApiError(res.status, code)
  }
  return res.json() as Promise<T>
}
