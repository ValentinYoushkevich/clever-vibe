import { authHeader } from '../api/client.js'

const BASE = import.meta.env.VITE_API_URL ?? ''

export async function downloadFile(path: string, filename: string): Promise<void> {
  const res = await fetch(BASE + path, { headers: authHeader() })
  if (!res.ok) throw new Error(`download failed: ${res.status}`)
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
