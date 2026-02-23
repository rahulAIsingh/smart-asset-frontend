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

const provider = (import.meta.env.VITE_DATA_PROVIDER || 'api').toLowerCase()
const authority = import.meta.env.VITE_AUTH_AUTHORITY || ''
const clientId = import.meta.env.VITE_AUTH_CLIENT_ID || ''
const tenantId = import.meta.env.VITE_AUTH_TENANT_ID || ''
const configuredRedirectUri = import.meta.env.VITE_AUTH_REDIRECT_URI || ''
const appBase = import.meta.env.BASE_URL || '/'
const fallbackRedirectUri = (() => {
  const url = new URL(appBase, window.location.origin)
  const value = url.toString().replace(/\/$/, '')
  return value || window.location.origin
})()
const redirectUri = (() => {
  if (!configuredRedirectUri) return fallbackRedirectUri
  const normalizedConfigured = configuredRedirectUri.trim().toLowerCase()
  if (normalizedConfigured.includes('/assetmanagementapi')) {
    console.warn('VITE_AUTH_REDIRECT_URI points to API path. Falling back to app URL for OAuth redirect.')
    return fallbackRedirectUri
  }
  return configuredRedirectUri
})()
const authScope = import.meta.env.VITE_AUTH_SCOPE || 'openid profile email'
const expectedAudience = import.meta.env.VITE_AUTH_AUDIENCE || (clientId ? `api://${clientId}` : '')
const AUTH_EMAIL_HINT_KEY = 'sam_auth_email_hint'
const AUTH_NONCE_KEY = 'sam_auth_nonce'

const emit = () => listeners.forEach(listener => listener(authState))

const setAuth = (state: AuthState) => {
  authState = state
  emit()
}

const parseHashToken = () => {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
  if (!hash) return
  const params = new URLSearchParams(hash)
  const error = params.get('error')
  const errorDescription = params.get('error_description')
  if (error) {
    localStorage.removeItem('sam_access_token')
    localStorage.setItem('sam_auth_last_error', `${error}: ${errorDescription || 'Unknown auth error'}`)
    return
  }
  const idToken = params.get('id_token')
  if (idToken) {
    const hint = extractEmailHint(decodeJwtPayload(idToken))
    if (hint) localStorage.setItem(AUTH_EMAIL_HINT_KEY, hint)
  }

  const token = params.get('access_token')
  if (token) {
    localStorage.setItem('sam_access_token', token)
    localStorage.removeItem('sam_auth_last_error')
    window.history.replaceState({}, document.title, window.location.pathname + window.location.search)
    return
  }

  if (params.get('id_token') && !params.get('access_token')) {
    localStorage.removeItem('sam_access_token')
    localStorage.setItem(
      'sam_auth_last_error',
      'SSO returned ID token but no access token. Enable Access tokens in Entra app Authentication settings.'
    )
    window.history.replaceState({}, document.title, window.location.pathname + window.location.search)
  }
}

const decodeJwtPayload = (token: string): Record<string, any> | null => {
  try {
    const [, payload] = token.split('.')
    if (!payload) return null
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(base64)
    return JSON.parse(json)
  } catch {
    return null
  }
}

const extractEmailHint = (claims: Record<string, any> | null): string => {
  if (!claims) return ''
  const candidates = [claims.email, claims.preferred_username, claims.upn, claims.unique_name]
  const selected = candidates.find(v => typeof v === 'string' && String(v).includes('@'))
  return selected ? String(selected).trim().toLowerCase() : ''
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

  const payload = decodeJwtPayload(token)
  if (expectedAudience && payload?.aud && String(payload.aud) !== expectedAudience) {
    localStorage.setItem(
      'sam_auth_last_error',
      `Token audience mismatch. Expected ${expectedAudience} but got ${String(payload.aud)}.`
    )
    localStorage.removeItem('sam_access_token')
  localStorage.removeItem(AUTH_EMAIL_HINT_KEY)
  setAuth({ user: null, isLoading: false })
    return
  }

  try {
    const data = await apiClient.get<{ user?: ApiAuthUser }>(`/api/auth/me`)
    const user = data.user || null
    if (user) {
      if (!user.email || !user.email.includes('@')) {
        const hint = localStorage.getItem(AUTH_EMAIL_HINT_KEY)
        if (hint && hint.includes('@')) user.email = hint
      }
      user.role = user.role || mapRole(user.roles)
    }
    setAuth({ user, isLoading: false })
  } catch (error: any) {
    const msg = error?.message || 'Failed to validate token with backend (/api/auth/me).'
    localStorage.setItem('sam_auth_last_error', msg)
    console.error('Auth refresh failed:', msg)
    localStorage.removeItem('sam_access_token')
  localStorage.removeItem(AUTH_EMAIL_HINT_KEY)
  setAuth({ user: null, isLoading: false })
  }
}

const login = async () => {
  if (provider !== 'api') return
  localStorage.removeItem('sam_access_token')
  localStorage.removeItem('sam_auth_last_error')
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  localStorage.setItem(AUTH_NONCE_KEY, nonce)
  const resolvedAuthority = authority || (tenantId ? `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize` : '')
  if (!resolvedAuthority || !clientId) {
    throw new Error('Missing Entra auth configuration in VITE_AUTH_* env vars')
  }

  const authUrl = new URL(resolvedAuthority)
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('response_type', 'token id_token')
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', authScope)
  authUrl.searchParams.set('response_mode', 'fragment')
  authUrl.searchParams.set('nonce', nonce)

  window.location.href = authUrl.toString()
}

const signOut = () => {
  localStorage.removeItem('sam_access_token')
  localStorage.removeItem(AUTH_EMAIL_HINT_KEY)
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

export const apiAdapter = {
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
    },
    testEmail: (payload: { to: string }) => {
      if (provider !== 'api') throw new Error('API provider is not enabled')
      return apiClient.post<{ ok: boolean; message?: string; error?: string; detail?: string; inner?: string }>(
        `/api/compat/notifications/email/test`,
        payload
      )
    },
  }
}


