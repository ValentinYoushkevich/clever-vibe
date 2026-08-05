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

export async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  if (creds) headers.Authorization = 'Basic ' + btoa(`${creds.login}:${creds.password}`)
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
    throw new ApiError(res.status, code)
  }
  return res.json() as Promise<T>
}
