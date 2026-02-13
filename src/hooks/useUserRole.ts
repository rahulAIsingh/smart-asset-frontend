import { useState, useEffect } from 'react'
import { blink } from '../lib/blink'
import { useAuth } from './useAuth'

export type UserRole = 'admin' | 'user' | 'support' | 'pm' | 'boss'

export interface UserProfile {
    email: string
    role: UserRole
    department?: string
    name?: string
    avatar?: string
}

type DbUserProfile = UserProfile & { id: string }
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
                role: p.role,
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
        usersFetchPromise = blink.db.users.list()
            .then(data => {
                usersCache = data as DbUserProfile[]
                return usersCache
            })
            .finally(() => {
                usersFetchPromise = null
            })
    }
    return usersFetchPromise
}

export function useUserRole() {
    const { user } = useAuth()

    // List of admin emails
    const ADMIN_EMAILS = ['admin@demo.com', 'devopsazureai@gmail.com']
    const PM_EMAILS = ['pm@demo.com']
    const BOSS_EMAILS = ['boss@demo.com']

    const [role, setRoleInternal] = useState<UserRole | null>(() => {
        // Check if this is an admin from dev login
        const devUser = localStorage.getItem('sam_dev_user')
        if (devUser) {
            try {
                const parsed = JSON.parse(devUser)
                if (ADMIN_EMAILS.includes(parsed.email)) {
                    localStorage.setItem('sam_user_role', 'admin')
                    return 'admin'
                }
                if (PM_EMAILS.includes(parsed.email)) {
                    localStorage.setItem('sam_user_role', 'pm')
                    return 'pm'
                }
                if (BOSS_EMAILS.includes(parsed.email)) {
                    localStorage.setItem('sam_user_role', 'boss')
                    return 'boss'
                }
            } catch (e) {
                // ignore parse errors
            }
        }

        // Load role from localStorage
        const cached = localStorage.getItem('sam_user_role')
        return cached as UserRole | null
    })
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)

    // Protected setRole that prevents admin emails from being downgraded
    const setRole = (newRole: UserRole | null) => {
        if (user?.email && ADMIN_EMAILS.includes(user.email) && newRole !== 'admin') {
            console.warn('🛡️ BLOCKED: Attempt to set', user.email, 'to', newRole, '- keeping admin role')
            return
        }
        console.log('✅ Setting role to:', newRole, 'for', user?.email)
        setRoleInternal(newRole)
    }

    useEffect(() => {
        if (user?.email) {
            checkUserRole(user.email)
        } else {
            setLoading(false)
        }
    }, [user])

    const checkUserRole = async (email: string) => {
        try {
            // FORCE admin emails to admin IMMEDIATELY
            if (ADMIN_EMAILS.includes(email)) {
                console.log('🔧 FORCING', email, 'to admin role')
                setRole('admin')
                localStorage.setItem('sam_user_role', 'admin')

                // Then update database in background
                const users = await getUsersCached()
                const existingUser = users.find(u => u.email === email)

                if (existingUser) {
                    console.log('Found existing admin user:', email, 'Current DB role:', existingUser.role)
                    if (existingUser.role !== 'admin') {
                        console.log('Updating admin user role to "admin" in database...')
                        await blink.db.users.update(existingUser.id, { role: 'admin' })
                        if (usersCache) {
                            usersCache = usersCache.map(u => u.id === existingUser.id ? { ...u, role: 'admin' } : u)
                        }
                        console.log('✅ Database updated to admin')
                    }
                    const nextProfile: DbUserProfile = { ...existingUser, role: 'admin' }
                    setProfile(nextProfile)
                    upsertStoredProfile(nextProfile)
                    if (usersCache) {
                        usersCache = [...usersCache, nextProfile]
                    }
                } else {
                    console.log('Creating new admin user in database:', email)
                    const newAdmin: UserProfile = {
                        email,
                        role: 'admin',
                        name: user?.displayName || 'Admin User',
                        avatar: user?.photoURL || ''
                    }
                    await blink.db.users.create(newAdmin)
                    const nextProfile: DbUserProfile = { ...newAdmin, id: email }
                    setProfile(nextProfile)
                    upsertStoredProfile(nextProfile)
                }
                return
            }

            if (PM_EMAILS.includes(email)) {
                setRole('pm')
                localStorage.setItem('sam_user_role', 'pm')
                const users = await getUsersCached()
                const existingUser = users.find(u => u.email === email)
                if (existingUser) {
                    if (existingUser.role !== 'pm') {
                        await blink.db.users.update(existingUser.id, { role: 'pm' })
                        if (usersCache) {
                            usersCache = usersCache.map(u => u.id === existingUser.id ? { ...u, role: 'pm' } : u)
                        }
                    }
                    const nextProfile: DbUserProfile = { ...existingUser, role: 'pm' }
                    setProfile(nextProfile)
                    upsertStoredProfile(nextProfile)
                } else {
                    const newPm: UserProfile = {
                        email,
                        role: 'pm',
                        name: user?.displayName || 'PM User',
                        avatar: user?.photoURL || ''
                    }
                    await blink.db.users.create(newPm)
                    const nextProfile: DbUserProfile = { ...newPm, id: email }
                    setProfile(nextProfile)
                    upsertStoredProfile(nextProfile)
                }
                return
            }

            if (BOSS_EMAILS.includes(email)) {
                setRole('boss')
                localStorage.setItem('sam_user_role', 'boss')
                const users = await getUsersCached()
                const existingUser = users.find(u => u.email === email)
                if (existingUser) {
                    if (existingUser.role !== 'boss') {
                        await blink.db.users.update(existingUser.id, { role: 'boss' })
                        if (usersCache) {
                            usersCache = usersCache.map(u => u.id === existingUser.id ? { ...u, role: 'boss' } : u)
                        }
                    }
                    const nextProfile: DbUserProfile = { ...existingUser, role: 'boss' }
                    setProfile(nextProfile)
                    upsertStoredProfile(nextProfile)
                } else {
                    const newBoss: UserProfile = {
                        email,
                        role: 'boss',
                        name: user?.displayName || 'Boss User',
                        avatar: user?.photoURL || ''
                    }
                    await blink.db.users.create(newBoss)
                    const nextProfile: DbUserProfile = { ...newBoss, id: email }
                    setProfile(nextProfile)
                    upsertStoredProfile(nextProfile)
                }
                return
            }

            // For other users, do normal flow
            const users = await getUsersCached()
            const existingUser = users.find(u => u.email === email)

            if (existingUser) {
                setRole(existingUser.role)
                setProfile(existingUser)
                localStorage.setItem('sam_user_role', existingUser.role)
                upsertStoredProfile(existingUser)
            } else {
                // New users default to 'user' role
                const newRole: UserRole = 'user'

                const newProfile: UserProfile = {
                    email,
                    role: newRole,
                    name: user?.displayName || email.split('@')[0],
                    avatar: user?.photoURL || ''
                }

                await blink.db.users.create(newProfile)
                setRole(newRole)
                setProfile(newProfile)
                localStorage.setItem('sam_user_role', newRole)
                const nextProfile: DbUserProfile = { ...newProfile, id: email }
                upsertStoredProfile(nextProfile)
                if (usersCache) {
                    usersCache = [...usersCache, nextProfile]
                }
            }
        } catch (error) {
            console.error('Error fetching user role:', error)
            const email = user?.email
            const storedProfiles = readStoredProfiles()
            const storedUser = storedProfiles.find(p => p.email === email)

            if (email && ADMIN_EMAILS.includes(email)) {
                const nextProfile: DbUserProfile = storedUser || {
                    id: email,
                    email,
                    role: 'admin',
                    name: user?.displayName || 'Admin User',
                    avatar: user?.photoURL || ''
                }
                setRole('admin')
                setProfile(nextProfile)
                localStorage.setItem('sam_user_role', 'admin')
                upsertStoredProfile(nextProfile)
            } else if (email && PM_EMAILS.includes(email)) {
                const nextProfile: DbUserProfile = storedUser || {
                    id: email,
                    email,
                    role: 'pm',
                    name: user?.displayName || 'PM User',
                    avatar: user?.photoURL || ''
                }
                setRole('pm')
                setProfile(nextProfile)
                localStorage.setItem('sam_user_role', 'pm')
                upsertStoredProfile(nextProfile)
            } else if (email && BOSS_EMAILS.includes(email)) {
                const nextProfile: DbUserProfile = storedUser || {
                    id: email,
                    email,
                    role: 'boss',
                    name: user?.displayName || 'Boss User',
                    avatar: user?.photoURL || ''
                }
                setRole('boss')
                setProfile(nextProfile)
                localStorage.setItem('sam_user_role', 'boss')
                upsertStoredProfile(nextProfile)
            } else if (email && storedUser) {
                setRole(storedUser.role)
                setProfile(storedUser)
                localStorage.setItem('sam_user_role', storedUser.role)
            } else if (email) {
                const fallbackProfile: DbUserProfile = {
                    id: email,
                    email,
                    role: 'user',
                    name: user?.displayName || email.split('@')[0],
                    avatar: user?.photoURL || ''
                }
                setRole('user')
                setProfile(fallbackProfile)
                localStorage.setItem('sam_user_role', 'user')
                upsertStoredProfile(fallbackProfile)
            } else {
                setRole('user')
            }
        } finally {
            setLoading(false)
        }
    }

    const updateProfile = async (updates: Partial<UserProfile>) => {
        if (!profile) return
        const localProfile: DbUserProfile = {
            ...(profile as DbUserProfile),
            ...updates,
            id: (profile as DbUserProfile).id || profile.email
        }
        setProfile(localProfile)
        upsertStoredProfile(localProfile)
        if (updates.role) {
            setRole(updates.role)
            localStorage.setItem('sam_user_role', updates.role)
        }
        try {
            // Find the user ID based on email (since we don't store ID in local state yet)
            const users = await getUsersCached()
            const userRecord = users.find(u => u.email === profile.email)

            if (userRecord) {
                await blink.db.users.update(userRecord.id, updates)
                const updated = { ...userRecord, ...updates, id: userRecord.id }
                upsertStoredProfile(updated)
                if (usersCache) {
                    usersCache = usersCache.map(u => u.id === userRecord.id ? updated : u)
                }
            }
        } catch (error) {
            console.warn('Error updating profile in DB, changes kept locally:', error)
        }
    }

    return {
        role,
        profile,
        loading,
        isAdmin: role === 'admin',
        isUser: role === 'user',
        isSupport: role === 'support',
        isPm: role === 'pm',
        isBoss: role === 'boss',
        updateProfile
    }
}
