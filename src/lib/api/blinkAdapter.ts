import { apiClient } from './client'

export type ApiAuthUser = {
  id: string
  email?: string
  displayName?: string
  role?: string
  roles?: string[]
  photoURL?: string
  firstName?: string
  lastName?: string
  createdAt?: string
  updatedAt?: string
}

type AuthState = { user: ApiAuthUser | null; isLoading: boolean }

const listeners = new Set<(state: AuthState) => void>()
let authState: AuthState = { user: null, isLoading: true }

const provider = (import.meta.env.VITE_DATA_PROVIDER || 'blink').toLowerCase()
const authority = import.meta.env.VITE_AUTH_AUTHORITY || ''
const clientId = import.meta.env.VITE_AUTH_CLIENT_ID || ''
const tenantId = import.meta.env.VITE_AUTH_TENANT_ID || ''
const redirectUri = import.meta.env.VITE_AUTH_REDIRECT_URI || window.location.origin

const emit = () => listeners.forEach(listener => listener(authState))

const setAuth = (state: AuthState) => {
  authState = state
  emit()
}

const parseHashToken = () => {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
  if (!hash.includes('access_token=')) return
  const params = new URLSearchParams(hash)
  const token = params.get('access_token')
  if (token) {
    localStorage.setItem('sam_access_token', token)
    window.history.replaceState({}, document.title, window.location.pathname + window.location.search)
  }
}

const mapRole = (roles?: string[]) => {
  if (!roles || roles.length === 0) return 'user'
  const normalized = roles.map(r => r.toLowerCase())
  if (normalized.includes('admin')) return 'admin'
  if (normalized.includes('support')) return 'support'
  return 'user'
}

const refreshAuth = async () => {
  if (provider !== 'api') {
    return
  }

  parseHashToken()
  const token = localStorage.getItem('sam_access_token')
  if (!token) {
    setAuth({ user: null, isLoading: false })
    return
  }

  try {
    const data = await apiClient.get<{ user?: ApiAuthUser }>(`/api/auth/me`)
    const user = data.user || null
    if (user) {
      user.role = user.role || mapRole(user.roles)
    }
    setAuth({ user, isLoading: false })
  } catch {
    localStorage.removeItem('sam_access_token')
    setAuth({ user: null, isLoading: false })
  }
}

const login = async () => {
  if (provider !== 'api') return
  const resolvedAuthority = authority || (tenantId ? `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize` : '')
  if (!resolvedAuthority || !clientId) {
    throw new Error('Missing Entra auth configuration in VITE_AUTH_* env vars')
  }

  const authUrl = new URL(resolvedAuthority)
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('response_type', 'token')
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', 'openid profile email')
  authUrl.searchParams.set('response_mode', 'fragment')

  window.location.href = authUrl.toString()
}

const signOut = () => {
  localStorage.removeItem('sam_access_token')
  setAuth({ user: null, isLoading: false })
}

const makeEntityApi = (entity: string) => ({
  list: async (query?: { where?: Record<string, unknown>; orderBy?: Record<string, string>; limit?: number }) => {
    if (provider !== 'api') throw new Error('API provider is not enabled')
    return apiClient.post<any[]>(`/api/compat/db/${entity}/list`, query || {})
  },
  create: async (payload: Record<string, unknown>) => {
    if (provider !== 'api') throw new Error('API provider is not enabled')
    return apiClient.post<any>(`/api/compat/db/${entity}/create`, payload)
  },
  update: async (id: string, payload: Record<string, unknown>) => {
    if (provider !== 'api') throw new Error('API provider is not enabled')
    return apiClient.patch<any>(`/api/compat/db/${entity}/${id}`, payload)
  },
  delete: async (id: string) => {
    if (provider !== 'api') throw new Error('API provider is not enabled')
    return apiClient.delete<void>(`/api/compat/db/${entity}/${id}`)
  }
})

export const apiBlinkAdapter = {
  db: {
    users: makeEntityApi('users'),
    assets: makeEntityApi('assets'),
    issuances: makeEntityApi('issuances'),
    maintenance: makeEntityApi('maintenance'),
    stockTransactions: makeEntityApi('stockTransactions'),
    categories: makeEntityApi('categories'),
    departments: makeEntityApi('departments'),
    vendors: makeEntityApi('vendors'),
    financeProfiles: makeEntityApi('financeProfiles'),
    financeAssetOverrides: makeEntityApi('financeAssetOverrides'),
    batch: async (statements: Array<{ sql: string }>, mode: 'write' | 'read' = 'write') => {
      if (provider !== 'api') throw new Error('API provider is not enabled')
      return apiClient.post<{ affectedRows: number }>(`/api/compat/db/batch`, { statements: statements.map(s => ({ sql: s.sql })), mode })
    }
  },
  auth: {
    onAuthStateChanged: (listener: (state: AuthState) => void) => {
      listeners.add(listener)
      listener(authState)
      void refreshAuth()
      return () => listeners.delete(listener)
    },
    login,
    signOut
  },
  notifications: {
    email: (payload: { to: string; subject: string; html: string }) => {
      if (provider !== 'api') throw new Error('API provider is not enabled')
      return apiClient.post(`/api/compat/notifications/email`, payload)
    }
  }
}
