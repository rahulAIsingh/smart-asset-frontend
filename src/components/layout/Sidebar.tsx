import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Laptop,
  ArrowRightLeft,
  History,
  Settings,
  Package,
  Menu,
  X,
  Ticket,
  Users as UsersIcon,
  LogOut,
  Database,
  Landmark,
  ClipboardCheck
} from 'lucide-react'
import { blink } from '../../lib/blink'
import { cn } from '../../lib/utils'

import { useUserRole } from '../../hooks/useUserRole'
import { useAuth } from '../../hooks/useAuth'

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', requiredRole: ['admin', 'support'] },
  { icon: Laptop, label: 'My Assets', path: '/my-assets', requiredRole: ['user', 'pm', 'boss', 'admin', 'support'] },
  { icon: Laptop, label: 'All Assets', path: '/assets', requiredRole: ['admin', 'support'] },
  { icon: ArrowRightLeft, label: 'Issuance', path: '/issuance', requiredRole: ['admin'] },
  { icon: Ticket, label: 'Tickets', path: '/tickets', requiredRole: ['admin', 'support'] },
  { icon: ClipboardCheck, label: 'Approvals', path: '/approvals', requiredRole: ['pm', 'boss', 'admin', 'support'] },
  { icon: UsersIcon, label: 'Users', path: '/users', requiredRole: ['admin'] },
  { icon: Database, label: 'Data Management', path: '/data-management', requiredRole: ['admin'] },
  { icon: Package, label: 'Stock Transactions', path: '/stock', requiredRole: ['admin'] },
  { icon: Landmark, label: 'Finance', path: '/finance', requiredRole: ['admin'] },
  { icon: Settings, label: 'Settings', path: '/settings', requiredRole: ['admin', 'pm', 'boss'] },
]

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const location = useLocation()
  const { role, loading } = useUserRole()
  const { user } = useAuth()

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
              <span className="font-bold text-xl tracking-tight text-sidebar-foreground">AssetManager</span>
            </div>
            <button className="lg:hidden p-2 hover:bg-sidebar-accent rounded-md" onClick={onClose}>
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
            {navItems
              .filter(item => role && item.requiredRole && item.requiredRole.includes(role))
              .map((item) => {
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => onClose()}
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
                blink.auth.signOut()
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
