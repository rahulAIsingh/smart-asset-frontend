const resolveDefaultApiBaseUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:5000'
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:5000'
  return window.location.origin
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || resolveDefaultApiBaseUrl()

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

const getToken = () => localStorage.getItem('sam_access_token') || ''

async function request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body)
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${method} ${path} failed: ${res.status} ${text}`)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path)
}
