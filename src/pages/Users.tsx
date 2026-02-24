import React, { useEffect, useState } from 'react'
import { dataClient } from '../lib/dataClient'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '../components/ui/table'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'
import { Shield, User as UserIcon, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "../components/ui/dropdown-menu"
import type { UserProfile, UserRole } from '../hooks/useUserRole'
import { ROLE_META, USER_ROLES } from '../lib/rbac'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'

type DbUser = UserProfile & { id: string }
const USER_PROFILES_KEY = 'sam_user_profiles'

const readStoredUsers = (): DbUser[] => {
    try {
        const raw = localStorage.getItem(USER_PROFILES_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        return parsed
            .filter((u: any) => u?.email && u?.role)
            .map((u: any) => ({
                id: u.id || u.email,
                email: u.email,
                role: u.role,
                department: u.department,
                name: u.name,
                avatar: u.avatar
            }))
    } catch {
        return []
    }
}

const writeStoredUsers = (users: DbUser[]) => {
    localStorage.setItem(USER_PROFILES_KEY, JSON.stringify(users))
}

export function Users() {
    const [users, setUsers] = useState<DbUser[]>([])
    const [loading, setLoading] = useState(true)
    const [newUser, setNewUser] = useState({ name: '', email: '', role: 'user' as UserRole })

    useEffect(() => {
        fetchUsers()
    }, [])

    const fetchUsers = async () => {
        try {
            console.log('🔍 Fetching database users...')
            const data = await dataClient.db.users.list() as DbUser[]
            console.log('✅ Users fetched:', data)
            setUsers(data)
            writeStoredUsers(data)
        } catch (error) {
            console.error('❌ Failed to fetch users:', error)
            const fallback = readStoredUsers()
            setUsers(fallback)
            toast.error('Users API unavailable, showing local users')
        } finally {
            setLoading(false)
        }
    }

    const handleUpdateRole = async (user: DbUser, newRole: UserRole) => {
        if (user.role === newRole) return
        if (!confirm(`Are you sure you want to change ${user.email}'s role to ${newRole}?`)) return

        // Optimistic update
        const nextUsers = users.map(u => u.id === user.id ? { ...u, role: newRole } : u)
        setUsers(nextUsers)
        writeStoredUsers(nextUsers)

        try {
            await dataClient.db.users.update(user.id, { role: newRole })
            toast.success(`Role updated to ${newRole}`)
        } catch (error) {
            console.error('❌ Failed to update role:', error)
            toast.success(`Role updated locally to ${newRole}`)
        }
    }

    const handleAddUser = async () => {
        const email = newUser.email.trim().toLowerCase()
        const name = newUser.name.trim()
        if (!email || !email.includes('@')) {
            toast.error('Enter valid user email')
            return
        }
        if (users.some(u => u.email.toLowerCase() === email)) {
            toast.error('User already exists')
            return
        }

        const payload: UserProfile = {
            email,
            role: newUser.role,
            name: name || email.split('@')[0],
            avatar: ''
        }

        try {
            const created = await dataClient.db.users.create(payload as unknown as Record<string, unknown>) as DbUser
            const next = [...users, { ...payload, id: created?.id || email }]
            setUsers(next)
            writeStoredUsers(next)
            setNewUser({ name: '', email: '', role: 'user' })
            toast.success('User added')
        } catch (error) {
            console.error('Failed to add user:', error)
            toast.error('Failed to add user')
        }
    }

    const handleDeleteUser = async (target: DbUser) => {
        if (!confirm(`Delete user ${target.email}?`)) return
        const next = users.filter(u => u.id !== target.id)
        setUsers(next)
        writeStoredUsers(next)
        try {
            await dataClient.db.users.delete(target.id)
            toast.success('User deleted')
        } catch (error) {
            console.error('Failed to delete user:', error)
            toast.error('Delete failed on server. Kept locally removed.')
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
                <p className="text-muted-foreground">Manage user access and roles.</p>
            </div>

            <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-4" data-tour="users-add-form">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div className="space-y-1">
                        <Label htmlFor="newUserName">Name</Label>
                        <Input
                            id="newUserName"
                            placeholder="User full name"
                            value={newUser.name}
                            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="newUserEmail">Email</Label>
                        <Input
                            id="newUserEmail"
                            placeholder="user@company.com"
                            value={newUser.email}
                            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label>Role</Label>
                        <Select value={newUser.role} onValueChange={(v: UserRole) => setNewUser({ ...newUser, role: v })}>
                            <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                            <SelectContent>
                                {USER_ROLES.map(role => (
                                    <SelectItem key={role} value={role}>{ROLE_META[role].label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={handleAddUser}>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Add User
                    </Button>
                </div>
            </div>

            <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden" data-tour="users-role-actions">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/30">
                            <TableHead>User</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={4} className="text-center">Loading...</TableCell></TableRow>
                        ) : users.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="text-center">No users found.</TableCell></TableRow>
                        ) : (
                            users.map(user => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={user.avatar} />
                                                <AvatarFallback>{user.name?.[0] || user.email[0].toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                            {user.name || 'Unknown'}
                                        </div>
                                    </TableCell>
                                    <TableCell className={!user.email.includes('@') ? 'text-amber-700 font-medium' : ''}>
                                        {user.email}
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={ROLE_META[user.role]?.badgeClass || ROLE_META.user.badgeClass}>
                                            {user.role === 'admin' ? <Shield className="w-3 h-3 mr-1" /> : <UserIcon className="w-3 h-3 mr-1" />}
                                            {ROLE_META[user.role]?.label || 'User'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm">Edit Role</Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Change Role</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                {USER_ROLES.map(role => (
                                                    <DropdownMenuItem key={role} onClick={() => handleUpdateRole(user, role)}>
                                                        Set as {ROLE_META[role].label}
                                                    </DropdownMenuItem>
                                                ))}
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem className="text-red-600 focus:text-red-700" onClick={() => handleDeleteUser(user)}>
                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                    Delete User
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}

