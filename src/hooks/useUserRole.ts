import { useEffect, useState } from 'react'
import { dataClient } from '../lib/dataClient'
import { useAuth } from './useAuth'
import { hasPermission, normalizeRole, type AppPermission, type UserRole } from '../lib/rbac'

export type { UserRole } from '../lib/rbac'

export interface UserProfile {
  email: string
  role: UserRole
  department?: string
  name?: string
  avatar?: string
}

type DbUserProfile = UserProfile & { id: string }
const AUTH_EMAIL_HINT_KEY = 'sam_auth_email_hint'

const USER_PROFILES_KEY = 'sam_user_profiles'
let usersCache: DbUserProfile[] | null = null
let usersFetchPromise: Promise<DbUserProfile[]> | null = null

const readStoredProfiles = (): DbUserProfile[] => {
  try {
    const raw = localStorage.getItem(USER_PROFILES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((p: any) => p?.email && p?.role)
      .map((p: any) => ({
        id: p.id || p.email,
        email: p.email,
        role: normalizeRole(p.role),
        department: p.department,
        name: p.name,
        avatar: p.avatar
      }))
  } catch {
    return []
  }
}

const writeStoredProfiles = (profiles: DbUserProfile[]) => {
  localStorage.setItem(USER_PROFILES_KEY, JSON.stringify(profiles))
}

const upsertStoredProfile = (profile: DbUserProfile) => {
  const existing = readStoredProfiles()
  const next = [...existing.filter(p => p.email !== profile.email), profile]
  writeStoredProfiles(next)
  if (usersCache) {
    usersCache = [...usersCache.filter(p => p.email !== profile.email), profile]
  }
}

const getUsersCached = async () => {
  if (usersCache) return usersCache
  if (!usersFetchPromise) {
    usersFetchPromise = dataClient.db.users.list()
      .then(data => {
        usersCache = (data as DbUserProfile[]).map(u => ({ ...u, role: normalizeRole(u.role) }))
        return usersCache
      })
      .finally(() => {
        usersFetchPromise = null
      })
  }
  return usersFetchPromise
}

const getBootstrapAdminEmails = () => {
  const raw = String(import.meta.env.VITE_BOOTSTRAP_ADMIN_EMAILS || 'admin@demo.com,s.rahul@kavitechsolution.com')
  return raw
    .split(',')
    .map(v => v.trim().toLowerCase())
    .filter(Boolean)
}

export function useUserRole() {
  const { user } = useAuth()
  const [role, setRole] = useState<UserRole | null>(() => {
    const cached = localStorage.getItem('sam_user_role')
    return cached ? normalizeRole(cached) : null
  })
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const isValidEmail = (value?: string | null) => Boolean(value && value.includes('@'))

  useEffect(() => {
    const identity = (user?.email || localStorage.getItem(AUTH_EMAIL_HINT_KEY) || '').trim()
    if (identity) {
      void checkUserRole(identity)
    } else {
      setRole(null)
      setProfile(null)
      setLoading(false)
    }
  }, [user?.email, user?.id])

  const setLocalRoleAndProfile = (nextProfile: DbUserProfile) => {
    const nextRole = normalizeRole(nextProfile.role)
    const normalized = { ...nextProfile, role: nextRole }
    setRole(nextRole)
    setProfile(normalized)
    localStorage.setItem('sam_user_role', nextRole)
    upsertStoredProfile(normalized)
  }

  const checkUserRole = async (email: string) => {
    if (!isValidEmail(email)) {
      setLoading(false)
      return
    }
    try {
      const normalizedEmail = email.toLowerCase()
      const token = localStorage.getItem('sam_access_token') || ''
      const hintedRoleRaw = (localStorage.getItem('sam_user_role') || '').toLowerCase()
      const isHintedRoleValid = ['admin', 'support', 'pm', 'boss', 'user'].includes(hintedRoleRaw)

      // In E2E auth mode, trust deterministic role hint to avoid transient role flips.
      if (token.startsWith('e2e::') && isHintedRoleValid) {
        const hintedProfile: DbUserProfile = {
          id: email,
          email,
          role: hintedRoleRaw as UserRole,
          name: user?.displayName || email.split('@')[0],
          avatar: user?.photoURL || ''
        }
        setLocalRoleAndProfile(hintedProfile)
        return
      }

      const users = await getUsersCached()
      const existingUser = users.find(u => u.email.toLowerCase() === normalizedEmail)

      if (existingUser) {
        setLocalRoleAndProfile(existingUser)
        return
      }

      const bootstrapAdmins = getBootstrapAdminEmails()
      const shouldBootstrapAdmin = bootstrapAdmins.includes(normalizedEmail)
      const newRole: UserRole = shouldBootstrapAdmin ? 'admin' : 'user'
      const newProfile: UserProfile = {
        email,
        role: newRole,
        name: user?.displayName || email.split('@')[0],
        avatar: user?.photoURL || ''
      }

      await dataClient.db.users.create(newProfile as unknown as Record<string, unknown>)
      const nextProfile: DbUserProfile = { ...newProfile, id: email }
      setLocalRoleAndProfile(nextProfile)
      if (usersCache) {
        usersCache = [...usersCache.filter(p => p.email !== nextProfile.email), nextProfile]
      }
    } catch (error) {
      const storedProfiles = readStoredProfiles()
      const storedUser = storedProfiles.find(p => p.email.toLowerCase() === email.toLowerCase())

      if (storedUser) {
        setLocalRoleAndProfile(storedUser)
      } else {
        const hintedRoleRaw = (localStorage.getItem('sam_user_role') || '').toLowerCase()
        const hintedRole = ['admin', 'support', 'pm', 'boss', 'user'].includes(hintedRoleRaw)
          ? (hintedRoleRaw as UserRole)
          : null
        const bootstrapAdmins = getBootstrapAdminEmails()
        const fallbackRole: UserRole = hintedRole || (bootstrapAdmins.includes(email.toLowerCase()) ? 'admin' : 'user')
        const fallbackProfile: DbUserProfile = {
          id: email,
          email,
          role: fallbackRole,
          name: user?.displayName || email.split('@')[0],
          avatar: user?.photoURL || ''
        }
        setLocalRoleAndProfile(fallbackProfile)
      }
      console.warn('Role lookup fallback used:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!profile) return

    const localProfile: DbUserProfile = {
      ...(profile as DbUserProfile),
      ...updates,
      role: normalizeRole(updates.role || profile.role),
      id: (profile as DbUserProfile).id || profile.email
    }
    setLocalRoleAndProfile(localProfile)

    try {
      const users = await getUsersCached()
      const userRecord = users.find(u => u.email === profile.email)
      if (!userRecord) return

      await dataClient.db.users.update(userRecord.id, updates)
      const updated = { ...userRecord, ...updates, role: normalizeRole(updates.role || userRecord.role), id: userRecord.id }
      upsertStoredProfile(updated)
      if (usersCache) {
        usersCache = usersCache.map(u => (u.id === userRecord.id ? updated : u))
      }
    } catch (error) {
      console.warn('Error updating profile in DB, changes kept locally:', error)
    }
  }

  const can = (permission: AppPermission) => hasPermission(role, permission)

  return {
    role,
    profile,
    loading,
    isAdmin: role === 'admin',
    isUser: role === 'user',
    isSupport: role === 'support',
    isPm: role === 'pm',
    isBoss: role === 'boss',
    can,
    updateProfile
  }
}

