import { useState, useEffect } from 'react'
import { dataClient } from '../lib/dataClient'

export type UserRole = 'admin' | 'user' | 'support' | 'pm' | 'boss'

export type AppUser = {
  id: string
  email?: string
  displayName?: string
  firstName?: string
  lastName?: string
  photoURL?: string
  createdAt?: string
  updatedAt?: string
}

type AuthSnapshot = {
  user: AppUser | null
  loading: boolean
}

let authSnapshot: AuthSnapshot = { user: null, loading: true }
let authInitialized = false
let authUnsubscribe: (() => void) | null = null
const authListeners = new Set<(snapshot: AuthSnapshot) => void>()

const emitAuthSnapshot = () => {
  authListeners.forEach(listener => listener(authSnapshot))
}

const setAuthSnapshot = (next: AuthSnapshot) => {
  authSnapshot = next
  emitAuthSnapshot()
}

const initAuthOnce = () => {
  if (authInitialized) return
  authInitialized = true

  const devUser = localStorage.getItem('sam_dev_user')
  if (devUser) {
    setAuthSnapshot({ user: JSON.parse(devUser), loading: false })
    return
  }

  authUnsubscribe = dataClient.auth.onAuthStateChanged((state: { user: AppUser | null; isLoading?: boolean; loading?: boolean }) => {
    setAuthSnapshot({ user: state.user, loading: Boolean(state.isLoading ?? state.loading) })
  })
}

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(authSnapshot.user)
  const [loading, setLoading] = useState(authSnapshot.loading)

  useEffect(() => {
    initAuthOnce()
    const listener = (snapshot: AuthSnapshot) => {
      setUser(snapshot.user)
      setLoading(snapshot.loading)
    }
    authListeners.add(listener)
    listener(authSnapshot)
    return () => {
      authListeners.delete(listener)
      if (authListeners.size === 0 && authUnsubscribe) {
        authUnsubscribe()
        authUnsubscribe = null
        authInitialized = false
      }
    }
  }, [])

  const login = () => dataClient.auth.login()

  const devLogin = (email: string, role: UserRole) => {
    const fakeUser = {
      id: email,
      email,
      firstName: role === 'admin' ? 'Admin' : 'User',
      lastName: 'Demo',
      displayName: role === 'admin' ? 'Admin Demo' : 'User Demo',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as AppUser

    localStorage.setItem('sam_dev_user', JSON.stringify(fakeUser))
    setAuthSnapshot({ user: fakeUser, loading: false })
  }

  const logout = () => {
    localStorage.removeItem('sam_dev_user')
    dataClient.auth.signOut()
    setAuthSnapshot({ user: null, loading: false })
  }

  return { user, loading, login, devLogin, logout, isAuthenticated: !!user }
}

