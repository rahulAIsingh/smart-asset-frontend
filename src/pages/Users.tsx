import React, { useEffect, useState } from 'react'
import { blink } from '../lib/blink'
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
import { Users as UsersIcon, Shield, User as UserIcon } from 'lucide-react'
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

    useEffect(() => {
        fetchUsers()
    }, [])

    const fetchUsers = async () => {
        try {
            console.log('🔍 Fetching database users...')
            const data = await blink.db.users.list() as DbUser[]
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
            await blink.db.users.update(user.id, { role: newRole })
            toast.success(`Role updated to ${newRole}`)
        } catch (error) {
            console.error('❌ Failed to update role:', error)
            toast.success(`Role updated locally to ${newRole}`)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
                <p className="text-muted-foreground">Manage user access and roles.</p>
            </div>

            <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
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
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell>
                                        {user.role === 'admin' ? (
                                            <Badge variant="default" className="bg-purple-600 hover:bg-purple-700">
                                                <Shield className="w-3 h-3 mr-1" /> Admin
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary">
                                                <UserIcon className="w-3 h-3 mr-1" /> User
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm">Edit Role</Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Change Role</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => handleUpdateRole(user, 'admin')}>
                                                    Make Admin
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleUpdateRole(user, 'user')}>
                                                    Make User
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
