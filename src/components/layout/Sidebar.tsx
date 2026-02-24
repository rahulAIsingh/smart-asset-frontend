import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Laptop,
  ArrowRightLeft,
  Settings,
  Package,
  Menu,
  X,
  Ticket,
  Users as UsersIcon,
  LogOut,
  Database,
  Landmark,
  ClipboardCheck,
  Clock
} from 'lucide-react'
import { dataClient } from '../../lib/dataClient'
import { cn } from '../../lib/utils'

import { useUserRole } from '../../hooks/useUserRole'
import type { AppPermission, UserRole } from '../../lib/rbac'

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', permission: 'dashboard:view' as AppPermission },
  { icon: Laptop, label: 'My Assets', path: '/my-assets', permission: 'my_assets:view' as AppPermission },
  { icon: Ticket, label: 'Tickets', path: '/tickets', permission: 'tickets:view' as AppPermission },
  { icon: ClipboardCheck, label: 'Request Approvals', path: '/my-requests', permission: 'my_assets:view' as AppPermission, visibleRoles: ['user', 'pm', 'support'] as UserRole[] },
  { icon: Clock, label: 'My Request History', path: '/my-request-history', permission: 'my_assets:view' as AppPermission, visibleRoles: ['user', 'pm', 'support'] as UserRole[] },
  { icon: Laptop, label: 'All Assets', path: '/assets', permission: 'assets:view' as AppPermission },
  { icon: ArrowRightLeft, label: 'Issuance', path: '/issuance', permission: 'issuance:manage' as AppPermission },
  { icon: ClipboardCheck, label: 'Approvals', path: '/approvals', permission: 'approvals:view' as AppPermission },
  { icon: UsersIcon, label: 'Users', path: '/users', permission: 'users:manage' as AppPermission },
  { icon: Database, label: 'Data Management', path: '/data-management', permission: 'data:manage' as AppPermission },
  { icon: Package, label: 'Stock Transactions', path: '/stock', permission: 'stock:manage' as AppPermission },
  { icon: Landmark, label: 'Finance', path: '/finance', permission: 'finance:view' as AppPermission },
  { icon: Settings, label: 'Settings', path: '/settings', permission: 'settings:view' as AppPermission },
]

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const location = useLocation()
  const { can, role } = useUserRole()

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-all"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 w-64 bg-sidebar border-r border-sidebar-border z-50 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-6 border-b border-sidebar-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-xl tracking-tight text-sidebar-foreground">Asset Management</span>
            </div>
            <button className="lg:hidden p-2 hover:bg-sidebar-accent rounded-md" onClick={onClose}>
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
            {navItems
              .filter(item => can(item.permission) && (!item.visibleRoles || (role ? item.visibleRoles.includes(role) : false)))
              .map((item) => {
                const isActive = location.pathname === item.path
                const navTestId = item.path === '/' ? 'sidebar-link-root' : `sidebar-link-${item.path.slice(1).replace(/\//g, '-')}`
                const navTourId = item.path === '/' ? 'nav-root' : `nav-${item.path.slice(1).replace(/\//g, '-')}`
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => onClose()}
                    data-testid={navTestId}
                    data-tour={navTourId}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    )}
                  >
                    <item.icon className={cn("w-5 h-5", isActive ? "text-inherit" : "text-sidebar-foreground/50")} />
                    {item.label}
                  </Link>
                )
              })}
          </nav>

          {/* Footer Info */}
          <div className="p-4 border-t border-sidebar-border">
            <div className="bg-sidebar-accent/50 rounded-xl p-4 mb-2">
              <p className="text-xs font-medium text-sidebar-foreground/50 mb-1 uppercase tracking-wider">Internal Portal</p>
              <p className="text-sm font-semibold text-sidebar-foreground">v1.0.0-Beta</p>
            </div>
            <button
              onClick={() => {
                localStorage.removeItem('sam_user_role')
                dataClient.auth.signOut()
                localStorage.removeItem('sam_dev_user')
                window.location.reload()
              }}
              className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}


