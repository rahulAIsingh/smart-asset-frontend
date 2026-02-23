import React, { useEffect, useMemo, useState } from 'react'
import { Bell, Search, User, LogOut, Menu } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useUserRole } from '../../hooks/useUserRole'
import { requestsClient, type AssetRequest } from '../../lib/api/requestsClient'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '../ui/dropdown-menu'
import { Button } from '../ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { normalizeRole } from '../../lib/rbac'

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, logout } = useAuth()
  const { role, isAdmin } = useUserRole()
  const [loadingNotifications, setLoadingNotifications] = useState(false)
  const [requestNotifications, setRequestNotifications] = useState<AssetRequest[]>([])

  useEffect(() => {
    if (!user?.email) return
    void loadNotifications()
  }, [user?.email, role])

  const loadNotifications = async () => {
    if (!user?.email) return

    try {
      setLoadingNotifications(true)
      if (isAdmin) {
        const [pm, boss, it] = await Promise.all([
          requestsClient.list({ status: 'pending_pm', limit: 20 }),
          requestsClient.list({ status: 'pending_boss', limit: 20 }),
          requestsClient.list({ status: 'pending_it_fulfillment', limit: 20 })
        ])
        const combined = [...pm, ...boss, ...it]
        combined.sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))
        setRequestNotifications(combined.slice(0, 8))
        return
      }

      const [pendingMine, mine] = await Promise.all([
        requestsClient.pendingMe(user.email, role || 'user'),
        requestsClient.list({ requesterEmail: user.email, limit: 20 })
      ])

      const byId = new Map<string, AssetRequest>()
      pendingMine.forEach(r => byId.set(r.id, r))
      mine.filter(r => r.status !== 'closed').forEach(r => byId.set(r.id, r))

      const merged = Array.from(byId.values()).sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))
      setRequestNotifications(merged.slice(0, 8))
    } catch {
      setRequestNotifications([])
    } finally {
      setLoadingNotifications(false)
    }
  }

  const notificationCount = requestNotifications.length

  const dropdownTitle = useMemo(() => {
    if (isAdmin) return 'IT/Admin Notifications'
    return 'My Notifications'
  }, [isAdmin])

  const roleCode = normalizeRole(role)

  return (
    <header className="h-16 border-b bg-background/80 backdrop-blur-md sticky top-0 z-30 px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button 
          className="lg:hidden p-2 hover:bg-muted rounded-md" 
          onClick={onMenuClick}
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="relative hidden md:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search assets, serials..." 
            className="pl-10 pr-4 py-2 bg-muted/50 border-none rounded-full text-sm w-64 focus:ring-2 focus:ring-primary/20 transition-all outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative rounded-full">
              <Bell className="w-5 h-5 text-muted-foreground" />
              {notificationCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-background" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>{dropdownTitle}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {loadingNotifications && (
              <DropdownMenuItem>
                <span className="text-sm text-muted-foreground">Loading...</span>
              </DropdownMenuItem>
            )}
            {!loadingNotifications && requestNotifications.length === 0 && (
              <DropdownMenuItem>
                <span className="text-sm text-muted-foreground">No notifications</span>
              </DropdownMenuItem>
            )}
            {!loadingNotifications && requestNotifications.map((req) => (
              <DropdownMenuItem key={req.id} className="cursor-pointer">
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase text-muted-foreground">{req.status.replace(/_/g, ' ')}</span>
                  <span className="text-sm">{req.requestNumber} - {req.requestType}</span>
                  <span className="text-xs text-muted-foreground">
                    {isAdmin ? `Requester: ${req.requesterEmail}` : `Owner: ${req.currentApprovalLevel.toUpperCase()}`}
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar className="h-10 w-10 border-2 border-primary/10">
                <AvatarImage src={user?.photoURL} alt={user?.displayName || 'User'} />
                <AvatarFallback className="bg-primary/5 text-primary">
                  {user?.displayName?.[0] || user?.email?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.displayName || 'Admin User'}</p>
                <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                <p className="text-xs leading-none text-primary">{`Role = ${roleCode}`}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onClick={() => logout()}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
